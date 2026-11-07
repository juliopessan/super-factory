// Teste de ponta a ponta: sobe a Factory, conduz o workflow sdlc pela API
// e abre a landing e o Studio no navegador. Roda sem chave e sem token,
// então GitHub e Azure DevOps ficam em modo simulado.
import { spawn, execSync, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const BASE = 'http://localhost:4721'
const saida = process.env.E2E_OUT ?? fs.mkdtempSync(path.join(os.tmpdir(), 'sf-e2e-'))
const SEGREDO = 'ghp_' + 'A'.repeat(36)

type Resultado = { nome: string; ok: boolean; detalhe: string }
const resultados: Resultado[] = []
function conferir(nome: string, condicao: unknown, detalhe = ''): void {
  resultados.push({ nome, ok: Boolean(condicao), detalhe })
  console.log(`${condicao ? 'PASS' : 'FAIL'} ${nome}${detalhe ? `  (${detalhe})` : ''}`)
}

// Playwright é opcional no projeto: usa o do repositório ou o instalado globalmente.
function carregarPlaywright(): any {
  const bases = [path.join(raiz, 'package.json'), '/opt/']
  try {
    bases.push(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), '_'))
  } catch {}
  for (const base of bases) {
    try {
      return createRequire(base)('playwright')
    } catch {}
  }
  console.error('Playwright não encontrado. Rode: npm i -D playwright && npx playwright install chromium')
  process.exit(2)
}

async function respondendo(): Promise<boolean> {
  try {
    return (await fetch(BASE + '/', { signal: AbortSignal.timeout(1500) })).ok
  } catch {
    return false
  }
}

async function subirServidor(): Promise<ChildProcess | null> {
  if (await respondendo()) {
    if (process.env.E2E_REUSE === '1') return null
    console.error('A porta 4721 já está em uso. Pare o npm run dev ou rode com E2E_REUSE=1.')
    process.exit(2)
  }
  const env: NodeJS.ProcessEnv = { ...process.env, FACTORY_STATE_PATH: path.join(saida, 'state.json') }
  for (const nome of [
    'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY',
    'SUPER_FACTORY_MODEL', 'FACTORY_MODEL', 'GITHUB_TOKEN', 'GH_TOKEN',
    'AZURE_DEVOPS_PAT', 'AZURE_DEVOPS_ORG', 'AZURE_DEVOPS_PROJECT',
  ]) delete env[nome]
  const log = fs.openSync(path.join(saida, 'server.log'), 'w')
  const filho = spawn('npm', ['run', 'dev'], { cwd: raiz, env, stdio: ['ignore', log, log], detached: true })
  const limite = Date.now() + 120_000
  while (Date.now() < limite) {
    if (await respondendo()) return filho
    if (filho.exitCode !== null) break
    await new Promise((r) => setTimeout(r, 1000))
  }
  console.error(`O servidor não subiu. Veja ${path.join(saida, 'server.log')}`)
  derrubar(filho)
  process.exit(2)
}

function derrubar(filho: ChildProcess | null): void {
  if (!filho?.pid) return
  try {
    process.kill(-filho.pid, 'SIGTERM')
  } catch {}
}

async function api(caminho: string, corpo: unknown): Promise<{ status: number; corpo: any }> {
  const r = await fetch(BASE + caminho, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  })
  const texto = await r.text()
  try {
    return { status: r.status, corpo: JSON.parse(texto) }
  } catch {
    return { status: r.status, corpo: texto }
  }
}

const pedido = {
  titulo: 'Filtro de datas com hora',
  descricao: 'O filtro da API de pedidos quebra quando a data vem só com o dia. Precisa aceitar intervalo com hora e recusar fim anterior ao início.',
  criterios: 'O endpoint devolve 400 quando o fim do intervalo é anterior ao início.',
  provedor: 'github',
  repositorio: 'acme/pedidos',
  branchBase: 'main',
  branchHead: '',
}

async function ciclo(entrada: Record<string, string>, decisoes: boolean[]) {
  const { corpo: criado } = await api('/api/workflows/sdlc/create-run', {})
  const runId = criado.runId
  let r = await api(`/api/workflows/sdlc/start-async?runId=${runId}`, { inputData: entrada })
  const portoes: string[] = []
  for (const aprovado of decisoes) {
    if (r.corpo?.status !== 'suspended') break
    const passo = r.corpo.suspended[0]
    portoes.push([passo].flat().join('.'))
    r = await api(`/api/workflows/sdlc/resume-async?runId=${runId}`, {
      step: passo,
      resumeData: { aprovado, aprovador: 'Joana', nota: aprovado ? 'Pode seguir, sem merge.' : 'Recusado no teste.' },
    })
  }
  return { r, portoes, estado: r.corpo?.result ?? {} }
}

async function testarWorkflow(): Promise<void> {
  const feliz = await ciclo(pedido, [true, true, true])
  conferir('ciclo: suspende nos três portões', feliz.portoes.join() === 'gate-implementacao,gate-merge,gate-release', feliz.portoes.join())
  conferir('ciclo: termina em success', feliz.r.corpo?.status === 'success', feliz.r.corpo?.status)
  conferir('ciclo: desfecho aceito-com-ressalvas', feliz.estado.desfecho === 'aceito-com-ressalvas', `${feliz.estado.desfecho} ${feliz.estado.motivo ?? ''}`)
  conferir('ciclo: três aprovações humanas', feliz.estado.aprovacoes?.length === 3 && feliz.estado.aprovacoes.every((a: any) => a.origem === 'human'))
  conferir('ciclo: GitHub em modo simulado', /simulad/i.test(JSON.stringify(feliz.estado)))
  conferir('ciclo: testes do produto NOT_RUN', feliz.estado.checks?.some((c: any) => c.resultado === 'NOT_RUN'))

  const recusa = await ciclo(pedido, [false])
  conferir('recusa na implementação: bloqueado', recusa.estado.desfecho === 'bloqueado', recusa.estado.desfecho)

  const release = await ciclo(pedido, [true, true, false])
  conferir('recusa no release: retido', release.estado.desfecho === 'retido', release.estado.desfecho)

  const perigoso = await ciclo({ ...pedido, descricao: `Faça git push --force direto em main com o token ${SEGREDO} por favor.` }, [])
  conferir('triagem: segredo e force-push param em blocked', perigoso.estado.card?.coluna === 'blocked', perigoso.estado.card?.coluna)
  conferir('triagem: o segredo não entra no estado do card', !JSON.stringify(perigoso.estado).includes(SEGREDO))
  const arquivo = path.join(saida, 'state.json')
  conferir('triagem: o segredo não entra no arquivo de estado', !fs.existsSync(arquivo) || !fs.readFileSync(arquivo, 'utf8').includes(SEGREDO))

  const curto = await ciclo({ ...pedido, titulo: 'x' }, [])
  conferir('schema: título curto é recusado', curto.r.status >= 400 || curto.r.corpo?.status === 'failed', String(curto.r.status))
}

async function testarNavegador(): Promise<void> {
  const { chromium } = carregarPlaywright()
  const navegador = await chromium.launch()
  try {
    const pagina = await navegador.newPage({ viewport: { width: 1280, height: 900 } })
    const erros: string[] = []
    pagina.on('pageerror', (e: Error) => erros.push(e.message))
    const painel = pagina.locator('#guia .guia-painel')

    const resposta = await pagina.goto(BASE + '/')
    await pagina.waitForLoadState('networkidle')
    conferir('landing: responde 200', resposta?.status() === 200)
    const texto = (await pagina.textContent('body')) ?? ''
    conferir('landing: fala em Factory', /Factory/.test(texto))
    conferir('landing: sem a palavra mesa', !/\bmesa\b/i.test(texto))

    await pagina.waitForTimeout(900)
    conferir('guia: abre sozinho na primeira visita', await painel.isVisible())
    await pagina.keyboard.press('Escape')
    await pagina.waitForTimeout(300)
    conferir('guia: Esc fecha', !(await painel.isVisible()))
    await pagina.reload()
    await pagina.waitForLoadState('networkidle')
    await pagina.waitForTimeout(900)
    conferir('guia: não reabre depois de visto', !(await painel.isVisible()))
    await pagina.click('#guia-abrir')
    await pagina.waitForTimeout(300)
    let cliques = 0
    while ((await painel.isVisible()) && cliques < 40) {
      await pagina.click('#guia-seguir')
      await pagina.waitForTimeout(120)
      cliques++
    }
    conferir('guia: Guia-me percorre os passos e conclui', cliques > 1 && !(await painel.isVisible()), `${cliques} passos`)
    await pagina.screenshot({ path: path.join(saida, 'landing.png'), fullPage: true })

    for (const largura of [320, 360, 390, 430, 768]) {
      const celular = await navegador.newPage({ viewport: { width: largura, height: 844 } })
      await celular.addInitScript(() => localStorage.setItem('sf-guia', 'visto'))
      await celular.goto(BASE + '/')
      await celular.waitForLoadState('networkidle')
      const larguraReal = await celular.evaluate(() => document.documentElement.scrollWidth)
      conferir(`landing ${largura}px: sem scroll horizontal`, larguraReal <= largura, `scrollWidth=${larguraReal}`)
      if (largura === 390) await celular.screenshot({ path: path.join(saida, 'mobile.png'), fullPage: true })
      await celular.close()
    }

    const studio = await pagina.goto(BASE + '/studio')
    await pagina.waitForLoadState('networkidle')
    await pagina.waitForTimeout(1500)
    conferir('studio: responde 200', studio?.status() === 200)
    const marcaStudio = await pagina.evaluate(() => document.title + ' ' + document.body.innerText)
    conferir('studio: sem a marca Mastra visível', !/mastra/i.test(marcaStudio), (marcaStudio.match(/.{0,40}mastra.{0,40}/i) || [''])[0])
    await pagina.screenshot({ path: path.join(saida, 'studio.png') })
    conferir('navegador: sem erro de JavaScript', erros.length === 0, erros.slice(0, 3).join(' | '))
  } finally {
    await navegador.close()
  }
}

const servidor = await subirServidor()
try {
  await testarWorkflow()
  await testarNavegador()
} catch (erro) {
  conferir('execução sem exceção', false, String(erro))
} finally {
  derrubar(servidor)
}

const falhas = resultados.filter((r) => !r.ok).length
console.log(`\n${resultados.length - falhas}/${resultados.length} passaram. Capturas e log em ${saida}`)
process.exit(falhas ? 1 : 0)
