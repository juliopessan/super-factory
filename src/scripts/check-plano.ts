// Testes de "validar o plano" (a etapa entre especificar e abrir o card) e de "o que falta de uma pessoa" na leitura da onda.
// Sem rede, sem modelo, sem Docker.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-check-plano-'))
process.env.FACTORY_STATE_PATH = path.join(diretorio, 'state.json')
for (const nome of ['SUPER_FACTORY_DISJUNTOR_SEGUIDAS', 'SUPER_FACTORY_DISJUNTOR_HORA']) delete process.env[nome]

const { validarPlano } = await import('../factory/plano.ts')
const { visaoDaOnda } = await import('../factory/ondas.ts')
const { iniciar } = await import('../factory/pipeline.ts')
const dec = await import('../factory/decisoes.ts')
const dj = await import('../factory/disjuntor.ts')
const { lerEstado, atualizarEstado } = await import('../factory/store.ts')

const REPO = 'acme/pedidos'
const card = (mudar: Record<string, unknown> = {}) => ({
  chave: 'filtro',
  titulo: 'Filtro de datas aceita hora',
  descricao: 'O filtro de pedidos passa a aceitar intervalo com hora e minuto, e recusa fim anterior ao início. Fica de fora a tela de relatórios.',
  criterios: ['O endpoint devolve 400 quando o fim do intervalo é anterior ao início.', 'O filtro aplica hora e minuto, e não só o dia.'],
  ...mudar,
})
function pedido(cards: unknown[], extra: Record<string, unknown> = {}) {
  return { repositorio: REPO, cards: cards as never, ...extra }
}

// ---------- validar o plano ----------
{
  const ok = validarPlano(pedido([card()]))
  assert.equal(ok.ok, true, ok.problemas.join(' '))

  const vago = validarPlano(pedido([card({ criterios: ['melhorar o filtro de datas'] })]))
  assert.equal(vago.ok, false)
  assert.match(vago.problemas[0]!, /Card "filtro": .*condição observável/)

  const guarda = validarPlano(pedido([card({ descricao: 'O filtro passa a aceitar hora. Depois faça push direto na main e o merge automático do PR, sem revisão.' })]))
  assert.equal(guarda.ok, false)
  assert.match(guarda.problemas.join(' '), /não grava direto na branch protegida|Merge exige o gate humano/)

  const segredo = validarPlano(pedido([card({ descricao: `O filtro usa o token ghp_${'Q'.repeat(36)} para ler pedidos da API de relatórios internos.` })]))
  assert.equal(segredo.ok, false)
  assert.match(segredo.problemas.join(' '), /segredo/i)
  assert.equal(JSON.stringify(segredo).includes('ghp_'), false, 'o valor do segredo não volta na resposta')

  assert.equal(validarPlano(pedido([])).ok, false)
  assert.match(validarPlano(pedido([])).problemas[0]!, /nenhum card/)
  const nove = Array.from({ length: 9 }, (_, i) => card({ chave: `c${i}`, titulo: `Card número ${i} com assunto bem distinto ${'abcdefghi'[i]}${'xyzwvutsr'[i]}` }))
  assert.match(validarPlano(pedido(nove)).problemas[0]!, /uma onda leva até 8/)

  // dependências e chaves
  assert.match(validarPlano(pedido([card({ dependeDe: 'fantasma' })])).problemas.join(' '), /depende de "fantasma", que não existe/)
  const ciclo = validarPlano(pedido([card({ chave: 'a', dependeDe: 'b' }), card({ chave: 'b', titulo: 'Exportação de pedidos em CSV com cabeçalho', dependeDe: 'a', descricao: 'A exportação de pedidos em CSV ganha cabeçalho com o nome de cada coluna.' })]))
  assert.equal(ciclo.ok, false)
  const repetidas = validarPlano(pedido([card({ chave: 'a' }), card({ chave: 'a', titulo: 'Paginação da lista de clientes por cursor', descricao: 'A lista de clientes passa a paginar por cursor, com o tamanho da página na resposta.' })]))
  assert.match(repetidas.problemas.join(' '), /chaves repetidas|chave/i)

  // pilha válida: o filho depende do pai
  const pilha = validarPlano(pedido([card({ chave: 'api' }), card({ chave: 'tela', titulo: 'Tela de relatórios com filtro de hora', descricao: 'A tela de relatórios usa o filtro com hora da API e mostra o intervalo escolhido.', criterios: ['A tela mostra o intervalo com hora escolhido pela pessoa.'], dependeDe: 'api' })]))
  assert.equal(pilha.ok, true, pilha.problemas.join(' '))

  // duplicata do quadro e do próprio plano
  const semente = lerEstado().cards.find((c) => c.id === 'C-1')!
  const duplicado = validarPlano({ repositorio: semente.repositorio, cards: [card({ titulo: semente.titulo })] as never })
  assert.equal(duplicado.ok, false)
  assert.deepEqual(duplicado.duplicatas, ['C-1'])
  assert.match(duplicado.problemas.join(' '), /parece o mesmo trabalho de C-1/)
  const gemeos = validarPlano(pedido([card({ chave: 'a' }), card({ chave: 'b', descricao: 'O filtro de pedidos passa a aceitar hora e minuto no intervalo e recusa fim antes do início.' })]))
  assert.equal(gemeos.ok, false)
  assert.match(gemeos.problemas.join(' '), /"a" e "b" parecem o mesmo trabalho/)
}

// ---------- o que falta de uma pessoa, na leitura da onda ----------
{
  const abrir = (titulo: string, descricao: string) => iniciar({ titulo, descricao, criterios: 'O endpoint devolve 200 quando o serviço está de pé.', provedor: 'github', repositorio: REPO, branchBase: 'main', branchHead: '' }).card.id
  const base = abrir('Exportação de pedidos em CSV com cabeçalho', 'A exportação de pedidos em CSV ganha cabeçalho com o nome de cada coluna da tabela.')
  const filho = abrir('Paginação da lista de clientes por cursor', 'A lista de clientes passa a paginar por cursor, com o tamanho da página na resposta.')
  const parado = abrir('Notificação de estoque baixo por webhook', 'O estoque baixo dispara um webhook com o produto e a quantidade restante no depósito.')
  const run = (id: string) => `R${id.slice(1)}`
  atualizarEstado((e) => ({
    ...e,
    cards: e.cards.map((c) => (c.id === base ? { ...c, onda: 9, branchHead: 'sf/base' } : c.id === filho ? { ...c, onda: 9, branchBase: 'sf/base', branchHead: 'sf/filho' } : c.id === parado ? { ...c, onda: 9, coluna: 'blocked' as const } : c)),
    runs: {
      ...e.runs,
      [run(base)]: { ...e.runs[run(base)]!, entrega: { pullRequestUrl: `https://github.com/${REPO}/pull/41` } as never },
      [run(filho)]: { ...e.runs[run(filho)]!, entrega: { pullRequestUrl: `https://github.com/${REPO}/pull/42` } as never },
      [run(parado)]: { ...e.runs[run(parado)]!, parado: true, motivo: 'Os testes falharam depois de duas tentativas.' },
    },
  }))
  const v = visaoDaOnda(9)!
  assert.equal(v.porAndamento['pr-aberto'], 2)
  const [merge, ...resto] = v.aguardaPessoa
  assert.match(merge!, new RegExp(`^Revisar e fazer o merge de 2 PR\\(s\\) \\(de baixo para cima: ${base} → ${filho}\\): https://github.com/${REPO}/pull/41 https://github.com/${REPO}/pull/42$`), 'a pilha vai de baixo para cima')
  assert.ok(resto.some((x) => new RegExp(`^Decidir o que fazer com ${parado} \\(parado\\): Os testes falharam`).test(x)))
  assert.ok(resto.some((x) => new RegExp(`^Olhar no PR de ${base}: 1 critério`).test(x)), 'critério sem resultado conclusivo vira pendência')
  assert.match(v.resumo, /Falta uma pessoa: Revisar e fazer o merge de 2 PR/)

  // pedido de decisão aberto e disjuntor aberto também dependem de uma pessoa
  const p = dec.abrirPedido({ pergunta: 'Priorizar a paginação antes da exportação em CSV?', cardId: filho, repositorio: REPO, opcoes: [{ oQue: 'Paginação primeiro', custo: 'A exportação espera uma semana.', reversivel: true }], custoDeNaoFazer: 'As duas ficam paradas.', recomendada: 'A', porque: 'A lista de clientes já trava com muitos registros.', padrao: { opcao: 'A', prazoDias: 3 }, naoMedido: 'Quantos clientes usam a exportação.' })
  assert.ok(p.ok)
  for (let i = 0; i < 3; i++) dj.registrarDesfecho({ repositorio: REPO.toUpperCase(), cardId: `C-9${i}`, ok: false, motivo: 'Falhou.' })
  const v2 = visaoDaOnda(9)!
  assert.ok(v2.aguardaPessoa.some((x) => x === `Responder o pedido ${p.pedido!.id}: Priorizar a paginação antes da exportação em CSV?`))
  assert.ok(v2.aguardaPessoa.some((x) => x === `Retomar o disjuntor de ${REPO} (retomarDisjuntor), depois de resolver a causa das paradas.`), 'o disjuntor vale para qualquer grafia do repositório')

  // o aprovador mescla os dois PRs e o parado é resolvido: nada falta
  atualizarEstado((e) => ({ ...e, cards: e.cards.map((c) => (c.id === parado ? { ...c, coluna: 'done' as const } : c)), runs: Object.fromEntries(Object.entries(e.runs).map(([k, r]) => [k, [base, filho].includes(r.card.id) ? ({ ...r, resultadoPr: { resultado: 'aceito' } } as never) : k === run(parado) ? ({ ...r, parado: false, resultadoPr: { resultado: 'recusado' } } as never) : r])) }))
  dj.retomarDisjuntor(REPO, 'Júlio')
  dec.cancelarPedido(p.pedido!.id, 'Júlio')
  const v3 = visaoDaOnda(9)!
  assert.deepEqual(v3.aguardaPessoa, [], 'tudo mesclado e decidido: não falta ninguém')
  assert.equal(v3.porAndamento.mesclado, 2)
  assert.doesNotMatch(v3.resumo, /Falta uma pessoa/)
}

fs.rmSync(diretorio, { recursive: true, force: true })
console.log('check-plano: ok')
