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
const SEGREDO = 'ghp_' + Array.from({ length: 36 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('')

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
  const env: NodeJS.ProcessEnv = { ...process.env, FACTORY_STATE_PATH: path.join(saida, 'state.json'), SUPER_FACTORY_KEYS_PATH: path.join(saida, 'cofre', 'chaves.enc.json'), SUPER_FACTORY_MCPS_PATH: path.join(saida, 'cofre', 'mcps.json'), SUPER_FACTORY_MCP_COMANDO: '1', SUPER_FACTORY_ENSAIO_MS: '60' }
  for (const nome of [
    'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY',
    'SUPER_FACTORY_MODEL', 'FACTORY_MODEL', 'GITHUB_TOKEN', 'GH_TOKEN',
    'AZURE_DEVOPS_PAT', 'AZURE_DEVOPS_ORG', 'AZURE_DEVOPS_PROJECT',
  ]) delete env[nome]
  const log = fs.openSync(path.join(saida, 'server.log'), 'w')
  // E2E_PROD=1 testa o que roda na VPS: o build de produção, com `npm start`.
  const producao = process.env.E2E_PROD === '1'
  if (producao) {
    console.log('Modo produção: construindo (npm run build)…')
    execSync('npm run build', { cwd: raiz, env, stdio: ['ignore', log, log] })
  }
  const filho = spawn('npm', producao ? ['start'] : ['run', 'dev'], { cwd: raiz, env, stdio: ['ignore', log, log], detached: true })
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
  const feliz = await ciclo(pedido, [true])
  conferir('ciclo: suspende só no gate do merge', feliz.portoes.join() === 'gate-merge', feliz.portoes.join())
  conferir('ciclo: termina em success', feliz.r.corpo?.status === 'success', feliz.r.corpo?.status)
  conferir('ciclo: desfecho aceito-com-ressalvas', feliz.estado.desfecho === 'aceito-com-ressalvas', `${feliz.estado.desfecho} ${feliz.estado.motivo ?? ''}`)
  conferir('ciclo: uma aprovação humana, a do merge', feliz.estado.aprovacoes?.length === 1 && feliz.estado.aprovacoes.every((a: any) => a.origem === 'human' && a.portao === 'beforeMerge'))
  conferir('ciclo: o card espera o merge em review', feliz.estado.card?.coluna === 'review', feliz.estado.card?.coluna)
  conferir('ciclo: GitHub em modo simulado', /simulad/i.test(JSON.stringify(feliz.estado)))
  conferir('ciclo: testes do produto NOT_RUN', feliz.estado.checks?.some((c: any) => c.resultado === 'NOT_RUN'))

  const recusa = await ciclo(pedido, [false])
  conferir('recusa no merge: bloqueado', recusa.estado.desfecho === 'bloqueado', recusa.estado.desfecho)

  const perigoso = await ciclo({ ...pedido, descricao: `Faça git push --force direto em main com o token ${SEGREDO} por favor.` }, [])
  conferir('triagem: segredo e force-push param em blocked', perigoso.estado.card?.coluna === 'blocked', perigoso.estado.card?.coluna)
  conferir('triagem: o segredo não entra no estado do card', !JSON.stringify(perigoso.estado).includes(SEGREDO))
  const arquivo = path.join(saida, 'state.json')
  conferir('triagem: o segredo não entra no arquivo de estado', !fs.existsSync(arquivo) || !fs.readFileSync(arquivo, 'utf8').includes(SEGREDO))

  await new Promise((r) => setTimeout(r, 1500))
  const gravado = ['factory.db', 'factory.db-wal']
    .map((nome) => path.join(raiz, nome))
    .filter((caminho) => fs.existsSync(caminho))
    .some((caminho) => fs.readFileSync(caminho).includes(SEGREDO))
  conferir('triagem: o segredo não entra no factory.db', !gravado)

  const { corpo: criadoAuto } = await api('/api/workflows/autonomo/create-run', {})
  const auto = await api(`/api/workflows/autonomo/start-async?runId=${criadoAuto.runId}`, { inputData: { ...pedido, repositorio: 'https://github.com/acme/pedidos.git' } })
  conferir('autônomo: aceita o endereço do GitHub e, sem chave, para no primeiro nó pedindo a ANTHROPIC_API_KEY', auto.corpo?.status === 'failed' && /Receber o pedido: .*ANTHROPIC_API_KEY/.test(JSON.stringify(auto.corpo)), JSON.stringify(auto.corpo).slice(0, 200))
  const { corpo: criadoEnsaio } = await api('/api/workflows/autonomo/create-run', {})
  const ensaio = await api(`/api/workflows/autonomo/start-async?runId=${criadoEnsaio.runId}`, { inputData: { ...pedido, ensaio: true } })
  const passos = Object.keys(ensaio.corpo?.steps ?? {})
  const entregaEnsaio = (ensaio.corpo?.result?.entrega ?? {}) as { modo?: string; pullRequestId?: unknown; pullRequestUrl?: unknown; nota?: string }
  conferir('autônomo (ensaio): não finge entrega (título [ENSAIO], modo fixture, sem número de PR)', String(ensaio.corpo?.result?.card?.titulo).startsWith('[ENSAIO] ') && entregaEnsaio.modo === 'fixture' && entregaEnsaio.pullRequestId === null && entregaEnsaio.pullRequestUrl === null && /ENSAIO/.test(entregaEnsaio.nota ?? ''), JSON.stringify(entregaEnsaio))
  conferir('autônomo (ensaio): percorre as seis fases e termina aguardando revisão humana', ensaio.corpo?.status === 'success' && ensaio.corpo?.result?.card?.coluna === 'review' && ['triar', 'abrir-sandbox', 'clonar-e-preparar', 'construir-e-testar', 'revisar-e-enviar', 'abrir-pull-request'].every((id) => passos.includes(id)), `${ensaio.corpo?.status} ${passos.join(',')}`)

  const status = await fetch(BASE + '/configuracoes/chaves')
  const itens = ((await status.json()) as { itens?: Array<{ nome: string; valor: string | null }> }).itens ?? []
  conferir('chaves: o painel lista as sete chaves e não devolve nenhum segredo', status.status === 200 && itens.length === 7 && itens.every((item) => item.nome === 'AZURE_DEVOPS_ORG' || item.valor === null))
  const semOrigem = await fetch(BASE + '/configuracoes/chaves', { method: 'POST', headers: { 'content-type': 'application/json', 'x-sf-csrf': '1' }, body: JSON.stringify({ acao: 'remover', nome: 'GITHUB_TOKEN' }) })
  conferir('chaves: pedido sem Origin é recusado', semOrigem.status === 403)

  // MCPs do usuário: instala um servidor MCP de verdade e confere o que cada agente do Studio enxerga
  const fixtureMcp = fileURLToPath(new URL('./fixtures/mcp-eco.mjs', import.meta.url))
  const postMcp = (corpo: unknown, origem: string | null = BASE) =>
    fetch(BASE + '/configuracoes/mcps', { method: 'POST', headers: { 'content-type': 'application/json', 'x-sf-csrf': '1', ...(origem ? { origin: origem } : {}) }, body: JSON.stringify(corpo) })
  const ferramentasDoAgente = async (id: string) => Object.keys(((await (await fetch(`${BASE}/api/agents/${id}`)).json()) as { tools?: Record<string, unknown> }).tools ?? {}).filter((nome) => nome.startsWith('eco-de-teste_'))
  const catalogo = (await (await fetch(BASE + '/configuracoes/mcps')).json()) as { catalogo?: unknown[]; instalados?: unknown[] }
  conferir('mcps: o painel lista os 5 MCPs do catálogo e nenhum instalado', catalogo.catalogo?.length === 5 && catalogo.instalados?.length === 0)
  conferir('mcps: pedido sem Origin é recusado', (await postMcp({ acao: 'remover', id: 'abc' }, null)).status === 403)
  conferir('mcps: pedido de outro site é recusado', (await postMcp({ acao: 'remover', id: 'abc' }, 'https://outro-site.com')).status === 403)
  const instalado = (await (await postMcp({ acao: 'instalar-comando', nome: 'Eco de teste', comando: 'node', args: [fixtureMcp], segredos: { TOKEN_FALSO: 'abc123456' } })).text())
  conferir('mcps: instala um servidor MCP de verdade, conecta e não devolve o segredo', instalado.includes('"instalado":true') && instalado.includes('"conectado"') && !instalado.includes('abc123456'), instalado.slice(0, 160))
  const doSecurity = await ferramentasDoAgente('security')
  const doChief = await ferramentasDoAgente('chief-of-staff')
  conferir('mcps: o agente Security só recebe as ferramentas de leitura', doSecurity.sort().join() === 'eco-de-teste_ambiente,eco-de-teste_eco', doSecurity.join())
  conferir('mcps: o Chief of Staff recebe também a que pede aprovação', doChief.includes('eco-de-teste_gravar_nota') && doChief.includes('eco-de-teste_eco'), doChief.join())
  const aoChief = ((await (await fetch(`${BASE}/api/agents/chief-of-staff`)).json()) as { tools?: Record<string, unknown> }).tools ?? {}
  const aoSecurity = ((await (await fetch(`${BASE}/api/agents/security`)).json()) as { tools?: Record<string, unknown> }).tools ?? {}
  conferir('agentes: o Chief of Staff lê o repositório e organiza o Project', ['listarBranchesGithub', 'lerArquivoGithub', 'lerProjetoGithub', 'organizarProjetoGithub'].every((nome) => nome in aoChief || Object.values(aoChief).some((t) => (t as { id?: string }).id === nome.replace(/([A-Z])/g, '-$1').toLowerCase())), Object.keys(aoChief).join(','))
  conferir('agentes: o Security lê o Project mas não escreve nele', !Object.keys(aoSecurity).some((nome) => /organizar/i.test(nome)))
  conferir('mcps: merge nunca chega a nenhum agente', !doSecurity.concat(doChief).some((nome) => nome.includes('merge')))

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
    const video = await fetch(BASE + '/motion/super-factory-hero.mp4', { headers: { range: 'bytes=0-1023' } })
    conferir('landing: o vídeo de apresentação responde em faixas (206), para o Safari tocar', video.status === 206 && (video.headers.get('content-type') ?? '') === 'video/mp4')
    conferir('landing: o bloco do vídeo começa escondido e aparece depois de 3 s', (await (await fetch(BASE + '/')).text()).includes('video-quadro'))
    const texto = (await pagina.textContent('body')) ?? ''
    conferir('landing: fala em Factory', /Factory/.test(texto))
    conferir('landing: sem a palavra mesa', !/\bmesa\b/i.test(texto))
    const ingles = await pagina.goto(BASE + '/en')
    await pagina.waitForLoadState('networkidle')
    const textoIngles = (await pagina.textContent('body')) ?? ''
    conferir('landing /en: em inglês, com a bandeira dos EUA marcada', ingles?.status() === 200 && /Programming is dead/.test(textoIngles) && (await pagina.getAttribute('a[hreflang="en-US"]', 'aria-current')) === 'page')
    await pagina.goto(BASE + '/')
    await pagina.waitForLoadState('networkidle')

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

    // Navegação: o menu segue a ordem da página, e cada clique desce em ordem e deixa o título à vista
    await pagina.goto(BASE + '/')
    await pagina.waitForLoadState('networkidle')
    const menu = await pagina.$$eval('.top nav a[href^="#"]', (links: Element[]) => links.map((a: Element) => a.getAttribute('href')))
    const secoes = await pagina.$$eval('section[id]', (blocos: Element[]) => blocos.map((b: Element) => '#' + b.id))
    conferir('landing: o menu tem todas as seções, na mesma ordem da página', JSON.stringify(menu) === JSON.stringify(secoes), `${menu.join(' ')} | ${secoes.join(' ')}`)
    let anterior = -1
    let desceSempre = true
    let tituloAVista = true
    let marcaCerta = true
    for (const href of menu) {
      await pagina.click(`.top nav a[href="${href}"]`)
      let ultimo = -1
      let parado = 0
      for (let i = 0; i < 60 && parado < 4; i++) {
        await pagina.waitForTimeout(100)
        const y = await pagina.evaluate(() => Math.round(window.scrollY))
        parado = y === ultimo ? parado + 1 : 0
        ultimo = y
      }
      if (ultimo < anterior) desceSempre = false
      anterior = ultimo
      const medida = await pagina.evaluate((alvo: string) => {
        const cabecalho = (document.querySelector('.top') as HTMLElement).getBoundingClientRect().bottom
        const titulo = (document.querySelector(`${alvo} h2`) as HTMLElement).getBoundingClientRect().top
        return { folga: titulo - cabecalho, atual: document.querySelector('.top nav a[aria-current]')?.getAttribute('href') }
      }, href as string)
      if (medida.folga < 10 || medida.folga > 140) tituloAVista = false
      if (medida.atual !== href) marcaCerta = false
    }
    conferir('landing: clicar no menu só desce, na ordem das seções', desceSempre)
    conferir('landing: o título da seção chega abaixo do cabeçalho, nunca escondido', tituloAVista)
    conferir('landing: o menu destaca a seção para onde se foi', marcaCerta)

    // Motion do hero: ativo com movimento normal, texto intacto, e parado com movimento reduzido
    const textoDoHero = await pagina.evaluate(async () => {
      // O campo só desenha com o hero na tela: dá tempo ao observador de visibilidade depois de voltar ao topo.
      window.scrollTo({ top: 0, behavior: 'instant' })
      await new Promise((r) => setTimeout(r, 700))
      const w = window as unknown as { sfHeroSeek?: (t: number | null) => void }
      w.sfHeroSeek?.(3.3)
      await new Promise((r) => setTimeout(r, 400))
      const c = document.querySelector('.campo-pontos') as HTMLCanvasElement | null
      let acento = 0
      if (c) {
        const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 120 && (d[i] ?? 0) > 150 && (d[i + 2] ?? 0) < 150) acento++
      }
      const h1 = (document.querySelector('.hero h1') as HTMLElement).innerText.replace(/\s+/g, ' ').trim()
      w.sfHeroSeek?.(null)
      return { acento, h1, letras: document.querySelectorAll('.hero h1 .l').length, tem: typeof w.sfHeroSeek === 'function' }
    })
    conferir('hero: o motion está ativo (letras separadas e campo de pontos)', textoDoHero.tem && textoDoHero.letras > 20 && textoDoHero.acento > 300, JSON.stringify(textoDoHero))
    conferir('hero: o texto do título continua intacto', textoDoHero.h1 === 'A programação morreu. A engenharia não.', textoDoHero.h1)
    const reduzido = await navegador.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
    await reduzido.addInitScript(() => localStorage.setItem('sf-guia', 'visto'))
    await reduzido.goto(BASE + '/')
    await reduzido.waitForLoadState('networkidle')
    const parado = await reduzido.evaluate(() => ({ campo: document.querySelectorAll('.campo-pontos').length, letras: document.querySelectorAll('.hero h1 .l').length, opacidade: getComputedStyle(document.querySelector('.hero h1 .linha') as Element).opacity, rede: getComputedStyle(document.querySelector('.hero .rede') as Element).opacity }))
    conferir('hero: com movimento reduzido nada é animado e tudo aparece', parado.campo === 0 && parado.letras === 0 && parado.opacidade === '1' && parado.rede === '1', JSON.stringify(parado))
    await reduzido.close()
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
    conferir('studio: é a interface (menu Agents e Workflows), não a página do servidor', /Agents/.test(marcaStudio) && /Workflows/.test(marcaStudio) && !/(Super Factory|Mastra) Server/.test(marcaStudio))
    conferir('studio: sem a marca Mastra visível', !/mastra/i.test(marcaStudio), (marcaStudio.match(/.{0,40}mastra.{0,40}/i) || [''])[0])
    conferir('studio: menu chama o grupo de Factory, não Primitives', !/\bPrimitives\b/.test(marcaStudio) && /\bFactory\b/.test(marcaStudio))
    await pagina.waitForTimeout(500)
    conferir('chaves: a pílula flutuante saiu do canto', (await pagina.locator('#sf-chaves-botao').count()) === 0)
    await pagina.goto(BASE + '/studio/settings')
    await pagina.locator('#sf-chaves-secao iframe').waitFor({ timeout: 15000 })
    const secao = pagina.frameLocator('#sf-chaves-secao iframe')
    await secao.locator('form.chave').first().waitFor()
    conferir('chaves: o Settings tem a seção com as sete chaves e campos de senha', (await secao.locator('form.chave').count()) === 7 && (await secao.locator('input[type=password]').count()) === 6)
    conferir('chaves: a seção fica depois de General e da conexão, sem abas nem rodapé do popup', /Chaves e acessos/.test(await pagina.locator('#sf-chaves-secao h2').innerText()) && (await secao.locator('.abas').isVisible()) === false && (await secao.locator('#fechar').count()) === 0)
    conferir('chaves: o iframe ajusta a altura ao conteúdo', (await pagina.locator('#sf-chaves-secao iframe').evaluate((e: Element) => e.getBoundingClientRect().height)) > 400)
    for (const rota of ['tools', 'mcps']) {
      await pagina.goto(BASE + '/studio/' + rota)
      await pagina.locator('#sf-mais-mcp').waitFor({ timeout: 15000 })
      conferir(`mcps: o botão + aparece em /studio/${rota}`, await pagina.locator('#sf-mais-mcp').isVisible())
    }
    await pagina.click('#sf-mais-mcp')
    const popup = pagina.frameLocator('#sf-chaves-fundo iframe')
    await popup.locator('[data-mcp="eco-de-teste"]').waitFor({ timeout: 10000 })
    conferir('mcps: o + abre direto na aba de ferramentas, com o catálogo e o MCP instalado, conectado', (await popup.locator('#aba-mcps').getAttribute('aria-selected')) === 'true' && (await popup.locator('form[data-catalogo]').count()) === 5 && /4 ferramentas/.test(await popup.locator('[data-mcp="eco-de-teste"] .estado').first().innerText()))
    await popup.locator('[data-mcp="eco-de-teste"] summary', { hasText: 'Ferramentas' }).click()
    const merge = popup.locator('[data-mcp="eco-de-teste"] .ferr', { hasText: 'merge_pull_request' })
    conferir('mcps: a tela mostra o merge bloqueado e desabilitado', /bloqueada/.test(await merge.innerText()) && (await merge.locator('input').isDisabled()))
    conferir('mcps: o segredo não aparece na tela', !(await popup.locator('body').innerHTML()).includes('abc123456'))
    await pagina.keyboard.press('Escape')
    await pagina.locator('#sf-chaves-fundo').waitFor({ state: 'detached', timeout: 3000 }).catch(() => {})
    conferir('chaves: Esc fecha o popup', (await pagina.locator('#sf-chaves-fundo').count()) === 0)
    const conjuntos = await (await pagina.request.get(BASE + '/api/datasets')).json()
    conferir('datasets: o conjunto inicial de critérios existe', Array.isArray(conjuntos.datasets) && conjuntos.datasets.some((d: { id: string }) => d.id === 'criterios-de-aceite'))
    const logs = await pagina.request.get(BASE + '/api/observability/logs?perPage=1')
    conferir('observabilidade: logs e métricas têm storage (DuckDB)', logs.status() === 200 && (await (await pagina.request.get(BASE + '/api/observability/discovery/metric-names')).status()) === 200)
    await pagina.goto(BASE + '/studio')
    await pagina.waitForLoadState('networkidle')
    await pagina.screenshot({ path: path.join(saida, 'studio.png') })
    await pagina.goto(BASE + '/studio/workflows/autonomo/graph')
    await pagina.locator('#sf-fases li').first().waitFor({ timeout: 15000 }).catch(() => {})
    conferir('autônomo: o canvas mostra o painel com as seis fases', (await pagina.locator('#sf-fases li').count()) === 6)
    conferir('autônomo: o ícone da marca é o tile branco', (await pagina.locator('svg[data-sf="1"] rect').first().getAttribute('fill')) === '#f0f0f0')

    // Lista de agentes: abre nos cartões, e a escolha da tabela é lembrada
    const visao = await navegador.newPage({ viewport: { width: 1440, height: 900 } })
    const naTabela = async () => (await visao.locator('[aria-label^="Name, "]').count()) > 0
    await visao.goto(BASE + '/studio/agents')
    await visao.getByRole('button', { name: 'Compact view' }).waitFor()
    await visao.waitForTimeout(800)
    conferir('agentes: a lista abre nos cartões, não na tabela', (await visao.getByRole('button', { name: 'Compact view' }).getAttribute('aria-pressed')) === 'true' && !(await naTabela()))
    await visao.getByRole('button', { name: 'List view' }).click()
    await visao.reload()
    await visao.getByRole('button', { name: 'List view' }).waitFor()
    await visao.waitForTimeout(800)
    conferir('agentes: quem escolhe a tabela fica com ela', await naTabela())
    await visao.getByRole('button', { name: 'Compact view' }).click()
    await visao.reload()
    await visao.getByRole('button', { name: 'Compact view' }).waitFor()
    await visao.waitForTimeout(800)
    conferir('agentes: voltar aos cartões também é lembrado', !(await naTabela()))
    await visao.close()

    // Sugestões com Tab, no estilo do Claude Code: campo vazio mostra a sugestão e Tab preenche
    const sug = await navegador.newPage({ viewport: { width: 1440, height: 900 } })
    await sug.addInitScript(() => localStorage.setItem('sf-sugestoes', JSON.stringify({ repositorio: 'acme/pedidos', amostra: 0 })))
    await sug.goto(BASE + '/studio/workflows/autonomo/graph')
    await sug.locator('textarea[name=titulo]').waitFor()
    await sug.waitForTimeout(1200)
    const campo = (nome: string) => sug.locator(`textarea[name=${nome}]`)
    const dica = async (nome: string) => campo(nome).evaluate((e: HTMLTextAreaElement) => e.placeholder)
    conferir('sugestões: o campo vazio mostra a sugestão em cinza', (await dica('titulo')) === 'Filtro de datas com hora' && /devolve 400/.test(await dica('criterios')))
    conferir('sugestões: repositório vem do histórico e branch base tem main como padrão', (await dica('repositorio')) === 'acme/pedidos' && (await dica('branchBase')) === 'main')
    conferir('sugestões: provedor e campos sem sugestão ficam sem cinza', (await sug.locator('input[name=provedor]').evaluate((e: HTMLInputElement) => e.placeholder)) === '')
    await campo('titulo').focus()
    await sug.waitForTimeout(200)
    conferir('sugestões: a dica "Tab preenche" aparece ao focar', await sug.locator('#sf-sug-chip').isVisible())
    await sug.keyboard.press('Tab')
    await sug.waitForTimeout(250)
    conferir('sugestões: Tab preenche o campo e a dica some', (await campo('titulo').inputValue()) === 'Filtro de datas com hora' && !(await sug.locator('#sf-sug-chip').isVisible()))
    await sug.keyboard.press('Tab')
    conferir('sugestões: com o campo preenchido, Tab só avança', (await sug.evaluate(() => (document.activeElement as HTMLTextAreaElement | null)?.name)) === 'descricao')
    await campo('descricao').focus()
    await sug.keyboard.press('Tab')
    await campo('repositorio').focus()
    await sug.keyboard.press('Tab')
    await campo('branchBase').focus()
    await sug.keyboard.press('Tab')
    await sug.waitForTimeout(300)
    await sug.getByText('JSON', { exact: true }).first().click()
    await sug.waitForTimeout(800)
    const estadoReact = await sug.evaluate(() => document.body.innerText)
    conferir('sugestões: o Studio recebe o valor de verdade (estado do formulário)', estadoReact.includes('Filtro de datas com hora') && estadoReact.includes('acme/pedidos') && /"branchBase":\s*"main"/.test(estadoReact))
    await sug.getByText('Form', { exact: true }).first().click()
    await sug.waitForTimeout(500)
    await campo('branchHead').focus()
    await sug.keyboard.press('Escape')
    conferir('sugestões: Esc ignora a sugestão do campo', !(await sug.locator('#sf-sug-chip').isVisible()))
    await sug.goto(BASE + '/studio/agents/chief-of-staff/chat/new')
    await sug.locator('form textarea').first().waitFor()
    await sug.waitForTimeout(1500)
    conferir('sugestões: o chat de cada agente sugere a próxima mensagem', (await sug.locator('form textarea').first().evaluate((e: HTMLTextAreaElement) => e.placeholder)) === 'Como está o quadro agora?')
    await sug.locator('form textarea').first().focus()
    await sug.keyboard.press('Tab')
    conferir('sugestões: Tab preenche a mensagem do chat', (await sug.locator('form textarea').first().inputValue()) === 'Como está o quadro agora?')
    await sug.close()
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
