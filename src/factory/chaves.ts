// Chaves e acessos guardados pelo painel (/configuracoes).
// - Lista fechada de nomes: o painel nunca grava uma variável qualquer.
// - Criptografadas em disco (AES-256-GCM). A chave mestra vem de SUPER_FACTORY_MASTER_KEY;
//   sem ela, nasce um arquivo ao lado do cofre (menos seguro, e o painel avisa).
// - O valor nunca volta para a tela. Nenhuma função daqui devolve ou registra um segredo.
// - Valem na hora: o valor salvo vai para process.env, que o código lê a cada chamada.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { segmento } from './guards.ts'

export type Definicao = {
  nome: string
  rotulo: string
  grupo: 'modelo' | 'repositorio'
  secreto: boolean
  ajuda: string
  autonomo?: boolean
}

export const DEFINICOES: Definicao[] = [
  { nome: 'ANTHROPIC_API_KEY', rotulo: 'Anthropic (Claude)', grupo: 'modelo', secreto: true, autonomo: true, ajuda: 'Obrigatória no modo autônomo: é o agente construtor que escreve o código.' },
  { nome: 'OPENAI_API_KEY', rotulo: 'OpenAI', grupo: 'modelo', secreto: true, ajuda: 'Opcional. Libera os modelos da OpenAI no chat do Studio.' },
  { nome: 'GOOGLE_API_KEY', rotulo: 'Google (Gemini)', grupo: 'modelo', secreto: true, ajuda: 'Opcional. Libera os modelos do Gemini no chat do Studio.' },
  { nome: 'GITHUB_TOKEN', rotulo: 'GitHub: token', grupo: 'repositorio', secreto: true, autonomo: true, ajuda: 'Token fine-grained só nos repositórios da Factory: Contents, Pull requests e Issues com Read and write.' },
  { nome: 'GITHUB_PROJECT_TOKEN', rotulo: 'GitHub: token do Project', grupo: 'repositorio', secreto: true, ajuda: 'Opcional. Para ler e organizar o GitHub Project. Project de usuário exige token clássico com os escopos repo e project; sem esta chave, vale o token do GitHub acima.' },
  { nome: 'AZURE_DEVOPS_ORG', rotulo: 'Azure DevOps: organização', grupo: 'repositorio', secreto: false, autonomo: true, ajuda: 'Só o nome da organização, o trecho depois de dev.azure.com/.' },
  { nome: 'AZURE_DEVOPS_PAT', rotulo: 'Azure DevOps: PAT', grupo: 'repositorio', secreto: true, autonomo: true, ajuda: 'PAT com validade curta, escopos Code (Read & write) e Work Items (Read & write).' },
]

export function definicao(nome: string): Definicao | undefined {
  return DEFINICOES.find((item) => item.nome === nome)
}

// ---------- cofre criptografado ----------

type Conteudo = Record<string, { valor: string; em: string; por: string }>
type Arquivo = { v: 1; iv: string; tag: string; dados: string }

const AAD = Buffer.from('super-factory:chaves:v1')
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export function caminhoDoCofre(): string {
  return process.env.SUPER_FACTORY_KEYS_PATH?.trim() || path.join(raiz, 'data', 'chaves.enc.json')
}

function caminhoDaChaveMestra(): string {
  return path.join(path.dirname(caminhoDoCofre()), 'chaves.key')
}

function chaveDoAmbiente(): Buffer | null {
  const bruto = process.env.SUPER_FACTORY_MASTER_KEY?.trim()
  if (!bruto) return null
  const bytes = Buffer.from(bruto, 'base64')
  return bytes.length === 32 ? bytes : crypto.createHash('sha256').update(bruto).digest()
}

function chaveDoArquivo(criar: boolean): Buffer | null {
  const alvo = caminhoDaChaveMestra()
  try {
    const bytes = Buffer.from(fs.readFileSync(alvo, 'utf8').trim(), 'base64')
    if (bytes.length === 32) return bytes
  } catch {}
  if (!criar) return null
  fs.mkdirSync(path.dirname(alvo), { recursive: true })
  const nova = crypto.randomBytes(32)
  fs.writeFileSync(alvo, nova.toString('base64'), { mode: 0o600 })
  return nova
}

export function cifrar(conteudo: Conteudo, chave: Buffer): Arquivo {
  const iv = crypto.randomBytes(12)
  const cifra = crypto.createCipheriv('aes-256-gcm', chave, iv)
  cifra.setAAD(AAD)
  const dados = Buffer.concat([cifra.update(JSON.stringify(conteudo), 'utf8'), cifra.final()])
  return { v: 1, iv: iv.toString('base64'), tag: cifra.getAuthTag().toString('base64'), dados: dados.toString('base64') }
}

export function decifrar(arquivo: Arquivo, chave: Buffer): Conteudo {
  const decifra = crypto.createDecipheriv('aes-256-gcm', chave, Buffer.from(arquivo.iv, 'base64'))
  decifra.setAAD(AAD)
  decifra.setAuthTag(Buffer.from(arquivo.tag, 'base64'))
  const texto = Buffer.concat([decifra.update(Buffer.from(arquivo.dados, 'base64')), decifra.final()]).toString('utf8')
  return JSON.parse(texto) as Conteudo
}

export type Cofre = { conteudo: Conteudo; chaveDe: 'ambiente' | 'arquivo'; corrompido: boolean }

export function lerCofre(): Cofre {
  const doAmbiente = chaveDoAmbiente()
  const preferida: 'ambiente' | 'arquivo' = doAmbiente ? 'ambiente' : 'arquivo'
  let bruto: string
  try {
    bruto = fs.readFileSync(caminhoDoCofre(), 'utf8')
  } catch {
    return { conteudo: {}, chaveDe: preferida, corrompido: false }
  }
  let arquivo: Arquivo
  try {
    arquivo = JSON.parse(bruto) as Arquivo
  } catch {
    return { conteudo: {}, chaveDe: preferida, corrompido: true }
  }
  const candidatas: Array<['ambiente' | 'arquivo', Buffer | null]> = [
    ['ambiente', doAmbiente],
    ['arquivo', chaveDoArquivo(false)],
  ]
  for (const [origem, chave] of candidatas) {
    if (!chave) continue
    try {
      const conteudo = decifrar(arquivo, chave)
      // Migração: o cofre foi criado com a chave do arquivo e a chave mestra do ambiente chegou depois.
      if (origem === 'arquivo' && doAmbiente) gravar(conteudo, doAmbiente)
      return { conteudo, chaveDe: origem === 'arquivo' && doAmbiente ? 'ambiente' : origem, corrompido: false }
    } catch {}
  }
  return { conteudo: {}, chaveDe: preferida, corrompido: true }
}

function gravar(conteudo: Conteudo, chave: Buffer): void {
  const alvo = caminhoDoCofre()
  fs.mkdirSync(path.dirname(alvo), { recursive: true })
  const temporario = `${alvo}.${process.pid}.tmp`
  fs.writeFileSync(temporario, JSON.stringify(cifrar(conteudo, chave)), { mode: 0o600 })
  fs.renameSync(temporario, alvo)
}

function gravarCofre(conteudo: Conteudo): void {
  gravar(conteudo, chaveDoAmbiente() ?? (chaveDoArquivo(true) as Buffer))
}

// ---------- ambiente ----------

const originais = new Map<string, string | undefined>()

/** Põe os valores do cofre em process.env e devolve ao original o que saiu do cofre. */
export function aplicarNoAmbiente(conteudo: Conteudo): void {
  for (const def of DEFINICOES) {
    const item = conteudo[def.nome]
    if (item) {
      if (!originais.has(def.nome)) originais.set(def.nome, process.env[def.nome])
      process.env[def.nome] = item.valor
    } else if (originais.has(def.nome)) {
      const antes = originais.get(def.nome)
      if (antes === undefined) delete process.env[def.nome]
      else process.env[def.nome] = antes
      originais.delete(def.nome)
    }
  }
}

/** Chamado na subida: o que o painel salvou vale mais que o .env. */
export function carregarChavesSalvas(): Cofre {
  const cofre = lerCofre()
  if (!cofre.corrompido) aplicarNoAmbiente(cofre.conteudo)
  return cofre
}

// ---------- estado para a tela (nunca traz um segredo) ----------

export type ItemDeStatus = {
  nome: string
  rotulo: string
  grupo: Definicao['grupo']
  secreto: boolean
  ajuda: string
  autonomo: boolean
  configurada: boolean
  origem: 'painel' | 'ambiente' | null
  em: string | null
  por: string | null
  valor: string | null
}

export function estadoDasChaves(): { itens: ItemDeStatus[]; cofre: { chaveDe: Cofre['chaveDe']; corrompido: boolean } } {
  const cofre = lerCofre()
  const itens = DEFINICOES.map((def): ItemDeStatus => {
    const salvo = cofre.conteudo[def.nome]
    const noAmbiente = (originais.has(def.nome) ? originais.get(def.nome) : process.env[def.nome])?.trim()
    const origem = salvo ? 'painel' : noAmbiente ? 'ambiente' : null
    const valorAtual = salvo?.valor ?? noAmbiente ?? null
    return {
      nome: def.nome,
      rotulo: def.rotulo,
      grupo: def.grupo,
      secreto: def.secreto,
      ajuda: def.ajuda,
      autonomo: Boolean(def.autonomo),
      configurada: origem !== null,
      origem,
      em: salvo?.em ?? null,
      por: salvo?.por ?? null,
      valor: def.secreto ? null : valorAtual,
    }
  })
  return { itens, cofre: { chaveDe: cofre.chaveDe, corrompido: cofre.corrompido } }
}

// ---------- validação ----------

export function validarValor(nome: string, valor: unknown): string {
  const def = definicao(nome)
  if (!def) throw new Error('Esta chave não existe no painel.')
  if (typeof valor !== 'string') throw new Error('Cole o valor da chave.')
  const limpo = valor.trim()
  if (def.nome === 'AZURE_DEVOPS_ORG') {
    try {
      return segmento(limpo.replace(/^https:\/\/dev\.azure\.com\//i, '').replace(/\/.*$/, ''), 'Organização')
    } catch {
      throw new Error('A organização usa só letras, números, ponto, hífen e sublinhado.')
    }
  }
  if (limpo.length < 8 || limpo.length > 500) throw new Error('O valor parece curto ou longo demais para uma chave.')
  if (!/^[\x21-\x7E]+$/.test(limpo)) throw new Error('A chave não pode ter espaços, quebras de linha ou caracteres especiais. Copie de novo, sem sobras.')
  return limpo
}

// ---------- teste contra o provedor ----------

export type ResultadoDoTeste = { ok: boolean; estado: 'valida' | 'invalida' | 'sem-resposta' | 'incompleta'; mensagem: string }

const PRAZO_MS = 8000

export async function testarChave(
  nome: string,
  valor: string,
  deps: { fetch?: typeof fetch; org?: string } = {},
): Promise<ResultadoDoTeste> {
  const buscar = deps.fetch ?? fetch
  const pedir = async (url: string, headers: Record<string, string>, quem: string, init: { method?: string; body?: string } = {}) => {
    try {
      return { resposta: await buscar(url, { headers, signal: AbortSignal.timeout(PRAZO_MS), ...init }), quem }
    } catch {
      return { resposta: null, quem }
    }
  }
  const julgar = (r: { resposta: Response | null; quem: string }, ok: (r: Response) => Promise<string> | string): Promise<ResultadoDoTeste> | ResultadoDoTeste => {
    if (!r.resposta) return { ok: false, estado: 'sem-resposta', mensagem: `Não consegui falar com ${r.quem} (rede ou tempo esgotado). Dá para salvar sem testar.` }
    const status = r.resposta.status
    if (status === 401 || status === 403 || status === 203) return { ok: false, estado: 'invalida', mensagem: `${r.quem} recusou a chave (${status}). Confira se copiou inteira e se ela tem permissão.` }
    if (status >= 200 && status < 300) {
      return Promise.resolve(ok(r.resposta)).then((mensagem) => ({ ok: true, estado: 'valida' as const, mensagem }))
    }
    return { ok: false, estado: 'sem-resposta', mensagem: `${r.quem} respondeu ${status}. Tente de novo em instantes.` }
  }

  switch (nome) {
    case 'ANTHROPIC_API_KEY':
      return julgar(await pedir('https://api.anthropic.com/v1/models?limit=1', { 'x-api-key': valor, 'anthropic-version': '2023-06-01' }, 'a Anthropic'), () => 'A Anthropic reconheceu a chave.')
    case 'OPENAI_API_KEY':
      return julgar(await pedir('https://api.openai.com/v1/models', { Authorization: `Bearer ${valor}` }, 'a OpenAI'), () => 'A OpenAI reconheceu a chave.')
    case 'GOOGLE_API_KEY':
      return julgar(await pedir('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', { 'x-goog-api-key': valor }, 'o Google'), () => 'O Google reconheceu a chave.')
    case 'GITHUB_TOKEN':
      return julgar(
        await pedir('https://api.github.com/user', { Authorization: `Bearer ${valor}`, Accept: 'application/vnd.github+json', 'User-Agent': 'super-factory' }, 'o GitHub'),
        async (r) => {
          const corpo = (await r.json().catch(() => ({}))) as { login?: unknown }
          return typeof corpo.login === 'string' ? `O GitHub reconheceu o token (conta ${corpo.login.slice(0, 40)}).` : 'O GitHub reconheceu o token.'
        },
      )
    case 'GITHUB_PROJECT_TOKEN': {
      const resultado = await julgar(
        await pedir('https://api.github.com/graphql', { Authorization: `Bearer ${valor}`, 'Content-Type': 'application/json', 'User-Agent': 'super-factory' }, 'o GitHub', { method: 'POST', body: JSON.stringify({ query: '{ viewer { login } }' }) }),
        async (r) => {
          const corpo = (await r.json().catch(() => ({}))) as { data?: { viewer?: { login?: unknown } } }
          const conta = typeof corpo.data?.viewer?.login === 'string' ? ` (conta ${corpo.data.viewer.login.slice(0, 40)})` : ''
          // Token clássico lista os escopos num cabeçalho. Sem "project" ele lê o repositório mas não o Project.
          const escopos = r.headers.get('x-oauth-scopes')
          if (escopos !== null && !/(^|,\s*)(read:)?project(\s*,|$)/.test(escopos)) return `SEM_ESCOPO${conta}`
          return `O GitHub reconheceu o token${conta}. Falta conferir o acesso ao Project na primeira leitura.`
        },
      )
      if (resultado.ok && resultado.mensagem.startsWith('SEM_ESCOPO')) {
        return { ok: false, estado: 'invalida', mensagem: 'O token não tem o escopo "project". Gere um token clássico com os escopos repo e project.' }
      }
      return resultado
    }
    case 'AZURE_DEVOPS_ORG':
      return { ok: true, estado: 'valida', mensagem: 'Nome aceito. Ele é conferido junto com o PAT.' }
    case 'AZURE_DEVOPS_PAT': {
      const org = (deps.org ?? process.env.AZURE_DEVOPS_ORG ?? '').trim()
      if (!org) return { ok: false, estado: 'incompleta', mensagem: 'Salve primeiro o nome da organização do Azure DevOps.' }
      let alvo: string
      try {
        alvo = segmento(org, 'Organização')
      } catch {
        return { ok: false, estado: 'incompleta', mensagem: 'O nome da organização está inválido.' }
      }
      const basico = Buffer.from(`:${valor}`).toString('base64')
      return julgar(await pedir(`https://dev.azure.com/${alvo}/_apis/projects?$top=1&api-version=7.1`, { Authorization: `Basic ${basico}`, Accept: 'application/json' }, 'o Azure DevOps'), () => `O Azure DevOps reconheceu o PAT na organização ${alvo}.`)
    }
    default:
      return { ok: false, estado: 'invalida', mensagem: 'Esta chave não existe no painel.' }
  }
}

// ---------- gravar e remover ----------

export function salvarChave(nome: string, valor: string, por: string): void {
  validarValor(nome, valor)
  const cofre = lerCofre()
  if (cofre.corrompido) throw new Error('O arquivo de chaves não abriu com a chave mestra atual. Nada foi gravado, para não perder o que existe.')
  const conteudo = { ...cofre.conteudo, [nome]: { valor, em: new Date().toISOString(), por: por.slice(0, 32) } }
  gravarCofre(conteudo)
  aplicarNoAmbiente(conteudo)
}

export function removerChave(nome: string): void {
  if (!definicao(nome)) throw new Error('Esta chave não existe no painel.')
  const cofre = lerCofre()
  if (cofre.corrompido) throw new Error('O arquivo de chaves não abriu com a chave mestra atual. Nada foi alterado.')
  const { [nome]: _removida, ...resto } = cofre.conteudo
  gravarCofre(resto)
  aplicarNoAmbiente(resto)
}

// ---------- segredos dos MCPs instalados pelo usuário ----------
// Moram no mesmo cofre criptografado, num espaço de nomes próprio (MCP__<id>__<NOME>).
// Nunca vão para process.env, não aparecem na lista de chaves e só saem daqui para o
// subprocesso ou o cabeçalho do próprio MCP, no momento de conectar.

const ID_DE_MCP = /^[a-z0-9][a-z0-9-]{1,22}[a-z0-9]$/
const NOME_DE_SEGREDO = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/

function nomeNoCofre(id: string, nome: string): string {
  if (!ID_DE_MCP.test(id)) throw new Error('Identificador de MCP inválido.')
  if (!NOME_DE_SEGREDO.test(nome)) throw new Error('Nome de segredo inválido.')
  return `MCP__${id}__${nome}`
}

export function validarSegredoDeMcp(valor: unknown): string {
  if (typeof valor !== 'string') throw new Error('Cole o valor do segredo.')
  const limpo = valor.trim()
  if (limpo.length < 1 || limpo.length > 4096) throw new Error('O segredo está vazio ou grande demais.')
  if (!/^[\x20-\x7E]+$/.test(limpo)) throw new Error('O segredo não pode ter quebras de linha nem caracteres especiais. Copie de novo, sem sobras.')
  return limpo
}

/** Valores para conectar. Uso interno do gerente de MCPs: nunca devolva isto numa resposta HTTP. */
export function segredosDoMcp(id: string): Record<string, string> {
  const prefixo = nomeNoCofre(id, 'x').slice(0, -1)
  const saida: Record<string, string> = {}
  const cofre = lerCofre()
  if (cofre.corrompido) return saida
  for (const [nome, item] of Object.entries(cofre.conteudo)) {
    if (nome.startsWith(prefixo)) saida[nome.slice(prefixo.length)] = item.valor
  }
  return saida
}

/** Só os nomes que têm valor guardado. É isto que a tela pode saber. */
export function nomesDeSegredosDoMcp(id: string): string[] {
  return Object.keys(segredosDoMcp(id))
}

export function salvarSegredosDoMcp(id: string, valores: Record<string, string>, por: string): void {
  const cofre = lerCofre()
  if (cofre.corrompido) throw new Error('O arquivo de chaves não abriu com a chave mestra atual. Nada foi gravado, para não perder o que existe.')
  const conteudo = { ...cofre.conteudo }
  for (const [nome, valor] of Object.entries(valores)) {
    conteudo[nomeNoCofre(id, nome)] = { valor: validarSegredoDeMcp(valor), em: new Date().toISOString(), por: por.slice(0, 32) }
  }
  gravarCofre(conteudo)
}

export function removerSegredosDoMcp(id: string, nomes?: string[]): void {
  const cofre = lerCofre()
  if (cofre.corrompido) throw new Error('O arquivo de chaves não abriu com a chave mestra atual. Nada foi alterado.')
  const prefixo = nomeNoCofre(id, 'x').slice(0, -1)
  const alvo = nomes ? new Set(nomes.map((nome) => nomeNoCofre(id, nome))) : null
  const conteudo: Conteudo = {}
  for (const [nome, item] of Object.entries(cofre.conteudo)) {
    const sai = nome.startsWith(prefixo) && (!alvo || alvo.has(nome))
    if (!sai) conteudo[nome] = item
  }
  gravarCofre(conteudo)
}
