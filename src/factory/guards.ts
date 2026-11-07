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

function segmentosDe(texto: string): { host: string; segs: string[] } | null {
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(texto)) {
      const url = new URL(texto) // o usuário e a senha do endereço (https://token@…) são descartados aqui
      return { host: url.hostname.toLowerCase(), segs: url.pathname.split('/').filter(Boolean).map((parte) => decodeURIComponent(parte)) }
    }
    const ssh = /^[^@/\s]+@([^:/\s]+):(.+)$/.exec(texto)
    if (ssh) return { host: (ssh[1] ?? '').toLowerCase(), segs: (ssh[2] ?? '').split('/').filter(Boolean) }
    const solto = /^((?:[a-z0-9-]+\.)+[a-z]{2,})\/(.+)$/i.exec(texto)
    if (solto && /(^|\.)(github\.com|dev\.azure\.com|visualstudio\.com)$/i.test(solto[1] ?? '')) {
      return { host: (solto[1] ?? '').toLowerCase(), segs: (solto[2] ?? '').split('/').filter(Boolean) }
    }
  } catch {}
  return null
}

/**
 * Aceita o que a pessoa copia do navegador ou do git: https://github.com/acme/pedidos(.git),
 * git@github.com:acme/pedidos.git, https://dev.azure.com/org/Projeto/_git/repo,
 * https://org.visualstudio.com/Projeto/_git/repo e git@ssh.dev.azure.com:v3/org/Projeto/repo.
 * Devolve owner/repo no GitHub e projeto ou projeto/repositorio no Azure DevOps.
 * Um endereço de outro provedor passa sem mudar, e a validação explica o erro.
 */
export function normalizarRepositorio(provedor: 'github' | 'azure-devops', valor: string): string {
  const texto = valor.trim().replace(/\/+$/, '')
  const partes = segmentosDe(texto)
  if (!partes) return provedor === 'github' ? texto.replace(/\.git$/i, '') : texto
  const { host, segs } = partes
  if (provedor === 'github') {
    if ((host === 'github.com' || host === 'www.github.com') && segs.length >= 2) {
      return `${segs[0]}/${(segs[1] ?? '').replace(/\.git$/i, '')}`
    }
    return texto
  }
  let projeto: string | undefined
  let repositorio: string | undefined
  if (host === 'dev.azure.com') {
    projeto = segs[1]
    repositorio = segs[2] === '_git' ? segs[3] : undefined
  } else if (host === 'ssh.dev.azure.com') {
    projeto = segs[2]
    repositorio = segs[3]
  } else if (host.endsWith('.visualstudio.com')) {
    projeto = segs[0]
    repositorio = segs[1] === '_git' ? segs[2] : undefined
  } else {
    return texto
  }
  if (!projeto) return texto
  return repositorio ? `${projeto}/${repositorio.replace(/\.git$/i, '')}` : projeto
}

export function dividirRepositorio(valor: string): { owner: string; name: string } {
  const partes = valor.trim().split('/')
  if (partes.length !== 2) {
    if (/dev\.azure\.com|visualstudio\.com|_git/i.test(valor)) {
      throw new Error('Este repositório parece ser do Azure DevOps. Escolha o provedor azure-devops e use projeto/repositorio.')
    }
    throw new Error('Repositório GitHub precisa ser owner/repo, por exemplo acme/pedidos. O endereço copiado do navegador também serve.')
  }
  return { owner: segmento(partes[0] ?? '', 'Dono'), name: segmento(partes[1] ?? '', 'Repositório') }
}

export function dividirAzure(valor: string): { project: string; repository: string | null } {
  const partes = valor.trim().split('/')
  if (partes.length === 1) return { project: segmento(partes[0] ?? '', 'Projeto'), repository: null }
  if (partes.length === 2) {
    return { project: segmento(partes[0] ?? '', 'Projeto'), repository: segmento(partes[1] ?? '', 'Repositório') }
  }
  if (/github\.com/i.test(valor)) {
    throw new Error('Este repositório parece ser do GitHub. Escolha o provedor github e use owner/repo.')
  }
  throw new Error('Azure DevOps espera projeto ou projeto/repositorio. O endereço copiado do navegador também serve.')
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
