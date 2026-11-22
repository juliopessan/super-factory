// Prepara a onda: transforma os IDs de cards que já existem nos pedidos que o iniciador entende, sem abrir card novo,
// confere duplicatas e o sandbox, e reserva os cards. Quem de fato roda a onda é o workflow "onda".

import { mensagemDoTeto, type Tetos } from './custo.ts'
import { duplicatasDe, issueDoCard, lerCardCompleto, repositorioComparavel } from './cards.ts'
import { preValidarSandbox, type DepsDoPreflight } from './preflight.ts'
import { atualizarEstado, lerEstado, type FabricaEstado } from './store.ts'

export type PedidoPreparado = {
  titulo: string
  descricao: string
  criterios: string
  provedor: 'github' | 'azure-devops'
  repositorio: string
  branchBase?: string
  branchHead?: string
  issue?: number
  cardId?: string
  chave?: string
  dependeDe?: string
  [extra: string]: unknown
}

export type PreparoDaOnda = {
  ok: boolean
  pedidos: PedidoPreparado[]
  pulados: Array<{ id: string; motivo: string }>
  bloqueados: Array<{ id: string; motivos: string[] }>
  avisos: string[]
  /** Número da onda em que os cards ficaram reservados (o de planejarOnda, se todos já tinham o mesmo). */
  onda: number | null
  nota: string
}

/**
 * Cards por ID: só entram cards em ready, sem PR, sem duplicata ativa e cujo repositório o sandbox atende.
 * Os pedidos livres (sem cardId) seguem como estavam. O preflight vale para os dois, exceto no ensaio.
 */
export async function prepararOnda(
  entrada: { cardIds?: string[]; pedidos?: PedidoPreparado[]; ensaio?: boolean; reservar?: boolean; repositorio?: string },
  deps: { preflight?: DepsDoPreflight; custo?: { tetos: Tetos; gastoDoDia: () => number } },
  estado: FabricaEstado = lerEstado(),
): Promise<PreparoDaOnda> {
  const pulados: PreparoDaOnda['pulados'] = []
  const bloqueados: PreparoDaOnda['bloqueados'] = []
  const avisos: string[] = []
  const pedidos: PedidoPreparado[] = []
  const falha = (nota: string): PreparoDaOnda => ({ ok: false, pedidos: [], pulados, bloqueados, avisos, onda: null, nota })
  if (!entrada.cardIds?.length && !entrada.pedidos?.length) return falha('Informe cardIds (cards que já estão no quadro) ou pedidos completos.')
  // Teto do dia: se já passou, nenhuma execução nova começa (o ensaio não gasta modelo).
  if (!entrada.ensaio && deps.custo && deps.custo.tetos.dia > 0 && deps.custo.gastoDoDia() >= deps.custo.tetos.dia) return falha(`BLOCKED: ${mensagemDoTeto('dia', deps.custo.gastoDoDia(), deps.custo.tetos.dia)}`)
  const ids = [...new Set(entrada.cardIds ?? [])]
  // Filtro de repositório: o quadro é um só, e a onda não deve levar trabalho de outro projeto por engano.
  const alvo = entrada.repositorio?.trim() ? repositorioComparavel(entrada.repositorio) : null
  for (const id of ids) {
    const lido = lerCardCompleto(id, estado)
    if (!lido) { pulados.push({ id, motivo: 'não existe no quadro' }); continue }
    if (alvo && repositorioComparavel(lido.card.repositorio) !== alvo) { pulados.push({ id, motivo: `é do repositório ${lido.card.repositorio}, não de ${entrada.repositorio!.trim()}` }); continue }
    if (!lido.podeIniciar) { pulados.push({ id, motivo: lido.porQueNaoIniciar ?? 'não pode iniciar' }); continue }
    const repetido = pedidos.find((p) => p.cardId && duplicatasDe(estado.cards, lido.card).some((d) => d.id === p.cardId))
    if (repetido) { pulados.push({ id, motivo: `é o mesmo trabalho de ${repetido.cardId}, já na onda` }); continue }
    const c = lido.card
    pedidos.push({
      titulo: c.titulo,
      descricao: c.descricao,
      criterios: c.criterios.join('\n'),
      provedor: c.provedor,
      repositorio: c.repositorio,
      branchBase: c.branchBase,
      ...(c.branchHead ? { branchHead: c.branchHead } : {}),
      ...(issueDoCard(c) ? { issue: issueDoCard(c)! } : {}),
      cardId: c.id,
    })
  }
  for (const livre of entrada.pedidos ?? []) {
    if (alvo && repositorioComparavel(livre.repositorio) !== alvo) pulados.push({ id: livre.titulo, motivo: `é do repositório ${livre.repositorio}, não de ${entrada.repositorio!.trim()}` })
    else pedidos.push(livre)
  }
  if (pedidos.length === 0) return falha(`Nenhum card pôde iniciar: ${pulados.map((p) => `${p.id} (${p.motivo})`).join('; ')}.`)

  // Sandbox: uma conferência por repositório, antes de gastar qualquer execução.
  let seguros = pedidos
  if (!entrada.ensaio && deps.preflight) {
    const porRepo = new Map<string, Awaited<ReturnType<typeof preValidarSandbox>>>()
    seguros = []
    for (const p of pedidos) {
      const base = p.branchBase ?? 'main'
      const chave = `${p.provedor}:${p.repositorio.toLowerCase()}@${base}`
      if (!porRepo.has(chave)) porRepo.set(chave, await preValidarSandbox({ repositorio: p.repositorio, branchBase: base, provedor: p.provedor }, deps.preflight))
      const r = porRepo.get(chave)!
      if (r.resultado === 'BLOCKED') bloqueados.push({ id: p.cardId ?? p.titulo, motivos: r.motivos })
      else {
        if (r.resultado === 'NOT_RUN') avisos.push(`${p.cardId ?? p.titulo}: sandbox não conferido (${r.motivos[0]})`)
        seguros.push(p)
      }
    }
  }
  if (seguros.length === 0) return { ...falha(`BLOCKED: nenhum card pôde iniciar. ${bloqueados.map((b) => `${b.id}: ${b.motivos[0]}`).join(' ')}`), pedidos: [] }
  // Reserva: os cards da onda saem do pool de ready até a onda acabar ou a pessoa liberar com moverCard.
  let ondaN: number | null = null
  if (entrada.reservar !== false) {
    const reservar = new Set(seguros.map((p) => p.cardId).filter((i): i is string => Boolean(i)))
    // Os cards que planejarOnda já reservou mantêm o número da onda; senão, abre a próxima.
    const jaReservados = [...new Set(estado.cards.filter((c) => reservar.has(c.id)).map((c) => c.onda))]
    ondaN = reservar.size === 0 ? null : jaReservados.length === 1 && jaReservados[0] !== null ? jaReservados[0] : Math.max(0, ...estado.cards.map((c) => c.onda ?? 0)) + 1
    if (reservar.size > 0) {
      atualizarEstado((e) => ({
        ...e,
        cards: e.cards.map((c) => (reservar.has(c.id) ? { ...c, onda: ondaN } : c)),
      }))
    }
  }
  const partes = [`${seguros.length} card(s) prontos para a onda`]
  if (pulados.length) partes.push(`${pulados.length} pulado(s): ${pulados.map((p) => `${p.id} (${p.motivo})`).join('; ')}`)
  if (bloqueados.length) partes.push(`${bloqueados.length} BLOCKED pelo sandbox: ${bloqueados.map((b) => `${b.id}: ${b.motivos[0]}`).join(' ')}`)
  return { ok: true, pedidos: seguros, pulados, bloqueados, avisos, onda: ondaN, nota: `${partes.join('. ')}.` }
}
