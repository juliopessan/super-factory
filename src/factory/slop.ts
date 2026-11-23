// Auditoria de slop no diff: o que o modelo costuma fazer para "passar" ou para parecer pronto, sem que o lint do repositório
// perceba. Roda no diff que vai virar o commit, dentro do sandbox, sem exigir nada do repositório do cliente.
// Determinística e barata: não chama modelo. Quase tudo vira NOTA no PR; só uma coisa deixa o PR em rascunho:
// os testes ficarem mais fracos (teste desligado, foco em um teste só, arquivo de teste apagado, menos asserções no total).
// Quem decide continua sendo a pessoa: um skip legítimo existe, e o rascunho só pede que alguém olhe.

import type { Estado } from './schemas.ts'
import { classificarArquivos } from './verificacao.ts'

type Achado = Estado['achados'][number]
type Check = Estado['checks'][number]

export type ArquivoDoDiff = { caminho: string; novo: boolean; apagado: boolean; adicionadas: string[]; removidas: string[] }

/** Lê um diff unificado (git diff) em arquivos com as linhas adicionadas e removidas. */
export function lerDiff(diff: string): ArquivoDoDiff[] {
  const arquivos: ArquivoDoDiff[] = []
  let atual: ArquivoDoDiff | null = null
  for (const linha of diff.split('\n')) {
    const cabecalho = /^diff --git a\/(.+?) b\/(.+)$/.exec(linha)
    if (cabecalho) {
      atual = { caminho: cabecalho[2]!, novo: false, apagado: false, adicionadas: [], removidas: [] }
      arquivos.push(atual)
      continue
    }
    if (!atual) continue
    if (linha.startsWith('new file mode')) atual.novo = true
    else if (linha.startsWith('deleted file mode')) atual.apagado = true
    else if (linha.startsWith('+++') || linha.startsWith('---')) continue
    else if (linha.startsWith('+')) atual.adicionadas.push(linha.slice(1))
    else if (linha.startsWith('-')) atual.removidas.push(linha.slice(1))
  }
  return arquivos
}

const ASSERCAO = /\bassert\b|\bexpect\s*\(|\bassert\w*\s*\(|self\.assert\w+\s*\(|\.should\b|\bAssert\.\w+\s*\(|\bt\.(Error|Errorf|Fatal|Fatalf)\s*\(|\brequire\.\w+\s*\(|\bpytest\.raises\b|\bassertThat\s*\(/
const DESLIGA_TESTE = /@pytest\.mark\.(skip|xfail)\b(?!if)|@unittest\.skip\b|\bpytest\.skip\s*\(|\b(it|test|describe)\.skip\s*\(|\bx(it|describe|test)\s*\(|\bt\.Skip(Now|f)?\s*\(|\[Ignore\]|Skip\s*=\s*"/
const FOCA_TESTE = /\b(it|test|describe)\.only\s*\(|\bf(it|describe)\s*\(/
const ENGOLE_ERRO = /^\s*except\s*:\s*(pass)?\s*$|^\s*except\s+(Base)?Exception(\s+as\s+\w+)?\s*:\s*pass\s*$|catch\s*(\(\s*\w*\s*\))?\s*\{\s*\}|\.catch\s*\(\s*\(\s*\w*\s*\)\s*=>\s*\{\s*\}\s*\)|\.catch\s*\(\s*\(\s*\)\s*=>\s*(undefined|null)\s*\)/
const SILENCIA = /#\s*type:\s*ignore|#\s*noqa\b|@ts-ignore|@ts-expect-error|eslint-disable|\/\/\s*nolint\b|#pragma\s+warning\s+disable|#\s*pylint:\s*disable|\bas\s+any\b|:\s*any\b/
const CODIGO_COMENTADO = /^\s*(#|\/\/)\s*(def |class |return\b|if\b.*[:{]\s*$|for\b.*[:{]\s*$|while\b.*[:{]\s*$|import |from \S+ import |const |let |var |function\b|await |[\w.]+\([^)]*\)\s*;?\s*$|\}\s*$)/
const MARCADOR = /\b(TODO|FIXME|XXX|HACK)\b/
const DEPURACAO = /\bconsole\.(log|debug)\s*\(|\bdebugger\s*;|\bbreakpoint\s*\(\s*\)|\bpdb\.set_trace\s*\(|^\s*print\s*\(/

export type AuditoriaDeSlop = {
  achados: Achado[]
  /** Os testes ficaram mais fracos? Se sim, o motivo (vira rascunho). */
  enfraquece: string | null
  /** O diff tocou em teste? Só então o check "testes-preservados" existe. */
  tocouTestes: boolean
  /** O diff chegou cortado (grande demais): a auditoria foi parcial. */
  cortado: boolean
}

function lista(itens: string[], max = 3): string {
  const unicos = [...new Set(itens)]
  return unicos.slice(0, max).join(', ') + (unicos.length > max ? ` e mais ${unicos.length - max}` : '')
}

/** Audita o diff. Os achados são notas (SLP-n); "enfraquece" diz se os testes ficaram mais fracos. */
export function auditarDiff(diff: string): AuditoriaDeSlop {
  const cortado = /\[… \d+ caracteres cortados …\]/.test(diff)
  const arquivos = lerDiff(diff)
  const { testes } = classificarArquivos(arquivos.map((a) => a.caminho))
  const ehTeste = (a: ArquivoDoDiff) => testes.includes(a.caminho)
  const deTeste = arquivos.filter(ehTeste)
  const deCodigo = arquivos.filter((a) => !ehTeste(a))
  const notas: string[] = []
  const graves: string[] = []

  // 1. Testes mais fracos: desligados, focados, apagados, ou menos asserções no total.
  const desligados = deTeste.filter((a) => a.adicionadas.some((l) => DESLIGA_TESTE.test(l))).map((a) => a.caminho)
  if (desligados.length) graves.push(`teste desligado (skip/xfail) em ${lista(desligados)}`)
  const focados = deTeste.filter((a) => a.adicionadas.some((l) => FOCA_TESTE.test(l))).map((a) => a.caminho)
  if (focados.length) graves.push(`teste focado (.only), que faz os outros pararem de rodar, em ${lista(focados)}`)
  const apagados = deTeste.filter((a) => a.apagado).map((a) => a.caminho)
  if (apagados.length) graves.push(`arquivo de teste apagado: ${lista(apagados)}`)
  const assertsRemovidos = deTeste.reduce((n, a) => n + a.removidas.filter((l) => ASSERCAO.test(l)).length, 0)
  const assertsAdicionados = deTeste.reduce((n, a) => n + a.adicionadas.filter((l) => ASSERCAO.test(l)).length, 0)
  if (assertsRemovidos > assertsAdicionados) graves.push(`o diff remove ${assertsRemovidos} asserção(ões) de teste e adiciona ${assertsAdicionados}`)
  const testeNovoVazio = deTeste.filter((a) => a.novo && a.adicionadas.length > 0 && !a.adicionadas.some((l) => ASSERCAO.test(l))).map((a) => a.caminho)
  if (testeNovoVazio.length) notas.push(`Arquivo de teste novo sem nenhuma asserção: ${lista(testeNovoVazio)}. Um teste que não verifica nada passa sempre.`)

  // 2. Erro engolido (inclui "except X:" numa linha e "pass" na seguinte).
  const engolidos: string[] = []
  for (const a of deCodigo) {
    a.adicionadas.forEach((l, i) => {
      if (ENGOLE_ERRO.test(l) || (/^\s*except\b[^:]*:\s*$/.test(l) && /^\s*pass\s*$/.test(a.adicionadas[i + 1] ?? ''))) engolidos.push(a.caminho)
    })
  }
  if (engolidos.length) notas.push(`Erro engolido (except/catch vazio) em ${lista(engolidos)}: a falha some em vez de aparecer.`)

  // 3. Checagem silenciada.
  const silenciados = arquivos.filter((a) => a.adicionadas.some((l) => SILENCIA.test(l))).map((a) => a.caminho)
  if (silenciados.length) notas.push(`Checagem silenciada (type: ignore, noqa, ts-ignore, eslint-disable, any) em ${lista(silenciados)}: confira se o problema não foi só escondido.`)

  // 4. Código comentado (3 linhas ou mais num arquivo).
  const comentados = arquivos.filter((a) => a.adicionadas.filter((l) => CODIGO_COMENTADO.test(l)).length >= 3).map((a) => a.caminho)
  if (comentados.length) notas.push(`Código comentado adicionado em ${lista(comentados)}: o versionamento já guarda o que saiu.`)

  // 5. Pendência marcada.
  const marcadores = arquivos.reduce((n, a) => n + a.adicionadas.filter((l) => MARCADOR.test(l)).length, 0)
  if (marcadores) notas.push(`${marcadores} marcador(es) TODO/FIXME/HACK novo(s): trabalho deixado pela metade?`)

  // 6. Depuração esquecida (fora dos testes).
  const depuracao = deCodigo.filter((a) => a.adicionadas.some((l) => DEPURACAO.test(l))).map((a) => a.caminho)
  if (depuracao.length) notas.push(`Saída de depuração (print, console.log, breakpoint) em ${lista(depuracao)}: era para ficar?`)

  if (cortado) notas.push('O diff é grande demais para ler inteiro: a auditoria de slop foi parcial.')
  const achados: Achado[] = [...graves.map((g) => `Os testes ficaram mais fracos: ${g}.`), ...notas].map((texto, i) => ({ id: `SLP-${i + 1}`, severidade: 'note', trilha: 'review', texto }))
  return { achados, enfraquece: graves.length ? graves.join('; ') : null, tocouTestes: deTeste.length > 0, cortado }
}

/** O check que só existe quando o diff mexe em teste: os testes foram preservados? */
export function checkDosTestes(a: AuditoriaDeSlop): Check | null {
  if (!a.tocouTestes) return null
  return a.enfraquece
    ? { nome: 'testes-preservados', resultado: 'FAIL', comando: null, evidencia: `O diff enfraquece os testes: ${a.enfraquece}.` }
    : { nome: 'testes-preservados', resultado: 'PASS', comando: null, evidencia: 'O diff mexe em testes sem desligar, focar, apagar nem reduzir asserções.' }
}
