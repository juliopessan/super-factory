import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Card, Estado, Evento } from './schemas.ts'

export type FabricaEstado = {
  seq: number
  cards: Card[]
  runs: Record<string, Estado>
  ledger: Evento[]
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export function caminhoDoEstado(): string {
  return process.env.FACTORY_STATE_PATH ?? path.join(root, 'data', 'factory-state.json')
}

function semente(): FabricaEstado {
  return {
    seq: 2,
    cards: [
      {
        id: 'C-1',
        titulo: 'Filtro de datas só com dia',
        descricao: 'Bug: a API de pedidos falha quando o intervalo vem sem hora.',
        criterios: [
          'O endpoint devolve 400 quando o fim é anterior ao início.',
          'O filtro aplica hora e minuto, não só o dia.',
        ],
        coluna: 'ready',
        rota: 'bug',
        grau: 'easy',
        provedor: 'github',
        repositorio: 'acme/widgets',
        branchBase: 'main',
        branchHead: null,
        onda: null,
        itemExterno: null,
      },
      {
        id: 'C-2',
        titulo: 'Melhorar o onboarding',
        descricao: 'Ainda está vago o que a pessoa precisa concluir.',
        criterios: ['a definir'],
        coluna: 'backlog',
        rota: 'foggy',
        grau: 'medium',
        provedor: 'azure-devops',
        repositorio: 'fabrica',
        branchBase: 'main',
        branchHead: null,
        onda: null,
        itemExterno: null,
      },
    ],
    runs: {},
    ledger: [],
  }
}

export function lerEstado(): FabricaEstado {
  const arquivo = caminhoDoEstado()
  if (!fs.existsSync(arquivo)) return semente()
  const bruto = JSON.parse(fs.readFileSync(arquivo, 'utf8')) as Partial<FabricaEstado>
  if (!bruto || !Array.isArray(bruto.cards) || !Array.isArray(bruto.ledger) || typeof bruto.seq !== 'number') {
    throw new Error('Estado da fábrica ilegível.')
  }
  return {
    seq: bruto.seq,
    cards: bruto.cards,
    runs: bruto.runs ?? {},
    ledger: bruto.ledger,
  }
}

export function gravarEstado(estado: FabricaEstado): void {
  const arquivo = caminhoDoEstado()
  fs.mkdirSync(path.dirname(arquivo), { recursive: true })
  const temporario = `${arquivo}.${process.pid}.tmp`
  fs.writeFileSync(temporario, JSON.stringify(estado, null, 2))
  fs.renameSync(temporario, arquivo)
}

export function atualizarEstado(mudar: (estado: FabricaEstado) => FabricaEstado): FabricaEstado {
  const proximo = mudar(lerEstado())
  gravarEstado(proximo)
  return proximo
}

export function alocarId(prefixo: string): string {
  let id = ''
  atualizarEstado((estado) => {
    const seq = estado.seq + 1
    id = `${prefixo}-${seq}`
    return { ...estado, seq }
  })
  return id
}

export function persistir(run: Estado): Estado {
  atualizarEstado((estado) => ({
    ...estado,
    cards: [...estado.cards.filter((card) => card.id !== run.card.id), run.card],
    runs: { ...estado.runs, [run.runId]: run },
    ledger: [...estado.ledger.filter((evento) => evento.runId !== run.runId), ...run.trilha],
  }))
  return run
}

export function lerRun(runId: string): Estado | null {
  return lerEstado().runs[runId] ?? null
}
