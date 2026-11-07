// Executor de comandos para o modo autônomo. Cada card roda num container Docker
// descartável. Nada roda na máquina de quem opera a Factory.

import { marcarSegredos } from './guards.ts'

export type Execucao = {
  comando: string
  codigo: number
  saida: string
  erro: string
  ms: number
  estourou: boolean
}

export interface Executor {
  readonly tipo: 'docker' | 'falso'
  /** env vale só para este comando: é por onde o token entra no clone e no push. */
  executar(comando: string, opcoes?: { timeoutMs?: number; cwd?: string; env?: Record<string, string> }): Promise<Execucao>
  encerrar(): Promise<void>
}

export const PASTA_DO_REPOSITORIO = '/workspace/repo'
const LIMITE_DE_SAIDA = 20_000
const TEMPO_PADRAO_MS = 10 * 60_000

/** Tira segredos e corta saídas longas antes de qualquer registro. */
export function limparSaida(texto: string, segredos: string[]): string {
  // Marca com rótulo, e não só apaga: a varredura do diff ainda precisa saber que havia um segredo.
  const limpo = marcarSegredos(semSegredoLongo(texto, segredos))
  if (limpo.length <= LIMITE_DE_SAIDA) return limpo
  return `${limpo.slice(0, LIMITE_DE_SAIDA / 2)}\n[… ${limpo.length - LIMITE_DE_SAIDA} caracteres cortados …]\n${limpo.slice(-LIMITE_DE_SAIDA / 2)}`
}

// semSegredo achata espaços e corta em 180 caracteres; aqui a saída precisa ficar inteira.
function semSegredoLongo(texto: string, segredos: string[]): string {
  let saida = texto
  for (const segredo of segredos) if (segredo && segredo.length >= 6) saida = saida.split(segredo).join('[segredo]')
  return saida
}

export type OpcoesDocker = {
  cardId: string
  /** Variáveis do container. Tokens entram aqui, nunca no texto do comando. */
  env?: Record<string, string>
  /** Valores que nunca podem aparecer numa saída. */
  segredos?: string[]
  imagem?: string
  rede?: string
  memoriaBytes?: number
}

/** Abre um container para o card. Lança erro claro se o Docker não responder. */
export async function criarExecutorDocker(opcoes: OpcoesDocker): Promise<Executor> {
  const { DockerSandbox } = await import('@mastra/docker')
  const segredos = [...(opcoes.segredos ?? []), ...Object.values(opcoes.env ?? {})]
  // O container nasce sem token. Ele entra por comando, em executar(…, { env }).
  const sandbox = new DockerSandbox({
    id: `super-factory-${opcoes.cardId.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-${Date.now()}`,
    image: opcoes.imagem ?? process.env.SUPER_FACTORY_SANDBOX_IMAGE?.trim() ?? 'node:22-bookworm',
    env: opcoes.env ?? {},
    workingDir: '/workspace',
    ...(opcoes.rede ?? process.env.SUPER_FACTORY_SANDBOX_NETWORK?.trim() ? { network: opcoes.rede ?? process.env.SUPER_FACTORY_SANDBOX_NETWORK?.trim() } : {}),
    privileged: false,
    capDrop: ['ALL'],
    capAdd: ['CHOWN', 'DAC_OVERRIDE', 'FOWNER', 'SETUID', 'SETGID'],
    securityOpt: ['no-new-privileges'],
    pidsLimit: 512,
    memory: opcoes.memoriaBytes ?? 4 * 1024 ** 3,
    init: true,
    labels: { 'super-factory.card': opcoes.cardId },
  })
  try {
    await sandbox.start()
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro)
    throw new Error(`O Docker não respondeu. Abra o Docker Desktop ou o Colima e tente de novo. (${limparSaida(motivo, segredos).slice(0, 200)})`)
  }
  return {
    tipo: 'docker',
    async executar(comando, extra = {}) {
      const inicio = Date.now()
      if (!sandbox.executeCommand) throw new Error('Este sandbox não executa comandos.')
      const resultado = await sandbox.executeCommand('bash', ['-lc', comando], {
        timeout: extra.timeoutMs ?? TEMPO_PADRAO_MS,
        cwd: extra.cwd ?? PASTA_DO_REPOSITORIO,
        ...(extra.env ? { env: extra.env } : {}),
      })
      return {
        comando: limparSaida(comando, segredos),
        codigo: resultado.exitCode,
        saida: limparSaida(resultado.stdout, segredos),
        erro: limparSaida(resultado.stderr, segredos),
        ms: resultado.executionTimeMs ?? Date.now() - inicio,
        estourou: Boolean(resultado.timedOut),
      }
    },
    async encerrar() {
      await sandbox.destroy().catch(() => {})
    },
  }
}

/** Executor de teste: registra cada comando e responde por roteiro. */
export function criarExecutorFalso(
  roteiro: (comando: string) => Partial<Execucao> | undefined,
  segredos: string[] = [],
): Executor & { comandos: string[]; envs: Array<Record<string, string> | undefined>; encerrado: boolean } {
  const executor = {
    tipo: 'falso' as const,
    comandos: [] as string[],
    encerrado: false,
    envs: [] as Array<Record<string, string> | undefined>,
    async executar(comando: string, opcoes?: { env?: Record<string, string> }) {
      executor.comandos.push(comando)
      executor.envs.push(opcoes?.env)
      const parcial = roteiro(comando) ?? {}
      return {
        comando: limparSaida(comando, segredos),
        codigo: parcial.codigo ?? 0,
        saida: limparSaida(parcial.saida ?? '', segredos),
        erro: limparSaida(parcial.erro ?? '', segredos),
        ms: parcial.ms ?? 1,
        estourou: parcial.estourou ?? false,
      }
    },
    async encerrar() {
      executor.encerrado = true
    },
  }
  return executor
}
