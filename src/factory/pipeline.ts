import { criarIssueGithub, criarRascunhoGithub, type GithubDeps } from './github.ts'
import { criarRascunhoAzure, criarWorkItemAzure, type AzureDeps } from './azure.ts'
import { fatiasDe, fatiasDisjuntas, grauDe, lintarCriterios, rotear } from './board.ts'
import {
  dividirAzure,
  dividirRepositorio,
  normalizarRepositorio,
  pedidoPerigoso,
  redigirSegredos,
  validarBranch,
  validarRascunho,
  varrerSegredos,
} from './guards.ts'
import { anotar, anotarHumano, evidenciaDe } from './ledger.ts'
import { validarManifesto } from './manifest.ts'
import { relatorioDe } from './report.ts'
import type { Estado, Pedido, PedidoBruto, Portao } from './schemas.ts'
import { alocarId, persistir } from './store.ts'

export type Retomada = {
  aprovado: boolean
  aprovador: string
  nota: string
}

export type Clientes = {
  github?: GithubDeps
  azure?: AzureDeps
}

export function normalizarPedido(input: PedidoBruto): Pedido {
  return {
    titulo: input.titulo.trim(),
    descricao: input.descricao.trim(),
    criterios: input.criterios
      .split(/\r?\n/)
      .map((linha) => linha.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean),
    provedor: input.provedor,
    repositorio: normalizarRepositorio(input.provedor, input.repositorio),
    branchBase: (input.branchBase?.trim() || 'main'),
    branchHead: input.branchHead?.trim() ? input.branchHead.trim() : null,
  }
}

export function validarPedido(pedido: Pedido): void {
  validarBranch(pedido.branchBase)
  if (pedido.branchHead) validarBranch(pedido.branchHead)
  if (pedido.provedor === 'github') dividirRepositorio(pedido.repositorio)
  else dividirAzure(pedido.repositorio)
}

function agora(): string {
  return new Date().toISOString()
}

export function observado(
  nome: string,
  resultado: Estado['checks'][number]['resultado'],
  evidencia: string,
  comando: string | null = null,
): Estado['checks'][number] {
  if (resultado === 'PASS' && evidencia.trim().length < 8) {
    throw new Error(`PASS sem evidência em ${nome}.`)
  }
  if (resultado === 'PASS' && comando !== null) {
    throw new Error(`Esta Factory não marca PASS a partir de um comando externo (${nome}).`)
  }
  if (nome === 'testes-do-produto' && resultado === 'PASS') {
    throw new Error('Testes do produto não recebem PASS nesta Factory.')
  }
  return { nome, resultado, comando, evidencia }
}

export function parar(estado: Estado, motivo: string): Estado {
  if (estado.parado) return estado
  const proximo: Estado = {
    ...estado,
    parado: true,
    motivo,
    desfecho: 'bloqueado',
    card: { ...estado.card, coluna: 'blocked' },
    atualizadoEm: agora(),
  }
  return anotar(proximo, 'observed', motivo, 'factory')
}

export function iniciar(bruto: PedidoBruto): Estado {
  const pedido = normalizarPedido(bruto)
  validarPedido(pedido)
  const original = `${pedido.titulo}\n${pedido.descricao}\n${pedido.criterios.join('\n')}`
  const segredos = varrerSegredos(original)
  const titulo = redigirSegredos(pedido.titulo)
  const descricao = redigirSegredos(pedido.descricao)
  const criterios = pedido.criterios.map((criterio) => redigirSegredos(criterio))
  const lint = lintarCriterios(criterios, { titulo, descricao })
  const rota = rotear(descricao, lint.ok)
  const bloqueios = [
    ...lint.issues,
    ...(segredos.encontrado ? [`Padrão de segredo (${segredos.rotulos.join(', ')}). O valor não foi copiado.`] : []),
    ...pedidoPerigoso(original),
  ]
  const rascunho = validarRascunho(pedido.branchBase, pedido.branchHead)
  if (rascunho) bloqueios.push(rascunho)
  if (rota === 'foggy' && bloqueios.length === 0) bloqueios.push('Pedido ainda nebuloso para sair do backlog.')

  const cardId = alocarId('C')
  const atualizadoEm = agora()
  let estado: Estado = {
    runId: `R${cardId.slice(1)}`,
    card: {
      id: cardId,
      titulo,
      descricao,
      criterios,
      coluna: bloqueios.length > 0 ? 'blocked' : 'ready',
      rota,
      grau: grauDe(descricao, 1),
      provedor: pedido.provedor,
      repositorio: pedido.repositorio,
      branchBase: pedido.branchBase,
      branchHead: pedido.branchHead,
      onda: null,
      itemExterno: null,
    },
    estagio: 'triage',
    parado: bloqueios.length > 0,
    motivo: bloqueios.length > 0 ? bloqueios.join(' ') : null,
    desfecho: bloqueios.length > 0 ? 'bloqueado' : 'em-andamento',
    especificacao: '',
    fatias: [],
    checks: [],
    achados: segredos.encontrado
      ? [
          {
            id: 'SEC-1',
            severidade: 'blocking',
            trilha: 'security',
            texto: `Padrão de segredo (${segredos.rotulos.join(', ')}). O valor não foi copiado.`,
          },
        ]
      : [],
    aprovacoes: [],
    entrega: null,
    evidencia: 'NONE',
    trilha: [],
    relatorio: '',
    atualizadoEm,
  }
  estado = anotar(
    estado,
    'observed',
    bloqueios.length > 0 ? 'Triagem bloqueou o card.' : 'Triagem colocou o card em ready.',
    'chief-of-staff',
  )
  return persistir(estado)
}

export function especificar(estado: Estado): Estado {
  if (estado.parado) return estado
  const proximo: Estado = {
    ...estado,
    estagio: 'specification',
    especificacao: [
      `Card ${estado.card.id} no ${estado.card.provedor}, repositório ${estado.card.repositorio}.`,
      estado.card.descricao,
      'Fora deste card: merge, push na branch protegida e deploy.',
    ].join('\n\n'),
    atualizadoEm: agora(),
  }
  return anotar(proximo, 'reported', 'Especificação registrada. Nenhum arquivo do repositório foi alterado.', 'architect')
}

export function aprovar(
  estado: Estado,
  entrada: { portao: Portao; aprovado: boolean; aprovador: string; nota: string; origem: 'human' | 'agent' },
): Estado {
  if (entrada.origem !== 'human') throw new Error('Agente não registra aprovação humana.')
  if (estado.parado) return estado
  if (estado.aprovacoes.some((item) => item.portao === entrada.portao)) return estado
  const em = agora()
  let proximo: Estado = {
    ...estado,
    atualizadoEm: em,
    aprovacoes: [
      ...estado.aprovacoes,
      {
        portao: entrada.portao,
        aprovado: entrada.aprovado,
        aprovador: entrada.aprovador,
        nota: entrada.nota,
        origem: 'human',
        em,
      },
    ],
  }
  proximo = anotarHumano(
    proximo,
    `${entrada.portao} ${entrada.aprovado ? 'aprovado' : 'recusado'} por ${entrada.aprovador}.`,
    entrada.aprovador,
  )
  if (!entrada.aprovado && entrada.portao === 'beforeRelease') {
    return {
      ...proximo,
      desfecho: 'retido',
      motivo: null,
      parado: false,
      card: { ...proximo.card, coluna: 'review' },
    }
  }
  if (!entrada.aprovado) return parar(proximo, `Gate ${entrada.portao} recusado por ${entrada.aprovador}.`)
  if (entrada.portao === 'beforeImplementation') {
    return { ...proximo, estagio: 'implementation', card: { ...proximo.card, coluna: 'build' } }
  }
  if (entrada.portao === 'beforeMerge') {
    return { ...proximo, estagio: 'delivery', card: { ...proximo.card, coluna: 'review' } }
  }
  return { ...proximo, card: { ...proximo.card, coluna: 'done' } }
}

export function comoRetomada(valor: unknown): Retomada | null {
  if (!valor || typeof valor !== 'object') return null
  const item = valor as Record<string, unknown>
  if (typeof item.aprovador !== 'string' || item.aprovador.trim().length < 2) return null
  if (typeof item.aprovado !== 'boolean') return null
  if (typeof item.nota !== 'string' || item.nota.trim().length < 3) return null
  return { aprovado: item.aprovado, aprovador: item.aprovador.trim(), nota: item.nota.trim() }
}

function textoDoPortao(portao: Portao): string {
  if (portao === 'beforeImplementation') return 'Uma pessoa precisa liberar a implementação. O agente não aprova este gate.'
  if (portao === 'beforeMerge') return 'Uma pessoa precisa liberar o acompanhamento. A Factory não faz merge.'
  return 'Uma pessoa precisa aceitar o release. A Factory não faz deploy.'
}

export function podePedirMerge(estado: Estado): string[] {
  const motivos: string[] = []
  const implementacao = estado.aprovacoes.find(
    (item) => item.portao === 'beforeImplementation' && item.aprovado && item.origem === 'human',
  )
  if (!implementacao) motivos.push('Falta aprovação humana antes da implementação.')
  if (estado.achados.some((achado) => achado.severidade === 'blocking')) motivos.push('Há achado bloqueante em aberto.')
  if (estado.checks.some((check) => check.resultado === 'FAIL')) motivos.push('Há check em FAIL.')
  if (estado.checks.some((check) => check.resultado === 'PASS' && check.evidencia.trim().length < 8)) {
    motivos.push('Há PASS sem evidência.')
  }
  const rascunho = validarRascunho(estado.card.branchBase, estado.card.branchHead)
  if (rascunho) motivos.push(rascunho)
  return motivos
}

export function podePedirRelease(estado: Estado): string[] {
  const motivos = podePedirMerge(estado).filter((motivo) => !motivo.startsWith('Falta aprovação humana antes da implementação.'))
  const merge = estado.aprovacoes.find((item) => item.portao === 'beforeMerge' && item.aprovado && item.origem === 'human')
  if (!merge) motivos.push('Falta aprovação humana antes do merge.')
  if (!estado.entrega?.ok) motivos.push('A entrega no provedor não foi concluída.')
  return motivos
}

export function decidirPortao(
  estado: Estado,
  portao: Portao,
  retomada: unknown,
):
  | { acao: 'seguir'; estado: Estado }
  | { acao: 'parar'; estado: Estado }
  | { acao: 'suspender'; pausa: { portao: Portao; cardId: string; resumo: string; motivos: string[] } } {
  if (estado.parado || estado.desfecho === 'retido') return { acao: 'seguir', estado }
  const motivos = portao === 'beforeImplementation' ? [] : portao === 'beforeMerge' ? podePedirMerge(estado) : podePedirRelease(estado)
  if (motivos.length > 0) return { acao: 'parar', estado: parar(estado, motivos.join(' ')) }
  const decisao = comoRetomada(retomada)
  if (!decisao) {
    return {
      acao: 'suspender',
      pausa: { portao, cardId: estado.card.id, resumo: textoDoPortao(portao), motivos: [] },
    }
  }
  return { acao: 'seguir', estado: aprovar(estado, { ...decisao, portao, origem: 'human' }) }
}

export function planejar(estado: Estado): Estado {
  if (estado.parado) return estado
  const texto = `${estado.card.descricao}\n${estado.card.criterios.join('\n')}`
  const fatias = fatiasDe(texto)
  const proximo: Estado = {
    ...estado,
    estagio: 'implementation',
    fatias,
    card: { ...estado.card, grau: grauDe(estado.card.descricao, fatias.length), coluna: 'build', onda: 1 },
    atualizadoEm: agora(),
  }
  return anotar(
    proximo,
    'reported',
    `Plano com ${fatias.map((fatia) => fatia.dono).join(', ')}. Nenhum arquivo do repositório foi alterado.`,
    'architect',
  )
}

export function verificar(estado: Estado): Estado {
  if (estado.parado) return estado
  const donos = fatiasDisjuntas(estado.fatias)
  const manifesto = validarManifesto()
  const checks = [
    observado('criterios-de-aceite', 'PASS', `Critérios observáveis: ${estado.card.criterios.join(' | ')}`),
    observado('varredura-de-segredos', 'PASS', 'Nenhum padrão de segredo no card.'),
    observado(
      'escritas-disjuntas',
      donos.ok ? 'PASS' : 'FAIL',
      donos.ok ? `Donos sem sobreposição: ${estado.fatias.map((fatia) => fatia.dono).join(', ')}.` : `Conflito em ${donos.conflito}.`,
    ),
    observado(
      'invariantes-do-manifesto',
      manifesto.ok ? 'PASS' : 'FAIL',
      manifesto.ok
        ? 'Gates humanos, sem deploy automático, segurança somente leitura.'
        : manifesto.falhas.join(' '),
    ),
    observado(
      'testes-do-produto',
      'NOT_RUN',
      'A Factory não executa comandos do card. Rode a suíte no repositório e anexe o resultado.',
    ),
  ]
  let proximo: Estado = {
    ...estado,
    estagio: 'verification',
    checks,
    evidencia: 'NONE',
    card: { ...estado.card, coluna: 'qa' },
    atualizadoEm: agora(),
  }
  proximo = { ...proximo, evidencia: evidenciaDe(proximo) }
  if (checks.some((check) => check.resultado === 'FAIL')) return parar(proximo, 'Verificação em FAIL.')
  return anotar(proximo, 'observed', 'Checks internos observados. Testes do produto em NOT_RUN.', 'qa')
}

export function revisar(estado: Estado): Estado {
  if (estado.parado) return estado
  const texto = `${estado.card.titulo}\n${estado.card.descricao}\n${estado.card.criterios.join('\n')}`
  const segredos = varrerSegredos(texto)
  const achados = [...estado.achados]
  if (segredos.encontrado && !achados.some((achado) => achado.id === 'SEC-1')) {
    achados.push({
      id: 'SEC-1',
      severidade: 'blocking',
      trilha: 'security',
      texto: `Padrão de segredo (${segredos.rotulos.join(', ')}). O valor não foi copiado.`,
    })
  }
  for (const motivo of pedidoPerigoso(texto)) {
    achados.push({ id: `SEC-${achados.length + 1}`, severidade: 'blocking', trilha: 'security', texto: motivo })
  }
  const donos = fatiasDisjuntas(estado.fatias)
  if (!donos.ok) {
    achados.push({ id: 'REV-1', severidade: 'blocking', trilha: 'review', texto: `Escritas sobrepostas: ${donos.conflito}.` })
  }
  if (estado.checks.some((check) => check.resultado === 'NOT_RUN')) {
    achados.push({
      id: 'QA-1',
      severidade: 'note',
      trilha: 'qa',
      texto: 'Testes do produto seguem NOT_RUN. Não entram como PASS.',
    })
  }
  let proximo: Estado = {
    ...estado,
    estagio: 'human-review',
    achados,
    card: { ...estado.card, coluna: achados.some((achado) => achado.severidade === 'blocking') ? 'blocked' : 'review' },
    atualizadoEm: agora(),
  }
  if (achados.some((achado) => achado.severidade === 'blocking')) return parar(proximo, 'Revisão bloqueou o card.')
  return anotar(proximo, 'observed', 'Revisão sem achado bloqueante.', 'security')
}

function corpo(estado: Estado): string {
  return [
    estado.especificacao,
    '',
    'Checks:',
    ...estado.checks.map((check) => `- ${check.resultado} ${check.nome}: ${check.evidencia}`),
    '',
    'Aberto pela Factory. Merge e deploy não foram feitos.',
  ].join('\n')
}

export async function entregar(estado: Estado, clientes: Clientes = {}): Promise<Estado> {
  if (estado.parado || estado.desfecho === 'retido') return estado
  const merge = estado.aprovacoes.find((item) => item.portao === 'beforeMerge' && item.aprovado && item.origem === 'human')
  if (!merge) return parar(estado, 'Entrega sem aprovação humana de merge.')
  const rascunho = validarRascunho(estado.card.branchBase, estado.card.branchHead)
  if (rascunho) return parar(estado, rascunho)
  const texto = corpo(estado)
  const item =
    estado.card.provedor === 'github'
      ? await criarIssueGithub(estado.card.repositorio, estado.card.titulo, texto, clientes.github)
      : await criarWorkItemAzure(estado.card.repositorio, estado.card.titulo, texto, clientes.azure)
  if (!item.ok) return parar(estado, item.nota)
  let pull: { id: string | null; url: string | null; nota: string } | null = null
  if (estado.card.branchHead) {
    const pr =
      estado.card.provedor === 'github'
        ? await criarRascunhoGithub(
            estado.card.repositorio,
            estado.card.titulo,
            texto,
            estado.card.branchBase,
            estado.card.branchHead,
            clientes.github,
          )
        : await criarRascunhoAzure(
            estado.card.repositorio,
            estado.card.titulo,
            texto,
            estado.card.branchBase,
            estado.card.branchHead,
            clientes.azure,
          )
    if (!pr.ok) {
      return parar(
        {
          ...estado,
          card: { ...estado.card, itemExterno: item.id },
          entrega: {
            modo: item.modo,
            provedor: estado.card.provedor,
            ok: false,
            itemId: item.id,
            itemUrl: item.url,
            pullRequestId: null,
            pullRequestUrl: null,
            nota: `${item.nota} ${pr.nota}`,
          },
        },
        pr.nota,
      )
    }
    pull = pr
  }
  const nota = [item.nota, pull?.nota].filter(Boolean).join(' ')
  const proximo: Estado = {
    ...estado,
    estagio: 'delivery',
    atualizadoEm: agora(),
    card: { ...estado.card, coluna: 'review', itemExterno: item.id },
    entrega: {
      modo: item.modo,
      provedor: estado.card.provedor,
      ok: true,
      itemId: item.id,
      itemUrl: item.url,
      pullRequestId: pull?.id ?? null,
      pullRequestUrl: pull?.url ?? null,
      nota,
    },
  }
  return anotar(proximo, 'observed', nota, 'integrations')
}

export function fechar(estado: Estado): Estado {
  let proximo = estado
  if (!proximo.parado && proximo.desfecho === 'em-andamento') {
    const release = proximo.aprovacoes.find(
      (item) => item.portao === 'beforeRelease' && item.aprovado && item.origem === 'human',
    )
    if (release && proximo.checks.every((check) => check.resultado !== 'FAIL')) {
      proximo = {
        ...proximo,
        desfecho: 'aceito-com-ressalvas',
        card: { ...proximo.card, coluna: 'done' },
      }
    }
  }
  proximo = { ...proximo, evidencia: evidenciaDe(proximo), atualizadoEm: agora() }
  proximo = { ...proximo, relatorio: relatorioDe(proximo) }
  return anotar(proximo, 'reported', `Desfecho ${proximo.desfecho}.`, 'chief-of-staff')
}

export function avaliarMerge(estado: Estado): { ok: boolean; motivos: string[] } {
  const motivos = podePedirMerge(estado)
  const merge = estado.aprovacoes.find((item) => item.portao === 'beforeMerge' && item.aprovado && item.origem === 'human')
  if (!merge) motivos.push('Falta aprovação humana antes do merge.')
  return { ok: motivos.length === 0, motivos }
}
