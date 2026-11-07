// Agente construtor do modo autônomo. Escreve código dentro do container do card.
// Todas as ferramentas rodam no sandbox: nada toca a máquina de quem opera a Factory.

import { Agent } from '@mastra/core/agent'
import { RequestContext } from '@mastra/core/request-context'
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

import type { Implementador } from '../../factory/autonomo.ts'
import type { Executor } from '../../factory/sandbox.ts'
import { guardaDeSaida } from '../processors/guarda-saida.ts'

export const MODELO_CONSTRUTOR = process.env.SUPER_FACTORY_BUILDER_MODEL?.trim() || 'anthropic/claude-sonnet-5-5'

function executorDo(contexto: { requestContext?: RequestContext } | undefined): Executor {
  const executor = contexto?.requestContext?.get('executor') as Executor | undefined
  if (!executor) throw new Error('Sem sandbox ativo: o construtor só roda dentro do modo autônomo.')
  return executor
}

/** Caminho relativo ao repositório, sem sair dele e sem mexer no .git. */
export function caminhoSeguro(caminho: string): string {
  const limpo = caminho.trim().replace(/^\.\//, '')
  if (!limpo || limpo.startsWith('/') || limpo.split('/').some((parte) => parte === '..') || /(^|\/)\.git(\/|$)/.test(limpo) || /['\n\\]/.test(limpo)) {
    throw new Error(`Caminho recusado: ${caminho}`)
  }
  return limpo
}

/** Comandos que nem o sandbox aceita: enviar código, mexer no remoto, executar script baixado. */
export function comandoRecusado(comando: string): string | null {
  if (/\bgit\s+(push|remote|fetch\s+--all|config\s+--global)\b/.test(comando)) return 'Push e remoto ficam com a Factory, depois dos testes.'
  if (/\b(curl|wget)\b[^|]*\|\s*(ba|z)?sh\b/.test(comando)) return 'Script baixado não roda direto no shell.'
  if (/FACTORY_GIT_AUTH|\.git-credentials/.test(comando)) return 'Credencial do repositório não é lida pelo agente.'
  if (/\brm\s+-rf\s+\/(\s|$)/.test(comando)) return 'Comando destrutivo recusado.'
  return null
}

const lerArquivo = createTool({
  id: 'ler-arquivo',
  description: 'Lê um arquivo do repositório, com números de linha. Use inicio e fim para arquivos grandes.',
  inputSchema: z.object({ caminho: z.string(), inicio: z.number().int().min(1).default(1), fim: z.number().int().min(1).default(400) }),
  execute: async ({ caminho, inicio, fim }, contexto) => {
    const resultado = await executorDo(contexto).executar(`sed -n '${inicio},${fim}p' '${caminhoSeguro(caminho)}' | cat -n | sed 's/^ *\\([0-9]*\\)/\\1/'`)
    return resultado.codigo === 0 ? resultado.saida : `Erro: ${resultado.erro}`
  },
})

const escreverArquivo = createTool({
  id: 'escrever-arquivo',
  description: 'Cria ou substitui um arquivo inteiro no repositório.',
  inputSchema: z.object({ caminho: z.string(), conteudo: z.string() }),
  execute: async ({ caminho, conteudo }, contexto) => {
    const alvo = caminhoSeguro(caminho)
    const base64 = Buffer.from(conteudo, 'utf8').toString('base64')
    const resultado = await executorDo(contexto).executar(`mkdir -p "$(dirname '${alvo}')" && printf '%s' '${base64}' | base64 -d > '${alvo}'`)
    return resultado.codigo === 0 ? `Escrito: ${alvo} (${conteudo.length} caracteres).` : `Erro: ${resultado.erro}`
  },
})

const listarArquivos = createTool({
  id: 'listar-arquivos',
  description: 'Lista os arquivos versionados, opcionalmente dentro de uma pasta.',
  inputSchema: z.object({ pasta: z.string().default('') }),
  execute: async ({ pasta }, contexto) => {
    const alvo = pasta.trim() ? `'${caminhoSeguro(pasta)}'` : ''
    return (await executorDo(contexto).executar(`git ls-files ${alvo} | head -300`)).saida
  },
})

const buscar = createTool({
  id: 'buscar',
  description: 'Procura um texto no repositório (git grep), com arquivo e linha.',
  inputSchema: z.object({ texto: z.string().min(2).max(200) }),
  execute: async ({ texto }, contexto) => {
    const padrao = Buffer.from(texto, 'utf8').toString('base64')
    return (await executorDo(contexto).executar(`git grep -n -I -F -e "$(printf '%s' '${padrao}' | base64 -d)" | head -100`)).saida || 'Nada encontrado.'
  },
})

const executarComando = createTool({
  id: 'executar-comando',
  description: 'Roda um comando na pasta do repositório, dentro do container. Use para testes, build e lint.',
  inputSchema: z.object({ comando: z.string().min(1).max(2000) }),
  execute: async ({ comando }, contexto) => {
    const motivo = comandoRecusado(comando)
    if (motivo) return `Recusado: ${motivo}`
    const resultado = await executorDo(contexto).executar(comando, { timeoutMs: 15 * 60_000 })
    return `código ${resultado.codigo}${resultado.estourou ? ' (tempo esgotado)' : ''}\n${resultado.saida}\n${resultado.erro}`.slice(0, 12_000)
  },
})

export const construtor = new Agent({
  id: 'construtor',
  name: 'Construtor',
  description: 'Escreve o código do card dentro do sandbox e roda os testes do repositório.',
  instructions: [
    'PAPEL: construtor da Super Factory.',
    'Você trabalha num container com o repositório do cliente clonado. Implemente o card com a menor mudança que cumpra os critérios.',
    'Antes de escrever, leia o código à volta e siga o estilo, as pastas e as convenções que já existem.',
    'Escreva ou ajuste testes que provem cada critério de aceite.',
    'Rode o comando de teste do repositório e só pare quando ele passar, ou quando explicar por que não passa.',
    'Não faça commit, push, merge nem deploy: a Factory envia a branch e abre o pull request depois. Uma pessoa revisa e faz o merge.',
    'Não leia nem imprima credenciais. Não desative testes para passar.',
    'Termine com um resumo curto: o que mudou, quais arquivos e o resultado do teste.',
  ].join('\n'),
  model: MODELO_CONSTRUTOR,
  maxRetries: 2,
  tools: { lerArquivo, escreverArquivo, listarArquivos, buscar, executarComando },
  defaultOptions: { maxSteps: 60 },
  outputProcessors: [guardaDeSaida()],
})

/** Implementador de verdade: o agente construtor, com o executor do card no contexto. */
export const implementadorComAgente: Implementador = async ({ estado, executor, verificacao, tentativa, falhaAnterior }) => {
  const contexto = new RequestContext()
  contexto.set('executor', executor)
  const pedido = [
    `Card ${estado.card.id}: ${estado.card.titulo}`,
    '',
    estado.card.descricao,
    '',
    'Critérios de aceite:',
    ...estado.card.criterios.map((criterio) => `- ${criterio}`),
    '',
    `Teste do repositório: ${verificacao.verificar ?? 'nenhum encontrado; crie um teste se o projeto tiver framework de teste'}.`,
    falhaAnterior
      ? `\nTentativa ${tentativa}. O teste falhou antes (código ${falhaAnterior.codigo}):\n${`${falhaAnterior.saida}\n${falhaAnterior.erro}`.slice(-4000)}`
      : '',
  ].join('\n')
  const resposta = await construtor.generate(pedido, { requestContext: contexto, maxSteps: 60 })
  return { resumo: resposta.text.slice(0, 1500) || 'O construtor terminou sem resumo.' }
}
