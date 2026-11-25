// Testes das skills do repositório nas convenções e da configuração de CI. Arquivo à parte do check.ts (limite do TypeScript).
// As convenções rodam no shell de verdade, numa pasta temporária: é o mesmo comando que roda no sandbox.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const { lerConvencoes } = await import('../factory/verificacao.ts')
type Executor = Parameters<typeof lerConvencoes>[0]

function executorEm(pasta: string): Executor {
  return {
    tipo: 'falso',
    async executar(comando: string) {
      const r = spawnSync('bash', ['-c', comando], { cwd: pasta, encoding: 'utf8' })
      return { comando, codigo: r.status ?? 1, saida: r.stdout ?? '', erro: r.stderr ?? '', ms: 1, estourou: false }
    },
    async encerrar() {},
  }
}

const TOKEN = 'ghp_' + 'Q'.repeat(36)
const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-conv-'))
try {
  // sem nada: sem convenções
  assert.equal(await lerConvencoes(executorEm(repo)), null)
  fs.writeFileSync(path.join(repo, 'AGENTS.md'), 'Rode pytest antes de abrir PR.')
  fs.mkdirSync(path.join(repo, '.claude', 'skills'), { recursive: true })
  fs.writeFileSync(path.join(repo, '.claude', 'CLAUDE.md'), 'Use f-strings, nunca % para formatar.')
  for (const nome of ['a-migracao', 'b-release', 'c-deploy', 'd-flags', 'e-logs', 'f-sexta']) {
    fs.mkdirSync(path.join(repo, '.claude', 'skills', nome), { recursive: true })
    fs.writeFileSync(path.join(repo, '.claude', 'skills', nome, 'SKILL.md'), `---\nname: ${nome}\ndescription: Como fazemos ${nome}.\n---\nPasso a passo de ${nome}. ${nome === 'b-release' ? `Token: ${TOKEN}` : ''}\n${'x'.repeat(nome === 'c-deploy' ? 3000 : 10)}`)
  }
  const conv = (await lerConvencoes(executorEm(repo))) ?? ''
  assert.match(conv, /### AGENTS\.md\nRode pytest/)
  assert.match(conv, /### \.claude\/CLAUDE\.md\nUse f-strings/, 'o CLAUDE.md dentro de .claude também conta')
  assert.match(conv, /### \.claude\/skills\/a-migracao\/SKILL\.md \(skill do repositório\)\n---\nname: a-migracao\ndescription: Como fazemos a-migracao\./)
  assert.ok(conv.indexOf('### AGENTS.md') < conv.indexOf('(skill do repositório)'), 'instruções do projeto vêm antes das skills')
  assert.equal((conv.match(/\(skill do repositório\)/g) ?? []).length, 5, 'no máximo 5 skills')
  assert.ok(!conv.includes('f-sexta'), 'a sexta skill fica de fora')
  assert.ok(!conv.includes(TOKEN), 'segredo dentro de uma skill sai redigido')
  assert.ok(!conv.includes('x'.repeat(1600)), 'cada skill é cortada em 1.500 caracteres')
  assert.ok(conv.length <= 12_000)
  // muito texto: o teto total corta pelo fim, onde estão as skills
  fs.writeFileSync(path.join(repo, 'CLAUDE.md'), 'y'.repeat(9000))
  fs.writeFileSync(path.join(repo, 'CONTRIBUTING.md'), 'z'.repeat(9000))
  const cheia = (await lerConvencoes(executorEm(repo))) ?? ''
  assert.ok(cheia.length <= 12_000)
  assert.equal(Math.max(...(cheia.match(/y{100,}/g) ?? ['']).map((t) => t.length)), 4000, 'cada arquivo de instrução é cortado em 4.000 caracteres')
  assert.match(cheia, /^### AGENTS\.md/, 'o que é mais importante vem primeiro')
  assert.match(cheia, /\(skill do repositório\)/, 'e as skills ainda cabem')
} finally {
  fs.rmSync(repo, { recursive: true, force: true })
}

// CI: o workflow roda o mesmo check, com permissão mínima e sem segredo
const ci = fs.readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8')
assert.match(ci, /^on:\n {2}pull_request:\n {2}push:\n {4}branches: \[main\]/m)
assert.match(ci, /permissions:\n {2}contents: read/)
assert.match(ci, /run: npm ci/)
assert.match(ci, /run: npm run check/)
assert.match(ci, /run: npm audit --omit=dev/)
assert.ok(!/secrets\./.test(ci), 'o CI não usa segredo')
const pacote = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> }
assert.match(pacote.scripts.check!, /check\.ts && .*check-slop\.ts && .*check-extras\.ts$/, 'o npm run check roda os três arquivos')

console.log('check-extras: ok')
