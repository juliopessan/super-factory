// Modo ensaio do autônomo: as mesmas fases, sem Docker, sem agente e sem tocar repositório.
// Liga só com SUPER_FACTORY_AUTONOMO_ENSAIO=1 no ambiente. Serve para o time ver o fluxo
// acender no canvas, e para o e2e conferir isso sem depender de Docker nem de chave.

import type { DepsAutonomo } from '../../factory/autonomo.ts'
import { criarExecutorFalso, type Executor } from '../../factory/sandbox.ts'

function pausa(): Promise<void> {
  const ms = Number(process.env.SUPER_FACTORY_ENSAIO_MS ?? 900)
  return new Promise((resolve) => setTimeout(resolve, Number.isFinite(ms) && ms >= 0 ? Math.min(ms, 10_000) : 900))
}

function roteiro(comando: string) {
  if (comando === 'ls -1a') return { saida: '.\n..\npackage.json\npackage-lock.json\nsrc' }
  if (comando === 'cat package.json') return { saida: JSON.stringify({ scripts: { test: 'node --test' } }) }
  if (comando === 'npm run test') return { saida: 'ensaio: 3 testes passaram' }
  if (comando === 'git status --porcelain') return { saida: ' M src/ensaio.js' }
  if (comando === 'git add -A && git diff --cached') return { saida: '+// ensaio da Super Factory' }
  if (comando === 'git diff --cached --stat') return { saida: ' src/ensaio.js | 1 +' }
  return { codigo: 0 }
}

function executorDeEnsaio(): Executor {
  const falso = criarExecutorFalso(roteiro)
  return {
    tipo: 'falso',
    async executar(comando, opcoes) {
      await pausa()
      return falso.executar(comando, opcoes)
    },
    encerrar: () => falso.encerrar(),
  }
}

export function depsDeEnsaio(): DepsAutonomo {
  return {
    criarExecutor: async () => {
      await pausa()
      return executorDeEnsaio()
    },
    implementador: async () => {
      await pausa()
      await pausa()
      return { resumo: 'Ensaio: nenhum código de verdade foi escrito.' }
    },
    credenciais: { githubToken: 'ensaio', azureOrg: 'ensaio', azurePat: 'ensaio' },
    github: {
      token: 'ensaio',
      fetch: (async () => {
        await pausa()
        return new Response(JSON.stringify({ number: 0, html_url: null }), { status: 201 })
      }) as unknown as typeof fetch,
    },
    azure: {
      pat: 'ensaio',
      org: 'ensaio',
      fetch: (async () => {
        await pausa()
        return new Response(JSON.stringify({ pullRequestId: 0 }), { status: 201 })
      }) as unknown as typeof fetch,
    },
  }
}
