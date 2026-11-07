import type { Estado } from './schemas.ts'

const SECOES = ['Contexto', 'Critérios', 'Donos', 'Evidência', 'Gates', 'Próximo passo']

export function secoesDoRelatorio(): string[] {
  return [...SECOES]
}

export function relatorioDe(estado: Estado): string {
  const donos = estado.fatias.length
    ? estado.fatias.map((fatia) => `- ${fatia.dono}: ${fatia.caminhos.join(', ')}`).join('\n')
    : '- nenhum, o card não chegou no plano'
  const checks = estado.checks.length
    ? estado.checks.map((check) => `- ${check.resultado} ${check.nome}: ${check.evidencia}`).join('\n')
    : '- NONE: ainda não há check observado'
  const portoes = (['beforeImplementation', 'beforeMerge', 'beforeRelease'] as const)
    .map((portao) => {
      const aprovacao = estado.aprovacoes.find((item) => item.portao === portao)
      if (!aprovacao) return `- ${portao}: pendente`
      const decisao = aprovacao.aprovado ? 'aprovado' : 'recusado'
      return `- ${portao}: ${decisao} por ${aprovacao.aprovador} (${aprovacao.origem})`
    })
    .join('\n')
  const proximo =
    estado.desfecho === 'aceito-com-ressalvas'
      ? 'Rode os testes do produto fora da Factory e anexe o resultado. Nenhum deploy foi feito.'
      : estado.desfecho === 'retido'
        ? 'O release continua retido. Nada foi publicado.'
        : 'O card está bloqueado. Ajuste o pedido e abra outro ciclo. Nenhum merge foi feito.'
  const entrega = estado.entrega
    ? `${estado.entrega.nota}`
    : 'Nenhum item foi aberto no provedor.'

  return [
    `# ${estado.card.titulo}`,
    '',
    '## Contexto',
    estado.especificacao || estado.card.descricao,
    '',
    entrega,
    '',
    '## Critérios',
    estado.card.criterios.map((criterio) => `- ${criterio}`).join('\n') || '- nenhum',
    '',
    '## Donos',
    donos,
    '',
    '## Evidência',
    checks,
    '',
    `Estado da evidência: ${estado.evidencia}.`,
    '',
    '## Gates',
    portoes,
    '',
    '## Próximo passo',
    proximo,
  ].join('\n')
}
