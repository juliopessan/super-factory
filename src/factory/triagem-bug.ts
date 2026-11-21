// Triagem automática de bug: antes de uma pessoa gastar tempo numa issue de bug, a Factory tenta REPRODUZI-LA no sandbox.
// Um agente escreve só um teste que falha por causa do bug (não corrige nada), e a Factory conclui:
//   reproduzido      o teste falha na versão atual
//   ja-corrigido     o teste falha na versão da época da issue e passa na atual
//   nao-reproduzido  o teste passa nas duas: falta informação na issue, ou o bug não existe como descrito
//   inconclusivo     não deu para isolar (sem comando de teste, a suíte já falhava, sem teste escrito)
// Só comenta na issue (uma vez, com marcador). Não abre PR, não muda código, não fecha a issue.

import { alvoDoCloneGithub, descobrirVerificacao, type Credenciais } from './autonomo.ts'
import { comentarIssueGithub } from './github-escrita.ts'
import type { GithubDeps } from './github.ts'
import { lerIssueGithub } from './github-leitura.ts'
import { dividirRepositorio, redigirSegredos } from './guards.ts'
import { PASTA_DO_REPOSITORIO, type Execucao, type Executor } from './sandbox.ts'
import { classificarArquivos, caminhoDeArquivoSeguro, lerConvencoes, type Verificacao } from './verificacao.ts'
import { gerarMapaDoRepositorio } from './mapa.ts'

export type VereditoDaTriagem = 'reproduzido' | 'ja-corrigido' | 'nao-reproduzido' | 'inconclusivo'
export type ResultadoDaTriagem = { veredito: VereditoDaTriagem; resumo: string; teste: { caminho: string; conteudo: string } | null; passos: string[] }

export type Reprodutor = (contexto: {
  issue: { numero: number; titulo: string; corpo: string }
  executor: Executor
  verificacao: Verificacao
  convencoes: string | null
  mapa: string | null
}) => Promise<{ resumo: string }>

export type DepsDaTriagem = {
  criarExecutor: (id: string) => Promise<Executor>
  reprodutor: Reprodutor
  credenciais?: Credenciais
  github?: GithubDeps
  /** Comentar na issue. Padrão: sim. */
  comentar?: boolean
}

const MARCADOR = 'triagem-bug'
const falhou = (e: Execucao) => e.codigo !== 0 || e.estourou
const rabo = (e: Execucao, n = 12) => `${e.saida}\n${e.erro}`.trim().split('\n').slice(-n).join('\n')

const TEXTO: Record<VereditoDaTriagem, string> = {
  reproduzido: '🔴 **Reproduzido.** Escrevi um teste que falha na versão atual da branch principal por causa do que a issue descreve.',
  'ja-corrigido': '🟢 **Provavelmente já corrigido na branch principal.** O teste de reprodução falha na versão da época da issue e passa na versão atual.',
  'nao-reproduzido': '⚪ **Não reproduzido.** O teste que escrevi a partir da descrição passa na versão atual. Falta informação na issue (passos, entrada, versão) ou o comportamento já está certo.',
  inconclusivo: '🟡 **Inconclusivo.** Não consegui isolar o bug.',
}

export function comentarioDaTriagem(r: ResultadoDaTriagem): string {
  return [
    TEXTO[r.veredito],
    '',
    r.resumo,
    ...(r.teste ? ['', `Teste de reprodução (\`${r.teste.caminho}\`):`, '```', r.teste.conteudo.slice(0, 1500), '```'] : []),
    '',
    '_Triagem automática: nada foi alterado no repositório e nenhum PR foi aberto. Uma pessoa decide o que fazer com esta issue._',
  ].join('\n')
}

export async function triarBug(repositorio: string, numero: number, deps: DepsDaTriagem): Promise<{ ok: boolean; resultado: ResultadoDaTriagem | null; nota: string }> {
  const nao = (nota: string) => ({ ok: false, resultado: null, nota })
  let alvo: ReturnType<typeof alvoDoCloneGithub>
  try {
    dividirRepositorio(repositorio)
    alvo = alvoDoCloneGithub(repositorio, deps.credenciais?.githubToken)
  } catch (erro) {
    return nao(erro instanceof Error ? erro.message : 'Repositório inválido.')
  }
  const lida = await lerIssueGithub(repositorio, numero, deps.github)
  if (!lida.ok || !lida.dado) return nao(lida.nota)
  const issue = lida.dado
  if (issue.ehPullRequest) return nao(`#${numero} é um pull request, não uma issue.`)
  if (issue.estado !== 'open') return nao(`A issue #${numero} não está aberta.`)
  const passos: string[] = []
  const concluir = async (veredito: VereditoDaTriagem, resumo: string, teste: ResultadoDaTriagem['teste'] = null) => {
    const resultado: ResultadoDaTriagem = { veredito, resumo, teste, passos }
    let nota = `Triagem de ${repositorio}#${numero}: ${veredito}.`
    if (deps.comentar !== false) {
      const c = await comentarIssueGithub(repositorio, numero, comentarioDaTriagem(resultado), deps.github, { marcador: MARCADOR })
      nota += c.ok ? (c.jaExistia ? ' A issue já tinha uma triagem: não comentei de novo.' : ' Comentei na issue.') : ` Não consegui comentar: ${c.nota}`
    }
    return { ok: true, resultado, nota }
  }
  const executor = await deps.criarExecutor(`triagem-${numero}`)
  try {
    const clone = await executor.executar(`git -c http.extraHeader="$FACTORY_GIT_AUTH" clone --depth 200 '${alvo.url}' '${PASTA_DO_REPOSITORIO}'`, { cwd: '/workspace', env: alvo.env, timeoutMs: 5 * 60_000 })
    if (clone.codigo !== 0) return nao(`O clone falhou: ${rabo(clone, 4)}`)
    await executor.executar("git config user.name 'Super Factory' && git config user.email 'factory@super-factory.local'")
    passos.push('Clonei a branch principal.')
    const verificacao = await descobrirVerificacao(executor)
    if (!verificacao.verificar) return concluir('inconclusivo', 'O repositório não tem um comando de teste que eu reconheça, então não tenho como provar um bug.')
    if (verificacao.instalar) {
      const inst = await executor.executar(verificacao.instalar, { timeoutMs: 15 * 60_000 })
      if (falhou(inst)) return concluir('inconclusivo', `A instalação das dependências falhou: ${rabo(inst, 4)}`)
    }
    const cabeca = (await executor.executar('git rev-parse HEAD')).saida.trim()
    const base = await executor.executar(verificacao.verificar, { timeoutMs: 20 * 60_000 })
    if (falhou(base)) return concluir('inconclusivo', 'A suíte já falha na branch principal, antes do teste de reprodução: não dá para isolar este bug.')
    passos.push('A suíte passa na branch principal.')
    const convencoes = await lerConvencoes(executor)
    const mapa = (await gerarMapaDoRepositorio(executor).catch(() => null))?.texto ?? null
    const feito = await deps.reprodutor({ issue: { numero, titulo: issue.titulo, corpo: issue.corpo }, executor, verificacao, convencoes, mapa })
    passos.push(`Reprodutor: ${feito.resumo.slice(0, 300)}`)
    // O reprodutor só escreve teste: qualquer mudança em código de produção é desfeita antes de medir.
    const mexidos = (await executor.executar('git ls-files -m -o --exclude-standard')).saida.split('\n').map((l) => l.trim()).filter(Boolean)
    const { testes, fontes } = classificarArquivos(mexidos)
    for (const f of fontes.filter(caminhoDeArquivoSeguro)) await executor.executar(`git checkout -q -- '${f}' 2>/dev/null || rm -f -- '${f}'`)
    if (fontes.length) passos.push(`Desfiz a mudança em ${fontes.length} arquivo(s) de código: a triagem só escreve teste.`)
    const seguros = testes.filter(caminhoDeArquivoSeguro)
    if (seguros.length === 0) return concluir('inconclusivo', 'O agente não conseguiu escrever um teste a partir da descrição da issue.')
    const conteudo = (await executor.executar(`cat '${seguros[0]}'`)).saida
    const teste = { caminho: seguros[0]!, conteudo: redigirSegredos(conteudo) }
    const agora = await executor.executar(verificacao.verificar, { timeoutMs: 20 * 60_000 })
    if (falhou(agora)) return concluir('reproduzido', `Na versão atual, \`${verificacao.verificar}\` falha com o teste novo:\n\n\`\`\`\n${redigirSegredos(rabo(agora, 10))}\n\`\`\``, teste)
    passos.push('O teste passa na versão atual.')
    // Passou agora: falhava na época da issue? Se sim, alguém já corrigiu.
    const quando = issue.criadaEm ? new Date(issue.criadaEm) : null
    const antigo = quando && !Number.isNaN(quando.getTime()) ? (await executor.executar(`git rev-list -1 --before='${quando.toISOString()}' HEAD`)).saida.trim() : ''
    if (/^[0-9a-f]{40}$/.test(antigo) && antigo !== cabeca) {
      await executor.executar('git stash push -u -q')
      const troca = await executor.executar(`git checkout -q ${antigo}`)
      await executor.executar('git stash pop -q')
      const naEpoca = troca.codigo === 0 ? await executor.executar(verificacao.verificar, { timeoutMs: 20 * 60_000 }) : null
      await executor.executar('git stash push -u -q')
      await executor.executar(`git checkout -q ${cabeca}`)
      await executor.executar('git stash pop -q')
      if (naEpoca && falhou(naEpoca)) return concluir('ja-corrigido', `O mesmo teste falha no commit ${antigo.slice(0, 8)} (da época da issue) e passa em ${cabeca.slice(0, 8)}. Confira o histórico para achar o commit que corrigiu.`, teste)
      passos.push('O teste também passa na versão da época da issue.')
    } else passos.push('Sem histórico anterior à issue no clone: não pude conferir se já foi corrigido.')
    return concluir('nao-reproduzido', 'O teste passa nas duas versões que pude conferir.', teste)
  } catch (erro) {
    return nao(erro instanceof Error ? erro.message : 'A triagem falhou.')
  } finally {
    await executor.encerrar()
  }
}
