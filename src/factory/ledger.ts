import type { Estado, Evento } from './schemas.ts'

export function anotar(
  estado: Estado,
  tipo: 'observed' | 'reported',
  resumo: string,
  ator: string,
): Estado {
  const evento: Evento = {
    sequencia: estado.trilha.length + 1,
    runId: estado.runId,
    em: estado.atualizadoEm,
    estagio: estado.estagio,
    tipo,
    resumo,
    ator,
  }
  return { ...estado, trilha: [...estado.trilha, evento] }
}

export function anotarHumano(estado: Estado, resumo: string, ator: string): Estado {
  const evento: Evento = {
    sequencia: estado.trilha.length + 1,
    runId: estado.runId,
    em: estado.atualizadoEm,
    estagio: estado.estagio,
    tipo: 'human',
    resumo,
    ator,
  }
  return { ...estado, trilha: [...estado.trilha, evento] }
}

export function evidenciaDe(estado: Estado): Estado['evidencia'] {
  if (estado.checks.length === 0) return 'NONE'
  if (estado.checks.some((check) => check.resultado === 'FAIL' || check.resultado === 'BLOCKED')) return 'STALE'
  if (estado.checks.some((check) => check.resultado === 'NOT_RUN')) return 'NONE'
  if (estado.checks.every((check) => check.resultado === 'PASS' && check.evidencia.trim().length >= 8)) return 'CURRENT'
  return 'STALE'
}
