// Testes da auditoria de slop no diff (K1). Arquivo à parte: o check.ts passou do tamanho que o TypeScript analisa num corpo só.
// Roda no npm run check, depois do check.ts. Sem rede, sem modelo, sem Docker: tudo simulado.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-check-slop-'))
process.env.FACTORY_STATE_PATH = path.join(diretorio, 'state.json')
for (const nome of ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY', 'SUPER_FACTORY_MODEL', 'FACTORY_MODEL', 'GITHUB_TOKEN', 'AZURE_DEVOPS_PAT', 'AZURE_DEVOPS_ORG', 'AZURE_DEVOPS_PROJECT']) delete process.env[nome]

const { executarAutonomo } = await import('../factory/autonomo.ts')
const { criarExecutorFalso } = await import('../factory/sandbox.ts')

const TOKEN_TESTE = 'ghp_' + 'Z'.repeat(36)
const pedidoAuto = {
  titulo: 'Filtro de datas com hora',
  descricao: 'O filtro da API de pedidos quebra quando a data vem só com o dia. Precisa aceitar intervalo com hora e recusar fim anterior ao início.',
  criterios: 'O endpoint devolve 400 quando o fim do intervalo é anterior ao início.',
  provedor: 'github' as const,
  repositorio: 'acme/pedidos',
  branchBase: 'main',
  branchHead: '',
}
function roteiroNode() {
  return (comando: string) => {
    if (comando === 'ls -1a') return { saida: '.\n..\npackage.json\npackage-lock.json\nsrc' }
    if (comando === 'cat package.json') return { saida: JSON.stringify({ scripts: { test: 'node --test' } }) }
    if (comando === 'npm run test') return { codigo: 0, saida: 'ok 3 testes', erro: '' }
    if (comando === 'git status --porcelain') return { saida: ' M src/filtro.js' }
    if (comando === 'git add -A && git diff --cached') return { saida: '+export function filtro() {}' }
    if (comando === 'git diff --cached --stat') return { saida: ' src/filtro.js | 4 ++++' }
    return { codigo: 0 }
  }
}
function githubFalso() {
  const chamadas: Array<{ url: string; corpo: Record<string, unknown> }> = []
  return {
    chamadas,
    deps: {
      token: TOKEN_TESTE,
      fetch: (async (url: string, init?: RequestInit) => {
        chamadas.push({ url: String(url), corpo: JSON.parse(String(init?.body ?? '{}')) })
        return new Response(JSON.stringify({ number: 7, html_url: 'https://github.com/acme/pedidos/pull/7' }), { status: 201 })
      }) as typeof fetch,
    },
  }
}

// --- K1: auditoria de slop no diff
{
  const sl = await import('../factory/slop.ts')
  const d = (caminho: string, linhas: string[], extra: string[] = []) => [`diff --git a/${caminho} b/${caminho}`, ...extra, `--- a/${caminho}`, `+++ b/${caminho}`, '@@ -1 +1 @@', ...linhas].join('\n')

  // leitura do diff
  const lido = sl.lerDiff([d('src/a.py', ['+x = 1', '-x = 0']), d('tests/test_b.py', ['+def test_b():', '+    assert b() == 2'], ['new file mode 100644']), d('tests/test_c.py', ['-assert c()'], ['deleted file mode 100644'])].join('\n'))
  assert.deepEqual(lido.map((a) => [a.caminho, a.novo, a.apagado, a.adicionadas.length, a.removidas.length]), [['src/a.py', false, false, 1, 1], ['tests/test_b.py', true, false, 2, 0], ['tests/test_c.py', false, true, 0, 1]])

  // diff limpo: nada a dizer, e o check só existe porque tocou em teste
  let a = sl.auditarDiff([d('src/filtro.py', ['+    return nome.strip().lower()', '-    return nome.lower()']), d('tests/test_filtro.py', ['+def test_espacos():', '+    assert capitalize(" aws ") == "AWS"'])].join('\n'))
  assert.deepEqual([a.achados, a.enfraquece, a.tocouTestes], [[], null, true])
  assert.equal(sl.checkDosTestes(a)?.resultado, 'PASS')
  assert.equal(sl.checkDosTestes(sl.auditarDiff(d('src/a.py', ['+x = 1']))), null, 'sem teste no diff, sem check')

  // testes mais fracos: cada forma vira grave
  const graves: Array<[string, string, RegExp]> = [
    ['tests/test_a.py', '+@pytest.mark.skip(reason="instável")', /teste desligado \(skip\/xfail\) em tests\/test_a\.py/],
    ['tests/test_a.py', '+@pytest.mark.xfail', /teste desligado/],
    ['src/a.test.ts', "+it.skip('filtra', () => {})", /teste desligado/],
    ['src/a.test.ts', "+xit('filtra', () => {})", /teste desligado/],
    ['src/a.test.ts', "+it.only('filtra', () => {})", /teste focado \(\.only\)/],
    ['pkg/a_test.go', '+\tt.Skip("depois")', /teste desligado/],
  ]
  for (const [arquivo, linha, re] of graves) {
    a = sl.auditarDiff(d(arquivo, [linha]))
    assert.match(a.enfraquece ?? '', re, linha)
    assert.equal(sl.checkDosTestes(a)?.resultado, 'FAIL', linha)
    assert.match(a.achados[0]!.texto, /^Os testes ficaram mais fracos:/)
  }
  assert.equal(sl.auditarDiff(d('tests/test_a.py', ['+@pytest.mark.skipif(sys.platform == "win32", reason="posix")'])).enfraquece, null, 'skip condicional (plataforma) não é enfraquecer')
  assert.match(sl.auditarDiff(d('tests/test_c.py', ['-def test_c():', '-    assert c() == 1'], ['deleted file mode 100644'])).enfraquece ?? '', /arquivo de teste apagado: tests\/test_c\.py/)
  assert.match(sl.auditarDiff(d('tests/test_a.py', ['-    assert a() == 1', '-    assert b() == 2', '+    assert a() == 1'])).enfraquece ?? '', /remove 2 asserção\(ões\) de teste e adiciona 1/)
  assert.equal(sl.auditarDiff(d('tests/test_a.py', ['-    assert a() == 1', '+    assert a() == 2'])).enfraquece, null, 'trocar uma asserção não enfraquece')
  assert.equal(sl.auditarDiff([d('tests/test_velho.py', ['-    assert a() == 1']), d('tests/test_novo.py', ['+    assert a() == 1'])].join('\n')).enfraquece, null, 'mover asserção entre arquivos não enfraquece')
  assert.equal(sl.auditarDiff(d('src/a.test.ts', ["-  expect(a()).toBe(1)", "+  expect(a()).toBe(2)"])).enfraquece, null)

  // notas
  const nota = (diff: string, re: RegExp) => assert.ok(sl.auditarDiff(diff).achados.some((x) => re.test(x.texto)), String(re))
  nota(d('tests/test_novo.py', ['+def test_nada():', '+    a()'], ['new file mode 100644']), /Arquivo de teste novo sem nenhuma asserção: tests\/test_novo\.py/)
  nota(d('src/a.py', ['+try:', '+    a()', '+except Exception:', '+    pass']), /Erro engolido \(except\/catch vazio\) em src\/a\.py/)
  nota(d('src/a.py', ['+except: pass']), /Erro engolido/)
  nota(d('src/a.ts', ['+  } catch (e) {}']), /Erro engolido/)
  nota(d('src/a.ts', ['+  p.catch(() => {})']), /Erro engolido/)
  nota(d('src/a.py', ['+x = f()  # type: ignore']), /Checagem silenciada/)
  nota(d('src/a.ts', ['+// @ts-ignore']), /Checagem silenciada/)
  nota(d('src/a.ts', ['+const x = y as any']), /Checagem silenciada/)
  nota(d('src/a.py', ['+# def velho():', '+#     return 1', '+# return x']), /Código comentado adicionado em src\/a\.py/)
  nota(d('src/a.py', ['+# TODO: tratar o caso vazio', '+x = 1  # FIXME']), /2 marcador\(es\) TODO\/FIXME\/HACK/)
  nota(d('src/a.ts', ['+  console.log(pedido)']), /Saída de depuração .* em src\/a\.ts/)
  nota(d('src/a.py', ['+breakpoint()']), /Saída de depuração/)
  assert.equal(sl.auditarDiff(d('tests/test_a.py', ['+    print(resultado)', '+    assert resultado'])).achados.length, 0, 'print em teste não é depuração esquecida')
  assert.equal(sl.auditarDiff(d('src/a.py', ['+# Explica por que o filtro usa a hora local.', '+# Ver a issue 12.'])).achados.length, 0, 'comentário de verdade não é código comentado')
  assert.equal(sl.auditarDiff(d('src/a.py', ['+try:', '+    a()', '+except ValueError:', '+    return None'])).achados.length, 0, 'tratar um erro específico não é engolir')
  // diff cortado: avisa que foi parcial
  assert.ok(sl.auditarDiff(`${d('src/a.py', ['+x = 1'])}\n[… 1234 caracteres cortados …]\n`).achados.some((x) => /auditoria de slop foi parcial/.test(x.texto)))
  // os ids e a severidade: notas, nunca bloqueio de gate
  a = sl.auditarDiff([d('tests/test_a.py', ['+@pytest.mark.skip']), d('src/a.py', ['+# TODO x'])].join('\n'))
  assert.deepEqual(a.achados.map((x) => [x.id, x.severidade]), [['SLP-1', 'note'], ['SLP-2', 'note']])

  // no fluxo do PR
  const rodarSlop = async (diff: string) => {
    const g = githubFalso()
    const base = roteiroNode()
    const exec = criarExecutorFalso((c) => (c === 'git diff --cached -U0 --no-color' ? { saida: diff } : base(c)))
    const out = await executarAutonomo(pedidoAuto, { criarExecutor: async () => exec, implementador: async () => ({ resumo: 'ok' }), credenciais: { githubToken: TOKEN_TESTE }, github: g.deps })
    return { out, corpo: String(g.chamadas[0]?.corpo.body ?? ''), rascunho: g.chamadas[0]?.corpo.draft }
  }
  let f = await rodarSlop([d('src/filtro.js', ['+export const f = () => 1']), d('tests/filtro.test.js', ["+it.skip('falha', () => {})"])].join('\n'))
  assert.equal(f.rascunho, true, 'teste desligado: PR em rascunho')
  assert.match(f.corpo, /Testes preservados → \*\*FAIL\*\*/)
  assert.match(f.corpo, /Aberto como rascunho: o diff enfraquece os testes \(veja Pontos de atenção\)/)
  assert.match(f.corpo, /### Pontos de atenção[\s\S]*Os testes ficaram mais fracos: teste desligado \(skip\/xfail\) em tests\/filtro\.test\.js/)
  assert.ok(f.out.estado.trilha.some((e) => /Auditoria de slop: os testes ficaram mais fracos/.test(e.resumo)))
  f = await rodarSlop(d('src/filtro.js', ['+export const f = () => 1', "+  console.log('x')"]))
  assert.equal(f.rascunho, false, 'só nota: o PR sai pronto')
  assert.match(f.corpo, /Saída de depuração \(print, console\.log, breakpoint\) em src\/filtro\.js/)
  assert.ok(!f.out.estado.checks.some((c) => c.nome === 'testes-preservados'), 'sem teste no diff, sem check')
  f = await rodarSlop([d('src/filtro.js', ['+export const f = () => 1']), d('tests/filtro.test.js', ['+  expect(f()).toBe(1)'])].join('\n'))
  assert.equal(f.rascunho, false)
  assert.match(f.corpo, /Testes preservados → \*\*PASS\*\*/)
  assert.ok(!/Pontos de atenção[\s\S]*SLP/.test(f.corpo))
}


fs.rmSync(diretorio, { recursive: true, force: true })
console.log('check-slop: ok')
