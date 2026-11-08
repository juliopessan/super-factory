// Conexão com os MCPs que o usuário instalou. Um cliente por MCP: se um cair, os outros seguem.
// Segurança em camadas (ver factory/mcps.ts):
// - remoto: só https público, restrito ao próprio host (inclusive nos redirects);
// - comando: o subprocesso só enxerga as variáveis dele, nunca as chaves da Factory;
// - ferramenta de merge, deploy, publicação ou aprovação nunca chega ao agente;
// - tudo que não é declarado somente leitura pede aprovação humana a cada uso.

import type { ToolsInput } from '@mastra/core/agent'
import { MCPClient } from '@mastra/mcp'

import { segredosDoMcp } from '../factory/chaves.ts'
import {
  ferramentaBloqueada,
  lerMcps,
  pastaDeTrabalho,
  precisaDeAprovacao,
  validarUrlRemota,
  type McpSalvo,
} from '../factory/mcps.ts'

export type FerramentaDoMcp = {
  nome: string
  descricao: string
  somenteLeitura: boolean
  /** Merge, deploy e afins: a Factory não entrega ao agente. */
  bloqueada: boolean
  ligada: boolean
  /** O nome completo passaria de 64 caracteres, o limite dos provedores de modelo. */
  nomeLongo: boolean
}

export type TipoDeFalha = 'recusado' | 'sem-resposta' | 'invalido'

export type Situacao = {
  estado: 'desativado' | 'parado' | 'conectado' | 'erro'
  erro?: string
  /** Só no estado erro. Decide se a instalação pode seguir sem teste (só quando o servidor não respondeu). */
  tipoDoErro?: TipoDeFalha
  ferramentas: FerramentaDoMcp[]
  atualizadoEm?: string
}

type Conexao = { cliente: MCPClient; ferramentas: Record<string, any>; situacao: Situacao; desde: number }

const PRAZO_DE_USO_MS = 20_000
const PRAZO_DE_TESTE_MS = 90_000
const ESPERA_APOS_FALHA_MS = 60_000
const VALIDADE_DA_CONEXAO_MS = 15 * 60_000
const LIMITE_DO_NOME = 64

let contador = 0

function aprovacao({ annotations }: { annotations?: { readOnlyHint?: boolean } }): boolean {
  return precisaDeAprovacao(annotations)
}

/** Tira qualquer valor secreto e trunca. Mensagens de erro de terceiros não são de confiança. */
export function mascarar(texto: string, segredos: string[]): string {
  let saida = texto
  for (const segredo of segredos) if (segredo.length >= 4) saida = saida.split(segredo).join('[segredo]')
  return saida.replace(/\s+/g, ' ').trim().slice(0, 300)
}

class FalhaDeMcp extends Error {
  readonly tipo: TipoDeFalha
  constructor(mensagem: string, tipo: TipoDeFalha) {
    super(mensagem)
    this.tipo = tipo
  }
}

function explicarErro(erro: unknown, def: McpSalvo): { mensagem: string; tipo: TipoDeFalha } {
  const bruto = erro instanceof Error ? erro.message : String(erro)
  const comando = def.transporte.tipo === 'comando'
  if (/ENOENT/.test(bruto)) return { mensagem: 'O comando não foi encontrado neste servidor.', tipo: 'invalido' }
  if (/\b(401|403)\b|unauthori[sz]ed|forbidden/i.test(bruto)) return { mensagem: 'O servidor recusou as credenciais. Confira o token e as permissões.', tipo: 'recusado' }
  if (/timed? ?out|timeout|tempo esgotado/i.test(bruto)) {
    return { mensagem: comando ? 'O comando não respondeu a tempo. Na primeira vez o npx baixa o pacote; tente de novo.' : 'O servidor não respondeu a tempo.', tipo: 'sem-resposta' }
  }
  if (/Connection closed|exited|EPIPE/i.test(bruto) && comando) return { mensagem: 'O comando saiu antes de responder. Confira os argumentos e as variáveis.', tipo: 'invalido' }
  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|fetch failed/i.test(bruto)) return { mensagem: 'Não consegui falar com o servidor (rede ou endereço).', tipo: 'sem-resposta' }
  return { mensagem: bruto, tipo: 'invalido' }
}

function corrida<T>(promessa: Promise<T>, ms: number, rotulo: string): Promise<T> {
  let temporizador: NodeJS.Timeout
  const prazo = new Promise<never>((_resolve, rejeitar) => {
    temporizador = setTimeout(() => rejeitar(new Error(`${rotulo}: tempo esgotado`)), ms)
  })
  return Promise.race([promessa, prazo]).finally(() => clearTimeout(temporizador))
}

async function criarCliente(def: McpSalvo, segredos: Record<string, string>): Promise<MCPClient> {
  const nomeDoServidor = def.id
  if (def.transporte.tipo === 'remoto') {
    // O nome pode ter passado a apontar para a rede interna depois de instalado.
    const url = await validarUrlRemota(def.transporte.url)
    const cabecalhos: Record<string, string> = {}
    for (const segredo of def.segredos) {
      const valor = segredos[segredo.nome]
      if (segredo.onde === 'cabecalho' && segredo.cabecalho && valor) cabecalhos[segredo.cabecalho] = `${segredo.prefixo ?? ''}${valor}`
    }
    return new MCPClient({
      id: `usuario-${def.id}-${++contador}`,
      registerProcessHooks: false,
      timeout: PRAZO_DE_USO_MS * 3,
      servers: { [nomeDoServidor]: { url, requestInit: { headers: cabecalhos }, allowedHosts: [url.host], requireToolApproval: aprovacao } },
    })
  }
  const ambiente: Record<string, string> = { ...def.transporte.ambiente }
  for (const segredo of def.segredos) {
    const valor = segredos[segredo.nome]
    if (segredo.onde === 'ambiente' && valor) ambiente[segredo.nome] = valor
  }
  return new MCPClient({
    id: `usuario-${def.id}-${++contador}`,
    registerProcessHooks: false,
    timeout: PRAZO_DE_USO_MS * 3,
    servers: {
      [nomeDoServidor]: {
        command: def.transporte.comando,
        args: def.transporte.args,
        env: ambiente,
        cwd: pastaDeTrabalho(def.id),
        stderr: 'ignore',
        requireToolApproval: aprovacao,
      },
    },
  })
}

function descrever(def: McpSalvo, ferramentas: Record<string, any>): FerramentaDoMcp[] {
  const prefixo = `${def.id}_`
  return Object.entries(ferramentas)
    .map(([completo, ferramenta]) => {
      const nome = completo.startsWith(prefixo) ? completo.slice(prefixo.length) : completo
      const somenteLeitura = ferramenta?.mcp?.annotations?.readOnlyHint === true
      return {
        nome,
        descricao: String(ferramenta?.description ?? '').replace(/\s+/g, ' ').slice(0, 240),
        somenteLeitura,
        bloqueada: ferramentaBloqueada(nome, somenteLeitura),
        ligada: !def.desligadas.includes(nome),
        nomeLongo: completo.length > LIMITE_DO_NOME,
      }
    })
    .sort((a, b) => a.nome.localeCompare(b.nome))
}

export class GerenteMcp {
  private readonly validadeMs: number
  constructor(opcoes: { validadeMs?: number } = {}) {
    this.validadeMs = opcoes.validadeMs ?? VALIDADE_DA_CONEXAO_MS
  }

  private conexoes = new Map<string, Conexao>()
  private conectando = new Map<string, Promise<Conexao>>()
  private falhas = new Map<string, { ate: number; erro: string; tipo: TipoDeFalha }>()

  /** Conecta, lista as ferramentas e devolve a conexão pronta. Falha com mensagem clara e sem segredo. */
  private async conectar(def: McpSalvo, prazo: number, explicitos?: Record<string, string>): Promise<Conexao> {
    const segredos = explicitos ?? segredosDoMcp(def.id)
    const valores = Object.values(segredos)
    let cliente: MCPClient | null = null
    try {
      cliente = await criarCliente(def, segredos)
      // listTools() engole a falha e devolve lista vazia: um MCP quebrado pareceria conectado.
      const { tools, errors } = await corrida(cliente.listToolsWithErrors(), prazo, def.nome)
      const falhou = errors?.[def.id]
      if (falhou) throw new Error(falhou)
      const ferramentas = tools as Record<string, any>
      return {
        cliente,
        ferramentas,
        situacao: { estado: 'conectado', ferramentas: descrever(def, ferramentas), atualizadoEm: new Date().toISOString() },
        desde: Date.now(),
      }
    } catch (erro) {
      await cliente?.disconnect().catch(() => {})
      const { mensagem, tipo } = explicarErro(erro, def)
      throw new FalhaDeMcp(mascarar(mensagem, valores), tipo)
    }
  }

  /** Reaproveita a conexão; várias chamadas ao mesmo tempo esperam a mesma tentativa. */
  private async garantir(def: McpSalvo, prazo: number): Promise<Conexao> {
    const pronta = this.conexoes.get(def.id)
    // Conexão velha: o subprocesso pode ter morrido ou a lista de ferramentas mudado. Reconecta.
    if (pronta && Date.now() - pronta.desde > this.validadeMs) await this.esquecer(def.id)
    else if (pronta) return pronta
    const andamento = this.conectando.get(def.id)
    if (andamento) return andamento
    const espera = this.falhas.get(def.id)
    if (espera && espera.ate > Date.now()) throw new FalhaDeMcp(espera.erro, espera.tipo)
    const tentativa = this.conectar(def, prazo)
      .then((conexao) => {
        this.conexoes.set(def.id, conexao)
        this.falhas.delete(def.id)
        return conexao
      })
      .catch((erro: Error) => {
        this.falhas.set(def.id, { ate: Date.now() + ESPERA_APOS_FALHA_MS, erro: erro.message, tipo: erro instanceof FalhaDeMcp ? erro.tipo : 'invalido' })
        throw erro
      })
      .finally(() => this.conectando.delete(def.id))
    this.conectando.set(def.id, tentativa)
    return tentativa
  }

  /** Teste explícito (botão da tela e instalação): ignora a espera após falha e guarda a conexão se der certo. */
  async testar(def: McpSalvo, opcoes: { guardar?: boolean; segredos?: Record<string, string> } = {}): Promise<Situacao> {
    await this.esquecer(def.id)
    this.falhas.delete(def.id)
    try {
      const conexao = await this.conectar(def, PRAZO_DE_TESTE_MS, opcoes.segredos)
      if (opcoes.guardar) this.conexoes.set(def.id, conexao)
      else await conexao.cliente.disconnect().catch(() => {})
      return conexao.situacao
    } catch (erro) {
      return {
        estado: 'erro',
        erro: erro instanceof Error ? erro.message : 'Não consegui conectar.',
        tipoDoErro: erro instanceof FalhaDeMcp ? erro.tipo : 'invalido',
        ferramentas: [],
        atualizadoEm: new Date().toISOString(),
      }
    }
  }

  /** O que a tela mostra de cada MCP salvo. Não conecta sozinho. */
  situacao(def: McpSalvo): Situacao {
    if (!def.ativo) return { estado: 'desativado', ferramentas: [] }
    const conexao = this.conexoes.get(def.id)
    if (conexao) return { ...conexao.situacao, ferramentas: descrever(def, conexao.ferramentas) }
    const falha = this.falhas.get(def.id)
    if (falha) return { estado: 'erro', erro: falha.erro, tipoDoErro: falha.tipo, ferramentas: [] }
    return { estado: 'parado', ferramentas: [] }
  }

  /**
   * As ferramentas dos MCPs ativos para um agente. Nunca falha: o MCP que não responde fica de fora
   * desta vez, e a próxima tentativa só acontece depois da espera.
   */
  async ferramentasParaAgente(opcoes: { somenteLeitura: boolean }): Promise<ToolsInput> {
    const saida: ToolsInput = {}
    const ativos = lerMcps().filter((def) => def.ativo)
    await Promise.all(
      ativos.map(async (def) => {
        try {
          const conexao = await this.garantir(def, PRAZO_DE_USO_MS)
          const permitidas = new Set(descrever(def, conexao.ferramentas).filter((item) => item.ligada && !item.bloqueada && !item.nomeLongo && (!opcoes.somenteLeitura || item.somenteLeitura)).map((item) => item.nome))
          for (const [completo, ferramenta] of Object.entries(conexao.ferramentas)) {
            if (permitidas.has(completo.slice(def.id.length + 1))) saida[completo] = ferramenta
          }
        } catch {
          /* fica registrado em this.falhas; a tela mostra o motivo */
        }
      }),
    )
    return saida
  }

  /** Solta a conexão. A próxima vez que o MCP for usado, ele conecta de novo. */
  async esquecer(id: string): Promise<void> {
    const conexao = this.conexoes.get(id)
    this.conexoes.delete(id)
    this.falhas.delete(id)
    await conexao?.cliente.disconnect().catch(() => {})
  }

  async desconectarTudo(): Promise<void> {
    await Promise.all([...this.conexoes.keys()].map((id) => this.esquecer(id)))
  }
}

export const gerenteMcp = new GerenteMcp()

/** Atalho para os agentes: as ferramentas dos MCPs do usuário, no formato que o Mastra espera. */
export function ferramentasDoUsuario(opcoes: { somenteLeitura: boolean }): Promise<ToolsInput> {
  return gerenteMcp.ferramentasParaAgente(opcoes)
}
