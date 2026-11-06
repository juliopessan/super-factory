import type { Card, Dono, Fatia, Grau, Rota } from './schemas.ts'

const VAGO = /\b(tbd|todo|etc\.?|asap|depois a gente vê|depois a gente ve|algo|alguma coisa|se der|se poss[ií]vel|a definir|a combinar)\b/i
const OBSERVAVEL = /quando|deve|precisa|n[aã]o|exibe|salva|recusa|retorna|devolve|mostra|bloqueia|registra|aplica|confirma|\d/i

export function lerCriterios(texto: string): string[] {
  return texto
    .split(/\r?\n/)
    .map((linha) => linha.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
}

export function lintarCriterios(criterios: string[]): { ok: boolean; issues: string[] } {
  const issues: string[] = []
  if (criterios.length === 0) issues.push('Nenhum critério de aceite.')
  for (const criterio of criterios) {
    if (criterio.length < 12) issues.push(`Curto demais: ${criterio}`)
    if (VAGO.test(criterio)) issues.push(`Vago: ${criterio}`)
    if (!OBSERVAVEL.test(criterio)) issues.push(`Sem condição observável: ${criterio}`)
  }
  return { ok: issues.length === 0, issues }
}

export function rotear(descricao: string, lintOk: boolean): Rota {
  if (!lintOk || descricao.trim().length < 40) return 'foggy'
  if (/\b(bug|erro|falha|exception|crash|sentry)\b/i.test(descricao)) return 'bug'
  return 'clear'
}

const REGRAS: { dono: Dono; test: RegExp; caminho: string }[] = [
  { dono: 'frontend', test: /\b(ui|tela|p[aá]gina|frontend|componente)\b/i, caminho: 'src/ui/' },
  { dono: 'backend', test: /\b(api|servi[cç]o|backend|banco|endpoint|filtro)\b/i, caminho: 'src/api/' },
  { dono: 'integrations', test: /\b(github|azure|integra[cç][aã]o|webhook)\b/i, caminho: 'src/integrations/' },
  { dono: 'docs', test: /\b(readme|documenta[cç][aã]o)\b/i, caminho: 'docs/' },
]

export function fatiasDe(texto: string): Fatia[] {
  const fatias = REGRAS.filter((regra) => regra.test.test(texto)).map((regra) => ({
    dono: regra.dono,
    caminhos: [regra.caminho],
  }))
  if (fatias.length === 0) return [{ dono: 'backend', caminhos: ['src/api/'] }]
  return fatias
}

export function sobrepoe(esquerda: string, direita: string): boolean {
  if (esquerda === direita) return true
  const a = esquerda.endsWith('/') ? esquerda : `${esquerda}/`
  const b = direita.endsWith('/') ? direita : `${direita}/`
  return a.startsWith(b) || b.startsWith(a)
}

export function fatiasDisjuntas(fatias: Fatia[]): { ok: boolean; conflito: string | null } {
  const caminhos = fatias.flatMap((fatia) => fatia.caminhos.map((caminho) => ({ dono: fatia.dono, caminho })))
  for (let i = 0; i < caminhos.length; i++) {
    for (let j = i + 1; j < caminhos.length; j++) {
      const um = caminhos[i]
      const outro = caminhos[j]
      if (!um || !outro || um.dono === outro.dono) continue
      if (sobrepoe(um.caminho, outro.caminho)) {
        return { ok: false, conflito: `${um.caminho} (${um.dono}) e ${outro.caminho} (${outro.dono})` }
      }
    }
  }
  return { ok: true, conflito: null }
}

export function grauDe(descricao: string, fatias: number): Grau {
  if (fatias >= 3 || descricao.length > 500) return 'hard'
  if (fatias <= 1 && descricao.length < 180) return 'easy'
  return 'medium'
}

export function planejarOnda(cards: Card[], limite = 3): { onda: number; cardIds: string[]; limite: number } {
  const teto = Math.min(Math.max(Math.trunc(limite) || 1, 1), 5)
  return {
    onda: 1,
    limite: teto,
    cardIds: cards.filter((card) => card.coluna === 'ready').slice(0, teto).map((card) => card.id),
  }
}

export function quadro(cards: Card[]) {
  const colunas = ['backlog', 'ready', 'build', 'qa', 'review', 'blocked', 'done'] as const
  return colunas.map((coluna) => ({
    coluna,
    cards: cards
      .filter((card) => card.coluna === coluna)
      .map((card) => ({ id: card.id, titulo: card.titulo, rota: card.rota, grau: card.grau })),
  }))
}
