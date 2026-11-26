// Pedido de decisão: o formato com que a Factory leva uma escolha a uma pessoa. Vem do método da Fábrica (DeskLabs):
// toda opção tem custo, "não fazer" é sempre uma opção, a recomendação diz por quê, o padrão vale se ninguém responder
// no prazo, e "não medido" nunca fica vazio. O que a Factory não conferiu pode mudar a recomendação, então vai escrito.
//
// Limites que não dependem de instrução:
// - guarda (merge, aprovação, deploy, push, segredo, teste desligado) não passa por aqui: é decisão humana direta, sem padrão por prazo;
// - o padrão é sempre um caminho reversível; vencido o prazo, ele só registra a escolha, nunca executa nada;
// - em pedido de critério o padrão é "manter" (o critério continua exigido): o prazo nunca dispensa critério;
// - em pedido de disjuntor o padrão é "manter pausado": o prazo nunca retoma sozinho.

import { ehPapelDaFactory, tocaEmGuarda } from './licoes.ts'
import { alocarId, atualizarEstado, lerEstado, type FabricaEstado } from './store.ts'

export type TipoDePedido = 'geral' | 'criterio' | 'disjuntor'
export type EfeitoDeCriterio = 'nao-se-aplica' | 'decidido-diferente' | 'manter'
export type OpcaoDoPedido = { rotulo: string; oQue: string; custo: string; reversivel: boolean; efeito?: string }
export type EstadoDoPedido = 'aberto' | 'respondido' | 'padrao-aplicado' | 'cancelado'

export type PedidoDeDecisao = {
  id: string
  tipo: TipoDePedido
  pergunta: string
  /** Quem decide: sempre uma pessoa (dono ou mantenedores). */
  quemDecide: string
  /** O que está parado esperando esta decisão. */
  parado: string | null
  cardId: string | null
  repositorio: string | null
  /** Só no pedido de critério: qual critério (1, 2, …) do card. */
  criterio: number | null
  /** Só no pedido de critério: o texto do critério quando o pedido foi aberto. Se o card mudar o critério, a decisão deixa de valer. */
  criterioTexto: string | null
  opcoes: OpcaoDoPedido[]
  recomendacao: { opcao: string; porque: string }
  /** Null quando nenhuma opção é reversível: o prazo não corre e o pedido espera a resposta. */
  padrao: { opcao: string; vence: string } | null
  naoMedido: string
  estado: EstadoDoPedido
  criadoEm: string
  escolha: string | null
  decididoEm: string | null
  decididoPor: string | null
  nota: string | null
}

const MAXIMO_ABERTOS = 40
const MAXIMO_GUARDADOS = 200
const ROTULOS = 'ABCDEFG'

const linhaSo = (t: string) => !/[\r\n]/.test(t)
const dentro = (t: string, min: number, max: number) => t.trim().length >= min && t.trim().length <= max

/** Quem decide é uma pessoa: nome próprio, nunca um papel da Factory. */
export function autorValido(autor: string): string | null {
  const nome = autor.trim()
  if (!nome || nome.length > 80 || ehPapelDaFactory(nome) || !linhaSo(nome)) return null
  return nome
}

export type EntradaDoPedido = {
  pergunta: string
  quemDecide?: string
  parado?: string
  cardId?: string
  repositorio?: string
  opcoes: Array<{ oQue: string; custo: string; reversivel: boolean }>
  /** O custo de não fazer: "não fazer" entra sempre como a última opção. */
  custoDeNaoFazer: string
  /** Rótulo (A, B, …) da opção recomendada; "não fazer" é a última letra. */
  recomendada: string
  porque: string
  /** Rótulo do padrão e prazo em dias. Obrigatório quando alguma opção é reversível. */
  padrao?: { opcao: string; prazoDias: number }
  naoMedido: string
}

export type ResultadoDeAbrir = { ok: boolean; pedido: PedidoDeDecisao | null; nota: string }

function validar(e: EntradaDoPedido): { opcoes: OpcaoDoPedido[]; erro: string | null } {
  const falha = (erro: string) => ({ opcoes: [], erro })
  if (!dentro(e.pergunta, 10, 200) || !linhaSo(e.pergunta)) return falha('A pergunta tem de 10 a 200 caracteres, numa linha.')
  if (e.opcoes.length < 1 || e.opcoes.length > 4) return falha('Passe de 1 a 4 opções (o "não fazer" entra sozinho como a última).')
  for (const o of e.opcoes) {
    if (!dentro(o.oQue, 5, 200) || !linhaSo(o.oQue)) return falha('Cada opção diz o que é, em 5 a 200 caracteres, numa linha.')
    if (!dentro(o.custo, 3, 200) || !linhaSo(o.custo)) return falha('Toda opção tem custo (3 a 200 caracteres): o que custa fazer e manter.')
  }
  if (!dentro(e.custoDeNaoFazer, 3, 200) || !linhaSo(e.custoDeNaoFazer)) return falha('"Não fazer" também tem custo: diga o que se perde.')
  if (!dentro(e.porque, 10, 240) || !linhaSo(e.porque)) return falha('A recomendação precisa de uma razão ligada a quem usa (10 a 240 caracteres).')
  if (!dentro(e.naoMedido, 8, 400) || !linhaSo(e.naoMedido)) return falha('"Não medido" não fica vazio: diga o que não foi conferido e poderia mudar a recomendação. Se tudo foi conferido, diga o que e como.')
  const textos = [e.pergunta, e.porque, ...e.opcoes.flatMap((o) => [o.oQue, o.custo]), e.custoDeNaoFazer]
  if (textos.some((t) => tocaEmGuarda(t))) return falha('O pedido toca em guarda da Factory (merge, aprovação, deploy, push, segredo ou teste desligado, ou pular/ignorar algo). Isso é decisão humana direta, no GitHub, e não passa por pedido com padrão por prazo.')
  const opcoes: OpcaoDoPedido[] = [
    ...e.opcoes.map((o, i) => ({ rotulo: ROTULOS[i]!, oQue: o.oQue.trim(), custo: o.custo.trim(), reversivel: o.reversivel })),
    { rotulo: ROTULOS[e.opcoes.length]!, oQue: 'Não fazer', custo: e.custoDeNaoFazer.trim(), reversivel: true },
  ]
  return { opcoes, erro: null }
}

const mesmoTexto = (a: string | null | undefined, b: string | null | undefined) => (a ?? '').replace(/\s+/g, ' ').trim() === (b ?? '').replace(/\s+/g, ' ').trim()

function guardar(estado: FabricaEstado, pedido: PedidoDeDecisao): FabricaEstado {
  const todos = [...(estado.decisoes ?? []), pedido]
  const abertos = todos.filter((p) => p.estado === 'aberto')
  const fechados = todos.filter((p) => p.estado !== 'aberto')
  // As respostas sobre critérios são a ÚNICA fonte do N_A/DECIDIDO que se lê no card: não podem sair do histórico por idade.
  // Vale a última resposta de cada (card, critério), então só ela fica; o resto do histórico é limitado.
  const ehDecisaoDeCriterio = (p: PedidoDeDecisao) => p.tipo === 'criterio' && p.estado === 'respondido' && p.criterio !== null
  const ultimas = new Map<string, PedidoDeDecisao>()
  for (const p of fechados.filter(ehDecisaoDeCriterio).sort((a, b) => (a.decididoEm ?? '').localeCompare(b.decididoEm ?? ''))) ultimas.set(`${p.cardId}#${p.criterio}`, p)
  const outros = fechados.filter((p) => !ehDecisaoDeCriterio(p)).slice(-MAXIMO_GUARDADOS)
  return { ...estado, decisoes: [...outros, ...ultimas.values(), ...abertos] }
}

function montar(base: Omit<PedidoDeDecisao, 'id' | 'estado' | 'criadoEm' | 'escolha' | 'decididoEm' | 'decididoPor' | 'nota'>, agora: Date): PedidoDeDecisao {
  return { ...base, id: alocarId('D'), estado: 'aberto', criadoEm: agora.toISOString(), escolha: null, decididoEm: null, decididoPor: null, nota: null }
}

/** Abre um pedido de decisão livre (tipo "geral"). O padrão precisa ser uma opção reversível. */
export function abrirPedido(e: EntradaDoPedido, agora: Date = new Date()): ResultadoDeAbrir {
  const v = validar(e)
  if (v.erro) return { ok: false, pedido: null, nota: v.erro }
  const rotulo = e.recomendada.trim().toUpperCase()
  if (!v.opcoes.some((o) => o.rotulo === rotulo)) return { ok: false, pedido: null, nota: `A recomendação ${e.recomendada} não é uma das opções (${v.opcoes.map((o) => o.rotulo).join(', ')}).` }
  const reversiveis = v.opcoes.filter((o) => o.reversivel)
  let padrao: PedidoDeDecisao['padrao'] = null
  if (reversiveis.length > 0) {
    if (!e.padrao) return { ok: false, pedido: null, nota: 'O padrão é obrigatório, com prazo: diga qual opção vale se ninguém responder e em quantos dias.' }
    const op = v.opcoes.find((o) => o.rotulo === e.padrao!.opcao.trim().toUpperCase())
    if (!op) return { ok: false, pedido: null, nota: `O padrão ${e.padrao.opcao} não é uma das opções.` }
    if (!op.reversivel) return { ok: false, pedido: null, nota: `O padrão tem de ser o caminho reversível, e a opção ${op.rotulo} não é. Escolha ${reversiveis.map((o) => o.rotulo).join(' ou ')}.` }
    if (!Number.isInteger(e.padrao.prazoDias) || e.padrao.prazoDias < 1 || e.padrao.prazoDias > 30) return { ok: false, pedido: null, nota: 'O prazo do padrão é de 1 a 30 dias.' }
    padrao = { opcao: op.rotulo, vence: new Date(agora.getTime() + e.padrao.prazoDias * 86_400_000).toISOString() }
  }
  if ((lerEstado().decisoes ?? []).filter((p) => p.estado === 'aberto').length >= MAXIMO_ABERTOS) return { ok: false, pedido: null, nota: `Já há ${MAXIMO_ABERTOS} pedidos abertos. Resolva ou cancele alguns antes de abrir outro: pedido demais vira ruído.` }
  const quem = (e.quemDecide ?? 'dono').trim().slice(0, 60) || 'dono'
  const pedido = montar({ tipo: 'geral', pergunta: e.pergunta.trim(), quemDecide: quem, parado: e.parado?.trim().slice(0, 200) || null, cardId: e.cardId ?? null, repositorio: e.repositorio ?? null, criterio: null, criterioTexto: null, opcoes: v.opcoes, recomendacao: { opcao: rotulo, porque: e.porque.trim() }, padrao, naoMedido: e.naoMedido.trim() }, agora)
  atualizarEstado((s) => guardar(s, pedido))
  return { ok: true, pedido, nota: padrao ? `Pedido ${pedido.id} aberto. Se ninguém responder até ${padrao.vence.slice(0, 10)}, vale a opção ${padrao.opcao}; o trabalho que não depende dele segue.` : `Pedido ${pedido.id} aberto. Nenhuma opção é reversível, então o prazo não corre: ele espera a resposta.` }
}

/** Pedido para dispensar ou reinterpretar um critério de aceite. O padrão é manter o critério exigido. */
export function abrirPedidoDeCriterio(entrada: { cardId: string; repositorio: string | null; criterio: number; textoDoCriterio: string; motivo: string; prazoDias?: number }, agora: Date = new Date()): ResultadoDeAbrir {
  if (!Number.isInteger(entrada.criterio) || entrada.criterio < 1) return { ok: false, pedido: null, nota: 'O critério é o número dele no card (1, 2, …).' }
  if (!dentro(entrada.motivo, 10, 240) || !linhaSo(entrada.motivo)) return { ok: false, pedido: null, nota: 'Diga por quê, em 10 a 240 caracteres, numa linha.' }
  if (tocaEmGuarda(entrada.motivo)) return { ok: false, pedido: null, nota: 'O motivo toca em guarda da Factory. Critério não se dispensa por esse caminho.' }
  const existente = (lerEstado().decisoes ?? []).find((p) => p.estado === 'aberto' && p.tipo === 'criterio' && p.cardId === entrada.cardId && p.criterio === entrada.criterio)
  if (existente) return { ok: true, pedido: existente, nota: `Já existe o pedido ${existente.id} aberto para este critério.` }
  const prazo = Math.min(30, Math.max(1, Math.round(entrada.prazoDias ?? 7)))
  const pedido = montar({
    tipo: 'criterio',
    pergunta: `O critério ${entrada.criterio} do card ${entrada.cardId} vale como está? ${entrada.textoDoCriterio.replace(/\s+/g, ' ').trim().slice(0, 120)}`.slice(0, 200),
    quemDecide: 'dono',
    parado: `O card ${entrada.cardId} fica com o critério ${entrada.criterio} sem resultado conclusivo.`,
    cardId: entrada.cardId,
    repositorio: entrada.repositorio,
    criterio: entrada.criterio,
    criterioTexto: entrada.textoDoCriterio.replace(/\s+/g, ' ').trim(),
    opcoes: [
      { rotulo: 'A', oQue: 'Não se aplica a este card', custo: 'O critério deixa de ser cobrado neste card; quem revisa precisa concordar com o motivo.', reversivel: true, efeito: 'nao-se-aplica' },
      { rotulo: 'B', oQue: 'Decidido diferente: outra forma de cumprir', custo: 'O critério fica registrado como decidido diferente, com o motivo; a evidência deixa de ser um teste.', reversivel: true, efeito: 'decidido-diferente' },
      { rotulo: 'C', oQue: 'Manter o critério como está', custo: 'O card segue com o critério pendente até haver teste que o prove.', reversivel: true, efeito: 'manter' },
    ],
    recomendacao: { opcao: 'C', porque: `Sem a decisão de uma pessoa o critério continua exigido. Motivo apresentado: ${entrada.motivo.trim()}`.slice(0, 240) },
    padrao: { opcao: 'C', vence: new Date(agora.getTime() + prazo * 86_400_000).toISOString() },
    naoMedido: 'Se o comportamento do critério existe de outra forma no repositório: a Factory só conferiu o teste apontado e a suíte.',
  }, agora)
  atualizarEstado((s) => guardar(s, pedido))
  return { ok: true, pedido, nota: `Pedido ${pedido.id} aberto. Só uma pessoa dispensa um critério; vencido o prazo, o critério continua exigido.` }
}

/** Pedido aberto pelo disjuntor: retomar ou manter pausado. O prazo nunca retoma. */
export function abrirPedidoDeDisjuntor(entrada: { repositorio: string; resumo: string }, agora: Date = new Date()): PedidoDeDecisao {
  const existente = (lerEstado().decisoes ?? []).find((p) => p.estado === 'aberto' && p.tipo === 'disjuntor' && p.repositorio === entrada.repositorio)
  if (existente) return existente
  const pedido = montar({
    tipo: 'disjuntor',
    pergunta: `O disjuntor pausou ${entrada.repositorio}. Retomar as execuções?`.slice(0, 200),
    quemDecide: 'dono',
    parado: `Nenhum card novo começa em ${entrada.repositorio} enquanto o circuito está aberto.`,
    cardId: null,
    repositorio: entrada.repositorio,
    criterio: null,
    criterioTexto: null,
    opcoes: [
      { rotulo: 'A', oQue: 'Retomar as execuções neste repositório', custo: 'Gasta tokens de novo; se a causa não foi resolvida, o disjuntor abre outra vez.', reversivel: true, efeito: 'retomar' },
      { rotulo: 'B', oQue: 'Manter pausado até a causa ser resolvida', custo: 'Os cards do repositório ficam parados.', reversivel: true, efeito: 'manter' },
    ],
    recomendacao: { opcao: 'B', porque: `Resolva a causa antes de retomar. ${entrada.resumo}`.slice(0, 240) },
    padrao: { opcao: 'B', vence: new Date(agora.getTime() + 7 * 86_400_000).toISOString() },
    naoMedido: 'A causa das falhas: o disjuntor só conta desfechos, não diagnostica. Leia o motivo de cada execução parada (lerCard).',
  }, agora)
  atualizarEstado((s) => guardar(s, pedido))
  return pedido
}

/** Pedidos vencidos: o padrão é registrado (nunca executado) e o pedido sai da fila de abertos. */
export function resolverVencidos(agora: Date = new Date()): PedidoDeDecisao[] {
  const vencidos = (lerEstado().decisoes ?? []).filter((p) => p.estado === 'aberto' && p.padrao && Date.parse(p.padrao.vence) <= agora.getTime())
  if (vencidos.length === 0) return []
  const ids = new Set(vencidos.map((p) => p.id))
  const feitos: PedidoDeDecisao[] = []
  atualizarEstado((s) => ({
    ...s,
    decisoes: (s.decisoes ?? []).map((p) => {
      if (!ids.has(p.id) || !p.padrao) return p
      const f: PedidoDeDecisao = { ...p, estado: 'padrao-aplicado', escolha: p.padrao.opcao, decididoEm: agora.toISOString(), decididoPor: 'padrão por prazo', nota: 'Ninguém respondeu no prazo: valeu a opção padrão (reversível). Nada foi executado por isso.' }
      feitos.push(f)
      return f
    }),
  }))
  return feitos
}

export type ResultadoDeResponder = { ok: boolean; pedido: PedidoDeDecisao | null; efeito: string | null; nota: string }

/** Registra a resposta de uma pessoa. O efeito (de critério ou de disjuntor) quem aplica é o chamador. */
export function responderPedido(id: string, escolha: string, autor: string, nota?: string, agora: Date = new Date()): ResultadoDeResponder {
  const pedido = (lerEstado().decisoes ?? []).find((p) => p.id === id)
  if (!pedido) return { ok: false, pedido: null, efeito: null, nota: `Não achei o pedido ${id}.` }
  const nome = autorValido(autor)
  if (!nome) return { ok: false, pedido, efeito: null, nota: 'Quem decide é uma pessoa: informe o nome dela, nunca um papel da Factory.' }
  if (pedido.estado !== 'aberto') return { ok: false, pedido, efeito: null, nota: `O pedido ${id} já está ${pedido.estado}.` }
  if (pedido.tipo === 'criterio' && pedido.criterio !== null) {
    const atual = lerEstado().cards.find((c) => c.id === pedido.cardId)?.criterios[pedido.criterio - 1]
    if (!mesmoTexto(atual, pedido.criterioTexto)) return { ok: false, pedido, efeito: null, nota: `O critério ${pedido.criterio} do card ${pedido.cardId} mudou (ou o card sumiu) depois deste pedido: a decisão seria sobre outro requisito. Cancele o pedido ${id} e abra outro.` }
  }
  const opcao = pedido.opcoes.find((o) => o.rotulo === escolha.trim().toUpperCase())
  if (!opcao) return { ok: false, pedido, efeito: null, nota: `A opção ${escolha} não existe neste pedido (${pedido.opcoes.map((o) => o.rotulo).join(', ')}).` }
  if (nota && (!linhaSo(nota) || nota.length > 240)) return { ok: false, pedido, efeito: null, nota: 'A nota tem até 240 caracteres, numa linha.' }
  const feito: PedidoDeDecisao = { ...pedido, estado: 'respondido', escolha: opcao.rotulo, decididoEm: agora.toISOString(), decididoPor: nome, nota: nota?.trim() || null }
  atualizarEstado((s) => ({ ...s, decisoes: (s.decisoes ?? []).map((p) => (p.id === id ? feito : p)) }))
  return { ok: true, pedido: feito, efeito: opcao.efeito ?? null, nota: `Pedido ${id} respondido por ${nome}: opção ${opcao.rotulo} (${opcao.oQue}).` }
}

export function cancelarPedido(id: string, autor: string, agora: Date = new Date()): ResultadoDeResponder {
  const pedido = (lerEstado().decisoes ?? []).find((p) => p.id === id)
  if (!pedido) return { ok: false, pedido: null, efeito: null, nota: `Não achei o pedido ${id}.` }
  const nome = autorValido(autor)
  if (!nome) return { ok: false, pedido, efeito: null, nota: 'Quem cancela é uma pessoa: informe o nome dela.' }
  if (pedido.estado !== 'aberto') return { ok: false, pedido, efeito: null, nota: `O pedido ${id} já está ${pedido.estado}.` }
  const feito: PedidoDeDecisao = { ...pedido, estado: 'cancelado', decididoEm: agora.toISOString(), decididoPor: nome }
  atualizarEstado((s) => ({ ...s, decisoes: (s.decisoes ?? []).map((p) => (p.id === id ? feito : p)) }))
  return { ok: true, pedido: feito, efeito: null, nota: `Pedido ${id} cancelado por ${nome}.` }
}

export function listarPedidos(filtro: { estado?: EstadoDoPedido; repositorio?: string; cardId?: string } = {}, estado: FabricaEstado = lerEstado()): PedidoDeDecisao[] {
  return (estado.decisoes ?? []).filter((p) => (!filtro.estado || p.estado === filtro.estado) && (!filtro.repositorio || p.repositorio === filtro.repositorio) && (!filtro.cardId || p.cardId === filtro.cardId))
}

export type DecisaoDeCriterio = { n: number; efeito: 'nao-se-aplica' | 'decidido-diferente'; motivo: string; decisaoId: string; por: string }

/**
 * Decisões de uma pessoa sobre critérios do card. Vale a ÚLTIMA resposta de cada critério: "manter" (C) apaga uma dispensa anterior.
 * Uma decisão só vale enquanto o critério tem o mesmo texto de quando foi decidida: se o card mudou o requisito, a decisão não o cobre.
 */
export function decisoesDeCriterio(cardId: string, estado: FabricaEstado = lerEstado()): DecisaoDeCriterio[] {
  const card = estado.cards.find((c) => c.id === cardId)
  if (!card) return []
  const saida = new Map<number, DecisaoDeCriterio>()
  const respondidos = (estado.decisoes ?? []).filter((p) => p.tipo === 'criterio' && p.cardId === cardId && p.estado === 'respondido' && p.criterio !== null && p.escolha)
  for (const p of [...respondidos].sort((a, b) => (a.decididoEm ?? '').localeCompare(b.decididoEm ?? ''))) {
    const n = p.criterio!
    const efeito = p.opcoes.find((o) => o.rotulo === p.escolha)?.efeito
    if (efeito === 'manter') { saida.delete(n); continue }
    if (efeito !== 'nao-se-aplica' && efeito !== 'decidido-diferente') continue
    if (!mesmoTexto(card.criterios[n - 1], p.criterioTexto)) { saida.delete(n); continue }
    saida.set(n, { n, efeito, motivo: p.nota ?? p.recomendacao.porque, decisaoId: p.id, por: p.decididoPor ?? 'uma pessoa' })
  }
  return [...saida.values()]
}

export function resumoDosPedidos(estado: FabricaEstado = lerEstado()): string {
  const abertos = (estado.decisoes ?? []).filter((p) => p.estado === 'aberto')
  if (abertos.length === 0) return 'Nenhum pedido de decisão aberto.'
  const vencendo = abertos.filter((p) => p.padrao).sort((a, b) => a.padrao!.vence.localeCompare(b.padrao!.vence))[0]
  return `${abertos.length} pedido(s) de decisão aberto(s).${vencendo ? ` O próximo prazo é ${vencendo.id}, em ${vencendo.padrao!.vence.slice(0, 10)} (vale a opção ${vencendo.padrao!.opcao}).` : ''}`
}
