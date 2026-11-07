const RODAPE = '_Factory local, sem provedor de modelo. Portão, merge e deploy não saem daqui._'

export type PlanoFactory =
  | { kind: 'text'; text: string }
  | { kind: 'tool'; toolName: string; input: Record<string, unknown> }

type Parte = {
  type?: string
  text?: string
  toolName?: string
  output?: { type?: string; value?: unknown }
}

type Mensagem = {
  role?: string
  content?: string | Parte[]
}

const PAPEIS = ['chief-of-staff', 'architect', 'frontend', 'backend', 'integrations', 'qa', 'security', 'docs'] as const
type Papel = (typeof PAPEIS)[number]

const LEITURA = ['statusQuadro', 'validarManifesto', 'lerLedger', 'lintarCriterios', 'planejarOnda', 'avaliarPortaoMerge', 'listarGithub', 'listarAzure', 'lerBaseProjeto', 'lerPoliticaProjeto', 'conduzirInstalacao']

const PERMITIDO: Record<Papel, string[]> = {
  'chief-of-staff': [...LEITURA, 'abrirCard', 'criarIssueGithub', 'criarWorkItemAzure'],
  architect: ['statusQuadro', 'validarManifesto', 'lerLedger', 'lintarCriterios', 'planejarOnda', 'lerBaseProjeto', 'lerPoliticaProjeto', 'conduzirInstalacao'],
  frontend: ['statusQuadro', 'lerLedger', 'lintarCriterios', 'lerBaseProjeto', 'lerPoliticaProjeto', 'conduzirInstalacao'],
  backend: ['statusQuadro', 'lerLedger', 'lintarCriterios', 'lerBaseProjeto', 'lerPoliticaProjeto', 'conduzirInstalacao'],
  integrations: ['statusQuadro', 'lerLedger', 'listarGithub', 'listarAzure', 'criarIssueGithub', 'criarWorkItemAzure', 'lerBaseProjeto', 'lerPoliticaProjeto', 'conduzirInstalacao'],
  qa: ['statusQuadro', 'lerLedger', 'lintarCriterios', 'avaliarPortaoMerge', 'lerBaseProjeto', 'lerPoliticaProjeto', 'conduzirInstalacao'],
  security: ['statusQuadro', 'lerLedger', 'lintarCriterios', 'validarManifesto', 'avaliarPortaoMerge', 'lerBaseProjeto', 'lerPoliticaProjeto', 'conduzirInstalacao'],
  docs: ['statusQuadro', 'lerLedger', 'lintarCriterios', 'lerBaseProjeto', 'lerPoliticaProjeto', 'conduzirInstalacao'],
}

export function textoDoUsuario(prompt: Mensagem[]): string {
  const ultima = prompt.filter((mensagem) => mensagem.role === 'user').at(-1)
  if (!ultima) return ''
  if (typeof ultima.content === 'string') return ultima.content
  return (ultima.content ?? [])
    .map((parte) => (parte.type === 'text' && parte.text ? parte.text : ''))
    .join('\n')
    .trim()
}

export function textoDoSistema(prompt: Mensagem[]): string {
  return prompt
    .filter((mensagem) => mensagem.role === 'system')
    .map((mensagem) => (typeof mensagem.content === 'string' ? mensagem.content : ''))
    .join('\n')
}

export function ultimoResultado(prompt: Mensagem[]): unknown {
  let resultado: unknown
  for (const mensagem of prompt) {
    const partes = Array.isArray(mensagem.content) ? mensagem.content : []
    for (const parte of partes) {
      if (parte.type !== 'tool-result' || !parte.output) continue
      resultado = parte.output.value
    }
  }
  return resultado
}

export function papelDe(sistema: string): Papel {
  const encontrado = sistema.match(/PAPEL:\s*([a-z-]+)/)
  const papel = encontrado?.[1]
  if (papel && PAPEIS.includes(papel as Papel)) return papel as Papel
  return 'chief-of-staff'
}

function repositorioDe(texto: string): string | null {
  const explicito = texto.match(/(?:repo|reposit[oó]rio|projeto)\s*[:=]\s*([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?)/i)
  if (explicito?.[1]) return explicito[1]
  const par = texto.match(/\b([A-Za-z0-9_.-]{2,})\/([A-Za-z0-9_.-]{2,})\b/)
  return par ? `${par[1]}/${par[2]}` : null
}

function criteriosDe(texto: string): string[] {
  return texto
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter((linha) => /^[-*]/.test(linha))
    .map((linha) => linha.replace(/^[-*]\s*/, ''))
}

function runDe(texto: string): string | null {
  return texto.match(/\bR-\d+\b/)?.[0] ?? null
}

function formatar(resultado: unknown): string {
  if (!resultado || typeof resultado !== 'object') return `Não consegui ler o retorno.\n\n${RODAPE}`
  const registro = resultado as { resumo?: unknown }
  if (typeof registro.resumo === 'string') return `${registro.resumo}\n\n${RODAPE}`
  return `${JSON.stringify(resultado, null, 2)}\n\n${RODAPE}`
}

function ajuda(papel: Papel): string {
  if (papel === 'security') {
    return ['Segurança é somente leitura.', 'Posso olhar o quadro, o manifesto, a trilha e se um merge tem evidência.', 'Não abro card, issue nem work item, e não aprovo portão.', '', RODAPE].join('\n')
  }
  if (papel === 'chief-of-staff') {
    return [
      'Para um ciclo com portões, rode o workflow sdlc.',
      'O formulário pede título, descrição, um critério por linha, provedor e repositório.',
      'Quando o passo suspender, retome com aprovado, aprovador e nota. Eu não aprovo.',
      '',
      RODAPE,
    ].join('\n')
  }
  if (papel === 'integrations') {
    return ['Eu leio e abro issue ou work item. Pull request rascunho só sai do workflow, depois do portão de merge.', '', RODAPE].join('\n')
  }
  return [`Papel ${papel}. O ciclo governado é o workflow sdlc. Eu não aprovo portão nem faço merge.`, '', RODAPE].join('\n')
}

function escolher(papel: Papel, texto: string): PlanoFactory {
  const repo = repositorioDe(texto)
  const runId = runDe(texto)
  let ferramenta = ''
  let input: Record<string, unknown> = {}

  if (/\b(instal|npm err|eaddrinuse|command not found|enoent)\b/i.test(texto) || /passo\s*[1-7]/i.test(texto)) {
    const numero = texto.match(/passo\s*([1-7])/i)
    ferramenta = 'conduzirInstalacao'
    input = { relato: texto, ...(numero ? { passo: Number(numero[1]) } : {}) }
  } else if (/\b(pol[ií]tica|autonomia)\b/i.test(texto)) {
    if (!repo) return { kind: 'text', text: `Diga o repositório, por exemplo repo: acme/widgets. A autonomia é entrega humana.\n\n${RODAPE}` }
    ferramenta = 'lerPoliticaProjeto'
    input = { repositorio: repo }
  } else if (/\b(base do projeto|regras do cliente)\b/i.test(texto)) {
    if (!repo) return { kind: 'text', text: `Diga o repositório, por exemplo repo: acme/widgets.\n\n${RODAPE}` }
    ferramenta = 'lerBaseProjeto'
    input = { repositorio: repo }
  } else if (/\b(quadro|status|board|colunas)\b/i.test(texto)) {
    ferramenta = 'statusQuadro'
  } else if (/\b(manifesto|invariantes|port[oõ]es)\b/i.test(texto)) {
    ferramenta = 'validarManifesto'
  } else if (/\b(trilha|ledger|hist[oó]rico)\b/i.test(texto)) {
    ferramenta = 'lerLedger'
    input = runId ? { runId } : {}
  } else if (/\b(onda|wave)\b/i.test(texto)) {
    ferramenta = 'planejarOnda'
    input = { limite: 3 }
  } else if (/\bmerge\b/i.test(texto)) {
    if (!runId) return { kind: 'text', text: `Diga o ciclo, por exemplo R-3, que eu leio o portão. Eu não aprovo.\n\n${RODAPE}` }
    ferramenta = 'avaliarPortaoMerge'
    input = { runId }
  } else if (/\b(crit[eé]rios|aceite)\b/i.test(texto)) {
    ferramenta = 'lintarCriterios'
    input = { criterios: texto }
  } else if (/\b(azure|devops|work item)\b/i.test(texto) && /\b(cria|abre|abrir|criar)\b/i.test(texto)) {
    if (!repo) return { kind: 'text', text: `Diga o projeto, por exemplo projeto: fabrica.\n\n${RODAPE}` }
    ferramenta = 'criarWorkItemAzure'
    input = { projeto: repo, titulo: texto.split('\n')[0]?.slice(0, 80) || 'Card', corpo: texto }
  } else if (/\b(azure|devops|work item)\b/i.test(texto)) {
    if (!repo) return { kind: 'text', text: `Diga o projeto, por exemplo projeto: fabrica.\n\n${RODAPE}` }
    ferramenta = 'listarAzure'
    input = { projeto: repo.includes('/') ? repo.split('/')[0] : repo }
  } else if (/\bgithub\b/i.test(texto) && /\b(cria|abre|abrir|criar|issue)\b/i.test(texto) && /\b(cria|abre|abrir|criar)\b/i.test(texto)) {
    if (!repo) return { kind: 'text', text: `Diga o repositório, por exemplo repo: acme/widgets.\n\n${RODAPE}` }
    ferramenta = 'criarIssueGithub'
    input = { repositorio: repo, titulo: texto.split('\n')[0]?.slice(0, 80) || 'Card', corpo: texto }
  } else if (/\b(github|issues)\b/i.test(texto)) {
    if (!repo) return { kind: 'text', text: `Diga o repositório, por exemplo repo: acme/widgets.\n\n${RODAPE}` }
    ferramenta = 'listarGithub'
    input = { repositorio: repo }
  } else if (texto.trim().length >= 40 && criteriosDe(texto).length > 0) {
    if (!repo) return { kind: 'text', text: `Falta o repositório. Use repo: owner/nome ou projeto: nome.\n\n${RODAPE}` }
    ferramenta = 'abrirCard'
    input = {
      titulo: (texto.split('\n')[0] ?? 'Card').replace(/^[-*]\s*/, '').slice(0, 80),
      descricao: texto,
      criterios: criteriosDe(texto).join('\n'),
      provedor: /\bazure\b/i.test(texto) ? 'azure-devops' : 'github',
      repositorio: repo,
      branchBase: 'main',
    }
  } else {
    return { kind: 'text', text: ajuda(papel) }
  }

  if (!PERMITIDO[papel].includes(ferramenta)) {
    if (papel === 'security') return { kind: 'text', text: ajuda('security') }
    return { kind: 'text', text: `Este papel não usa ${ferramenta}. ${ajuda(papel)}` }
  }
  return { kind: 'tool', toolName: ferramenta, input }
}

export function planejarFactory(entrada: { userText: string; systemText: string; toolResult?: unknown }): PlanoFactory {
  if (entrada.toolResult !== undefined) return { kind: 'text', text: formatar(entrada.toolResult) }
  return escolher(papelDe(entrada.systemText), entrada.userText.trim())
}

let chamada = 0

type Opcoes = {
  prompt: Mensagem[]
}

function planoDasOpcoes(options: Opcoes): PlanoFactory {
  return planejarFactory({
    userText: textoDoUsuario(options.prompt),
    systemText: textoDoSistema(options.prompt),
    toolResult: ultimoResultado(options.prompt),
  })
}

function uso(texto: string) {
  const outputTokens = Math.max(1, Math.ceil(texto.length / 4))
  return { inputTokens: 32, outputTokens, totalTokens: 32 + outputTokens }
}

export function criarFactoryModel() {
  return {
    specificationVersion: 'v2' as const,
    provider: 'super-factory',
    modelId: 'factory',
    supportedUrls: {},
    async doGenerate(options: Opcoes) {
      const plano = planoDasOpcoes(options)
      if (plano.kind === 'tool') {
        const toolCallId = `factory_${++chamada}`
        const input = JSON.stringify(plano.input)
        return {
          content: [{ type: 'tool-call' as const, toolCallId, toolName: plano.toolName, input }],
          finishReason: 'tool-calls' as const,
          usage: uso(input),
          warnings: [],
        }
      }
      return {
        content: [{ type: 'text' as const, text: plano.text }],
        finishReason: 'stop' as const,
        usage: uso(plano.text),
        warnings: [],
      }
    },
    async doStream(options: Opcoes) {
      const plano = planoDasOpcoes(options)
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] })
          if (plano.kind === 'tool') {
            const id = `factory_${++chamada}`
            const input = JSON.stringify(plano.input)
            controller.enqueue({ type: 'tool-input-start', id, toolName: plano.toolName })
            controller.enqueue({ type: 'tool-input-delta', id, delta: input })
            controller.enqueue({ type: 'tool-input-end', id })
            controller.enqueue({ type: 'tool-call', toolCallId: id, toolName: plano.toolName, input })
            controller.enqueue({ type: 'finish', finishReason: 'tool-calls', usage: uso(input) })
          } else {
            controller.enqueue({ type: 'text-start', id: 'texto' })
            controller.enqueue({ type: 'text-delta', id: 'texto', delta: plano.text })
            controller.enqueue({ type: 'text-end', id: 'texto' })
            controller.enqueue({ type: 'finish', finishReason: 'stop', usage: uso(plano.text) })
          }
          controller.close()
        },
      })
      return { stream }
    },
  }
}
