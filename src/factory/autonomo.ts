// Modo autônomo: do card ao pull request, sem gate até o merge.
// A Factory clona o repositório num container, implementa, roda os testes do próprio
// repositório e abre o PR. Merge e deploy continuam com uma pessoa.

import { criarRascunhoAzure, type AzureDeps } from './azure.ts'
import { criarRascunhoGithub, type GithubDeps } from './github.ts'
import { dividirAzure, dividirRepositorio, segmento, validarBranch, varrerSegredos } from './guards.ts'
import { especificar, iniciar, parar } from './pipeline.ts'
import { PASTA_DO_REPOSITORIO, type Execucao, type Executor } from './sandbox.ts'
import type { Estado, PedidoBruto } from './schemas.ts'

export type Credenciais = {
  githubToken?: string
  azureOrg?: string
  azurePat?: string
}

export type Verificacao = {
  instalar: string | null
  verificar: string | null
  origem: string
}

/** Quem escreve o código: o agente construtor de verdade, ou um roteiro nos testes. */
export type Implementador = (contexto: {
  estado: Estado
  executor: Executor
  verificacao: Verificacao
  tentativa: number
  falhaAnterior: Execucao | null
}) => Promise<{ resumo: string }>

export type DepsAutonomo = {
  criarExecutor: (cardId: string) => Promise<Executor>
  implementador: Implementador
  credenciais?: Credenciais
  github?: GithubDeps
  azure?: AzureDeps
  tentativas?: number
}

const AUTOR = 'Super Factory <factory@super-factory.local>'

function agora(): string {
  return new Date().toISOString()
}

function anotarAuto(estado: Estado, estagio: Estado['estagio'], resumo: string, tipo: 'observed' | 'reported' = 'observed'): Estado {
  const sequencia = (estado.trilha.at(-1)?.sequencia ?? 0) + 1
  return {
    ...estado,
    estagio,
    atualizadoEm: agora(),
    trilha: [...estado.trilha, { sequencia, runId: estado.runId, em: agora(), estagio, tipo, resumo: resumo.slice(0, 500), ator: 'factory-autonoma' }],
  }
}

/** Branch de trabalho do card. Nunca main nem master. */
export function nomeDaBranch(estado: Estado): string {
  const slug = estado.card.titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return validarBranch(`factory/${estado.card.id.toLowerCase()}-${slug || 'card'}`)
}

/** URL de clone e o cabeçalho de autenticação, que vai só no env do comando. */
export function alvoDoClone(estado: Estado, credenciais: Credenciais): { url: string; env: Record<string, string> } {
  const { provedor, repositorio } = estado.card
  if (provedor === 'github') {
    const { owner, name } = dividirRepositorio(repositorio)
    const token = credenciais.githubToken?.trim()
    if (!token) throw new Error('Defina GITHUB_TOKEN para a Factory clonar e abrir o pull request.')
    return {
      url: `https://github.com/${owner}/${name}.git`,
      env: { FACTORY_GIT_AUTH: `Authorization: Basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}` },
    }
  }
  const { project, repository } = dividirAzure(repositorio)
  if (!repository) throw new Error('No Azure DevOps, informe projeto/repositorio para o modo autônomo.')
  const org = segmento(credenciais.azureOrg?.trim() ?? '', 'Organização')
  const pat = credenciais.azurePat?.trim()
  if (!pat) throw new Error('Defina AZURE_DEVOPS_PAT para a Factory clonar e abrir o pull request.')
  return {
    url: `https://dev.azure.com/${org}/${project}/_git/${repository}`,
    env: { FACTORY_GIT_AUTH: `Authorization: Basic ${Buffer.from(`:${pat}`).toString('base64')}` },
  }
}

/** Descobre como instalar e testar o projeto, só pelo que está no repositório. */
export async function descobrirVerificacao(executor: Executor): Promise<Verificacao> {
  const arquivos = (await executor.executar('ls -1a')).saida.split('\n').map((linha) => linha.trim())
  const tem = (nome: string) => arquivos.includes(nome)
  if (tem('package.json')) {
    const pacote = await executor.executar('cat package.json')
    let scripts: Record<string, string> = {}
    try {
      scripts = (JSON.parse(pacote.saida) as { scripts?: Record<string, string> }).scripts ?? {}
    } catch {}
    const gerenciador = tem('pnpm-lock.yaml') ? 'pnpm' : tem('yarn.lock') ? 'yarn' : 'npm'
    const instalar =
      gerenciador === 'pnpm'
        ? 'corepack enable && pnpm install --frozen-lockfile'
        : gerenciador === 'yarn'
          ? 'corepack enable && yarn install --frozen-lockfile'
          : tem('package-lock.json')
            ? 'npm ci'
            : 'npm install'
    const alvo = ['test', 'check'].find((nome) => scripts[nome] && !/no test specified/.test(scripts[nome] ?? ''))
    return { instalar, verificar: alvo ? `${gerenciador} run ${alvo}` : null, origem: `package.json (${gerenciador})` }
  }
  if (arquivos.some((nome) => /\.(sln|csproj)$/.test(nome))) return { instalar: 'dotnet restore', verificar: 'dotnet test --no-restore', origem: '.NET' }
  if (tem('go.mod')) return { instalar: 'go mod download', verificar: 'go test ./...', origem: 'go.mod' }
  if (tem('pyproject.toml') || tem('requirements.txt')) {
    const instalar = tem('requirements.txt') ? 'pip install -r requirements.txt' : 'pip install -e .'
    return { instalar, verificar: 'python -m pytest -q', origem: 'Python' }
  }
  if (tem('Makefile')) {
    const make = await executor.executar("grep -E '^test:' Makefile || true")
    return { instalar: null, verificar: make.saida.trim() ? 'make test' : null, origem: 'Makefile' }
  }
  return { instalar: null, verificar: null, origem: 'nenhum comando de teste encontrado' }
}

function rabo(execucao: Execucao, linhas = 30): string {
  const texto = `${execucao.saida}\n${execucao.erro}`.trim().split('\n')
  return texto.slice(-linhas).join('\n')
}

function checkDoSandbox(execucao: Execucao | null, verificacao: Verificacao): Estado['checks'][number] {
  if (!execucao) {
    return { nome: 'testes-no-sandbox', resultado: 'NOT_RUN', comando: null, evidencia: `Sem comando de teste no repositório (${verificacao.origem}).` }
  }
  const resultado = execucao.codigo === 0 && !execucao.estourou ? 'PASS' : 'FAIL'
  const status = execucao.estourou ? 'tempo esgotado' : `código de saída ${execucao.codigo}`
  return {
    nome: 'testes-no-sandbox',
    resultado,
    comando: execucao.comando,
    evidencia: `Observado no sandbox: ${status}, ${execucao.ms} ms.\n${rabo(execucao)}`.slice(0, 3000),
  }
}

export type ResultadoAutonomo = { estado: Estado; branch: string | null; verificacao: Verificacao | null }

/**
 * O que passa de uma fase para a outra. Vai para o snapshot do workflow, então
 * não carrega segredo nem o container: o token é recalculado das credenciais
 * e o container fica na sessão.
 */
export type ContextoAutonomo = ResultadoAutonomo & { estatistica: string | null }

/** O que vive só na memória durante a execução: o container do card. */
export type SessaoAutonomo = { executor: Executor | null }

export type FaseAutonomo = {
  id: string
  titulo: string
  descricao: string
  /** Verbos que o Studio gira enquanto a fase roda. */
  verbos: string[]
  executar: (contexto: ContextoAutonomo, deps: DepsAutonomo, sessao: SessaoAutonomo) => Promise<ContextoAutonomo>
}

function pararCom(contexto: ContextoAutonomo, motivo: string): ContextoAutonomo {
  return { ...contexto, estado: parar(contexto.estado, motivo) }
}

function executorDa(sessao: SessaoAutonomo): Executor {
  if (!sessao.executor) throw new Error('O sandbox deste card não está mais aberto. Rode o modo autônomo de novo.')
  return sessao.executor
}

export const FASES_AUTONOMO: FaseAutonomo[] = [
  {
    id: 'triar',
    titulo: 'Triar o card',
    descricao: 'Especifica o card, confere o repositório e as credenciais e escolhe a branch de trabalho. Nada roda ainda.',
    verbos: ['Triando…', 'Lendo o card…', 'Especificando…', 'Escolhendo a branch…'],
    async executar(contexto, deps) {
      const estado = especificar(contexto.estado)
      if (estado.parado) return { ...contexto, estado }
      try {
        alvoDoClone(estado, deps.credenciais ?? {})
        return { ...contexto, estado, branch: nomeDaBranch(estado) }
      } catch (erro) {
        return { ...contexto, estado: parar(estado, erro instanceof Error ? erro.message : 'Repositório inválido.') }
      }
    },
  },
  {
    id: 'abrir-sandbox',
    titulo: 'Abrir o sandbox',
    descricao: 'Sobe um container Docker isolado, só deste card. Todo código e todo teste rodam lá dentro.',
    verbos: ['Subindo o container…', 'Isolando o card…', 'Preparando o sandbox…'],
    async executar(contexto, deps, sessao) {
      try {
        sessao.executor = await deps.criarExecutor(contexto.estado.card.id)
      } catch (erro) {
        return pararCom(contexto, erro instanceof Error ? erro.message : 'O sandbox não abriu.')
      }
      const estado = anotarAuto(
        { ...contexto.estado, card: { ...contexto.estado.card, coluna: 'build', branchHead: contexto.branch } },
        'implementation',
        `Sandbox ${sessao.executor.tipo} aberto para ${contexto.estado.card.id}.`,
      )
      return { ...contexto, estado }
    },
  },
  {
    id: 'clonar-e-preparar',
    titulo: 'Clonar e preparar',
    descricao: 'Clona a branch base, cria a branch de trabalho e instala as dependências com o comando do próprio repositório.',
    verbos: ['Clonando…', 'Criando a branch…', 'Lendo o package.json…', 'Instalando dependências…'],
    async executar(contexto, deps, sessao) {
      const executor = executorDa(sessao)
      const alvo = alvoDoClone(contexto.estado, deps.credenciais ?? {})
      const branch = contexto.branch ?? nomeDaBranch(contexto.estado)
      const base = validarBranch(contexto.estado.card.branchBase)
      const clone = await executor.executar(
        `git -c http.extraHeader="$FACTORY_GIT_AUTH" clone --depth 50 --branch '${base}' '${alvo.url}' '${PASTA_DO_REPOSITORIO}'`,
        { cwd: '/workspace', env: alvo.env, timeoutMs: 5 * 60_000 },
      )
      if (clone.codigo !== 0) return pararCom(contexto, `O clone falhou: ${rabo(clone, 5)}`)
      await executor.executar(`git checkout -b '${branch}' && git config user.name 'Super Factory' && git config user.email 'factory@super-factory.local'`)
      let estado = anotarAuto(contexto.estado, 'implementation', `Repositório clonado na base ${base}. Branch ${branch}.`)
      const verificacao = await descobrirVerificacao(executor)
      if (verificacao.instalar) {
        const instalacao = await executor.executar(verificacao.instalar, { timeoutMs: 15 * 60_000 })
        estado = anotarAuto(estado, 'implementation', `Dependências: ${verificacao.instalar} → código ${instalacao.codigo}.`)
        if (instalacao.codigo !== 0) return { ...contexto, verificacao, estado: parar(estado, `A instalação falhou: ${rabo(instalacao, 5)}`) }
      }
      return { ...contexto, estado, verificacao }
    },
  },
  {
    id: 'construir-e-testar',
    titulo: 'Construir e testar',
    descricao: 'O agente construtor escreve o código e a Factory roda os testes do repositório. Se falhar, ele lê o erro e tenta de novo.',
    verbos: ['Lendo o código…', 'Escrevendo…', 'Rodando os testes…', 'Lendo o erro…', 'Corrigindo…', 'Conferindo evidência…'],
    async executar(contexto, deps, sessao) {
      const executor = executorDa(sessao)
      const verificacao = contexto.verificacao ?? (await descobrirVerificacao(executor))
      let estado = contexto.estado
      const tentativas = Math.max(1, deps.tentativas ?? 2)
      let teste: Execucao | null = null
      for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
        const { resumo } = await deps.implementador({ estado, executor, verificacao, tentativa, falhaAnterior: teste })
        estado = anotarAuto(estado, 'implementation', `Tentativa ${tentativa}: ${resumo}`, 'reported')
        teste = verificacao.verificar ? await executor.executar(verificacao.verificar, { timeoutMs: 20 * 60_000 }) : null
        estado = anotarAuto(estado, 'verification', teste ? `${verificacao.verificar} → código ${teste.codigo}.` : 'Sem comando de teste no repositório.')
        if (!teste || teste.codigo === 0) break
      }
      const check = checkDoSandbox(teste, verificacao)
      estado = { ...estado, checks: [...estado.checks.filter((item) => item.nome !== 'testes-no-sandbox'), check], evidencia: 'CURRENT', card: { ...estado.card, coluna: 'qa' } }
      return { ...contexto, estado, verificacao }
    },
  },
  {
    id: 'revisar-e-enviar',
    titulo: 'Revisar e enviar',
    descricao: 'Confere se houve mudança, procura segredo no diff, faz o commit e envia a branch. Nunca envia para main.',
    verbos: ['Lendo o diff…', 'Procurando segredo…', 'Fazendo o commit…', 'Enviando a branch…'],
    async executar(contexto, deps, sessao) {
      const executor = executorDa(sessao)
      const branch = contexto.branch ?? nomeDaBranch(contexto.estado)
      let estado = contexto.estado
      const mudancas = await executor.executar('git status --porcelain')
      if (!mudancas.saida.trim()) return pararCom(contexto, 'O agente não mudou nenhum arquivo.')
      const diff = await executor.executar('git add -A && git diff --cached')
      const segredos = varrerSegredos(diff.saida)
      if (segredos.encontrado) return pararCom(contexto, `O diff tem padrão de segredo (${segredos.rotulos.join(', ')}). Nada foi enviado.`)
      const estatistica = (await executor.executar('git diff --cached --stat')).saida.trim()
      const mensagem = `${estado.card.id}: ${estado.card.titulo}`.replace(/'/g, '')
      const commit = await executor.executar(`git commit -q -m '${mensagem}' --author='${AUTOR}'`)
      if (commit.codigo !== 0) return pararCom(contexto, `O commit falhou: ${rabo(commit, 5)}`)
      const alvo = alvoDoClone(estado, deps.credenciais ?? {})
      const push = await executor.executar(`git -c http.extraHeader="$FACTORY_GIT_AUTH" push -u origin '${branch}'`, { env: alvo.env, timeoutMs: 5 * 60_000 })
      if (push.codigo !== 0) return pararCom(contexto, `O push falhou: ${rabo(push, 5)}`)
      estado = anotarAuto({ ...estado, card: { ...estado.card, coluna: 'review' } }, 'delivery', `Branch ${branch} enviada.`)
      return { ...contexto, estado, estatistica }
    },
  },
  {
    id: 'abrir-pull-request',
    titulo: 'Abrir o pull request',
    descricao: 'Abre o PR com critérios de aceite e a evidência do sandbox. Pronto para revisão se os testes passaram; rascunho se não. O merge fica com uma pessoa.',
    verbos: ['Redigindo o PR…', 'Anexando a evidência…', 'Abrindo o pull request…', 'Esperando o gate…'],
    async executar(contexto, deps) {
      let estado = contexto.estado
      const branch = contexto.branch ?? nomeDaBranch(estado)
      const base = validarBranch(estado.card.branchBase)
      const check = estado.checks.find((item) => item.nome === 'testes-no-sandbox') ?? checkDoSandbox(null, contexto.verificacao ?? { instalar: null, verificar: null, origem: 'desconhecido' })
      const passou = check.resultado === 'PASS'
      const corpo = [
        `## ${estado.card.id}: ${estado.card.titulo}`,
        '',
        estado.card.descricao,
        '',
        '### Critérios de aceite',
        ...estado.card.criterios.map((criterio) => `- [ ] ${criterio}`),
        '',
        '### Evidência do sandbox',
        `- Teste: \`${check.comando ?? 'nenhum'}\` → **${check.resultado}**`,
        '',
        '```',
        check.evidencia.slice(0, 2500),
        '```',
        '',
        '### Arquivos',
        '```',
        (contexto.estatistica ?? '').slice(0, 2000),
        '```',
        '',
        passou
          ? 'Aberto pela Super Factory. Merge e deploy ficam com uma pessoa.'
          : 'Os testes não passaram no sandbox: aberto como rascunho. Merge e deploy ficam com uma pessoa.',
      ].join('\n')
      const titulo = `${estado.card.id}: ${estado.card.titulo}`.slice(0, 120)
      const pr =
        estado.card.provedor === 'github'
          ? await criarRascunhoGithub(estado.card.repositorio, titulo, corpo, base, branch, deps.github, { rascunho: !passou })
          : await criarRascunhoAzure(estado.card.repositorio, titulo, corpo, base, branch, deps.azure, { rascunho: !passou })
      estado = {
        ...estado,
        entrega: { modo: pr.modo, provedor: estado.card.provedor, ok: pr.ok, itemId: null, itemUrl: null, pullRequestId: pr.id, pullRequestUrl: pr.url, nota: pr.nota },
      }
      if (!pr.ok) return { ...contexto, estado: parar(estado, pr.nota) }
      estado = anotarAuto(estado, 'human-review', `${pr.nota} Aguardando revisão humana para o merge.`)
      return { ...contexto, estado: { ...estado, desfecho: 'em-andamento' } }
    },
  },
]

export function contextoInicial(pedido: PedidoBruto): ContextoAutonomo {
  return { estado: iniciar(pedido), branch: null, verificacao: null, estatistica: null }
}

/** Leva um pedido do card ao pull request. Para no primeiro bloqueio e explica. */
export async function executarAutonomo(pedido: PedidoBruto, deps: DepsAutonomo): Promise<ResultadoAutonomo> {
  let contexto = contextoInicial(pedido)
  const sessao: SessaoAutonomo = { executor: null }
  try {
    for (const fase of FASES_AUTONOMO) {
      contexto = await fase.executar(contexto, deps, sessao)
      if (contexto.estado.parado) break
    }
  } finally {
    await sessao.executor?.encerrar()
  }
  return { estado: contexto.estado, branch: contexto.branch, verificacao: contexto.verificacao }
}
