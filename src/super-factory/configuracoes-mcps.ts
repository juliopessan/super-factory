// Aba "Ferramentas (MCP)" do painel: /configuracoes/mcps (JSON).
// Mesmas proteções do painel de chaves: origem, cabeçalho próprio, lista fechada de ações,
// limite de pedidos e nenhum segredo de volta na resposta.

import { nomesDeSegredosDoMcp, removerSegredosDoMcp, salvarSegredosDoMcp, segredosDoMcp, validarSegredoDeMcp } from '../factory/chaves.ts'
import {
  CATALOGO,
  gravarMcps,
  lerMcps,
  montarComandoPersonalizado,
  montarDoCatalogo,
  montarRemoto,
  politica,
  validarIdDeMcp,
  valorDoSegredo,
  type McpSalvo,
  type NovoMcp,
  type Resolvedor,
} from '../factory/mcps.ts'
import { gerenteMcp, type GerenteMcp, type Situacao } from './mcp-usuario.ts'
import { criarLimite, lerPedido, quemE, resposta } from './protecao.ts'

const dentroDoLimite = criarLimite(30)

type Dependencias = { gerente?: GerenteMcp; resolver?: Resolvedor; limite?: (agora?: number) => boolean }

function destinoVisivel(def: McpSalvo): string {
  if (def.transporte.tipo === 'remoto') {
    const url = new URL(def.transporte.url)
    // Parâmetros da URL podem carregar token: não aparecem na tela.
    return `${url.origin}${url.pathname}${url.search ? ' (com parâmetros)' : ''}`
  }
  return [def.transporte.comando, ...def.transporte.args].join(' ').slice(0, 160)
}

export function estadoDosMcps(gerente: GerenteMcp = gerenteMcp) {
  const salvos = lerMcps()
  return {
    politica: politica(),
    catalogo: CATALOGO.map((item) => ({
      id: item.id,
      nome: item.nome,
      descricao: item.descricao,
      tipo: item.tipo,
      fonte: item.fonte,
      parametros: item.parametros,
      segredos: item.segredos.map(({ nome, rotulo, ajuda, opcional }) => ({ nome, rotulo, ajuda, opcional: Boolean(opcional) })),
      instalado: salvos.some((def) => def.id === item.id),
    })),
    instalados: salvos.map((def) => {
      const guardados = new Set(nomesDeSegredosDoMcp(def.id))
      return {
        id: def.id,
        nome: def.nome,
        origem: def.origem,
        tipo: def.transporte.tipo,
        destino: destinoVisivel(def),
        ativo: def.ativo,
        situacao: gerente.situacao(def),
        segredos: def.segredos.map((segredo) => ({
          nome: segredo.nome,
          rotulo: segredo.cabecalho ?? segredo.nome,
          onde: segredo.onde,
          configurado: guardados.has(segredo.nome),
        })),
        por: def.por,
        em: def.criadoEm,
      }
    }),
  }
}

function atualizar(id: string, mudar: (def: McpSalvo) => McpSalvo): McpSalvo {
  const lista = lerMcps()
  const atual = lista.find((def) => def.id === id)
  if (!atual) throw new Error('Este MCP não está instalado.')
  const novo = mudar(atual)
  gravarMcps(lista.map((def) => (def.id === id ? novo : def)))
  return novo
}

/** Testa a conexão com os segredos informados; só grava quando conecta (ou quando o servidor não respondeu e a pessoa insiste). */
async function instalar(novo: NovoMcp, semTeste: boolean, por: string, gerente: GerenteMcp) {
  const { definicao, segredos } = novo
  const lista = lerMcps()
  if (lista.length >= politica().maximo) throw new Error(`O limite é de ${politica().maximo} MCPs instalados. Remova algum antes.`)
  if (lista.some((def) => def.id === definicao.id)) throw new Error('Já existe um MCP com este nome.')
  const teste = await gerente.testar(definicao, { guardar: true, segredos })
  const passa = teste.estado === 'conectado' || (semTeste && teste.tipoDoErro === 'sem-resposta')
  if (!passa) return { instalado: false, teste }
  try {
    if (Object.keys(segredos).length > 0) salvarSegredosDoMcp(definicao.id, segredos, por)
    gravarMcps([...lista, definicao])
  } catch (erro) {
    // Não deixa um subprocesso preso a um MCP que não chegou a ser instalado.
    await gerente.esquecer(definicao.id)
    throw erro
  }
  console.log(`[mcp] ${definicao.id} instalado por ${por}${teste.estado === 'conectado' ? '' : ' (sem teste)'}`)
  return { instalado: true, teste }
}

function ferramentasDe(teste: Situacao) {
  return teste.ferramentas.map((item) => item.nome)
}

export async function tratarMcps(req: Request, deps: Dependencias = {}): Promise<Response> {
  const gerente = deps.gerente ?? gerenteMcp
  if (req.method === 'GET') return resposta(estadoDosMcps(gerente))
  if (req.method !== 'POST') return resposta({ erro: 'Método não permitido.' }, 405)
  const pedido = await lerPedido(req, { limite: deps.limite ?? dentroDoLimite, bytes: 16_000 })
  if ('recusa' in pedido) return pedido.recusa
  let corpo: Record<string, unknown>
  try {
    const dado = JSON.parse(pedido.texto) as unknown
    if (!dado || typeof dado !== 'object' || Array.isArray(dado)) throw new Error('formato')
    corpo = dado as Record<string, unknown>
  } catch {
    return resposta({ erro: 'Pedido ilegível.' }, 400)
  }
  const por = quemE(req)
  const semTeste = corpo.semTeste === true
  try {
    switch (corpo.acao) {
      case 'instalar-catalogo': {
        const resultado = await instalar(montarDoCatalogo(corpo.catalogoId, corpo.parametros, corpo.segredos, por), semTeste, por, gerente)
        return resposta({ ...resultado, estado: estadoDosMcps(gerente) })
      }
      case 'instalar-remoto': {
        const resultado = await instalar(await montarRemoto(corpo as { nome?: unknown; url?: unknown; cabecalhos?: unknown }, por, deps.resolver), semTeste, por, gerente)
        return resposta({ ...resultado, estado: estadoDosMcps(gerente) })
      }
      case 'instalar-comando': {
        if (!politica().comandoPersonalizado) {
          return resposta({ erro: 'Comando personalizado está desligado. Quem administra a VPS liga com SUPER_FACTORY_MCP_COMANDO=1 no .env.' }, 403)
        }
        const resultado = await instalar(montarComandoPersonalizado(corpo as Parameters<typeof montarComandoPersonalizado>[0], por), semTeste, por, gerente)
        return resposta({ ...resultado, estado: estadoDosMcps(gerente) })
      }
      case 'ativar':
      case 'desativar': {
        const id = validarIdDeMcp(corpo.id)
        const ativo = corpo.acao === 'ativar'
        atualizar(id, (def) => ({ ...def, ativo }))
        await gerente.esquecer(id)
        console.log(`[mcp] ${id} ${ativo ? 'ativado' : 'desativado'} por ${por}`)
        return resposta({ estado: estadoDosMcps(gerente) })
      }
      case 'remover': {
        const id = validarIdDeMcp(corpo.id)
        if (!lerMcps().some((def) => def.id === id)) throw new Error('Este MCP não está instalado.')
        await gerente.esquecer(id)
        removerSegredosDoMcp(id)
        gravarMcps(lerMcps().filter((def) => def.id !== id))
        console.log(`[mcp] ${id} removido por ${por}`)
        return resposta({ estado: estadoDosMcps(gerente) })
      }
      case 'testar': {
        const id = validarIdDeMcp(corpo.id)
        const def = lerMcps().find((item) => item.id === id)
        if (!def) throw new Error('Este MCP não está instalado.')
        const teste = await gerente.testar(def, { guardar: def.ativo })
        return resposta({ teste, ferramentas: ferramentasDe(teste), estado: estadoDosMcps(gerente) })
      }
      case 'ferramenta': {
        const id = validarIdDeMcp(corpo.id)
        const nome = typeof corpo.ferramenta === 'string' ? corpo.ferramenta : ''
        if (!nome || nome.length > 128 || /[\x00-\x1F]/.test(nome)) throw new Error('Ferramenta inválida.')
        const ligada = corpo.ligada === true
        atualizar(id, (def) => {
          const resto = def.desligadas.filter((item) => item !== nome)
          return { ...def, desligadas: ligada ? resto : [...resto, nome].slice(0, 200) }
        })
        return resposta({ estado: estadoDosMcps(gerente) })
      }
      case 'segredo': {
        const id = validarIdDeMcp(corpo.id)
        const def = lerMcps().find((item) => item.id === id)
        if (!def) throw new Error('Este MCP não está instalado.')
        const nome = typeof corpo.nome === 'string' ? corpo.nome : ''
        const segredoDoMcp = def.segredos.find((segredo) => segredo.nome === nome)
        if (!segredoDoMcp) throw new Error('Este MCP não usa esse segredo.')
        const valor = valorDoSegredo(segredoDoMcp, validarSegredoDeMcp(corpo.valor), def.parametros)
        const novosSegredos = { ...segredosDoMcp(id), [nome]: valor }
        const teste = await gerente.testar(def, { guardar: def.ativo, segredos: novosSegredos })
        const passa = teste.estado === 'conectado' || (semTeste && teste.tipoDoErro === 'sem-resposta')
        if (!passa) {
          await gerente.esquecer(id)
          return resposta({ salvo: false, teste, estado: estadoDosMcps(gerente) })
        }
        salvarSegredosDoMcp(id, { [nome]: valor }, por)
        console.log(`[mcp] segredo ${nome} de ${id} trocado por ${por}`)
        return resposta({ salvo: true, teste, estado: estadoDosMcps(gerente) })
      }
      default:
        return resposta({ erro: 'Ação desconhecida.' }, 400)
    }
  } catch (erro) {
    return resposta({ erro: erro instanceof Error ? erro.message : 'Não consegui concluir.' }, 400)
  }
}
