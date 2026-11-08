// Colar a configuração de um MCP no formato do Cursor, do Claude Desktop ou do VS Code:
//   { "mcpServers": { "context7": { "command": "npx", "args": ["-y", "@upstash/context7-mcp"] } } }
// A Factory não confia no que foi colado: reconhecido vira item do catálogo (versão fixa, endereço oficial);
// URL passa pela checagem de rede pública; comando só com a liberação do administrador. Valores de env e de
// cabeçalho são sempre tratados como segredo (cofre criptografado) e nunca voltam em resposta.

import {
  CATALOGO,
  limparNome,
  montarComandoPersonalizado,
  montarDoCatalogo,
  montarRemoto,
  politica,
  type NovoMcp,
  type Resolvedor,
} from './mcps.ts'

export const MAXIMO_COLADO = 5
const LIMITE_DO_TEXTO = 12_000

export type EntradaColada = {
  nome: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
}

export type ItemColado = {
  nome: string
  modo: 'catalogo' | 'remoto' | 'comando'
  resumo: string
  /** Só os nomes. O valor nunca volta ao navegador. */
  segredos: string[]
  avisos: string[]
  erro?: string
  novo?: NovoMcp
}

function objeto(valor: unknown): Record<string, unknown> | null {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Record<string, unknown>) : null
}

function textoOuNada(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : undefined
}

function mapaDeTextos(valor: unknown, rotulo: string): Record<string, string> {
  const dado = objeto(valor)
  if (!dado) return {}
  const saida: Record<string, string> = {}
  for (const [chave, v] of Object.entries(dado)) {
    if (typeof v !== 'string') throw new Error(`${rotulo} "${chave}" precisa ser texto.`)
    saida[chave] = v
  }
  return saida
}

function entradaDe(nome: string, bruto: unknown): EntradaColada {
  const dado = objeto(bruto)
  if (!dado) throw new Error(`"${nome}" não é uma configuração de servidor.`)
  const url = textoOuNada(dado.url) ?? textoOuNada(dado.serverUrl)
  let comando = textoOuNada(dado.command)
  let args = Array.isArray(dado.args) ? dado.args.map((arg) => (typeof arg === 'string' ? arg : String(arg))) : undefined
  // "npx -y pacote" num só texto: separa quando não há aspas nem argumentos à parte.
  if (comando && !args && /\s/.test(comando) && !/["'`$&;|<>]/.test(comando)) {
    const partes = comando.split(/\s+/)
    comando = partes[0]
    args = partes.slice(1)
  }
  if (!url && !comando) throw new Error(`"${nome}" precisa de "command" ou de "url".`)
  if (url && comando) throw new Error(`"${nome}" tem "command" e "url" ao mesmo tempo. Cole um ou outro.`)
  return { nome, command: comando, args, env: mapaDeTextos(dado.env, 'A variável'), url, headers: mapaDeTextos(dado.headers, 'O cabeçalho') }
}

export function lerConfiguracaoColada(texto: unknown): { entradas: EntradaColada[]; avisos: string[] } {
  if (typeof texto !== 'string' || !texto.trim()) throw new Error('Cole a configuração do MCP.')
  if (texto.length > LIMITE_DO_TEXTO) throw new Error('O texto colado é grande demais.')
  let raiz: unknown
  try {
    // O Cursor aceita comentários e vírgula sobrando; o JSON de verdade, não. Tira só o que é seguro tirar.
    raiz = JSON.parse(texto.replace(/^﻿/, '').trim().replace(/,(\s*[}\]])/g, '$1'))
  } catch {
    throw new Error('Isto não é um JSON válido. Cole o trecho inteiro, com as chaves { }.')
  }
  const topo = objeto(raiz)
  if (!topo) throw new Error('O JSON precisa ser um objeto, como { "mcpServers": { ... } }.')
  const servidores = objeto(topo.mcpServers) ?? objeto(topo.servers) ?? objeto(objeto(topo.mcp)?.servers)
  const avisos: string[] = []
  let pares: Array<[string, unknown]>
  if (servidores) pares = Object.entries(servidores)
  else if (topo.command !== undefined || topo.url !== undefined) pares = [[nomeDoPacote(topo), topo]]
  else if (Object.values(topo).length > 0 && Object.values(topo).every((v) => objeto(v) && (objeto(v)?.command !== undefined || objeto(v)?.url !== undefined))) pares = Object.entries(topo)
  else throw new Error('Não achei "mcpServers" nem um servidor com "command" ou "url".')
  if (pares.length === 0) throw new Error('A lista de servidores está vazia.')
  if (pares.length > MAXIMO_COLADO) throw new Error(`No máximo ${MAXIMO_COLADO} servidores por vez.`)
  const entradas = pares.map(([nome, valor]) => {
    const dado = objeto(valor)
    for (const campo of Object.keys(dado ?? {})) {
      if (!['command', 'args', 'env', 'url', 'serverUrl', 'headers', 'type', 'transport', 'disabled', 'autoApprove', 'alwaysAllow', 'timeout', 'cwd', 'envFile'].includes(campo)) avisos.push(`"${nome}": o campo "${campo}" foi ignorado.`)
    }
    if (dado && ('autoApprove' in dado || 'alwaysAllow' in dado)) avisos.push(`"${nome}": aprovação automática não existe aqui. Ferramentas que alteram algo continuam pedindo a sua aprovação.`)
    if (dado && 'cwd' in dado) avisos.push(`"${nome}": a pasta de trabalho é sempre a da Factory.`)
    return entradaDe(nome, valor)
  })
  return { entradas, avisos }
}

function nomeDoPacote(topo: Record<string, unknown>): string {
  const args = Array.isArray(topo.args) ? topo.args.map(String) : []
  const pacote = pacoteDe(args) ?? textoOuNada(topo.url) ?? 'mcp'
  return pacote.replace(/^@[^/]+\//, '').replace(/[^A-Za-z0-9]+/g, ' ').trim() || 'mcp'
}

/** O pacote npm de uma linha "npx -y @escopo/pacote@versão ...", sem a versão. */
function pacoteDe(args: string[]): string | undefined {
  const alvo = args.find((arg) => !arg.startsWith('-'))
  if (!alvo) return undefined
  const versao = alvo.lastIndexOf('@')
  return versao > 0 ? alvo.slice(0, versao) : alvo
}

function semBarraFinal(url: string): string {
  return url.replace(/\/+$/, '')
}

function nomeAmigavel(nome: string): string {
  const base = nome.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  const nomeFinal = base.length >= 3 ? base : `${base} mcp`
  return limparNome(nomeFinal.charAt(0).toUpperCase() + nomeFinal.slice(1))
}

/** Interpreta cada servidor colado, sem instalar nada. `novo` leva os segredos e só existe no servidor. */
export async function analisarColagem(texto: unknown, por: string, resolver?: Resolvedor): Promise<{ itens: ItemColado[]; avisos: string[] }> {
  const { entradas, avisos } = lerConfiguracaoColada(texto)
  const itens: ItemColado[] = []
  for (const entrada of entradas) {
    const item: ItemColado = { nome: entrada.nome, modo: entrada.url ? 'remoto' : 'comando', resumo: '', segredos: [], avisos: [] }
    try {
      const valoresDeEnv = entrada.env ?? {}
      const valoresDeCabecalho = entrada.headers ?? {}
      const pacote = entrada.command ? pacoteDe(entrada.args ?? []) : undefined
      const doCatalogo = entrada.command && ['npx', 'bunx', 'pnpm', 'yarn'].includes(entrada.command) && pacote
        ? CATALOGO.find((c) => c.pacotes?.includes(pacote))
        : entrada.url
          ? CATALOGO.find((c) => c.url && semBarraFinal(c.url) === semBarraFinal(entrada.url as string))
          : undefined
      if (doCatalogo && doCatalogo.parametros.length === 0) {
        // Reconhecido: usa a versão do catálogo, que a Factory fixou e revisou, em vez do que veio colado.
        const segredos: Record<string, string> = {}
        for (const modelo of doCatalogo.segredos) {
          const deEnv = valoresDeEnv[modelo.nome]
          const deCabecalho = modelo.cabecalho ? valoresDeCabecalho[modelo.cabecalho] : undefined
          const bruto = deEnv ?? deCabecalho
          if (bruto) segredos[modelo.nome] = modelo.prefixo && bruto.startsWith(modelo.prefixo) ? bruto.slice(modelo.prefixo.length) : bruto
        }
        const sobra = [...Object.keys(valoresDeEnv).filter((k) => !doCatalogo.segredos.some((m) => m.nome === k)), ...Object.keys(valoresDeCabecalho).filter((k) => !doCatalogo.segredos.some((m) => m.cabecalho === k))]
        if (sobra.length > 0) item.avisos.push(`Ignorei ${sobra.join(', ')}: o catálogo só usa o que o próprio servidor precisa.`)
        item.novo = montarDoCatalogo(doCatalogo.id, {}, segredos, por)
        item.modo = 'catalogo'
        item.nome = doCatalogo.nome
        item.resumo = `Reconhecido como ${doCatalogo.nome} (${doCatalogo.fonte}). Instalo a versão do catálogo da Factory${entrada.command ? ', sem rodar o pacote colado' : ''}.`
        item.segredos = Object.keys(segredos)
      } else if (entrada.url) {
        const cabecalhos = Object.entries(valoresDeCabecalho).map(([nome, valor]) => {
          const m = /^(Bearer|Token|Basic)\s+(.+)$/i.exec(valor)
          return m ? { nome, prefixo: m[1], valor: m[2] } : { nome, valor }
        })
        item.novo = await montarRemoto({ nome: nomeAmigavel(entrada.nome), url: entrada.url, cabecalhos }, por, resolver)
        item.resumo = `Servidor remoto ${new URL(entrada.url).host}. Só https e só endereço público.`
        item.segredos = Object.keys(valoresDeCabecalho)
      } else {
        if (!politica().comandoPersonalizado) {
          throw new Error(`"${entrada.command} ${(entrada.args ?? []).join(' ')}" não está no catálogo. Rodar um comando é executar código dentro da Factory, e quem administra a VPS precisa ligar SUPER_FACTORY_MCP_COMANDO=1 no .env. Se o servidor tiver um endereço https, cole a versão com "url".`)
        }
        const ambienteSecreto = valoresDeEnv
        item.novo = montarComandoPersonalizado({ nome: nomeAmigavel(entrada.nome), comando: entrada.command, args: entrada.args ?? [], segredos: ambienteSecreto }, por)
        item.resumo = `Comando ${entrada.command} no servidor. Sem versão fixa o pacote pode mudar: prefira @pacote@1.2.3.`
        item.segredos = Object.keys(ambienteSecreto)
        if (pacote && !/@\d/.test((entrada.args ?? []).find((a) => !a.startsWith('-')) ?? '')) item.avisos.push('O pacote está sem versão fixa. Coloque @1.2.3 para a Factory não rodar uma versão nova sem você saber.')
      }
    } catch (erro) {
      item.erro = erro instanceof Error ? erro.message : 'Não consegui interpretar.'
    }
    itens.push(item)
  }
  if (itens.length > 1) {
    const ids = itens.map((item) => item.novo?.definicao.id).filter(Boolean)
    if (new Set(ids).size !== ids.length) for (const item of itens) if (item.novo) item.erro = 'Dois servidores colados ficariam com o mesmo nome.'
  }
  return { itens, avisos }
}

/** O que vai para o navegador: nunca o `novo` (tem os segredos). */
export function paraONavegador(itens: ItemColado[]) {
  return itens.map(({ novo, ...resto }) => ({ ...resto, id: novo?.definicao.id ?? null, pronto: Boolean(novo) && !resto.erro }))
}
