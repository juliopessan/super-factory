// Lote B: o que a Factory precisa saber do repositório do cliente para trabalhar nele com segurança.
//  1. Mapa de funcionalidades: onde está cada coisa (pastas, telas, rotas de API, entradas, testes).
//  2. Prontidão: o repositório tem o que um agente precisa para provar o que fez (testes, lint, CI, convenções)?
//  3. Verificação do app: sobe o app no sandbox, abre no navegador, e guarda o que viu (status, console, captura de tela).
// As funções puras (mapaDeCaminhos, avaliarProntidao, comandoParaSubir) não tocam em nada e são testadas direto.

import { createHash } from 'node:crypto'

import { redigirSegredos } from './guards.ts'
import type { Executor } from './sandbox.ts'
import type { Estado } from './schemas.ts'
import { classificarArquivos } from './verificacao.ts'

type Check = Estado['checks'][number]

// ---------- 1. mapa de funcionalidades ----------

export type MapaDoRepositorio = { hash: string; texto: string; arquivos: number }

const LIMITE_DO_MAPA = 6000
const SEM_RUIDO = /(^|\/)(node_modules|dist|build|\.next|\.git|vendor|coverage|__pycache__|\.venv)(\/|$)/

/** "app/(site)/blog/[id]/page.tsx" → "/blog/[id]". */
function rotaDoCaminho(caminho: string, raiz: string): string {
  const resto = caminho.slice(raiz.length).replace(/\/(page|route)\.[cm]?[jt]sx?$/, '').replace(/\.[cm]?[jt]sx?$/, '')
  const partes = resto.split('/').filter((p) => p && !/^\(.*\)$/.test(p) && p !== 'index')
  return `/${partes.join('/')}`
}

function unicos(lista: string[], max: number): string[] {
  return [...new Set(lista)].sort().slice(0, max)
}

/** Resumo do repositório só a partir da lista de arquivos e do package.json. Sem ler código. */
export function mapaDeCaminhos(todos: string[], pacote: { main?: string; bin?: unknown; scripts?: Record<string, string> } | null): string {
  const arquivos = todos.filter((a) => !SEM_RUIDO.test(a))
  const linhas: string[] = []
  const extensoes = new Map<string, number>()
  for (const a of arquivos) {
    const m = /\.([A-Za-z0-9]+)$/.exec(a)
    if (m) extensoes.set(m[1]!.toLowerCase(), (extensoes.get(m[1]!.toLowerCase()) ?? 0) + 1)
  }
  const topo = [...extensoes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([e, n]) => `${e} (${n})`)
  linhas.push(`${arquivos.length} arquivos. Linguagens: ${topo.join(', ') || 'não identificadas'}.`)

  const pastas = new Map<string, number>()
  for (const a of arquivos) {
    const p = a.includes('/') ? a.split('/')[0]! : '.'
    pastas.set(p, (pastas.get(p) ?? 0) + 1)
  }
  linhas.push('', '## Pastas principais', ...[...pastas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([p, n]) => `- ${p === '.' ? '(raiz)' : `${p}/`}: ${n} arquivo(s)`))

  const telas: string[] = []
  const apis: string[] = []
  for (const a of arquivos) {
    for (const raiz of ['app/', 'src/app/']) {
      if (a.startsWith(raiz) && /\/page\.[cm]?[jt]sx?$/.test(a)) telas.push(rotaDoCaminho(a, raiz))
      if (a.startsWith(raiz) && /\/route\.[cm]?[jt]s$/.test(a)) apis.push(rotaDoCaminho(a, raiz))
    }
    for (const raiz of ['pages/', 'src/pages/']) {
      if (!a.startsWith(raiz) || !/\.[cm]?[jt]sx?$/.test(a)) continue
      const nome = a.slice(raiz.length)
      if (/^_/.test(nome)) continue
      if (nome.startsWith('api/')) apis.push(rotaDoCaminho(a, raiz))
      else telas.push(rotaDoCaminho(a, raiz))
    }
    if (/^src\/(routes|views)\/.+\.(svelte|vue|[jt]sx?)$/.test(a) && !/\.(test|spec)\./.test(a)) telas.push(a.replace(/^src\//, ''))
  }
  if (telas.length) linhas.push('', '## Telas', ...unicos(telas, 40).map((t) => `- ${t}`))
  if (apis.length) linhas.push('', '## Rotas de API', ...unicos(apis, 40).map((t) => `- ${t}`))

  const entradas: string[] = []
  if (pacote?.main) entradas.push(`main: ${pacote.main}`)
  if (pacote?.bin) entradas.push(`bin: ${typeof pacote.bin === 'string' ? pacote.bin : Object.keys(pacote.bin as object).join(', ')}`)
  for (const [nome, comando] of Object.entries(pacote?.scripts ?? {}).slice(0, 12)) entradas.push(`script ${nome}: ${comando}`)
  for (const a of arquivos) if (/^(main|app|manage|server|index)\.(py|go|ts|js|mjs)$|^cmd\/[^/]+\/main\.go$|^Dockerfile$|^docker-compose\.ya?ml$/.test(a)) entradas.push(a)
  if (entradas.length) linhas.push('', '## Entradas e scripts', ...entradas.slice(0, 25).map((e) => `- ${e}`))

  const { testes } = classificarArquivos(arquivos)
  if (testes.length) {
    const pastasDeTeste = unicos(testes.map((t) => (t.includes('/') ? t.slice(0, t.lastIndexOf('/')) : '.')), 8)
    linhas.push('', '## Testes', `- ${testes.length} arquivo(s), em: ${pastasDeTeste.join(', ')}`)
  } else linhas.push('', '## Testes', '- nenhum arquivo de teste encontrado')

  const docs = arquivos.filter((a) => /^(README|CONTRIBUTING|AGENTS|CLAUDE|ARCHITECTURE)(\.[a-z]+)?$/i.test(a) || /^docs\//.test(a)).slice(0, 10)
  if (docs.length) linhas.push('', '## Documentação', ...docs.map((d) => `- ${d}`))
  const texto = redigirSegredos(linhas.join('\n'))
  return texto.length > LIMITE_DO_MAPA ? `${texto.slice(0, LIMITE_DO_MAPA)}\n…(mapa cortado)` : texto
}

/** Lê o repositório clonado (cwd do executor) e monta o mapa. O hash muda quando a lista de arquivos muda. */
export async function gerarMapaDoRepositorio(executor: Executor): Promise<MapaDoRepositorio | null> {
  const lista = await executor.executar('git ls-files', { timeoutMs: 60_000 })
  if (lista.codigo !== 0) return null
  const arquivos = lista.saida.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 20_000)
  if (arquivos.length === 0) return null
  let pacote: { main?: string; bin?: unknown; scripts?: Record<string, string> } | null = null
  if (arquivos.includes('package.json')) {
    try {
      pacote = JSON.parse((await executor.executar('cat package.json')).saida) as typeof pacote
    } catch {}
  }
  const hash = createHash('sha1').update([...arquivos].sort().join('\n')).digest('hex').slice(0, 12)
  return { hash, texto: mapaDeCaminhos(arquivos, pacote), arquivos: arquivos.length }
}

/** Arquivo do mapa guardado pela Factory: um cabeçalho com o hash, para só reescrever quando o repositório mudou. */
export function mapaEmArquivo(repositorio: string, mapa: MapaDoRepositorio): string {
  return `<!-- hash:${mapa.hash} repositorio:${repositorio} -->\n# Mapa de ${repositorio}\n\n${mapa.texto}\n`
}

export function hashDoArquivoDeMapa(conteudo: string): string | null {
  return /^<!-- hash:([0-9a-f]{12}) /.exec(conteudo)?.[1] ?? null
}

// ---------- 2. prontidão ----------

export type ItemDeProntidao = { id: string; nome: string; ok: boolean; dica: string }
export type Prontidao = { pontos: number; total: number; nivel: 'pronto' | 'parcial' | 'fragil'; itens: ItemDeProntidao[] }

const ARQUIVOS_DE_CONVENCAO = /^(AGENTS|CLAUDE|CONTRIBUTING)\.md$|^\.github\/copilot-instructions\.md$|^\.cursor\/rules\//i
const ARQUIVOS_DE_CI = /^\.github\/workflows\/.+\.ya?ml$|^azure-pipelines\.ya?ml$|^\.gitlab-ci\.ya?ml$|^Jenkinsfile$|^\.circleci\/config\.yml$/
const ARQUIVOS_DE_LOCK = /^(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|poetry\.lock|Pipfile\.lock|go\.sum|Cargo\.lock|packages\.lock\.json|requirements\.txt)$/

export function avaliarProntidao(entrada: { arquivos: string[]; comandoDeTeste: string | null; extras: string[] }): Prontidao {
  const nomes = entrada.arquivos
  const tem = (re: RegExp) => nomes.some((n) => re.test(n))
  const itens: ItemDeProntidao[] = [
    { id: 'testes', nome: 'Comando de teste', ok: Boolean(entrada.comandoDeTeste), dica: 'Sem um comando de teste, o construtor não tem como provar o que fez. Declare o script "test" (ou o equivalente da linguagem).' },
    { id: 'testes-existem', nome: 'Arquivos de teste', ok: classificarArquivos(nomes).testes.length > 0, dica: 'Nenhum arquivo de teste: um comando que passa sem testar nada não prova nada.' },
    { id: 'lint', nome: 'Lint', ok: entrada.extras.includes('lint'), dica: 'Sem lint, estilo e erros simples só aparecem na revisão humana.' },
    { id: 'typecheck', nome: 'Typecheck', ok: entrada.extras.includes('typecheck'), dica: 'Sem typecheck, uma mudança que quebra um contrato passa despercebida.' },
    { id: 'build', nome: 'Build', ok: entrada.extras.includes('build'), dica: 'Sem build declarado, a Factory não confirma que o projeto ainda compila.' },
    { id: 'convencoes', nome: 'Convenções para agentes', ok: tem(ARQUIVOS_DE_CONVENCAO), dica: 'Crie um AGENTS.md curto com o jeito de rodar os testes e o estilo do código; o construtor lê antes de escrever.' },
    { id: 'ci', nome: 'CI no repositório', ok: tem(ARQUIVOS_DE_CI), dica: 'Sem CI, o PR chega sem um segundo juiz rodando em ambiente limpo.' },
    { id: 'lock', nome: 'Dependências travadas', ok: tem(ARQUIVOS_DE_LOCK), dica: 'Sem lockfile, o baseline de hoje pode não ser o de amanhã.' },
    { id: 'readme', nome: 'README', ok: tem(/^README(\.[a-z]+)?$/i), dica: 'O README é o primeiro lugar que o construtor procura para entender o projeto.' },
  ]
  const pontos = itens.filter((i) => i.ok).length
  const razao = pontos / itens.length
  return { pontos, total: itens.length, nivel: razao >= 0.8 ? 'pronto' : razao >= 0.5 ? 'parcial' : 'fragil', itens }
}

export function prontidaoEmTexto(p: Prontidao): string {
  const falta = p.itens.filter((i) => !i.ok)
  return `Prontidão do repositório para a Factory: ${p.pontos}/${p.total} (${p.nivel}).${falta.length ? ` Falta: ${falta.map((i) => i.nome).join(', ')}.` : ''}`
}

/** Pontos de atenção que cabem no PR: só o que falta e atrapalha a prova. */
export function atencaoDeProntidao(p: Prontidao): string[] {
  const falta = p.itens.filter((i) => !i.ok && ['testes', 'testes-existem', 'ci'].includes(i.id))
  return falta.map((i) => `Prontidão: falta ${i.nome.toLowerCase()}. ${i.dica}`)
}

export async function diagnosticarProntidao(executor: Executor, comandoDeTeste: string | null, extras: Array<{ nome: string }>): Promise<Prontidao | null> {
  const lista = await executor.executar('git ls-files', { timeoutMs: 60_000 })
  if (lista.codigo !== 0) return null
  const arquivos = lista.saida.split('\n').map((l) => l.trim()).filter(Boolean)
  return avaliarProntidao({ arquivos, comandoDeTeste, extras: extras.map((e) => e.nome) })
}

// ---------- 3. verificação do app no navegador ----------

export type CapturaDoApp = { png: string | null }
export type ResultadoDoApp = { check: Check; captura: CapturaDoApp }

const PASTA_DO_APP = '/tmp/sf-app'
const SCRIPTS_PARA_SUBIR = ['start', 'dev', 'serve', 'preview']
const PORTAS = [3000, 5173, 4321, 8080, 8000, 4200]

/** Escolhe o script que sobe o app e a porta provável, pelo package.json. */
export function comandoParaSubir(scripts: Record<string, string>, gerenciador: string): { comando: string; porta: number | null } | null {
  const nome = SCRIPTS_PARA_SUBIR.find((n) => scripts[n])
  if (!nome) return null
  const texto = scripts[nome]!
  const porta = Number(/(?:--port[ =]|\s-p[ =]?|PORT=)(\d{2,5})\b/.exec(texto)?.[1]) || (/\bvite\b/.test(texto) ? 5173 : /\bastro\b/.test(texto) ? 4321 : /\bng serve\b/.test(texto) ? 4200 : null)
  return { comando: `${gerenciador} run ${nome}`, porta }
}

export const SCRIPT_DO_NAVEGADOR = String.raw`
const { chromium } = require('playwright')
const fs = require('fs')
;(async () => {
  const url = process.argv[2]
  const erros = []
  const falhas = []
  let status = null
  let titulo = ''
  const b = await chromium.launch({ args: ['--no-sandbox'] })
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } })
  p.on('console', (m) => { if (m.type() === 'error') erros.push(String(m.text()).slice(0, 300)) })
  p.on('pageerror', (e) => erros.push('pageerror: ' + String((e && e.message) || e).slice(0, 300)))
  p.on('requestfailed', (r) => falhas.push(r.url().slice(0, 200)))
  try {
    const r = await p.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    status = r ? r.status() : null
    titulo = await p.title()
  } catch (e) {
    erros.push('goto: ' + String((e && e.message) || e).slice(0, 300))
  }
  await p.screenshot({ path: '${PASTA_DO_APP}/tela.png' }).catch(() => {})
  await b.close()
  fs.writeFileSync('${PASTA_DO_APP}/relatorio.json', JSON.stringify({ status, titulo, erros: erros.slice(0, 10), falhas: falhas.slice(0, 10) }))
})()
`.replaceAll('${PASTA_DO_APP}', PASTA_DO_APP)

function checkDoApp(resultado: Check['resultado'], comando: string | null, evidencia: string): Check {
  return { nome: 'app-no-navegador', resultado, comando, evidencia: redigirSegredos(evidencia).slice(0, 1500) }
}

export async function pararApp(executor: Executor): Promise<void> {
  await executor.executar(`[ -f ${PASTA_DO_APP}/pid ] && kill -TERM -- -$(cat ${PASTA_DO_APP}/pid) 2>/dev/null; sleep 1; [ -f ${PASTA_DO_APP}/pid ] && kill -KILL -- -$(cat ${PASTA_DO_APP}/pid) 2>/dev/null; rm -f ${PASTA_DO_APP}/pid; true`)
}

/**
 * Sobe o app do repositório no sandbox, abre no Chromium e devolve o que viu. Não afirma nada que o navegador não mostrou:
 * página que carrega sem erro de console é PASS, qualquer erro ou app que não sobe é FAIL, repositório sem app web é NOT_RUN.
 */
export async function verificarAppNoNavegador(executor: Executor, gerenciador: string, comTela: boolean): Promise<ResultadoDoApp> {
  const sem = (c: Check): ResultadoDoApp => ({ check: c, captura: { png: null } })
  const pacote = await executor.executar('cat package.json')
  let scripts: Record<string, string> = {}
  try {
    scripts = (JSON.parse(pacote.saida) as { scripts?: Record<string, string> }).scripts ?? {}
  } catch {}
  const subir = comandoParaSubir(scripts, gerenciador)
  if (!subir) return sem(checkDoApp('NOT_RUN', null, 'O repositório não tem script start, dev, serve ou preview: não há app para abrir no navegador.'))
  const pw = await executor.executar('NODE_PATH="$(npm root -g)" node -e "require(\'playwright\')"')
  if (pw.codigo !== 0) return sem(checkDoApp('NOT_RUN', null, 'A imagem do sandbox não tem navegador. Construa com: sudo bash deploy/construir-sandbox.sh --com-browser'))

  await pararApp(executor)
  const portas = [...new Set([...(subir.porta ? [subir.porta] : []), ...PORTAS])]
  const comando = [
    `mkdir -p ${PASTA_DO_APP} && rm -f ${PASTA_DO_APP}/relatorio.json ${PASTA_DO_APP}/tela.png`,
    `PORT=3000 BROWSER=none CI=1 setsid nohup ${subir.comando} > ${PASTA_DO_APP}/app.log 2>&1 &`,
    `echo $! > ${PASTA_DO_APP}/pid`,
    `for i in $(seq 1 60); do for p in ${portas.join(' ')}; do c=$(curl -s -o /dev/null -m 2 -w '%{http_code}' http://127.0.0.1:$p/); if [ "$c" != "000" ]; then echo "PORTA=$p"; exit 0; fi; done; sleep 1; done`,
    `echo SEM_PORTA; tail -n 15 ${PASTA_DO_APP}/app.log`,
    'exit 1',
  ].join('\n')
  const subiu = await executor.executar(comando, { timeoutMs: 120_000 })
  const porta = /PORTA=(\d+)/.exec(subiu.saida)?.[1]
  if (!porta) {
    await pararApp(executor)
    return sem(checkDoApp('FAIL', subir.comando, `O app não respondeu em 60 s depois de ${subir.comando}.\n${subiu.saida.split('SEM_PORTA').pop()?.trim() ?? ''}`))
  }
  const b64 = Buffer.from(SCRIPT_DO_NAVEGADOR, 'utf8').toString('base64')
  await executor.executar(`printf '%s' '${b64}' | base64 -d > ${PASTA_DO_APP}/ver.js`)
  const url = `http://127.0.0.1:${porta}/`
  const rodou = await executor.executar(`NODE_PATH="$(npm root -g)" node ${PASTA_DO_APP}/ver.js '${url}'`, { timeoutMs: 90_000 })
  const leitura = await executor.executar(`cat ${PASTA_DO_APP}/relatorio.json`)
  let captura: CapturaDoApp = { png: null }
  if (comTela) {
    const tela = await executor.executar(`[ "$(wc -c < ${PASTA_DO_APP}/tela.png 2>/dev/null || echo 0)" -lt 1500000 ] && base64 -w0 ${PASTA_DO_APP}/tela.png || true`)
    if (/^[A-Za-z0-9+/=]{100,}$/.test(tela.saida.trim())) captura = { png: tela.saida.trim() }
  }
  await pararApp(executor)
  let relatorio: { status: number | null; titulo: string; erros: string[]; falhas: string[] }
  try {
    relatorio = JSON.parse(leitura.saida) as typeof relatorio
  } catch {
    return { check: checkDoApp('FAIL', subir.comando, `O navegador não devolveu relatório (código ${rodou.codigo}). ${`${rodou.saida}\n${rodou.erro}`.trim().slice(-300)}`), captura }
  }
  const cabecalho = `GET / → ${relatorio.status ?? 'sem resposta'}${relatorio.titulo ? `, título "${relatorio.titulo.slice(0, 80)}"` : ''}.`
  const ruins = [...relatorio.erros.map((e) => `console: ${e}`), ...relatorio.falhas.map((f) => `requisição falhou: ${f}`)]
  const aberta = relatorio.status !== null && relatorio.status < 400
  if (aberta && relatorio.erros.length === 0) {
    return { check: checkDoApp('PASS', subir.comando, `${cabecalho} Sem erro no console${relatorio.falhas.length ? `; ${relatorio.falhas.length} requisição(ões) falharam (veja abaixo)` : ''}.${relatorio.falhas.length ? `\n${ruins.join('\n')}` : ''}`), captura }
  }
  return { check: checkDoApp('FAIL', subir.comando, `${cabecalho}\n${ruins.join('\n') || 'A página não abriu.'}`), captura }
}
