// Lógica do chat do Studio que roda no navegador e também nos testes: é escrita como texto de JavaScript puro
// (sem tipos) para ser injetada nos scripts do Studio e avaliada em check.ts com o mesmo código.

/**
 * Acha os nomes de ferramenta no texto de uma mensagem. O Studio mostra "IniciarOnda" e "StatusQuadro",
 * com a primeira letra maiúscula, então a comparação ignora maiúsculas e aceita a forma com hífen (iniciar-onda).
 * Devolve [{ nome, pos }], com a posição da última ocorrência de cada um.
 */
export const CODIGO_FERRAMENTAS_NO_CHAT = String.raw`
function sfFerramentasNoTexto(texto, nomes) {
  var baixo = String(texto || '').toLowerCase()
  var achados = []
  nomes.forEach(function (nome) {
    var kebab = nome.replace(/([A-Z])/g, '-$1').toLowerCase()
    var a = Math.max(baixo.lastIndexOf(nome.toLowerCase()), baixo.lastIndexOf(kebab))
    if (a >= 0) achados.push({ nome: nome, pos: a })
  })
  return achados
}`

/**
 * O que a pessoa provavelmente quer fazer depois que o agente usou cada ferramenta. "peso" decide quando várias
 * aparecem na mesma resposta: o passo mais adiantado do ciclo vence (iniciar a onda pesa mais que ler o quadro).
 */
export const ETAPAS_POR_FERRAMENTA: Record<string, { peso: number; sugestao: string }> = {
  iniciarOnda: { peso: 10, sugestao: 'Como está o quadro agora?' },
  importarIssuesGithub: { peso: 9, sugestao: 'Inicie a onda com os cards novos que não estão bloqueados' },
  criarProjetoGithub: { peso: 9, sugestao: 'Adicione as issues abertas ao Project e ordene por prioridade' },
  criarMilestoneGithub: { peso: 8, sugestao: 'Coloque as issues nesse milestone e atribua a mim' },
  atribuirIssuesGithub: { peso: 8, sugestao: 'Leia o Project de novo e confira o resultado' },
  organizarProjetoGithub: { peso: 8, sugestao: 'Leia o Project de novo e confira o resultado' },
  comentarPullRequestGithub: { peso: 8, sugestao: 'Como está o quadro agora?' },
  abrirCard: { peso: 7, sugestao: 'Inicie a onda com este card' },
  planejarOnda: { peso: 6, sugestao: 'Inicie a onda com esses cards' },
  lerPullRequestGithub: { peso: 5, sugestao: 'Deixe a revisão como comentário no pull request' },
  lerProjetoGithub: { peso: 5, sugestao: 'Organize o Project por prioridade' },
  listarGithub: { peso: 5, sugestao: 'Importe as issues etiquetadas e abra os cards' },
  avaliarGateMerge: { peso: 5, sugestao: 'O que falta para liberar o merge?' },
  lintarCriterios: { peso: 4, sugestao: 'Abra o card com esses critérios' },
  listarBranchesGithub: { peso: 3, sugestao: 'Compare as branches e diga qual merece prioridade' },
  compararBranchesGithub: { peso: 4, sugestao: 'Abra cards para as branches que merecem prioridade' },
  statusQuadro: { peso: 2, sugestao: 'Planeje a próxima onda de cards' },
  lerLedger: { peso: 1, sugestao: 'O que ainda está em NOT_RUN e por quê?' },
}

/**
 * A próxima etapa a sugerir no campo de texto, a partir da última mensagem do agente.
 *  1. Se o agente terminou oferecendo algo ("Você quer que eu inicie a onda com #2, #3 e #4?"), a sugestão é a
 *     resposta natural ("Sim, inicie a onda com #2, #3 e #4."). A pessoa lê no campo e confirma com Enter.
 *  2. Senão, se a resposta usou ferramentas, o passo seguinte do ciclo (ETAPAS_POR_FERRAMENTA).
 *  3. Senão, vazio: vale a lista fixa do agente.
 * "texto" é a parte escrita da mensagem; "completo" inclui os nomes das ferramentas.
 */
export const CODIGO_PROXIMA_ETAPA = String.raw`
function sfProximaEtapa(texto, completo, etapas) {
  function limpar(t) {
    // Tira só o markdown (título, citação, negrito, itálico, crase). "#2" e "NOT_RUN" ficam como estão.
    return String(t || '')
      .replace(/[\u0000-\u001f\u007f]+/g, ' ')
      .replace(/^\s*(#{1,6}\s+|>\s*)/, '')
      .replace(/[*\x60]/g, '')
      .replace(/(^|\s)_+|_+(?=\s|$)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
  }
  var linhas = String(texto || '').split(/\n+/).map(limpar).filter(Boolean)
  var pergunta = ''
  for (var i = linhas.length - 1; i >= 0 && i >= linhas.length - 3 && !pergunta; i--) {
    var frases = linhas[i].match(/[^.!?]*[.!?]+/g) || [linhas[i]]
    for (var j = frases.length - 1; j >= 0; j--) {
      var f = frases[j].trim()
      if (/[?]$/.test(f)) { pergunta = f; break }
    }
  }
  if (pergunta) {
    var m = /^(?:e\s+)?(?:voc[eê]\s+)?(?:quer|deseja|gostaria)\s+que\s+eu\s+(.+?)\s*[?]$/i.exec(pergunta)
    if (m) return ('Sim, ' + m[1] + '.').slice(0, 200)
    m = /^(?:posso|devo)\s+(.+?)\s*[?]$/i.exec(pergunta)
    if (m) return ('Sim, pode ' + m[1] + '.').slice(0, 200)
    m = /^podemos\s+(.+?)\s*[?]$/i.exec(pergunta)
    if (m) return ('Sim, vamos ' + m[1] + '.').slice(0, 200)
    if (/\b(quer|deseja|confirma|posso|devo|podemos)\b/i.test(pergunta)) return 'Sim, pode seguir.'
    return ''
  }
  var achados = sfFerramentasNoTexto(completo, Object.keys(etapas))
  var melhor = null
  achados.forEach(function (a) {
    if (!melhor || etapas[a.nome].peso > etapas[melhor.nome].peso || (etapas[a.nome].peso === etapas[melhor.nome].peso && a.pos > melhor.pos)) melhor = a
  })
  return melhor ? etapas[melhor.nome].sugestao : ''
}`
