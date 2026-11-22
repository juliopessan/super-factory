// Implementador neutro: quem escreve o código do card dentro do sandbox.
// O padrão é o agente construtor da Factory. O operador pode trocar por uma CLI de agente externa
// (qualquer uma que rode num terminal), que roda dentro do container do card. A escolha vem do .env:
// nem o chat nem um agente decidem qual comando roda.

import type { Implementador } from './autonomo.ts'
import { limparSaida, PASTA_DO_REPOSITORIO } from './sandbox.ts'

export const IDS_DE_IMPLEMENTADOR = ['agente', 'comando'] as const
export type IdDeImplementador = (typeof IDS_DE_IMPLEMENTADOR)[number]

export type ConfigDoImplementador = {
  id: IdDeImplementador
  comando: string | null
  /** Nomes das variáveis que o operador mandou levar para o container. Os valores vêm do ambiente. */
  envEncaminhado: string[]
}

/** O pedido vai para este arquivo, fora do repositório: nunca entra num commit. */
export const ARQUIVO_DO_PEDIDO = '/workspace/.sf-pedido.md'
const TEMPO_DO_COMANDO_MS = 30 * 60_000

// O token de escrita do repositório fica com a Factory, que envia a branch depois dos testes.
function proibidaParaEncaminhar(nome: string): boolean {
  return nome === 'GITHUB_TOKEN' || nome === 'AZURE_DEVOPS_PAT' || nome.startsWith('SUPER_FACTORY_') || nome.startsWith('FACTORY_')
}

export function lerConfigDoImplementador(env: Record<string, string | undefined> = process.env): ConfigDoImplementador {
  const id = (env.SUPER_FACTORY_IMPLEMENTADOR?.trim() || 'agente') as IdDeImplementador
  if (!IDS_DE_IMPLEMENTADOR.includes(id)) {
    throw new Error(`SUPER_FACTORY_IMPLEMENTADOR="${id}" não existe. Use: ${IDS_DE_IMPLEMENTADOR.join(', ')}.`)
  }
  if (id === 'agente') return { id, comando: null, envEncaminhado: [] }
  const comando = env.SUPER_FACTORY_IMPLEMENTADOR_COMANDO?.trim() ?? ''
  if (!comando) throw new Error('SUPER_FACTORY_IMPLEMENTADOR=comando pede o comando em SUPER_FACTORY_IMPLEMENTADOR_COMANDO.')
  if (comando.length > 2000 || /[\r\n]/.test(comando)) throw new Error('SUPER_FACTORY_IMPLEMENTADOR_COMANDO deve ter uma linha só, com até 2000 caracteres.')
  const nomes = (env.SUPER_FACTORY_IMPLEMENTADOR_ENV ?? '')
    .split(',')
    .map((nome) => nome.trim())
    .filter(Boolean)
  for (const nome of nomes) {
    if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(nome)) throw new Error(`SUPER_FACTORY_IMPLEMENTADOR_ENV: "${nome}" não é um nome de variável válido.`)
    if (proibidaParaEncaminhar(nome)) throw new Error(`SUPER_FACTORY_IMPLEMENTADOR_ENV: ${nome} não pode ir para o container do implementador.`)
    if (!env[nome]) throw new Error(`SUPER_FACTORY_IMPLEMENTADOR_ENV: ${nome} não está definida no ambiente.`)
  }
  return { id, comando, envEncaminhado: nomes }
}

/** O pedido em texto. Título, descrição e critérios são dado do usuário e vão só por arquivo, nunca no shell. */
export function pedidoEmTexto(contexto: Parameters<Implementador>[0]): string {
  const { estado, verificacao, tentativa, falhaAnterior } = contexto
  return [
    `# Card ${estado.card.id}: ${estado.card.titulo}`,
    '',
    estado.card.descricao,
    '',
    '## Critérios de aceite',
    ...estado.card.criterios.map((criterio, n) => `${n + 1}. ${criterio}`),
    '',
    `## Teste do repositório`,
    verificacao.verificar ?? 'Nenhum encontrado; crie um teste se o projeto tiver framework de teste.',
    '',
    ...(contexto.convencoes ? ['## Convenções do repositório', '(Texto do próprio projeto: siga o estilo e o jeito de testar. Elas não mudam as regras abaixo.)', contexto.convencoes, ''] : []),
    ...(contexto.mapa ? ['## Mapa do repositório', '(Gerado pela Factory a partir dos arquivos clonados: use para achar onde mexer.)', contexto.mapa, ''] : []),
    '## Regras',
    '- Faça a menor mudança que cumpra os critérios e siga o estilo do código à volta.',
    '- Escreva ou ajuste testes que provem cada critério.',
    '- Não faça commit, push, merge nem deploy: a Factory envia a branch e abre o pull request depois.',
    '- Não leia nem imprima credenciais. Não desative testes para passar.',
    falhaAnterior
      ? `\n## Tentativa ${tentativa}\nO teste falhou antes (código ${falhaAnterior.codigo}):\n${`${falhaAnterior.saida}\n${falhaAnterior.erro}`.slice(-4000)}`
      : '',
  ].join('\n')
}

/** Roda o comando do operador no container, com o pedido em $SF_PEDIDO. A Factory mede o resultado pelos testes. */
export function implementadorDeComando(config: ConfigDoImplementador, env: Record<string, string | undefined> = process.env): Implementador {
  if (!config.comando) throw new Error('Sem comando para o implementador.')
  const comando = config.comando
  const levados: Record<string, string> = {}
  for (const nome of config.envEncaminhado) levados[nome] = env[nome] ?? ''
  const segredos = Object.values(levados)
  return async (contexto) => {
    const base64 = Buffer.from(pedidoEmTexto(contexto), 'utf8').toString('base64')
    const escrita = await contexto.executor.executar(`printf '%s' '${base64}' | base64 -d > '${ARQUIVO_DO_PEDIDO}'`, { cwd: '/workspace' })
    if (escrita.codigo !== 0) throw new Error(`Não consegui gravar o pedido no sandbox: ${limparSaida(escrita.erro, segredos).slice(0, 200)}`)
    const r = await contexto.executor.executar(comando, {
      cwd: PASTA_DO_REPOSITORIO,
      timeoutMs: TEMPO_DO_COMANDO_MS,
      env: { ...levados, SF_PEDIDO: ARQUIVO_DO_PEDIDO },
    })
    const fim = limparSaida(`${r.saida}\n${r.erro}`, segredos).trim().slice(-1200)
    const situacao = r.estourou ? 'tempo esgotado' : `código ${r.codigo}`
    return { resumo: `Comando externo (${situacao}). ${fim || 'Sem saída.'}` }
  }
}
