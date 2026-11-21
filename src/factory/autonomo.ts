// Modo autônomo: do card ao pull request, sem gate até o merge.
// A Factory clona o repositório num container, implementa, roda os testes do próprio
// repositório e abre o PR. Merge e deploy continuam com uma pessoa.

import { criarRascunhoAzure, type AzureDeps } from './azure.ts'
import { criarRascunhoGithub, type GithubDeps } from './github.ts'
import { comentarIssueGithub } from './github-escrita.ts'
import { chaveDaIssue } from './gatilhos.ts'
import { dividirAzure, dividirRepositorio, segmento, validarBranch, varrerSegredos } from './guards.ts'
import { especificar, iniciar, parar } from './pipeline.ts'
import { PASTA_DO_REPOSITORIO, type Execucao, type Executor } from './sandbox.ts'
import type { Card, Estado, PedidoBruto } from './schemas.ts'
import { auditarAcoes, extrasDoNode, lerConvencoes, rodarBaseline, rodarExtras, verificarVermelhoVerde, veredito, type AcaoDoConstrutor, type Verificacao } from './verificacao.ts'
import { persistir } from './store.ts'

export type { Verificacao } from './verificacao.ts'

export type Credenciais = {
  githubToken?: string
  azureOrg?: string
  azurePat?: string
}

/** Quem escreve o código: o agente construtor de verdade, ou um roteiro nos testes. */
export type Implementador = (contexto: {
  estado: Estado
  executor: Executor
  verificacao: Verificacao
  tentativa: number
  falhaAnterior: Execucao | null
  /** O que o próprio repositório pede de quem contribui (AGENTS.md, CLAUDE.md, CONTRIBUTING). Texto do projeto, não ordem da Factory. */
  convencoes?: string | null
}) => Promise<{ resumo: string; uso?: { entrada: number; saida: number }; acoes?: AcaoDoConstrutor[] }>

export type DepsAutonomo = {
  criarExecutor: (cardId: string) => Promise<Executor>
  implementador: Implementador
  credenciais?: Credenciais
  github?: GithubDeps
  azure?: AzureDeps
  tentativas?: number
  /** Comenta na issue de origem quando o PR abre. O ensaio desliga: nada pode tocar um repositório de verdade. Padrão: liga. */
  comentarNaDemanda?: boolean
  /** Verificação completa: baseline antes da mudança, lint, typecheck e build como checks, e vermelho→verde em bug. Mais tempo por card; padrão: desligada aqui, ligada no ambiente real. */
  verificacaoCompleta?: boolean
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
    const verificar = alvo ? `${gerenciador} run ${alvo}` : null
    return { instalar, verificar, origem: `package.json (${gerenciador})`, extras: extrasDoNode(scripts, gerenciador, verificar) }
  }
  if (arquivos.some((nome) => /\.(sln|csproj)$/.test(nome))) return { instalar: 'dotnet restore', verificar: 'dotnet test --no-restore', origem: '.NET', extras: [{ nome: 'build', comando: 'dotnet build --no-restore' }] }
  if (tem('go.mod')) return { instalar: 'go mod download', verificar: 'go test ./...', origem: 'go.mod', extras: [{ nome: 'lint', comando: 'go vet ./...' }, { nome: 'build', comando: 'go build ./...' }] }
  if (tem('pyproject.toml') || tem('requirements.txt')) {
    const instalar = tem('requirements.txt') ? 'pip install -r requirements.txt' : 'pip install -e .'
    // pytest só quando o projeto o declara. Sem sinal, vale o unittest, que já vem com o Python.
    const sinais = await executor.executar("{ grep -qiE 'pytest' requirements*.txt pyproject.toml setup.cfg tox.ini 2>/dev/null && echo pytest; ls pytest.ini conftest.py 2>/dev/null | head -1; } || true")
    const usaPytest = sinais.saida.trim().length > 0
    return usaPytest
      ? { instalar, verificar: 'python -m pytest -q', origem: 'Python (pytest)' }
      : { instalar, verificar: 'python -m unittest discover', origem: 'Python (unittest)' }
  }
  if (tem('Makefile')) {
    const make = await executor.executar("grep -E '^test:' Makefile || true")
    return { instalar: null, verificar: make.saida.trim() ? 'make test' : null, origem: 'Makefile' }
  }
  return { instalar: null, verificar: null, origem: 'nenhum comando de teste encontrado' }
}

/**
 * Falta de ferramenta no container (pip, python, ffmpeg…) é problema da imagem do sandbox, que é do operador, e não
 * do card nem do código. Diz isso e o que fazer, em vez de deixar só "command not found".
 */
export function dicaDoSandbox(execucao: Execucao): string | null {
  const texto = `${execucao.saida}\n${execucao.erro}`
  if (/externally-managed-environment/i.test(texto)) {
    return 'O Python da imagem do sandbox é gerenciado pelo sistema (PEP 668) e recusa o pip. Isso é do ambiente, não do card: use a imagem de deploy/sandbox.Dockerfile (sudo bash /opt/super-factory/deploy/construir-sandbox.sh), que já libera o pip.'
  }
  const achou = /(?:bash|sh): (?:line \d+: )?([A-Za-z0-9_.+-]{1,40}): (?:command )?not found/.exec(texto)
  if (!achou && execucao.codigo !== 127) return null
  const ferramenta = achou?.[1] ?? 'um comando'
  const extra = /^(ffmpeg|ffprobe)$/.test(ferramenta) ? ' Para ffmpeg, rode o script com --com-ffmpeg.' : ''
  return `A imagem do sandbox não tem "${ferramenta}". Isso é do ambiente, não do card: o operador constrói a imagem com Python e git (sudo bash /opt/super-factory/deploy/construir-sandbox.sh) e aponta SUPER_FACTORY_SANDBOX_IMAGE para ela.${extra}`
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
    evidencia: `Observado no sandbox: ${status}, ${execucao.ms} ms.\n${resultado === 'FAIL' && dicaDoSandbox(execucao) ? `${dicaDoSandbox(execucao)}\n` : ''}${rabo(execucao)}`.slice(0, 3000),
  }
}

export type ResultadoAutonomo = { estado: Estado; branch: string | null; verificacao: Verificacao | null }

/**
 * O que passa de uma fase para a outra. Vai para o snapshot do workflow, então
 * não carrega segredo nem o container: o token é recalculado das credenciais
 * e o container fica na sessão.
 */
export type ContextoAutonomo = ResultadoAutonomo & {
  estatistica: string | null
  /** Branch do card pai, quando este card está empilhado sobre outro (PR em pilha). */
  pilha?: string | null
  /** Convenções lidas do repositório clonado. */
  convencoes?: string | null
}

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
        if (instalacao.codigo !== 0) return { ...contexto, verificacao, estado: parar(estado, `A instalação falhou: ${rabo(instalacao, 5)}${dicaDoSandbox(instalacao) ? ` ${dicaDoSandbox(instalacao)}` : ''}`) }
      }
      // O que o repositório pede de quem contribui entra no pedido do construtor.
      const convencoes = await lerConvencoes(executor)
      if (convencoes) estado = anotarAuto(estado, 'implementation', `Convenções do repositório lidas (${(convencoes.match(/^### /gm) ?? []).length} arquivo(s)).`)
      // Baseline: o que já falhava ANTES da mudança, para não culpar o card por uma falha antiga.
      if (deps.verificacaoCompleta) {
        const baseline = await rodarBaseline(executor, verificacao)
        estado = { ...estado, checks: [...estado.checks.filter((c) => !c.nome.startsWith('baseline:')), ...baseline] }
        if (baseline.length > 0) estado = anotarAuto(estado, 'verification', `Baseline antes da mudança: ${baseline.map((c) => `${c.nome.replace('baseline:', '')} ${c.resultado}`).join(', ')}.`)
      }
      return { ...contexto, estado, verificacao, convencoes }
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
      let ultimoResumo = ''
      for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
        const { resumo, uso, acoes } = await deps.implementador({ estado, executor, verificacao, tentativa, falhaAnterior: teste, convencoes: contexto.convencoes ?? null })
        ultimoResumo = resumo
        estado = anotarAuto(estado, 'implementation', `Tentativa ${tentativa}: ${resumo}`, 'reported')
        if (uso) estado = { ...estado, uso: { entrada: (estado.uso?.entrada ?? 0) + uso.entrada, saida: (estado.uso?.saida ?? 0) + uso.saida } }
        if (acoes?.length) estado = { ...estado, acoes: [...(estado.acoes ?? []), ...acoes.map((a) => ({ ...a, tentativa }))].slice(-300) }
        teste = verificacao.verificar ? await executor.executar(verificacao.verificar, { timeoutMs: 20 * 60_000 }) : null
        estado = anotarAuto(estado, 'verification', teste ? `${verificacao.verificar} → código ${teste.codigo}.` : 'Sem comando de teste no repositório.')
        if (!teste || teste.codigo === 0) break
      }
      const check = checkDoSandbox(teste, verificacao)
      estado = { ...estado, checks: [...estado.checks.filter((item) => item.nome !== 'testes-no-sandbox'), check], evidencia: 'CURRENT', card: { ...estado.card, coluna: 'qa' } }
      if (deps.verificacaoCompleta) {
        // Lint, typecheck e build: cada um é um check, comparado com o baseline.
        const extras = await rodarExtras(executor, verificacao.extras ?? [])
        // Bug: o teste novo precisa falhar sem a correção e passar com ela.
        const rv = check.resultado === 'PASS' ? await verificarVermelhoVerde(executor, verificacao, estado.card.rota) : null
        if (rv && !rv.restaurou) return pararCom({ ...contexto, estado, verificacao }, 'Não consegui devolver o código ao lugar depois de rodar os testes sem a correção. O trabalho do construtor está guardado no stash do sandbox; rode o card de novo.')
        const novos = [...extras, ...(rv ? [rv.check] : [])]
        const nomes = new Set(novos.map((c) => c.nome))
        estado = { ...estado, checks: [...estado.checks.filter((c) => !nomes.has(c.nome)), ...novos] }
        if (novos.length > 0) estado = anotarAuto(estado, 'verification', `Verificações: ${novos.map((c) => `${c.nome} ${c.resultado}`).join(', ')}.`)
      }
      // O que o construtor afirmou contra o que fez.
      const achadosDeAncoragem = auditarAcoes(ultimoResumo, estado.acoes ?? [])
      if (achadosDeAncoragem.length > 0) estado = { ...estado, achados: [...estado.achados.filter((a) => !a.id.startsWith('ANC-')), ...achadosDeAncoragem] }
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
      const ver = veredito({ checks: estado.checks.some((c) => c.nome === 'testes-no-sandbox') ? estado.checks : [...estado.checks, check] })
      const passou = ver.passou
      const achado = (nome: string) => estado.checks.find((c) => c.nome === nome)
      const linhasDeChecks = ['lint', 'typecheck', 'build', 'vermelho-verde'].flatMap((nome) => {
        const c = achado(nome)
        if (!c) return []
        const antes = achado(`baseline:${nome}`)
        return [`- ${nome === 'vermelho-verde' ? 'Vermelho→verde' : nome}${c.comando ? ` (\`${c.comando}\`)` : ''} → **${c.resultado}**${antes ? ` (antes da mudança: ${antes.resultado})` : ''}`]
      })
      const pontosDeAtencao = [...ver.notas, ...estado.achados.filter((a) => a.id.startsWith('ANC-')).map((a) => a.texto), ...(achado('vermelho-verde')?.resultado === 'NOT_RUN' ? [achado('vermelho-verde')!.evidencia] : [])]
      const corpo = [
        `## ${estado.card.id}: ${estado.card.titulo}`,
        '',
        estado.card.descricao,
        '',
        ...(issueDeOrigem(estado.card)
          ? [
              '### Demanda de origem',
              // Com os testes verdes e o PR direto na branch principal, o merge (de uma pessoa) fecha a issue. Em rascunho ou empilhado, só referencia.
              passou && !contexto.pilha ? `Closes #${issueDeOrigem(estado.card)}` : `Refs #${issueDeOrigem(estado.card)}`,
              '',
            ]
          : []),
        '### Critérios de aceite',
        ...estado.card.criterios.map((criterio) => `- [ ] ${criterio}`),
        '',
        '### Evidência do sandbox',
        `- Teste: \`${check.comando ?? 'nenhum'}\` → **${check.resultado}**${achado('baseline:testes') ? ` (antes da mudança: ${achado('baseline:testes')!.resultado})` : ''}`,
        ...linhasDeChecks,
        '',
        '```',
        check.evidencia.slice(0, 2500),
        '```',
        '',
        ...(pontosDeAtencao.length > 0 ? ['### Pontos de atenção', ...pontosDeAtencao.map((t) => `- ${t}`), ''] : []),
        '### Arquivos',
        '```',
        (contexto.estatistica ?? '').slice(0, 2000),
        '```',
        '',
        ...(contexto.pilha
          ? [
              '### Pull request em pilha',
              `Este PR está **empilhado** sobre a branch \`${contexto.pilha}\`, de outro card, e não direto sobre a branch principal. Faça o merge **de baixo para cima**: primeiro o PR da base. Depois confira se este passou a apontar para a branch principal.`,
              '',
            ]
          : []),
        passou
          ? 'Aberto pela Super Factory. Merge e deploy ficam com uma pessoa.'
          : `Aberto como rascunho: ${ver.motivos.join('; ')}. Merge e deploy ficam com uma pessoa.`,
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
      // Avisa na issue de origem, uma vez só (comentário com marcador). Falhar aqui não derruba o card: o PR já está aberto.
      const origem = issueDeOrigem(estado.card)
      if (origem && pr.modo === 'live' && pr.url && deps.comentarNaDemanda !== false) {
        const aviso = await comentarIssueGithub(
          estado.card.repositorio,
          origem,
          [`A Super Factory abriu o pull request ${pr.url} para esta issue.`, '', `- Testes no sandbox: **${check.resultado}** (\`${check.comando ?? 'nenhum'}\`).`, `- ${passou ? 'Pronto para revisão.' : `Aberto como rascunho: ${ver.motivos.join('; ')}.`}`, '- O merge é de uma pessoa.'].join('\n'),
          deps.github,
          { marcador: `pr:${pr.url}` },
        )
        estado = anotarAuto(estado, 'human-review', aviso.ok ? (aviso.jaExistia ? `A issue #${origem} já tinha o aviso deste PR.` : `Avisei na issue #${origem}.`) : `Não consegui avisar na issue #${origem}: ${aviso.nota}`, 'reported')
      }
      return { ...contexto, estado: { ...estado, desfecho: 'em-andamento' } }
    },
  },
]

/**
 * Um ensaio não pode parecer entrega de verdade: a entrega vira "fixture", sem número nem link de
 * pull request, e a trilha do card diz que nada foi clonado, escrito ou enviado.
 */
export function marcarEnsaio(estado: Estado): Estado {
  const entrega = estado.entrega
    ? {
        ...estado.entrega,
        modo: 'fixture' as const,
        pullRequestId: null,
        pullRequestUrl: null,
        nota: 'ENSAIO: nada foi clonado, escrito nem enviado, e nenhum pull request existe. Rode sem ensaio para valer.',
      }
    : estado.entrega
  return anotarAuto({ ...estado, entrega }, estado.estagio, 'ENSAIO: percurso simulado, com sandbox de mentira. Nenhum repositório foi tocado.', 'reported')
}

/** Número da issue de origem do card (GitHub), a partir da chave que o gatilho e a onda gravam em itemExterno. Só vale no mesmo repositório do card. */
export function issueDeOrigem(card: Pick<Card, 'itemExterno' | 'repositorio' | 'provedor'>): number | null {
  if (card.provedor !== 'github' || !card.itemExterno) return null
  const achado = /^issue:([A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100})#(\d{1,7})$/.exec(card.itemExterno)
  if (!achado || (achado[1] as string).toLowerCase() !== card.repositorio.toLowerCase()) return null
  return Number(achado[2])
}

/** Liga o card à issue de onde veio o pedido: o PR passa a referenciá-la e a Factory avisa nela. */
function ligarAIssue(estado: Estado, issue?: number): Estado {
  if (!issue || !Number.isInteger(issue) || issue < 1 || estado.card.provedor !== 'github') return estado
  return persistir({ ...estado, card: { ...estado.card, itemExterno: chaveDaIssue(estado.card.repositorio, issue) } })
}

export function contextoInicial(pedido: PedidoBruto, issue?: number): ContextoAutonomo {
  return { estado: ligarAIssue(iniciar(pedido), issue), branch: null, verificacao: null, estatistica: null }
}

/** Leva um pedido do card ao pull request. Para no primeiro bloqueio e explica. */
export async function executarAutonomo(pedido: PedidoBruto, deps: DepsAutonomo, opcoes: { pilha?: string; issue?: number } = {}): Promise<ResultadoAutonomo> {
  let contexto: ContextoAutonomo = { ...contextoInicial(pedido, opcoes.issue), pilha: opcoes.pilha ?? null }
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
