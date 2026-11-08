// MCPs que o próprio usuário instala pela tela (/configuracoes, aba Ferramentas).
// Aqui ficam as regras, sem rede e sem Mastra: tipos, catálogo curado, política de segurança
// e persistência. A conexão de verdade está em super-factory/mcp-usuario.ts.
//
// Princípios:
// - O usuário escolhe do catálogo (versões fixas) ou aponta para um servidor remoto https público.
// - Rodar um comando qualquer dentro do container é execução de código: só com
//   SUPER_FACTORY_MCP_COMANDO=1, definido por quem administra a VPS. A tela não liga isso.
// - Segredos moram no cofre criptografado (chaves.ts). O arquivo de MCPs só guarda nomes.
// - Merge, deploy, force-push e aprovação seguem humanos: ferramenta com esse jeito nunca chega ao agente.

import dns from 'node:dns'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { segmento } from './guards.ts'

// ---------- tipos ----------

export type OndeVaiOSegredo = 'ambiente' | 'cabecalho'

export type SegredoDoMcp = {
  /** Nome do segredo no cofre: a variável de ambiente (stdio) ou um rótulo para o cabeçalho. */
  nome: string
  onde: OndeVaiOSegredo
  /** Só quando onde = cabecalho. */
  cabecalho?: string
  /** Texto fixo antes do valor, como "Bearer ". */
  prefixo?: string
  opcional?: boolean
  /** O valor guardado é base64("<parâmetro>:<valor>"). É o que o MCP do Azure DevOps pede para PAT. */
  basicoComParametro?: string
}

export type McpSalvo = {
  id: string
  nome: string
  origem: 'catalogo' | 'personalizado'
  catalogoId?: string
  transporte: { tipo: 'remoto'; url: string } | { tipo: 'comando'; comando: string; args: string[]; ambiente: Record<string, string> }
  segredos: SegredoDoMcp[]
  /** Parâmetros públicos informados na instalação (organização, e-mail). Nunca segredo. */
  parametros?: Record<string, string>
  ativo: boolean
  /** Nomes originais das ferramentas que o usuário desligou. O resto fica ligado. */
  desligadas: string[]
  criadoEm: string
  por: string
}

export type ItemDoCatalogo = {
  id: string
  nome: string
  descricao: string
  tipo: 'remoto' | 'comando'
  fonte: string
  url?: string
  comando?: string
  /** {param} é trocado pelo valor do parâmetro de mesmo nome. */
  args?: string[]
  parametros: Array<{ nome: string; rotulo: string; ajuda: string; tipo?: 'email' }>
  segredos: Array<SegredoDoMcp & { rotulo: string; ajuda: string }>
}

export const MAXIMO_DE_MCPS = 12

// ---------- política ----------

export type Politica = { comandoPersonalizado: boolean; redePrivada: boolean; maximo: number }

export function politica(): Politica {
  return {
    comandoPersonalizado: process.env.SUPER_FACTORY_MCP_COMANDO === '1',
    // Para testes e para quem tem MCP interno na própria rede. Não é oferecido na tela.
    redePrivada: process.env.SUPER_FACTORY_MCP_REDE_PRIVADA === '1',
    maximo: MAXIMO_DE_MCPS,
  }
}

const ID = /^[a-z0-9][a-z0-9-]{1,22}[a-z0-9]$/

export function validarIdDeMcp(id: unknown): string {
  if (typeof id !== 'string' || !ID.test(id)) throw new Error('O identificador usa de 3 a 24 letras minúsculas, números e hífen.')
  return id
}

export function idDoNome(nome: string): string {
  const base = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
    .replace(/-+$/g, '')
  if (!ID.test(base)) throw new Error('Dê um nome com pelo menos 3 letras ou números.')
  return base
}

function limparNome(nome: unknown): string {
  if (typeof nome !== 'string') throw new Error('Informe o nome do MCP.')
  const limpo = nome.trim().replace(/\s+/g, ' ')
  if (limpo.length < 3 || limpo.length > 40) throw new Error('O nome do MCP tem de 3 a 40 caracteres.')
  if (/[\x00-\x1F<>]/.test(limpo)) throw new Error('O nome não pode ter caracteres especiais.')
  return limpo
}

// ---------- rede: só servidor público ----------

export function enderecoPrivado(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a = 0, b = 0, c = 0] = ip.split('.').map(Number)
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    )
  }
  if (net.isIPv6(ip)) {
    const baixo = ip.toLowerCase()
    const mapeado = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(baixo)
    if (mapeado?.[1]) return enderecoPrivado(mapeado[1])
    return baixo === '::' || baixo === '::1' || /^f[cd]/.test(baixo) || /^fe[89ab]/.test(baixo) || baixo.startsWith('ff')
  }
  return true
}

const SUFIXOS_INTERNOS = ['.local', '.localhost', '.internal', '.lan', '.home.arpa', '.intranet', '.corp']

export type Resolvedor = (host: string) => Promise<string[]>

const resolverDoSistema: Resolvedor = async (host) => (await dns.promises.lookup(host, { all: true })).map((item) => item.address)

/**
 * Aceita só https para um nome público. Recusa endereço IP, nome interno, usuário na URL e
 * qualquer nome que resolva para a rede interna (a Factory roda ao lado de outros containers).
 */
export async function validarUrlRemota(entrada: unknown, resolver: Resolvedor = resolverDoSistema): Promise<URL> {
  if (typeof entrada !== 'string') throw new Error('Informe o endereço do MCP.')
  let url: URL
  try {
    url = new URL(entrada.trim())
  } catch {
    throw new Error('O endereço do MCP não é uma URL válida.')
  }
  const livre = politica().redePrivada
  if (url.protocol !== 'https:' && !(livre && url.protocol === 'http:')) throw new Error('O endereço precisa começar com https://.')
  if (url.username || url.password) throw new Error('Não coloque usuário nem senha na URL. Use o campo de cabeçalho, que é guardado criptografado.')
  if (url.href.length > 300) throw new Error('O endereço é longo demais.')
  if (livre) return url
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (net.isIP(host)) throw new Error('Use o nome do servidor, não o endereço IP.')
  if (!host.includes('.') || SUFIXOS_INTERNOS.some((sufixo) => host.endsWith(sufixo))) {
    throw new Error('Este endereço parece ser da rede interna. A Factory só conecta em MCP público.')
  }
  let enderecos: string[]
  try {
    enderecos = await resolver(host)
  } catch {
    throw new Error('Não consegui resolver o nome do servidor. Confira o endereço.')
  }
  if (enderecos.length === 0 || enderecos.some(enderecoPrivado)) throw new Error('Este nome aponta para a rede interna. A Factory só conecta em MCP público.')
  return url
}

// ---------- comando: só quem administra liga ----------

const LANCADORES = new Set(['npx', 'uvx', 'node', 'python3'])
const EXECUCAO_EM_LINHA: Record<string, string[]> = {
  npx: ['-c', '--call', '--shell'],
  node: ['-e', '--eval', '-p', '--print', '--input-type', '-r', '--require', '--import'],
  python3: ['-c', '-m'],
  uvx: ['--with-requirements'],
}

export function validarComando(comando: unknown, args: unknown): { comando: string; args: string[] } {
  if (typeof comando !== 'string' || !LANCADORES.has(comando)) {
    throw new Error(`O comando precisa ser um destes: ${[...LANCADORES].join(', ')}.`)
  }
  const lista = Array.isArray(args) ? args : []
  if (lista.length > 16) throw new Error('Argumentos demais (máximo 16).')
  const limpos = lista.map((arg) => {
    if (typeof arg !== 'string' || arg.length > 200 || /[\x00\r\n]/.test(arg)) throw new Error('Um dos argumentos é inválido.')
    return arg
  })
  const proibidos = EXECUCAO_EM_LINHA[comando] ?? []
  if (limpos.some((arg) => proibidos.includes(arg) || proibidos.some((flag) => flag.startsWith('--') && arg.startsWith(`${flag}=`)))) {
    throw new Error('Este argumento executa código solto e não é aceito. Aponte para um pacote ou um arquivo.')
  }
  return { comando, args: limpos }
}

const AMBIENTE_PROIBIDO = /^(PATH|HOME|SHELL|IFS|LD_.*|DYLD_.*|NODE_OPTIONS|NODE_PATH|NODE_EXTRA_CA_CERTS|NODE_TLS_REJECT_UNAUTHORIZED|PYTHON.*|NPM_CONFIG_.*|UV_.*|SUPER_FACTORY_.*)$/

export function validarNomeDeVariavel(nome: unknown): string {
  if (typeof nome !== 'string' || !/^[A-Z][A-Z0-9_]{0,63}$/.test(nome)) throw new Error('O nome da variável usa letras maiúsculas, números e sublinhado.')
  if (AMBIENTE_PROIBIDO.test(nome)) throw new Error(`A variável ${nome} não pode ser definida por um MCP.`)
  return nome
}

const CABECALHO_PROIBIDO = /^(host|content-length|content-type|accept|transfer-encoding|connection|upgrade|cookie|origin|referer|mcp-session-id|mcp-protocol-version)$/i

export function validarNomeDeCabecalho(nome: unknown): string {
  if (typeof nome !== 'string' || !/^[A-Za-z][A-Za-z0-9-]{0,63}$/.test(nome)) throw new Error('O nome do cabeçalho usa letras, números e hífen.')
  if (CABECALHO_PROIBIDO.test(nome)) throw new Error(`O cabeçalho ${nome} não pode ser definido.`)
  return nome
}

function valorSimples(valor: unknown, limite = 200): string {
  if (typeof valor !== 'string' || valor.length > limite || /[\x00-\x1F\x7F]/.test(valor)) throw new Error('Um dos valores é inválido.')
  return valor.trim()
}

// ---------- ferramentas: o que nunca chega ao agente ----------

const ACAO_HUMANA = /(^|[_.\-])(merge|deploy|publish|release|approve|rollback|force[_-]?push|delete[_-]?(branch|repo|repository))([_.\-]|$)/i

/**
 * Merge, deploy, publicação e aprovação são de uma pessoa. A ferramenta com esse nome só passa
 * se o servidor a declarar somente leitura (ex.: "get_merge_status"). A anotação é uma dica,
 * por isso o resto das ferramentas continua pedindo aprovação a cada uso.
 */
export function ferramentaBloqueada(nome: string, somenteLeitura: boolean): boolean {
  return ACAO_HUMANA.test(nome) && !somenteLeitura
}

export function precisaDeAprovacao(anotacoes: { readOnlyHint?: boolean } | undefined): boolean {
  return anotacoes?.readOnlyHint !== true
}

// ---------- catálogo curado ----------

export const CATALOGO: ItemDoCatalogo[] = [
  {
    id: 'microsoft-learn',
    nome: 'Microsoft Learn',
    descricao: 'Busca e lê a documentação oficial da Microsoft e do Azure. Não precisa de chave.',
    tipo: 'remoto',
    fonte: 'learn.microsoft.com',
    url: 'https://learn.microsoft.com/api/mcp',
    parametros: [],
    segredos: [],
  },
  {
    id: 'context7',
    nome: 'Context7',
    descricao: 'Traz documentação atualizada de bibliotecas e frameworks para o contexto. A chave é opcional e aumenta o limite de uso.',
    tipo: 'remoto',
    fonte: 'context7.com',
    url: 'https://mcp.context7.com/mcp',
    parametros: [],
    segredos: [{ nome: 'CONTEXT7_API_KEY', rotulo: 'Chave do Context7', ajuda: 'Opcional. Gere em context7.com.', onde: 'cabecalho', cabecalho: 'CONTEXT7_API_KEY', opcional: true }],
  },
  {
    id: 'github',
    nome: 'GitHub',
    descricao: 'Lê repositórios, issues e pull requests. Merge, deploy e aprovação ficam bloqueados pela Factory.',
    tipo: 'remoto',
    fonte: 'api.githubcopilot.com',
    url: 'https://api.githubcopilot.com/mcp/',
    parametros: [],
    segredos: [{ nome: 'GITHUB_PAT', rotulo: 'Token do GitHub', ajuda: 'Token fine-grained com o mínimo de permissão, só nos repositórios necessários.', onde: 'cabecalho', cabecalho: 'Authorization', prefixo: 'Bearer ' }],
  },
  {
    id: 'azure-devops',
    nome: 'Azure DevOps',
    descricao: 'Projetos, work items, repositórios, builds e wikis do Azure DevOps.',
    tipo: 'comando',
    fonte: 'npm: @azure-devops/mcp 2.11.0',
    comando: 'npx',
    // --authentication pat: o MCP manda o PAT como Basic. O modo envvar usaria Bearer, que é para token do Entra.
    args: ['-y', '@azure-devops/mcp@2.11.0', '{organizacao}', '--authentication', 'pat'],
    parametros: [
      { nome: 'organizacao', rotulo: 'Organização', ajuda: 'O nome que aparece em dev.azure.com/<organização>.' },
      { nome: 'email', rotulo: 'E-mail da conta', ajuda: 'O e-mail da conta dona do PAT.', tipo: 'email' },
    ],
    segredos: [
      {
        nome: 'PERSONAL_ACCESS_TOKEN',
        rotulo: 'PAT do Azure DevOps',
        ajuda: 'PAT com validade curta e escopos só de leitura. A Factory monta o formato que o MCP pede.',
        onde: 'ambiente',
        basicoComParametro: 'email',
      },
    ],
  },
  {
    id: 'raciocinio-em-etapas',
    nome: 'Raciocínio em etapas',
    descricao: 'Ajuda o agente a quebrar um problema grande em etapas e revisar o caminho. Não precisa de chave.',
    tipo: 'comando',
    fonte: 'npm: @modelcontextprotocol/server-sequential-thinking 2.1.1',
    comando: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking@2.1.1'],
    parametros: [],
    segredos: [],
  },
]

export function itemDoCatalogo(id: unknown): ItemDoCatalogo | undefined {
  return CATALOGO.find((item) => item.id === id)
}

// ---------- montar um MCP novo (valida tudo; não grava nada) ----------

export type NovoMcp = { definicao: McpSalvo; segredos: Record<string, string> }

/** O valor que vai para o cofre: o que a pessoa colou, ou o formato que o MCP exige (base64 de "e-mail:valor"). */
export function valorDoSegredo(segredo: SegredoDoMcp, bruto: string, parametros: Record<string, string> | undefined): string {
  if (!segredo.basicoComParametro) return bruto
  const usuario = parametros?.[segredo.basicoComParametro]
  if (!usuario) throw new Error(`Falta o parâmetro ${segredo.basicoComParametro} para montar o segredo ${segredo.nome}.`)
  return Buffer.from(`${usuario}:${bruto}`, 'utf8').toString('base64')
}

function segredosInformados(
  modelo: SegredoDoMcp[],
  recebidos: unknown,
): Record<string, string> {
  const dado = recebidos && typeof recebidos === 'object' ? (recebidos as Record<string, unknown>) : {}
  const saida: Record<string, string> = {}
  for (const segredo of modelo) {
    const valor = dado[segredo.nome]
    if (valor === undefined || valor === null || valor === '') {
      if (!segredo.opcional) throw new Error(`Falta o valor de ${segredo.nome}.`)
      continue
    }
    saida[segredo.nome] = valorSimples(valor, 4096)
    if (!saida[segredo.nome]) throw new Error(`O valor de ${segredo.nome} está vazio.`)
  }
  return saida
}

export function montarDoCatalogo(catalogoId: unknown, parametros: unknown, segredos: unknown, por: string): NovoMcp {
  const item = itemDoCatalogo(catalogoId)
  if (!item) throw new Error('Este MCP não está no catálogo.')
  const dado = parametros && typeof parametros === 'object' ? (parametros as Record<string, unknown>) : {}
  const valores: Record<string, string> = {}
  for (const parametro of item.parametros) {
    const informado = dado[parametro.nome]
    if (informado === undefined || informado === null || (typeof informado === 'string' && !informado.trim())) throw new Error(`Informe ${parametro.rotulo}.`)
    const bruto = valorSimples(informado, 100)
    // Um valor começando com hífen viraria opção de linha de comando do pacote.
    if (bruto.startsWith('-')) throw new Error(`${parametro.rotulo} não pode começar com hífen.`)
    if (parametro.tipo === 'email') {
      if (bruto.length > 120 || !/^[^\s@:]{1,64}@[^\s@:]{1,100}\.[^\s@:]{2,}$/.test(bruto)) throw new Error(`${parametro.rotulo} não parece um e-mail válido.`)
      valores[parametro.nome] = bruto
    } else {
      // Organização e nomes parecidos: só segmento seguro, nada que vire argumento novo.
      valores[parametro.nome] = segmento(bruto, parametro.rotulo)
    }
  }
  const modelo = item.segredos.map(({ nome, onde, cabecalho, prefixo, opcional, basicoComParametro }): SegredoDoMcp => ({ nome, onde, cabecalho, prefixo, opcional, basicoComParametro }))
  const recebidos = segredosInformados(modelo, segredos)
  for (const segredo of modelo) {
    const bruto = recebidos[segredo.nome]
    if (bruto !== undefined) recebidos[segredo.nome] = valorDoSegredo(segredo, bruto, valores)
  }
  const usados = modelo.filter((segredo) => recebidos[segredo.nome] !== undefined)
  const definicao: McpSalvo = {
    id: item.id,
    nome: item.nome,
    origem: 'catalogo',
    catalogoId: item.id,
    transporte:
      item.tipo === 'remoto'
        ? { tipo: 'remoto', url: item.url as string }
        : {
            tipo: 'comando',
            comando: item.comando as string,
            args: (item.args ?? []).map((arg) => arg.replace(/\{(\w+)\}/g, (_inteiro, nome: string) => valores[nome] ?? '')),
            ambiente: {},
          },
    segredos: usados,
    parametros: valores,
    ativo: true,
    desligadas: [],
    criadoEm: new Date().toISOString(),
    por: por.slice(0, 32),
  }
  return { definicao, segredos: recebidos }
}

export async function montarRemoto(
  entrada: { nome?: unknown; url?: unknown; cabecalhos?: unknown },
  por: string,
  resolver?: Resolvedor,
): Promise<NovoMcp> {
  const nome = limparNome(entrada.nome)
  const url = await validarUrlRemota(entrada.url, resolver)
  const lista = Array.isArray(entrada.cabecalhos) ? entrada.cabecalhos : []
  if (lista.length > 6) throw new Error('Cabeçalhos demais (máximo 6).')
  const segredos: SegredoDoMcp[] = []
  const valores: Record<string, string> = {}
  for (const bruto of lista) {
    const item = (bruto ?? {}) as { nome?: unknown; valor?: unknown; prefixo?: unknown }
    const cabecalho = validarNomeDeCabecalho(item.nome)
    const rotulo = `H_${cabecalho.replace(/-/g, '_').toUpperCase()}`
    if (valores[rotulo]) throw new Error(`O cabeçalho ${cabecalho} foi repetido.`)
    const prefixoLimpo = item.prefixo === undefined || item.prefixo === '' ? '' : valorSimples(item.prefixo, 20)
    const prefixo = prefixoLimpo ? `${prefixoLimpo} ` : undefined
    valores[rotulo] = valorSimples(item.valor, 4096)
    if (!valores[rotulo]) throw new Error(`O valor do cabeçalho ${cabecalho} está vazio.`)
    segredos.push({ nome: rotulo, onde: 'cabecalho', cabecalho, prefixo })
  }
  const definicao: McpSalvo = {
    id: idDoNome(nome),
    nome,
    origem: 'personalizado',
    transporte: { tipo: 'remoto', url: url.href },
    segredos,
    ativo: true,
    desligadas: [],
    criadoEm: new Date().toISOString(),
    por: por.slice(0, 32),
  }
  return { definicao, segredos: valores }
}

export function montarComandoPersonalizado(
  entrada: { nome?: unknown; comando?: unknown; args?: unknown; ambiente?: unknown; segredos?: unknown },
  por: string,
): NovoMcp {
  if (!politica().comandoPersonalizado) {
    throw new Error('Comando personalizado está desligado. Quem administra a VPS liga com SUPER_FACTORY_MCP_COMANDO=1 no .env.')
  }
  const nome = limparNome(entrada.nome)
  const { comando, args } = validarComando(entrada.comando, entrada.args)
  const ambiente: Record<string, string> = {}
  const publico = entrada.ambiente && typeof entrada.ambiente === 'object' ? (entrada.ambiente as Record<string, unknown>) : {}
  if (Object.keys(publico).length > 12) throw new Error('Variáveis demais (máximo 12).')
  for (const [chave, valor] of Object.entries(publico)) ambiente[validarNomeDeVariavel(chave)] = valorSimples(valor, 500)
  const secretos = entrada.segredos && typeof entrada.segredos === 'object' ? (entrada.segredos as Record<string, unknown>) : {}
  if (Object.keys(secretos).length > 12) throw new Error('Segredos demais (máximo 12).')
  const segredos: SegredoDoMcp[] = []
  const valores: Record<string, string> = {}
  for (const [chave, valor] of Object.entries(secretos)) {
    const variavel = validarNomeDeVariavel(chave)
    if (variavel in ambiente) throw new Error(`${variavel} foi informada como pública e como segredo.`)
    valores[variavel] = valorSimples(valor, 4096)
    if (!valores[variavel]) throw new Error(`O valor de ${variavel} está vazio.`)
    segredos.push({ nome: variavel, onde: 'ambiente' })
  }
  const definicao: McpSalvo = {
    id: idDoNome(nome),
    nome,
    origem: 'personalizado',
    transporte: { tipo: 'comando', comando, args, ambiente },
    segredos,
    ativo: true,
    desligadas: [],
    criadoEm: new Date().toISOString(),
    por: por.slice(0, 32),
  }
  return { definicao, segredos: valores }
}

// ---------- persistência (só dados sem segredo) ----------

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export function caminhoDosMcps(): string {
  return process.env.SUPER_FACTORY_MCPS_PATH?.trim() || path.join(raiz, 'data', 'mcps.json')
}

export function lerMcps(): McpSalvo[] {
  try {
    const dado = JSON.parse(fs.readFileSync(caminhoDosMcps(), 'utf8')) as { v?: number; servidores?: McpSalvo[] }
    if (dado.v !== 1 || !Array.isArray(dado.servidores)) return []
    return dado.servidores.filter((item) => ID.test(item?.id ?? '') && item.transporte)
  } catch {
    return []
  }
}

export function gravarMcps(lista: McpSalvo[]): void {
  const alvo = caminhoDosMcps()
  fs.mkdirSync(path.dirname(alvo), { recursive: true })
  const temporario = `${alvo}.${process.pid}.tmp`
  fs.writeFileSync(temporario, JSON.stringify({ v: 1, servidores: lista }, null, 2), { mode: 0o600 })
  fs.renameSync(temporario, alvo)
}

export function pastaDeTrabalho(id: string): string {
  const pasta = path.join(path.dirname(caminhoDosMcps()), 'mcps-trabalho', validarIdDeMcp(id))
  fs.mkdirSync(pasta, { recursive: true, mode: 0o700 })
  return pasta
}
