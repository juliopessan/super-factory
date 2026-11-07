// Cada padrão tem um rótulo. O marcador [segredo:rotulo] é o que fica no lugar
// do valor: a entrada da API já chega assim, e a triagem continua bloqueando.
const PADROES: Array<[string, RegExp]> = [
  ['chave-privada', /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g],
  ['chave-aws', /AKIA[0-9A-Z]{16}/g],
  ['pat-github', /github_pat_[A-Za-z0-9_]{20,}/g],
  ['token-github', /gh[pousr]_[A-Za-z0-9]{20,}/g],
  ['credencial-atribuida', /(api[_-]?key|token|password|secret|pat)\s*[:=]\s*['"][^'"]{8,}['"]/gi],
]
const MARCADOR = /\[segredo:([a-z-]+)\]/g

export function varrerSegredos(texto: string): { encontrado: boolean; rotulos: string[] } {
  const rotulos = new Set<string>()
  for (const [rotulo, padrao] of PADROES) {
    if (texto.match(padrao)) rotulos.add(rotulo)
  }
  for (const marca of texto.matchAll(MARCADOR)) rotulos.add(marca[1] ?? 'segredo')
  return { encontrado: rotulos.size > 0, rotulos: [...rotulos] }
}

/** Troca todo segredo por [segredo:rotulo]. Usado na porta da API, antes de qualquer gravação. */
export function marcarSegredos(texto: string): string {
  let saida = texto
  for (const [rotulo, padrao] of PADROES) saida = saida.replace(padrao, `[segredo:${rotulo}]`)
  return saida
}

export function redigirSegredos(texto: string): string {
  let saida = texto.replace(MARCADOR, '[segredo]')
  for (const [, padrao] of PADROES) saida = saida.replace(padrao, '[segredo]')
  return saida
}

export function pedidoPerigoso(texto: string): string[] {
  const motivos: string[] = []
  if (/push\s+--force|\bgit\s+push\s+-f\b|force-push|push\s+for[cç]ado/i.test(texto)) {
    motivos.push('A Factory não faz force-push.')
  }
  if (/commit\s+direto\s+(na|em)\s+(main|master)|push\s+(direto\s+)?(para|pra|na|em)\s+(a\s+)?(main|master)/i.test(texto)) {
    motivos.push('A Factory não grava direto na branch protegida.')
  }
  if (/pula(r)?\s+o\s+review|sem\s+revis[aã]o|auto-?merge|merge\s+autom[aá]tico/i.test(texto)) {
    motivos.push('Merge exige o gate humano.')
  }
  if (/\b(deploy|publica(r|ção)?)\s+(agora|autom[aá]tico|em produ[cç][aã]o)/i.test(texto)) {
    motivos.push('Release não faz deploy.')
  }
  return motivos
}

export function segmento(valor: string, rotulo: string): string {
  const limpo = valor.trim()
  if (!/^[A-Za-z0-9_.-]{1,64}$/.test(limpo)) {
    throw new Error(`${rotulo} inválido.`)
  }
  return limpo
}

export function validarBranch(nome: string): string {
  const limpo = nome.trim()
  if (!limpo || limpo.length > 120 || limpo.startsWith('/') || limpo.includes('..') || /[\s@:\\]/.test(limpo)) {
    throw new Error('Branch inválida.')
  }
  const partes = limpo.split('/')
  if (partes.some((parte) => !/^[A-Za-z0-9._-]{1,64}$/.test(parte))) throw new Error('Branch inválida.')
  return limpo
}

export function dividirRepositorio(valor: string): { owner: string; name: string } {
  const partes = valor.trim().split('/')
  if (partes.length !== 2) throw new Error('Repositório GitHub precisa ser owner/repo.')
  return { owner: segmento(partes[0] ?? '', 'Dono'), name: segmento(partes[1] ?? '', 'Repositório') }
}

export function dividirAzure(valor: string): { project: string; repository: string | null } {
  const partes = valor.trim().split('/')
  if (partes.length === 1) return { project: segmento(partes[0] ?? '', 'Projeto'), repository: null }
  if (partes.length === 2) {
    return { project: segmento(partes[0] ?? '', 'Projeto'), repository: segmento(partes[1] ?? '', 'Repositório') }
  }
  throw new Error('Azure DevOps espera projeto ou projeto/repositorio.')
}

const PROTEGIDAS = new Set(['main', 'master'])

export function validarRascunho(base: string, head: string | null): string | null {
  if (!head) return null
  if (head === base) return 'A branch de origem é a mesma da base.'
  if (PROTEGIDAS.has(head)) return 'A origem do pull request não pode ser a branch protegida.'
  return null
}

export function semSegredo(texto: string, segredos: string[]): string {
  let saida = texto
  for (const segredo of segredos) {
    if (segredo) saida = saida.split(segredo).join('[segredo]')
  }
  return saida.replace(/\s+/g, ' ').slice(0, 180)
}
