// Verificação de verdade no sandbox: o que o repositório já tinha antes da mudança (baseline), lint, typecheck e build como
// checks separados, o teste de reprodução que falha sem a correção (vermelho→verde), as convenções do repositório que o
// construtor precisa ler e a auditoria do que ele afirma contra o que ele fez.
// Tudo aqui lê o que o sandbox observou. Nada é relato do agente.

import { redigirSegredos } from './guards.ts'
import type { Execucao, Executor } from './sandbox.ts'
import type { Achado, Estado } from './schemas.ts'

export type ExtraDeVerificacao = { nome: 'lint' | 'typecheck' | 'build'; comando: string }

export type Verificacao = {
  instalar: string | null
  verificar: string | null
  origem: string
  /** Subpasta do projeto, quando o manifesto não está na raiz do repositório (os comandos já levam o "cd"). */
  pasta?: string
  /** Lint, typecheck e build, quando o repositório os declara. Cada um vira um check separado, com baseline. */
  extras?: ExtraDeVerificacao[]
}

type Check = Estado['checks'][number]

const TEMPO_DO_TESTE_MS = 20 * 60_000
const TEMPO_DO_EXTRA_MS = 10 * 60_000

function rabo(e: Execucao, linhas = 25): string {
  return `${e.saida}\n${e.erro}`.trim().split('\n').slice(-linhas).join('\n')
}

function checkDe(nome: string, e: Execucao, comando: string): Check {
  const resultado = e.codigo === 0 && !e.estourou ? 'PASS' : 'FAIL'
  const situacao = e.estourou ? 'tempo esgotado' : `código de saída ${e.codigo}`
  return { nome, resultado, comando, evidencia: `Observado no sandbox: ${situacao}, ${e.ms} ms.\n${rabo(e)}`.slice(0, 1800) }
}

// ---------- descoberta dos extras ----------

/** lint, typecheck e build a partir dos scripts do package.json. O comando que já é o de teste não se repete. */
export function extrasDoNode(scripts: Record<string, string>, gerenciador: string, verificar: string | null): ExtraDeVerificacao[] {
  const rodar = (nome: string) => `${gerenciador} run ${nome}`
  const candidatos: Array<[ExtraDeVerificacao['nome'], string[]]> = [
    ['lint', ['lint']],
    ['typecheck', ['typecheck', 'type-check', 'check:types', 'tsc']],
    ['build', ['build']],
  ]
  const extras: ExtraDeVerificacao[] = []
  for (const [nome, scriptsPossiveis] of candidatos) {
    const script = scriptsPossiveis.find((s) => scripts[s])
    if (!script) continue
    const comando = rodar(script)
    if (comando !== verificar) extras.push({ nome, comando })
  }
  return extras
}

// ---------- baseline e verificações finais ----------

/** Roda lint, typecheck e build. Com prefixo "baseline:", os nomes dos checks levam o prefixo. */
export async function rodarExtras(executor: Executor, extras: ExtraDeVerificacao[], prefixo: '' | 'baseline:' = ''): Promise<Check[]> {
  const checks: Check[] = []
  for (const extra of extras) {
    const e = await executor.executar(extra.comando, { timeoutMs: TEMPO_DO_EXTRA_MS })
    checks.push(checkDe(`${prefixo}${extra.nome}`, e, extra.comando))
  }
  return checks
}

/** O que o repositório já fazia ANTES da mudança: testes, lint, typecheck e build. Serve para separar falha antiga de regressão. */
export async function rodarBaseline(executor: Executor, v: Verificacao): Promise<Check[]> {
  const checks: Check[] = []
  if (v.verificar) checks.push(checkDe('baseline:testes', await executor.executar(v.verificar, { timeoutMs: TEMPO_DO_TESTE_MS }), v.verificar))
  checks.push(...(await rodarExtras(executor, v.extras ?? [], 'baseline:')))
  return checks
}

/** O veredito sobre os checks do card: pronto para revisão ou rascunho, e por quê. Falha que já existia no baseline não é regressão. */
export function veredito(estado: Pick<Estado, 'checks'>): { passou: boolean; motivos: string[]; notas: string[] } {
  const get = (n: string) => estado.checks.find((c) => c.nome === n)
  const motivos: string[] = []
  const notas: string[] = []
  const testes = get('testes-no-sandbox')
  if (testes?.resultado !== 'PASS') motivos.push('os testes não passaram')
  for (const nome of ['lint', 'typecheck', 'build']) {
    const final = get(nome)
    if (final?.resultado !== 'FAIL') continue
    if (get(`baseline:${nome}`)?.resultado === 'FAIL') notas.push(`${nome} já falhava antes da mudança (baseline): não é regressão deste card`)
    else motivos.push(`${nome} falhou e não falhava antes da mudança`)
  }
  const app = get('app-no-navegador')
  if (app?.resultado === 'FAIL') {
    if (get('baseline:app')?.resultado === 'PASS') motivos.push('o app abria sem erro no navegador antes da mudança e agora não')
    else notas.push('o app no navegador tem erro (não abria limpo antes da mudança, ou não há baseline): veja a evidência')
  }
  if (get('testes-preservados')?.resultado === 'FAIL') motivos.push('o diff enfraquece os testes (veja Pontos de atenção)')
  const rv = get('vermelho-verde')
  if (rv?.resultado === 'FAIL') motivos.push('o teste novo passa mesmo sem a correção, então não prova o conserto')
  const base = get('baseline:testes')
  if (base?.resultado === 'FAIL' && testes?.resultado === 'PASS') notas.push('a suíte já falhava antes da mudança e agora passa')
  if (base?.resultado === 'FAIL' && testes?.resultado === 'FAIL') notas.push('a suíte já falhava antes da mudança (baseline)')
  return { passou: motivos.length === 0, motivos, notas }
}

// ---------- vermelho→verde ----------

const PADROES_DE_TESTE = [/(^|\/)(tests?|__tests__|specs?)\//i, /\.(test|spec)\.[cm]?[jt]sx?$/i, /(^|\/)test_[^/]*\.py$/i, /_test\.(py|go)$/i, /Tests?\.(cs|java)$/]
const NAO_E_CODIGO = /\.(md|txt|rst|lock)$|(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/i

/** Separa arquivos de teste de arquivos de código. Documentação e lockfile não contam como código. */
export function classificarArquivos(arquivos: string[]): { testes: string[]; fontes: string[] } {
  const testes: string[] = []
  const fontes: string[] = []
  for (const a of arquivos) {
    if (PADROES_DE_TESTE.some((p) => p.test(a))) testes.push(a)
    else if (!NAO_E_CODIGO.test(a)) fontes.push(a)
  }
  return { testes, fontes }
}

/** Caminho sem aspas, sem "..", relativo: seguro para ir entre aspas simples num comando. */
export function caminhoDeArquivoSeguro(p: string): boolean {
  return p.length > 0 && p.length < 300 && !p.startsWith('/') && !p.split('/').includes('..') && /^[A-Za-z0-9._@+/\- ]+$/.test(p)
}

export type ResultadoVermelhoVerde = { check: Check; restaurou: boolean }

async function arquivosMudados(executor: Executor): Promise<string[]> {
  const r = await executor.executar('git ls-files -m -o --exclude-standard')
  return r.saida.split('\n').map((l) => l.trim()).filter(Boolean).sort()
}

/**
 * Em card de bug: o teste que a mudança trouxe precisa FALHAR sem a correção e PASSAR com ela. A Factory guarda o código
 * (stash), roda a verificação, devolve o código e confere que tudo voltou. Se o teste passa sem a correção, ele não prova o conserto.
 */
export async function verificarVermelhoVerde(executor: Executor, v: Verificacao, rota: string): Promise<ResultadoVermelhoVerde | null> {
  if (rota !== 'bug' || !v.verificar) return null
  const antes = await arquivosMudados(executor)
  const { testes, fontes } = classificarArquivos(antes)
  const semEfeito = (evidencia: string): ResultadoVermelhoVerde => ({ check: { nome: 'vermelho-verde', resultado: 'NOT_RUN', comando: null, evidencia }, restaurou: true })
  if (testes.length === 0) return semEfeito('O card é um bug, mas nenhum teste foi adicionado ou alterado: nada prova que o conserto conserta. Peça um teste que reproduza o bug.')
  if (fontes.length === 0) return semEfeito('Só testes mudaram; nenhum arquivo de código. Não há correção para tirar e comparar.')
  if (!fontes.every(caminhoDeArquivoSeguro)) return semEfeito('Um nome de arquivo tem caracteres que a Factory não aceita no comando; o vermelho→verde não rodou.')
  const lista = fontes.map((f) => `'${f}'`).join(' ')
  const e = await executor.executar(`git stash push -u -q -- ${lista} && { ${v.verificar}; c=$?; git stash pop -q; exit $c; }`, { timeoutMs: TEMPO_DO_TESTE_MS })
  let depois = await arquivosMudados(executor)
  if (depois.join('\n') !== antes.join('\n')) {
    // O stash fica guardado se o pop falhar: uma segunda tentativa costuma bastar.
    await executor.executar('git stash pop -q')
    depois = await arquivosMudados(executor)
  }
  const restaurou = depois.join('\n') === antes.join('\n')
  if (e.estourou) return { check: { nome: 'vermelho-verde', resultado: 'NOT_RUN', comando: v.verificar, evidencia: 'Tempo esgotado ao rodar os testes sem a correção.' }, restaurou }
  const falhouSemCorrecao = e.codigo !== 0
  return {
    restaurou,
    check: {
      nome: 'vermelho-verde',
      resultado: falhouSemCorrecao ? 'PASS' : 'FAIL',
      comando: v.verificar,
      evidencia: falhouSemCorrecao
        ? `Sem a correção (${fontes.length} arquivo(s) de código guardados), os testes FALHAM (código ${e.codigo}); com a correção, passam. O teste novo prova o conserto.\n${rabo(e, 12)}`.slice(0, 1800)
        : `Sem a correção (${fontes.length} arquivo(s) de código guardados), os testes PASSAM do mesmo jeito. O teste novo não reproduz o bug: ele passa com ou sem o conserto.`,
    },
  }
}

// ---------- convenções do repositório ----------

const COMANDO_DAS_CONVENCOES = String.raw`for f in AGENTS.md CLAUDE.md CONTRIBUTING.md .github/copilot-instructions.md; do if [ -f "$f" ]; then echo "### $f"; head -c 4000 "$f"; echo; fi; done; for f in $(ls .cursor/rules/*.mdc .cursor/rules/*.md 2>/dev/null | head -4); do echo "### $f"; head -c 2000 "$f"; echo; done`

/** O que o próprio repositório pede de quem contribui (AGENTS.md, CLAUDE.md, CONTRIBUTING, regras do Cursor). É texto do projeto, não ordem da Factory. */
export async function lerConvencoes(executor: Executor): Promise<string | null> {
  const r = await executor.executar(COMANDO_DAS_CONVENCOES)
  const texto = redigirSegredos(r.saida.replace(/\u0000/g, '').trim()).slice(0, 12_000)
  return texto ? texto : null
}

// ---------- trilha do construtor e ancoragem ----------

export type AcaoDoConstrutor = { tentativa: number; ferramenta: string; alvo: string }

const LEITURAS = new Set(['lerArquivo', 'buscar', 'listarArquivos'])
const CAMINHO_NO_TEXTO = /[\w@.-]+(?:\/[\w@.-]+)+\.[A-Za-z0-9]{1,5}/g

/**
 * Confere o que o construtor AFIRMA contra o que ele FEZ. Três coisas que a palestra sobre confiança em agentes chama de falha
 * clássica: escrever sem ler o código, citar arquivo que nunca abriu e dizer que os testes passam sem tê-los rodado.
 * Devolve só notas (não bloqueia): quem decide é a pessoa que revisa.
 */
export function auditarAcoes(resumo: string, acoes: AcaoDoConstrutor[]): Achado[] {
  const achados: Achado[] = []
  const nota = (texto: string) => achados.push({ id: `ANC-${achados.length + 1}`, severidade: 'note', trilha: 'review', texto })
  if (acoes.length === 0) return achados
  const escritas = acoes.filter((a) => a.ferramenta === 'escreverArquivo')
  const leituras = acoes.filter((a) => LEITURAS.has(a.ferramenta))
  if (escritas.length > 0 && leituras.length === 0) nota('O construtor escreveu arquivos sem ler nenhum arquivo do repositório antes: a mudança pode não seguir o código que já existe.')
  const conhecidos = acoes.filter((a) => a.ferramenta === 'lerArquivo' || a.ferramenta === 'escreverArquivo').map((a) => a.alvo.replace(/^\.\//, ''))
  const citados = [...new Set((resumo.match(CAMINHO_NO_TEXTO) ?? []).map((c) => c.replace(/^\.\//, '')))]
  const semLeitura = citados.filter((c) => !conhecidos.some((k) => k === c || k.endsWith(`/${c}`) || c.endsWith(`/${k}`))).slice(0, 4)
  if (semLeitura.length > 0) nota(`O resumo do construtor cita ${semLeitura.map((c) => `\`${c}\``).join(', ')}, mas não há leitura nem escrita desse(s) arquivo(s) na trilha.`)
  if (/\b(testes?|su[ií]te)\b[^.\n]{0,40}\b(passa|passou|passaram|passando|verde)/i.test(resumo) && !acoes.some((a) => a.ferramenta === 'executarComando')) {
    nota('O resumo diz que os testes passam, mas o construtor não rodou nenhum comando. O resultado que vale é o da Factory, que roda os testes por conta própria.')
  }
  return achados
}
