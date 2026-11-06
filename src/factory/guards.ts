const AWS = /AKIA[0-9A-Z]{16}/
const GITHUB = /ghp_[A-Za-z0-9]{20,}/
const GITHUB_PAT = /github_pat_[A-Za-z0-9_]{20,}/
const CHAVE = /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/
const ATRIBUIDO = /(api[_-]?key|token|password|secret|pat)\s*[:=]\s*['"][^'"]{8,}['"]/gi

export function varrerSegredos(texto: string): { encontrado: boolean; rotulos: string[] } {
  const rotulos: string[] = []
  if (AWS.test(texto)) rotulos.push('chave-aws')
  if (GITHUB.test(texto)) rotulos.push('token-github')
  if (GITHUB_PAT.test(texto)) rotulos.push('pat-github')
  if (CHAVE.test(texto)) rotulos.push('chave-privada')
  if (ATRIBUIDO.test(texto)) rotulos.push('credencial-atribuida')
  return { encontrado: rotulos.length > 0, rotulos }
}

export function redigirSegredos(texto: string): string {
  return texto
    .replace(CHAVE, '[segredo]')
    .replace(AWS, '[segredo]')
    .replace(GITHUB_PAT, '[segredo]')
    .replace(GITHUB, '[segredo]')
    .replace(ATRIBUIDO, '[segredo]')
}

export function pedidoPerigoso(texto: string): string[] {
  const motivos: string[] = []
  if (/push\s+--force|\bgit\s+push\s+-f\b|force-push|push\s+for[cç]ado/i.test(texto)) {
    motivos.push('A fábrica não faz force-push.')
  }
  if (/commit\s+direto\s+(na|em)\s+(main|master)|push\s+(direto\s+)?(para|pra|na|em)\s+(a\s+)?(main|master)/i.test(texto)) {
    motivos.push('A fábrica não grava direto na branch protegida.')
  }
  if (/pula(r)?\s+o\s+review|sem\s+revis[aã]o|auto-?merge|merge\s+autom[aá]tico/i.test(texto)) {
    motivos.push('Merge exige o portão humano.')
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
