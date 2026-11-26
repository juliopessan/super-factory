// Disjuntor: o vigia sem IA da Factory. Conta como cada execução do modo autônomo terminou, por repositório, e abre o
// circuito quando as falhas se repetem: nada novo começa naquele repositório até uma pessoa retomar. Repetir uma execução
// que já falhou três vezes só gasta tokens e esconde a causa. Vem do capítulo da equipe autônoma da Fábrica (DeskLabs):
// o vigia não usa modelo (morreria junto com a cota que vigia), não retoma sozinho, e o alarme abre um pedido de decisão,
// porque alarme sem quem feche vira ruído.
//
// Dois gatilhos, ambos por repositório (0 desliga): N falhas seguidas (SUPER_FACTORY_DISJUNTOR_SEGUIDAS, padrão 3) e N falhas
// na última hora (SUPER_FACTORY_DISJUNTOR_HORA, padrão 5). O teto de tokens continua sendo outro limite, com mensagem própria:
// parar por teto, ou por disjuntor aberto, não conta como falha do repositório. Ensaio não conta.

import { abrirPedidoDeDisjuntor, autorValido } from './decisoes.ts'
import { normalizarRepositorio } from './guards.ts'
import { atualizarEstado, lerEstado, type FabricaEstado } from './store.ts'

export type ConfigDoDisjuntor = { seguidas: number; hora: number }
export const CONFIG_PADRAO: ConfigDoDisjuntor = { seguidas: 3, hora: 5 }

export type Desfecho = { em: string; cardId: string; ok: boolean; motivo: string | null }

export type Circuito = {
  /** Falhas seguidas, contadas pelo próprio circuito (não dependem de histórico que outros repositórios possam empurrar para fora). */
  falhasSeguidas: number
  ultimoSucessoEm: string | null
  ultimaFalhaEm: string | null
  /** Última vez que este vigia viu um desfecho deste repositório (vigia precisa de vigia). */
  ultimoDesfechoEm: string | null
  /** Os desfechos recentes DESTE repositório, para a janela de uma hora. */
  recentes: Desfecho[]
  aberto: { em: string; gatilho: 'seguidas' | 'hora'; motivo: string; decisaoId: string | null } | null
  retomadoEm: string | null
  retomadoPor: string | null
}

export type EstadoDoDisjuntor = { circuitos: Record<string, Circuito> }

const DIAS_LEMBRADOS = 7
const MINIMO_DE_RECENTES = 30
const UMA_HORA = 3_600_000

/** O repositório em forma canônica (owner/repo, ou o endereço copiado do navegador), sem diferenciar maiúsculas. */
export function chaveDoRepositorio(valor: string): string {
  const v = valor.trim()
  try {
    return normalizarRepositorio('github', v).toLowerCase()
  } catch {
    return v.toLowerCase()
  }
}

export function lerConfigDoDisjuntor(env: Record<string, string | undefined> = process.env): ConfigDoDisjuntor {
  const num = (v: string | undefined, padrao: number) => {
    if (v === undefined || v.trim() === '') return padrao
    const n = Number(v)
    return Number.isInteger(n) && n >= 0 ? n : padrao
  }
  return { seguidas: num(env.SUPER_FACTORY_DISJUNTOR_SEGUIDAS, CONFIG_PADRAO.seguidas), hora: num(env.SUPER_FACTORY_DISJUNTOR_HORA, CONFIG_PADRAO.hora) }
}

const novoCircuito = (): Circuito => ({ falhasSeguidas: 0, ultimoSucessoEm: null, ultimaFalhaEm: null, ultimoDesfechoEm: null, recentes: [], aberto: null, retomadoEm: null, retomadoPor: null })
const doEstado = (e: FabricaEstado, chave: string): Circuito => ({ ...novoCircuito(), ...(e.disjuntor?.circuitos[chave] ?? {}) })

/** O motivo da parada foi o teto de tokens ou o próprio disjuntor? Então não é falha do repositório. */
export function paradaNaoContaComoFalha(motivo: string | null | undefined): boolean {
  return /^(Teto de tokens|Disjuntor)/i.test((motivo ?? '').trim())
}

/** Pura: decide se o circuito deve abrir, dado o contador de falhas seguidas e os desfechos recentes do repositório. */
export function avaliar(c: Pick<Circuito, 'falhasSeguidas' | 'recentes'>, repositorio: string, config: ConfigDoDisjuntor, agora: Date): { abre: boolean; gatilho: 'seguidas' | 'hora' | null; motivo: string | null; seguidas: number; naHora: number } {
  const corte = agora.getTime() - UMA_HORA
  const naHora = c.recentes.filter((d) => !d.ok && Date.parse(d.em) >= corte).length
  const seguidas = c.falhasSeguidas
  if (config.seguidas > 0 && seguidas >= config.seguidas) return { abre: true, gatilho: 'seguidas', motivo: `${seguidas} execuções seguidas pararam em ${repositorio}.`, seguidas, naHora }
  if (config.hora > 0 && naHora >= config.hora) return { abre: true, gatilho: 'hora', motivo: `${naHora} execuções pararam em ${repositorio} na última hora.`, seguidas, naHora }
  return { abre: false, gatilho: null, motivo: null, seguidas, naHora }
}

export type ResultadoDoRegistro = { repositorio: string; abriuAgora: boolean; aberto: boolean; circuito: Circuito; decisaoId: string | null }

/** Anota o desfecho de uma execução e abre o circuito se for o caso. Ensaio e paradas por teto/disjuntor não entram aqui. */
export function registrarDesfecho(entrada: { repositorio: string | null | undefined; cardId: string; ok: boolean; motivo?: string | null }, config: ConfigDoDisjuntor = lerConfigDoDisjuntor(), agora: Date = new Date()): ResultadoDoRegistro | null {
  if (!entrada.repositorio?.trim()) return null
  const repositorio = chaveDoRepositorio(entrada.repositorio)
  if (!entrada.ok && paradaNaoContaComoFalha(entrada.motivo)) return null
  const corte = agora.getTime() - DIAS_LEMBRADOS * 86_400_000
  // Guarda o bastante para a janela de uma hora comportar o limite configurado.
  const limiteDeRecentes = Math.max(MINIMO_DE_RECENTES, config.hora + 5)
  let resultado: ResultadoDoRegistro | null = null
  atualizarEstado((e) => {
    const antes = doEstado(e, repositorio)
    const recentes = [...antes.recentes.filter((d) => Date.parse(d.em) >= corte), { em: agora.toISOString(), cardId: entrada.cardId, ok: entrada.ok, motivo: entrada.ok ? null : (entrada.motivo ?? null)?.slice(0, 200) ?? null }].slice(-limiteDeRecentes)
    let circuito: Circuito = { ...antes, recentes, ultimoDesfechoEm: agora.toISOString() }
    let abriuAgora = false
    if (entrada.ok) {
      // Sucesso zera a sequência de falhas. Um circuito já aberto continua aberto: só uma pessoa o fecha.
      circuito = { ...circuito, falhasSeguidas: 0, ultimoSucessoEm: agora.toISOString() }
    } else {
      circuito = { ...circuito, falhasSeguidas: antes.falhasSeguidas + 1, ultimaFalhaEm: agora.toISOString() }
      const av = avaliar(circuito, repositorio, config, agora)
      if (av.abre && !circuito.aberto) {
        abriuAgora = true
        circuito = { ...circuito, aberto: { em: agora.toISOString(), gatilho: av.gatilho!, motivo: av.motivo!, decisaoId: null } }
      }
    }
    resultado = { repositorio, abriuAgora, aberto: circuito.aberto !== null, circuito, decisaoId: circuito.aberto?.decisaoId ?? null }
    return { ...e, disjuntor: { circuitos: { ...(e.disjuntor?.circuitos ?? {}), [repositorio]: circuito } } }
  })
  const r = resultado as ResultadoDoRegistro | null
  if (r?.abriuAgora && r.circuito.aberto) {
    // O alarme tem quem o feche: um pedido de decisão, cujo padrão é manter pausado.
    const pedido = abrirPedidoDeDisjuntor({ repositorio: r.repositorio, resumo: r.circuito.aberto.motivo }, agora)
    atualizarEstado((e) => {
      const c = doEstado(e, r.repositorio)
      return { ...e, disjuntor: { circuitos: { ...(e.disjuntor?.circuitos ?? {}), [r.repositorio]: { ...c, aberto: c.aberto ? { ...c.aberto, decisaoId: pedido.id } : null } } } }
    })
    r.decisaoId = pedido.id
    r.circuito = { ...r.circuito, aberto: { ...r.circuito.aberto, decisaoId: pedido.id } }
  }
  return r
}

/** Texto do bloqueio quando o circuito deste repositório está aberto; null quando pode seguir. */
export function bloqueioDoDisjuntor(repositorio: string | null | undefined, estado: FabricaEstado = lerEstado()): string | null {
  if (!repositorio?.trim()) return null
  const repo = chaveDoRepositorio(repositorio)
  const aberto = estado.disjuntor?.circuitos[repo]?.aberto
  if (!aberto) return null
  return `Disjuntor aberto em ${repo} desde ${aberto.em.slice(0, 16).replace('T', ' ')} UTC: ${aberto.motivo} Nenhum card novo começa aqui até uma pessoa retomar${aberto.decisaoId ? ` (pedido de decisão ${aberto.decisaoId}; use retomarDisjuntor)` : ' (use retomarDisjuntor)'}. Resolva a causa antes: leia o motivo das execuções paradas com lerCard.`
}

/** Fecha o circuito, em nome de uma pessoa. Zera a sequência e a janela de uma hora, para o disjuntor não reabrir por falhas já vistas. */
export function retomarDisjuntor(repositorio: string, autor: string, agora: Date = new Date()): { ok: boolean; nota: string } {
  const nome = autorValido(autor)
  if (!nome) return { ok: false, nota: 'Quem retoma é uma pessoa: informe o nome dela, nunca um papel da Factory.' }
  const repo = chaveDoRepositorio(repositorio)
  const circuito = lerEstado().disjuntor?.circuitos[repo]
  if (!circuito?.aberto) return { ok: false, nota: `O disjuntor de ${repo} não está aberto.` }
  const decisaoId = circuito.aberto.decisaoId
  atualizarEstado((e) => ({
    ...e,
    disjuntor: { circuitos: { ...(e.disjuntor?.circuitos ?? {}), [repo]: { ...doEstado(e, repo), aberto: null, falhasSeguidas: 0, recentes: [], retomadoEm: agora.toISOString(), retomadoPor: nome } } },
    // O pedido de decisão do alarme fecha junto, para não sobrar alarme sem dono.
    decisoes: (e.decisoes ?? []).map((p) => (p.id === decisaoId && p.estado === 'aberto' ? { ...p, estado: 'respondido' as const, escolha: 'A', decididoEm: agora.toISOString(), decididoPor: nome, nota: 'Retomado pela ferramenta retomarDisjuntor.' } : p)),
  }))
  return { ok: true, nota: `Disjuntor de ${repo} retomado por ${nome}. Se a causa persistir, ele abre de novo na sequência de falhas.` }
}

/** Ensaio: o que aconteceria com N falhas a mais, sem gravar nada. Prova que o vigia está armado. */
export function ensaiarDisjuntor(repositorio: string, falhasAMais: number, config: ConfigDoDisjuntor = lerConfigDoDisjuntor(), estado: FabricaEstado = lerEstado(), agora: Date = new Date()): { abriria: boolean; gatilho: string | null; motivo: string | null; resumo: string } {
  const repo = chaveDoRepositorio(repositorio)
  const n = Math.max(0, Math.min(50, Math.floor(falhasAMais)))
  const atual = doEstado(estado, repo)
  const hipoteticas: Desfecho[] = Array.from({ length: n }, (_, i) => ({ em: new Date(agora.getTime() + i).toISOString(), cardId: 'C-ensaio', ok: false, motivo: 'ensaio' }))
  const av = avaliar({ falhasSeguidas: atual.falhasSeguidas + n, recentes: [...atual.recentes, ...hipoteticas] }, repo, config, new Date(agora.getTime() + n))
  const armado = config.seguidas > 0 || config.hora > 0
  return {
    abriria: av.abre,
    gatilho: av.gatilho,
    motivo: av.motivo,
    resumo: !armado ? 'O disjuntor está desligado (os dois limites em 0).' : av.abre ? `Com ${n} falha(s) a mais, o disjuntor abriria (${av.gatilho}): ${av.motivo}` : `Com ${n} falha(s) a mais, o disjuntor ainda não abriria (${av.seguidas} seguidas, ${av.naHora} na última hora; limites ${config.seguidas || 'desligado'} e ${config.hora || 'desligado'}).`,
  }
}

export type ResumoDoDisjuntor = {
  config: ConfigDoDisjuntor
  circuitos: Array<{ repositorio: string; situacao: 'aberto' | 'fechado'; falhasSeguidas: number; ultimoSucessoEm: string | null; ultimoDesfechoEm: string | null; motivo: string | null; decisaoId: string | null }>
  resumo: string
}

export function resumoDoDisjuntor(config: ConfigDoDisjuntor = lerConfigDoDisjuntor(), estado: FabricaEstado = lerEstado()): ResumoDoDisjuntor {
  const circuitos = Object.entries(estado.disjuntor?.circuitos ?? {})
    .map(([repositorio, c]) => ({ repositorio, situacao: c.aberto ? ('aberto' as const) : ('fechado' as const), falhasSeguidas: c.falhasSeguidas, ultimoSucessoEm: c.ultimoSucessoEm, ultimoDesfechoEm: c.ultimoDesfechoEm, motivo: c.aberto?.motivo ?? null, decisaoId: c.aberto?.decisaoId ?? null }))
    .sort((a, b) => (a.situacao === b.situacao ? a.repositorio.localeCompare(b.repositorio) : a.situacao === 'aberto' ? -1 : 1))
  const abertos = circuitos.filter((c) => c.situacao === 'aberto')
  const limites = config.seguidas === 0 && config.hora === 0 ? 'Disjuntor desligado.' : `Abre com ${config.seguidas || 'sem limite de'} falha(s) seguida(s) ou ${config.hora || 'sem limite de'} na última hora, por repositório.`
  return { config, circuitos, resumo: `${limites} ${abertos.length ? `ABERTO em: ${abertos.map((c) => c.repositorio).join(', ')}.` : 'Nenhum circuito aberto.'}` }
}
