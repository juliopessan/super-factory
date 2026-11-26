// Melhoria entre cards (o laço externo): a Factory olha o que aconteceu nas execuções e propõe LIÇÕES para o construtor.
// Uma lição é uma linha de "como trabalhar aqui" (ex.: "escreva um teste por critério e aponte-o"). O caminho é:
//   sinais observados  →  lição proposta (com a evidência)  →  uma PESSOA aprova  →  entra no pedido do construtor
//   →  a Factory compara a pontuação antes e depois  →  se piorou, recomenda retirar (uma pessoa retira).
// Três travas: (1) a lição só entra com aprovação de uma pessoa, em nome dela; (2) o texto passa por um filtro que recusa
// qualquer coisa que mexa em guarda (merge, aprovação, deploy, push, segredo, teste desligado); (3) lição nunca substitui
// as regras de segurança do construtor: o pedido diz isso. Quem melhora a si mesma sem passar por pessoa seria "RSI forte",
// e esta Factory não faz isso por desenho.

import { createHash } from 'node:crypto'

import { pontuarTentativa } from './melhoria.ts'
import type { Estado } from './schemas.ts'
import { atualizarEstado, lerEstado, type FabricaEstado } from './store.ts'

export type EstadoDaLicao = 'proposta' | 'aprovada' | 'recusada' | 'retirada'
export type Licao = {
  id: string
  texto: string
  /** "global" ou "owner/repo". */
  escopo: string
  estado: EstadoDaLicao
  /** A evidência observada que motivou a lição. */
  origem: string
  criadaEm: string
  decididaEm?: string
  decididaPor?: string
  /** Pontuação média das execuções ANTES da aprovação, para comparar depois. */
  antes?: { n: number; media: number }
}

const MAXIMO_POR_ESCOPO = 8
const JANELA_DE_BASE = 10

// Palavras que tocam em guardas. Lição não é lugar para isso: recusa, e a pessoa escreve uma regra de projeto se quiser.
const PROIBIDAS = /\b(merge|mescl\w*|aprov\w*|deploy|publica\w*|push|force|--no-verify|segredo\w*|secret\w*|token\w*|credencia\w*|senha\w*|password|\.env|chave de api)\b|(ignor|desativ|desabilit|pul(e|ar)|contorn|burl|remov(a|er) (o )?teste|apag(ue|ar) (o )?teste|skip|disable)/i

/** O texto toca em guarda da Factory (merge, aprovação, deploy, push, segredo, teste desligado)? */
export function tocaEmGuarda(texto: string): boolean {
  return PROIBIDAS.test(texto)
}

export function validarLicao(texto: string): { ok: boolean; motivo: string | null } {
  const t = texto.trim()
  if (t.length < 20 || t.length > 300) return { ok: false, motivo: 'A lição deve ter de 20 a 300 caracteres.' }
  if (/[\r\n]/.test(t)) return { ok: false, motivo: 'A lição deve ser uma linha só.' }
  if (/https?:\/\//i.test(t)) return { ok: false, motivo: 'Lição não leva links.' }
  if (PROIBIDAS.test(t)) return { ok: false, motivo: 'A lição toca em algo que é guarda da Factory (merge, aprovação, deploy, push, segredo ou teste desligado). Isso não se ensina por lição.' }
  return { ok: true, motivo: null }
}

// ---------- sinais ----------

export type Sinais = {
  execucoes: number
  criterios: { total: number; semTeste: number }
  bugs: { total: number; semProva: number }
  ancoragem: { semLer: number; semRodar: number }
  prs: { medidos: number; ajustados: number; recusados: number }
  grandes: number
  /** Pontuação média das execuções com resultado por critério. */
  pontuacaoMedia: number | null
}

export function sinaisDeFalha(runs: Estado[]): Sinais {
  const comAvaliacao = runs.filter((r) => r.criterios !== undefined || r.checks.length > 0)
  const criterios = comAvaliacao.flatMap((r) => r.criterios ?? [])
  const bugs = comAvaliacao.filter((r) => r.card.rota === 'bug')
  const nota = (r: Estado, re: RegExp) => r.achados.some((a) => a.id.startsWith('ANC-') && re.test(a.texto))
  const medidos = runs.filter((r) => r.resultadoPr && r.resultadoPr.resultado !== 'aberto')
  const pontos = comAvaliacao.map((r) => pontuarTentativa(r).pontos)
  return {
    execucoes: comAvaliacao.length,
    criterios: { total: criterios.length, semTeste: criterios.filter((c) => c.status === 'NOT_RUN' && /não apontou nenhum teste|não está no diff|não informou/.test(c.evidencia)).length },
    bugs: { total: bugs.length, semProva: bugs.filter((r) => r.checks.find((c) => c.nome === 'vermelho-verde')?.resultado !== 'PASS').length },
    ancoragem: { semLer: comAvaliacao.filter((r) => nota(r, /sem ler/)).length, semRodar: comAvaliacao.filter((r) => nota(r, /não rodou nenhum comando/)).length },
    prs: { medidos: medidos.length, ajustados: medidos.filter((r) => r.resultadoPr?.resultado === 'ajustado').length, recusados: medidos.filter((r) => r.resultadoPr?.resultado === 'recusado').length },
    grandes: comAvaliacao.filter((r) => r.trilha.some((e) => /PR maior que o orçamento/.test(e.resumo))).length,
    pontuacaoMedia: pontos.length ? Math.round((pontos.reduce((a, b) => a + b, 0) / pontos.length) * 10) / 10 : null,
  }
}

const idDe = (texto: string, escopo: string) => `L-${createHash('sha1').update(`${escopo}|${texto}`).digest('hex').slice(0, 6)}`

export type Candidata = { texto: string; origem: string }

/** Lições candidatas a partir dos sinais. Determinístico: cada regra tem um limiar mínimo de amostra. */
export function licoesDeSinais(s: Sinais): Candidata[] {
  const c: Candidata[] = []
  if (s.criterios.total >= 4 && s.criterios.semTeste / s.criterios.total >= 0.3) c.push({ texto: 'Escreva ao menos um teste para cada critério de aceite e, no fim, aponte-o com "CRITERIO n: arquivo"; confira que o arquivo está entre os que você mudou.', origem: `${s.criterios.semTeste} de ${s.criterios.total} critérios ficaram sem teste apontado em ${s.execucoes} execução(ões).` })
  if (s.bugs.total >= 2 && s.bugs.semProva >= 2) c.push({ texto: 'Em card de bug, escreva primeiro o teste que reproduz o defeito, veja-o falhar e deixe-o no diff junto da correção.', origem: `${s.bugs.semProva} de ${s.bugs.total} bugs ficaram sem prova de reprodução (vermelho→verde).` })
  if (s.ancoragem.semLer >= 2) c.push({ texto: 'Leia o arquivo com lerArquivo antes de alterá-lo, mesmo quando achar que já conhece o conteúdo.', origem: `${s.ancoragem.semLer} execução(ões) escreveram arquivos sem ler antes.` })
  if (s.ancoragem.semRodar >= 2) c.push({ texto: 'Rode o comando de teste do repositório antes de dizer que os testes passam, e cite o resultado que você viu.', origem: `${s.ancoragem.semRodar} execução(ões) disseram que os testes passaram sem rodar comando.` })
  if (s.prs.medidos >= 4 && s.prs.ajustados / s.prs.medidos >= 0.4) c.push({ texto: 'Antes de terminar, compare o seu código com o estilo e as convenções do código à volta e ajuste o que destoar.', origem: `${s.prs.ajustados} de ${s.prs.medidos} PRs foram ajustados por pessoas depois de abertos.` })
  if (s.grandes >= 2) c.push({ texto: 'Faça a menor mudança que cumpra os critérios e evite reformatar ou reorganizar código que o card não pede.', origem: `${s.grandes} execução(ões) passaram do orçamento de tamanho de PR.` })
  return c
}

// ---------- estado ----------

/** Guarda as lições candidatas que ainda não existem (nem recusadas: a pessoa já decidiu). Devolve só as novas. */
export function proporLicoes(escopo = 'global', estado: FabricaEstado = lerEstado(), agora = new Date()): { novas: Licao[]; sinais: Sinais } {
  const runs = Object.values(estado.runs).filter((r) => escopo === 'global' || r.card.repositorio.toLowerCase() === escopo.toLowerCase())
  const sinais = sinaisDeFalha(runs)
  const existentes = new Set((estado.licoes ?? []).map((l) => l.id))
  const novas: Licao[] = []
  for (const cand of licoesDeSinais(sinais)) {
    const id = idDe(cand.texto, escopo)
    if (existentes.has(id) || !validarLicao(cand.texto).ok) continue
    novas.push({ id, texto: cand.texto, escopo, estado: 'proposta', origem: cand.origem, criadaEm: agora.toISOString() })
  }
  if (novas.length) atualizarEstado((e) => ({ ...e, licoes: [...(e.licoes ?? []), ...novas] }))
  return { novas, sinais }
}

// Os papéis da Factory (ids e nomes dos agentes, com variações de separador e acento) e outros nomes genéricos de máquina.
// "Chief of Staff", "chief-of-staff" e "chief_of_staff" são o mesmo papel; quem decide é uma pessoa, com nome próprio.
const PAPEIS_NORMALIZADOS = new Set([
  'factory', 'superfactory', 'chief', 'chiefofstaff', 'agente', 'agent', 'bot', 'claude', 'copilot', 'assistant', 'assistente', 'sistema', 'system', 'ia', 'ai', 'gpt',
  'architect', 'arquiteto', 'frontend', 'backend', 'qa', 'security', 'seguranca', 'docs', 'integrations', 'integracoes', 'reviewer', 'prreview', 'revisor',
  'construtor', 'reprodutor', 'melhorador', 'improver', 'worker', 'builder',
])
const normalizarNome = (nome: string) => nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')

/** O nome é de um papel da Factory (ou de uma máquina), e não de uma pessoa? */
export function ehPapelDaFactory(nome: string): boolean {
  const n = normalizarNome(nome)
  return n === '' || PAPEIS_NORMALIZADOS.has(n) || /(bot|agent)$/.test(n)
}

/** Aprova, recusa ou retira uma lição, em nome de uma pessoa. Aprovar guarda a pontuação média de antes, para comparar depois. */
export function decidirLicao(id: string, decisao: 'aprovada' | 'recusada' | 'retirada', autor: string, estado: FabricaEstado = lerEstado(), agora = new Date()): { ok: boolean; licao: Licao | null; nota: string } {
  const licao = (estado.licoes ?? []).find((l) => l.id === id)
  if (!licao) return { ok: false, licao: null, nota: `Não achei a lição ${id}.` }
  const nome = autor.trim()
  if (!nome || nome.length > 80 || ehPapelDaFactory(nome)) return { ok: false, licao, nota: 'Quem decide é uma pessoa: informe o nome dela como autor, nunca um papel da Factory.' }
  if (decisao === 'aprovada') {
    if (licao.estado === 'aprovada') return { ok: true, licao, nota: `A lição ${id} já está aprovada.` }
    const v = validarLicao(licao.texto)
    if (!v.ok) return { ok: false, licao, nota: v.motivo ?? 'Lição inválida.' }
    const aprovadas = (estado.licoes ?? []).filter((l) => l.estado === 'aprovada' && l.escopo === licao.escopo).length
    if (aprovadas >= MAXIMO_POR_ESCOPO) return { ok: false, licao, nota: `Já há ${MAXIMO_POR_ESCOPO} lições aprovadas neste escopo. Retire uma antes: instrução demais dilui todas.` }
  } else if (decisao === 'retirada' && licao.estado !== 'aprovada') return { ok: false, licao, nota: 'Só se retira uma lição que estava aprovada.' }
  else if (decisao === 'recusada' && licao.estado !== 'proposta') return { ok: false, licao, nota: 'Só se recusa uma lição que ainda é proposta.' }
  const base = decisao === 'aprovada' ? mediaRecente(estado, licao.escopo) : undefined
  const proxima: Licao = { ...licao, estado: decisao, decididaEm: agora.toISOString(), decididaPor: nome, ...(base ? { antes: base } : {}) }
  atualizarEstado((e) => ({ ...e, licoes: (e.licoes ?? []).map((l) => (l.id === id ? proxima : l)) }))
  return { ok: true, licao: proxima, nota: `Lição ${id} ${decisao === 'aprovada' ? 'aprovada' : decisao === 'recusada' ? 'recusada' : 'retirada'} por ${nome}.` }
}

function pontosDe(r: Estado): number {
  return pontuarTentativa(r).pontos
}

function mediaRecente(estado: FabricaEstado, escopo: string): { n: number; media: number } | undefined {
  const runs = Object.values(estado.runs)
    .filter((r) => (escopo === 'global' || r.card.repositorio.toLowerCase() === escopo.toLowerCase()) && (r.criterios !== undefined || r.checks.length > 0))
    .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))
    .slice(0, JANELA_DE_BASE)
  if (runs.length === 0) return undefined
  return { n: runs.length, media: Math.round((runs.reduce((n, r) => n + pontosDe(r), 0) / runs.length) * 10) / 10 }
}

/** As lições aprovadas que valem para um repositório (as globais e as dele), até o teto por escopo. */
export function licoesAtivas(repositorio: string, estado: FabricaEstado = lerEstado()): Licao[] {
  const aprovadas = (estado.licoes ?? []).filter((l) => l.estado === 'aprovada' && (l.escopo === 'global' || l.escopo.toLowerCase() === repositorio.toLowerCase()))
  return aprovadas.slice(-MAXIMO_POR_ESCOPO * 2)
}

export type Acompanhamento = { id: string; texto: string; escopo: string; estado: EstadoDaLicao; antes: { n: number; media: number } | null; depois: { n: number; media: number } | null; delta: number | null; veredito: 'sem-dados' | 'melhorou' | 'piorou' | 'neutra'; recomendacao: string }

/** Compara a pontuação média das execuções depois da aprovação com a de antes. Pouca amostra: não conclui. */
export function acompanharLicoes(estado: FabricaEstado = lerEstado(), minimo = 3): Acompanhamento[] {
  return (estado.licoes ?? []).map((l) => {
    const base: Acompanhamento = { id: l.id, texto: l.texto, escopo: l.escopo, estado: l.estado, antes: l.antes ?? null, depois: null, delta: null, veredito: 'sem-dados', recomendacao: l.estado === 'proposta' ? 'Aguardando uma pessoa aprovar ou recusar.' : l.estado === 'aprovada' ? 'Aprovada: ainda sem execuções suficientes depois dela.' : 'Sem acompanhamento.' }
    if (l.estado !== 'aprovada' || !l.decididaEm || !l.antes) return base
    const depoisRuns = Object.values(estado.runs).filter((r) => r.atualizadoEm > l.decididaEm! && (l.escopo === 'global' || r.card.repositorio.toLowerCase() === l.escopo.toLowerCase()) && (r.criterios !== undefined || r.checks.length > 0))
    if (depoisRuns.length < minimo) return { ...base, depois: depoisRuns.length ? { n: depoisRuns.length, media: Math.round((depoisRuns.reduce((n, r) => n + pontosDe(r), 0) / depoisRuns.length) * 10) / 10 } : null }
    const media = Math.round((depoisRuns.reduce((n, r) => n + pontosDe(r), 0) / depoisRuns.length) * 10) / 10
    const delta = Math.round((media - l.antes.media) * 10) / 10
    const veredito = delta >= 3 ? 'melhorou' : delta <= -3 ? 'piorou' : 'neutra'
    return { ...base, depois: { n: depoisRuns.length, media }, delta, veredito, recomendacao: veredito === 'piorou' ? `A pontuação média caiu ${Math.abs(delta)} pontos desde a aprovação (${l.antes.media} → ${media}, ${depoisRuns.length} execuções). Vale retirar a lição: quem decide é uma pessoa.` : veredito === 'melhorou' ? `A pontuação média subiu ${delta} pontos (${l.antes.media} → ${media}). Mantenha.` : 'Sem diferença clara. Mantenha e observe, ou retire se a lição for ruído.' }
  })
}
