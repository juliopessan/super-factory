// Testes do que veio da análise da Fábrica (DeskLabs): resultado por critério em cinco estados, pedido de decisão e disjuntor.
// Arquivo à parte do check.ts (limite de análise do TypeScript). Sem rede, sem modelo, sem Docker.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import type { EntradaDoPedido } from '../factory/decisoes.ts'

const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-check-fabrica-'))
process.env.FACTORY_STATE_PATH = path.join(diretorio, 'state.json')
for (const nome of ['SUPER_FACTORY_DISJUNTOR_SEGUIDAS', 'SUPER_FACTORY_DISJUNTOR_HORA']) delete process.env[nome]

const d = await import('../factory/decisoes.ts')
const dj = await import('../factory/disjuntor.ts')
const cr = await import('../factory/criterios.ts')
const { lerCardCompleto } = await import('../factory/cards.ts')
const { visaoDaOnda } = await import('../factory/ondas.ts')
const { prepararOnda } = await import('../factory/preparar-onda.ts')
const { lerEstado, atualizarEstado } = await import('../factory/store.ts')

const T0 = new Date('2026-11-26T10:00:00Z')
const depois = (min: number) => new Date(T0.getTime() + min * 60_000)

function entrada(mudar: Partial<EntradaDoPedido> = {}): EntradaDoPedido {
  return {
  pergunta: 'Priorizar o filtro de datas antes do onboarding?',
  opcoes: [
    { oQue: 'Filtro de datas primeiro', custo: 'O onboarding espera uma semana.', reversivel: true },
    { oQue: 'Reescrever a API de pedidos', custo: 'Duas semanas e migração de dados.', reversivel: false },
  ],
  custoDeNaoFazer: 'O bug segue em produção.',
  recomendada: 'A',
  porque: 'Quem usa a API perde dados todo dia.',
  padrao: { opcao: 'A', prazoDias: 3 },
  naoMedido: 'Quantos clientes usam o intervalo sem hora.',
  ...mudar,
  }
}

// ---------- pedido de decisão ----------
{
  const r = d.abrirPedido(entrada(), T0)
  assert.ok(r.ok && r.pedido, r.nota)
  const p = r.pedido!
  assert.match(p.id, /^D-\d+$/)
  assert.deepEqual(p.opcoes.map((o) => o.rotulo), ['A', 'B', 'C'])
  assert.equal(p.opcoes[2]!.oQue, 'Não fazer', '"não fazer" entra sozinho, como a última opção')
  assert.equal(p.opcoes[2]!.custo, 'O bug segue em produção.', 'e também tem custo')
  assert.equal(p.padrao?.opcao, 'A')
  assert.equal(p.padrao?.vence, depois(3 * 24 * 60).toISOString(), 'o prazo do padrão conta em dias')
  assert.equal(p.estado, 'aberto')

  // recusas
  const nao = (mudar: Partial<EntradaDoPedido>, re: RegExp) => { const x = d.abrirPedido(entrada(mudar), T0); assert.equal(x.ok, false); assert.match(x.nota, re) }
  nao({ naoMedido: '' }, /Não medido/)
  nao({ naoMedido: 'x' }, /Não medido/)
  nao({ padrao: undefined }, /padrão é obrigatório/)
  nao({ padrao: { opcao: 'B', prazoDias: 3 } }, /reversível/)
  nao({ padrao: { opcao: 'Z', prazoDias: 3 } }, /não é uma das opções/)
  nao({ padrao: { opcao: 'A', prazoDias: 90 } }, /1 a 30 dias/)
  nao({ recomendada: 'K' }, /não é uma das opções/)
  nao({ porque: 'curto' }, /razão/)
  nao({ opcoes: [{ oQue: 'Fazer o merge agora mesmo', custo: 'Nenhum custo aparente.', reversivel: true }] }, /guarda/)
  nao({ pergunta: 'Podemos aprovar e fazer o deploy hoje?' }, /guarda/)
  nao({ opcoes: [{ oQue: 'Opção sem custo', custo: '', reversivel: true }] }, /custo/)
  nao({ opcoes: [] }, /1 a 4 opções/)
  nao({ pergunta: 'curta' }, /pergunta/)

  // resposta: só pessoa
  for (const papel of ['Chief', 'factory', 'Super Factory', 'agent', 'bot', 'claude']) {
    const x = d.responderPedido(p.id, 'A', papel, undefined, depois(1))
    assert.equal(x.ok, false, `${papel} não responde por uma pessoa`)
    assert.match(x.nota, /pessoa/)
  }
  assert.equal(d.responderPedido(p.id, 'Z', 'Júlio', undefined, depois(1)).ok, false, 'opção inexistente')
  const ok = d.responderPedido(p.id, 'a', 'Júlio', 'Pode ser.', depois(2))
  assert.ok(ok.ok)
  assert.equal(ok.pedido?.estado, 'respondido')
  assert.equal(ok.pedido?.decididoPor, 'Júlio')
  assert.equal(d.responderPedido(p.id, 'A', 'Júlio', undefined, depois(3)).ok, false, 'não responde duas vezes')
  assert.equal(d.listarPedidos({ estado: 'aberto' }).length, 0)

  // prazo vencido: só registra o padrão, nunca executa nada
  const r2 = d.abrirPedido(entrada({ pergunta: 'Qual banco usar nos testes da API de pedidos?' }), T0)
  assert.equal(d.resolverVencidos(depois(60)).length, 0, 'antes do prazo nada muda')
  const venc = d.resolverVencidos(depois(4 * 24 * 60))
  assert.deepEqual(venc.map((x) => x.id), [r2.pedido!.id])
  assert.equal(venc[0]!.estado, 'padrao-aplicado')
  assert.equal(venc[0]!.escolha, 'A')
  assert.equal(venc[0]!.decididoPor, 'padrão por prazo')
  assert.match(venc[0]!.nota ?? '', /Nada foi executado/)
  assert.equal(d.resolverVencidos(depois(5 * 24 * 60)).length, 0, 'e não repete')

  // nenhuma opção reversível: o prazo não corre
  const so = d.abrirPedido(entrada({ opcoes: [{ oQue: 'Migrar o banco de uma vez', custo: 'Sem volta depois de migrar.', reversivel: false }], padrao: undefined, pergunta: 'Migrar o banco de pedidos agora ou esperar?' }), T0)
  // "não fazer" é sempre reversível, então o padrão continua obrigatório
  assert.equal(so.ok, false)
  assert.match(so.nota, /padrão é obrigatório/)

  // cancelar
  const r3 = d.abrirPedido(entrada({ pergunta: 'Documentar a API de pedidos em português?' }), T0)
  assert.equal(d.cancelarPedido(r3.pedido!.id, 'Chief').ok, false)
  assert.equal(d.cancelarPedido(r3.pedido!.id, 'Júlio').pedido?.estado, 'cancelado')
}

// ---------- cinco estados por critério ----------
{
  // o construtor só PROPÕE "não se aplica"
  const mapa = cr.lerMapaDeCriterios('Terminei.\nCRITERIO 1: tests/filtro.test.js\nCRITERIO 2: não se aplica - o endpoint já valida isso\nCRITERIO 3: nenhum')
  assert.deepEqual(mapa.map((m) => m.n), [1, 2, 3])
  assert.deepEqual(mapa[1]!.testes, [])
  assert.equal(mapa[1]!.proposta?.tipo, 'nao-se-aplica')
  assert.match(mapa[1]!.proposta?.motivo ?? '', /endpoint já valida/)
  assert.equal(mapa[0]!.proposta, undefined)
  assert.equal(cr.lerMapaDeCriterios('CRITERIO 1: Decidido diferente: cobrimos por contrato')[0]!.proposta?.tipo, 'decidido-diferente')

  const checks = [{ nome: 'testes-no-sandbox', resultado: 'PASS' as const, comando: 'npm test', evidencia: 'ok' }]
  const medido = cr.resultadoPorCriterio({ criterios: ['a', 'b', 'c'], mapa, arquivosMudados: ['tests/filtro.test.js'], checks, parado: false, motivo: null })
  assert.deepEqual(medido.map((m) => m.status), ['PASS', 'NOT_RUN', 'NOT_RUN'])
  assert.match(medido[1]!.evidencia, /propôs "não se aplica".*só vale com a decisão de uma pessoa/)
  assert.ok(medido.every((m) => m.status !== ('N_A' as string) && m.status !== ('DECIDIDO' as string)), 'o sandbox nunca produz N_A nem DECIDIDO')

  // card do quadro: duas decisões de pessoa mudam o que se lê
  const estado = lerEstado()
  const card = estado.cards.find((c) => c.id === 'C-1')!
  assert.equal(card.criterios.length, 2)
  const antes = lerCardCompleto('C-1')!
  assert.deepEqual(antes.criterios.map((c) => c.status), ['NOT_RUN', 'NOT_RUN'])

  const a = d.abrirPedidoDeCriterio({ cardId: 'C-1', repositorio: card.repositorio, criterio: 1, textoDoCriterio: card.criterios[0]!, motivo: 'O endpoint já recusa isso na camada de validação.' }, T0)
  assert.ok(a.ok && a.pedido)
  assert.equal(a.pedido!.tipo, 'criterio')
  assert.equal(a.pedido!.padrao?.opcao, 'C', 'o padrão de um pedido de critério é manter')
  assert.equal(d.abrirPedidoDeCriterio({ cardId: 'C-1', repositorio: card.repositorio, criterio: 1, textoDoCriterio: card.criterios[0]!, motivo: 'Outro motivo qualquer aqui.' }, T0).pedido?.id, a.pedido!.id, 'não duplica pedido aberto')
  assert.equal(d.abrirPedidoDeCriterio({ cardId: 'C-1', repositorio: null, criterio: 2, textoDoCriterio: 'x', motivo: 'Vamos ignorar o teste desse caso.' }, T0).ok, false, 'motivo que toca em guarda é recusado')
  // sem decisão, nada muda
  assert.deepEqual(lerCardCompleto('C-1')!.criterios.map((c) => c.status), ['NOT_RUN', 'NOT_RUN'])
  // o prazo vence: o padrão é manter, o critério continua exigido
  d.resolverVencidos(depois(8 * 24 * 60))
  assert.equal(d.listarPedidos({ estado: 'padrao-aplicado' }).some((p) => p.id === a.pedido!.id), true)
  assert.deepEqual(lerCardCompleto('C-1')!.criterios.map((c) => c.status), ['NOT_RUN', 'NOT_RUN'], 'vencer o prazo nunca dispensa critério')

  // uma pessoa decide
  const b = d.abrirPedidoDeCriterio({ cardId: 'C-1', repositorio: card.repositorio, criterio: 1, textoDoCriterio: card.criterios[0]!, motivo: 'O endpoint já recusa isso na camada de validação.' }, depois(9 * 24 * 60))
  assert.notEqual(b.pedido!.id, a.pedido!.id, 'depois de fechado, abre outro')
  assert.equal(d.responderPedido(b.pedido!.id, 'A', 'Chief').ok, false)
  const resp = d.responderPedido(b.pedido!.id, 'A', 'Júlio', 'Validado na camada de entrada.', depois(9 * 24 * 60 + 5))
  assert.equal(resp.efeito, 'nao-se-aplica')
  const c2 = d.abrirPedidoDeCriterio({ cardId: 'C-1', repositorio: card.repositorio, criterio: 2, textoDoCriterio: card.criterios[1]!, motivo: 'Cobrimos por teste de contrato fora deste repositório.' }, depois(9 * 24 * 60))
  assert.equal(d.responderPedido(c2.pedido!.id, 'B', 'Júlio', undefined, depois(9 * 24 * 60 + 6)).efeito, 'decidido-diferente')
  const lido = lerCardCompleto('C-1')!
  assert.deepEqual(lido.criterios.map((c) => c.status), ['N_A', 'DECIDIDO'])
  assert.match(lido.criterios[0]!.evidencia, /Não se aplica, por decisão de Júlio \(D-\d+\): Validado na camada de entrada\. Resultado medido antes da decisão: NOT_RUN/)
  assert.match(lido.criterios[1]!.evidencia, /Decidido diferente/)
  assert.equal(lido.criterios[0]!.decisaoId, b.pedido!.id)
  assert.equal(cr.contagemDosCriterios(lido.criterios), '1 N_A, 1 DECIDIDO')
  assert.equal(cr.contagemDosCriterios([{ status: 'PASS' }, { status: 'N_A' }, { status: 'FAIL' }]), '1 PASS, 1 FAIL, 1 N_A')

  // a visão da onda também mostra
  atualizarEstado((e) => ({ ...e, cards: e.cards.map((c) => (c.id === 'C-1' ? { ...c, onda: 7 } : c)) }))
  const onda = visaoDaOnda(7)!
  assert.deepEqual(onda.cards[0]!.criterios.map((c) => c.status), ['N_A', 'DECIDIDO'])
  assert.equal(onda.cards[0]!.contagemDeCriterios, '1 N_A, 1 DECIDIDO')
  // e o que o sandbox gravou na execução não muda (a decisão é uma camada de leitura)
  assert.equal(JSON.stringify(lerEstado().runs).includes('N_A'), false)
}

// ---------- disjuntor ----------
{
  const cfg = dj.lerConfigDoDisjuntor({})
  assert.deepEqual(cfg, { seguidas: 3, hora: 5 })
  assert.deepEqual(dj.lerConfigDoDisjuntor({ SUPER_FACTORY_DISJUNTOR_SEGUIDAS: '0', SUPER_FACTORY_DISJUNTOR_HORA: 'abc' }), { seguidas: 0, hora: 5 })
  const R = 'acme/pedidos'
  const falha = (cardId: string, min: number, motivo = 'Os testes falharam.') => dj.registrarDesfecho({ repositorio: R, cardId, ok: false, motivo }, cfg, depois(min))

  assert.equal(dj.registrarDesfecho({ repositorio: null, cardId: 'C-1', ok: false }, cfg, T0), null, 'sem repositório não há circuito')
  assert.equal(dj.bloqueioDoDisjuntor(R), null)
  const f1 = falha('C-1', 0)!
  assert.equal(f1.aberto, false)
  assert.equal(f1.circuito.falhasSeguidas, 1)
  // parar por teto ou pelo próprio disjuntor não conta
  assert.equal(dj.registrarDesfecho({ repositorio: R, cardId: 'C-9', ok: false, motivo: 'Teto de tokens do dia atingido (6.000.000 de 6.000.000).' }, cfg, depois(1)), null)
  assert.equal(dj.registrarDesfecho({ repositorio: R, cardId: 'C-9', ok: false, motivo: 'Disjuntor aberto em acme/pedidos' }, cfg, depois(1)), null)
  assert.equal(falha('C-2', 2)!.aberto, false)
  // um sucesso zera a sequência
  const ok1 = dj.registrarDesfecho({ repositorio: R, cardId: 'C-3', ok: true }, cfg, depois(3))!
  assert.equal(ok1.circuito.falhasSeguidas, 0)
  assert.equal(ok1.circuito.ultimoSucessoEm, depois(3).toISOString())
  assert.equal(falha('C-4', 4)!.aberto, false)
  assert.equal(falha('C-5', 5)!.aberto, false)
  const abre = falha('C-6', 6)!
  assert.equal(abre.abriuAgora, true, 'a terceira falha seguida abre o circuito')
  assert.equal(abre.aberto, true)
  assert.ok(abre.decisaoId, 'o alarme abre um pedido de decisão')
  const pedido = d.listarPedidos({ estado: 'aberto', repositorio: R }).find((p) => p.tipo === 'disjuntor')!
  assert.equal(pedido.id, abre.decisaoId)
  assert.equal(pedido.padrao?.opcao, 'B', 'o padrão é manter pausado')
  assert.match(pedido.naoMedido, /causa/)
  assert.match(dj.bloqueioDoDisjuntor(R) ?? '', /Disjuntor aberto em acme\/pedidos.*3 execuções seguidas.*retomarDisjuntor/)
  assert.equal(dj.bloqueioDoDisjuntor('acme/outro'), null, 'o circuito é por repositório')
  // sucesso e prazo não fecham: só uma pessoa
  dj.registrarDesfecho({ repositorio: R, cardId: 'C-7', ok: true }, cfg, depois(7))
  assert.ok(dj.bloqueioDoDisjuntor(R), 'um sucesso depois de aberto não fecha o circuito')
  d.resolverVencidos(depois(10 * 24 * 60))
  assert.ok(dj.bloqueioDoDisjuntor(R), 'vencer o prazo do pedido não retoma')
  assert.equal(d.listarPedidos({ estado: 'padrao-aplicado' }).some((p) => p.id === pedido.id), true)
  assert.equal(falha('C-8', 8)!.abriuAgora, false, 'já aberto: não abre outra vez nem duplica o alarme')
  assert.equal(d.listarPedidos({ estado: 'aberto', repositorio: R }).filter((p) => p.tipo === 'disjuntor').length, 0)

  // a onda não inicia cards do repositório pausado, e não gasta sandbox
  const preparo = await prepararOnda({ pedidos: [{ titulo: 'Filtro de datas', descricao: 'Aceitar intervalo com hora no filtro de pedidos da API.', criterios: 'O endpoint devolve 400 quando o fim é anterior ao início.', provedor: 'github', repositorio: R, branchBase: 'main', branchHead: '' }] }, {})
  assert.equal(preparo.ok, false)
  assert.match(preparo.nota, /BLOCKED.*Disjuntor aberto/)
  const ensaio = await prepararOnda({ pedidos: [{ titulo: 'Filtro de datas', descricao: 'Aceitar intervalo com hora no filtro de pedidos da API.', criterios: 'O endpoint devolve 400 quando o fim é anterior ao início.', provedor: 'github', repositorio: R, branchBase: 'main', branchHead: '' }], ensaio: true }, {})
  assert.equal(ensaio.ok, true, 'o ensaio passa: não gasta nada')
  const outro = await prepararOnda({ pedidos: [{ titulo: 'Filtro de datas', descricao: 'Aceitar intervalo com hora no filtro de pedidos da API.', criterios: 'O endpoint devolve 400 quando o fim é anterior ao início.', provedor: 'github', repositorio: 'acme/outro', branchBase: 'main', branchHead: '' }] }, {})
  assert.equal(outro.ok, true, 'outro repositório segue')

  // resumo e "vigia precisa de vigia"
  const res = dj.resumoDoDisjuntor(cfg)
  assert.match(res.resumo, /ABERTO em: acme\/pedidos/)
  const c = res.circuitos.find((x) => x.repositorio === R)!
  assert.equal(c.situacao, 'aberto')
  assert.equal(c.ultimoSucessoEm, depois(7).toISOString())
  assert.equal(c.ultimoDesfechoEm, depois(8).toISOString())

  // retomar: só pessoa
  assert.equal(dj.retomarDisjuntor(R, 'Chief').ok, false)
  assert.equal(dj.retomarDisjuntor(R, 'factory').ok, false)
  assert.equal(dj.retomarDisjuntor('acme/outro', 'Júlio').ok, false, 'não está aberto')
  const ret = dj.retomarDisjuntor(R, 'Júlio', depois(11 * 24 * 60))
  assert.ok(ret.ok, ret.nota)
  assert.equal(dj.bloqueioDoDisjuntor(R), null)
  assert.equal(dj.resumoDoDisjuntor(cfg).circuitos.find((x) => x.repositorio === R)!.situacao, 'fechado')
  // a sequência recomeça do zero: duas falhas não abrem
  assert.equal(falha('C-10', 11 * 24 * 60 + 1)!.aberto, false)
  assert.equal(falha('C-11', 11 * 24 * 60 + 2)!.aberto, false)

  // gatilho por hora: falhas intercaladas com sucesso, limite de 5 na última hora
  const R2 = 'acme/ruidoso'
  const g = (cardId: string, ok: boolean, min: number) => dj.registrarDesfecho({ repositorio: R2, cardId, ok, motivo: ok ? null : 'Falhou.' }, cfg, depois(20 * 24 * 60 + min))!
  g('C-20', false, 0); g('C-21', true, 5); g('C-22', false, 10); g('C-23', true, 15); g('C-24', false, 20); g('C-25', true, 25)
  assert.equal(g('C-26', false, 30).aberto, false, '4 falhas na hora ainda não abrem')
  const porHora = g('C-27', false, 35)
  assert.equal(porHora.abriuAgora, true)
  assert.equal(porHora.circuito.aberto?.gatilho, 'hora')
  assert.match(porHora.circuito.aberto?.motivo ?? '', /5 execuções pararam.*na última hora/)
  // falhas espaçadas (mais de uma hora) não abrem por hora
  const R3 = 'acme/espacado'
  for (let i = 0; i < 6; i++) { const x = dj.registrarDesfecho({ repositorio: R3, cardId: `C-3${i}`, ok: i % 2 === 1, motivo: 'Falhou.' }, cfg, depois(30 * 24 * 60 + i * 90)); assert.equal(x!.aberto, false) }

  // desligado
  const desligado = { seguidas: 0, hora: 0 }
  for (let i = 0; i < 8; i++) assert.equal(dj.registrarDesfecho({ repositorio: 'acme/livre', cardId: `C-4${i}`, ok: false, motivo: 'Falhou.' }, desligado, depois(40 * 24 * 60 + i))!.aberto, false)
  assert.match(dj.resumoDoDisjuntor(desligado).resumo, /desligado/)

  // ensaio: simula sem gravar
  const antes = JSON.stringify(lerEstado().disjuntor)
  const e1 = dj.ensaiarDisjuntor('acme/novo', 2, cfg, lerEstado(), T0)
  assert.equal(e1.abriria, false)
  const e2 = dj.ensaiarDisjuntor('acme/novo', 3, cfg, lerEstado(), T0)
  assert.equal(e2.abriria, true)
  assert.equal(e2.gatilho, 'seguidas')
  assert.match(e2.resumo, /abriria/)
  assert.equal(JSON.stringify(lerEstado().disjuntor), antes, 'o ensaio não grava nada')
  assert.match(dj.ensaiarDisjuntor('acme/novo', 3, desligado, lerEstado(), T0).resumo, /desligado/)
}

// ---------- o estado guarda tudo e sobrevive à releitura ----------
{
  const e = lerEstado()
  assert.ok((e.decisoes ?? []).length > 5)
  assert.ok(Object.keys(e.disjuntor?.circuitos ?? {}).includes('acme/pedidos'))
  assert.equal(JSON.stringify(e).includes('ghp_'), false)
}

fs.rmSync(diretorio, { recursive: true, force: true })
console.log('check-fabrica: ok')
