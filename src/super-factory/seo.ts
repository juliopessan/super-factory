// SEO e GEO da landing: metadados sociais, dados estruturados (schema.org), FAQ visível, robots, sitemap e llms.txt.
// O FAQ é uma fonte só: o mesmo texto vira a seção da página e o FAQPage do JSON-LD (o buscador exige que batam).
// URLs absolutas (canonical, og:image, hreflang) só saem quando SUPER_FACTORY_PUBLIC_URL está definida: sem o
// endereço público, a Factory não inventa um.

import type { Idioma } from './landing.ts'

export type Pergunta = { p: string; r: string }

export const FAQ: Record<Idioma, Pergunta[]> = {
  pt: [
    { p: 'O que é a Super Factory?', r: 'Uma fábrica de software com agentes. Ela lê a demanda num work item do Azure DevOps ou numa issue do GitHub, implementa num container Docker descartável, roda os testes do seu repositório e abre o pull request pronto para revisão. Uma pessoa revisa e faz o merge.' },
    { p: 'A Factory faz merge ou deploy?', r: 'Não. Ela não faz merge, não faz push em main ou master e não coloca nada em produção. A única decisão humana do processo é o merge, e tudo antes dele a Factory executa.' },
    { p: 'Em que ela é diferente de um agente de código ou de um IDE com IA?', r: 'Um agente de código escreve código. A Factory cuida do processo em volta: triagem do pedido (recusa pedido vago, segredo ou force-push), um sandbox isolado por card, testes, evidência e pull request. Hoje o construtor é um agente próprio, com Claude por padrão.' },
    { p: 'Como ela trabalha com várias tarefas ao mesmo tempo?', r: 'Numa onda, que roda até 8 cards (5 ao mesmo tempo), cada um com sandbox, branch e pull request próprios. Tarefas que dependem uma da outra viram pull requests em pilha: o card filho nasce da branch do pai, e o merge segue de baixo para cima. Se o pai falha, o filho fica bloqueado.' },
    { p: 'Que evidência vem no pull request?', r: 'O comando de teste que rodou no sandbox, o código de saída e o que ficou de fora. O resultado só é PASS com evidência observada: o que um agente apenas relata não conta.' },
    { p: 'Posso rodar na minha própria infraestrutura?', r: 'Sim. A Factory é auto-hospedada (Docker, por exemplo numa VPS), guarda as chaves num cofre criptografado, tem login com GitHub e libera o acesso pela lista de espera.' },
    { p: 'Como peço acesso?', r: 'Pela lista de espera: um formulário curto de qualificação para pessoas e empresas. O acesso é liberado aos poucos por uma pessoa da equipe.' },
  ],
  en: [
    { p: 'What is Super Factory?', r: 'A software factory run by agents. It reads the request from an Azure DevOps work item or a GitHub issue, builds it in a disposable Docker container, runs your repository\'s tests and opens a pull request ready for review. A person reviews and merges.' },
    { p: 'Does the Factory merge or deploy?', r: 'No. It does not merge, does not push to main or master and puts nothing in production. The only human decision in the process is the merge; the Factory does everything before it.' },
    { p: 'How is it different from a coding agent or an AI IDE?', r: 'A coding agent writes code. The Factory runs the process around it: request triage (it refuses vague requests, secrets and force-pushes), an isolated sandbox per card, tests, evidence and the pull request. Today the builder is its own agent, using Claude by default.' },
    { p: 'How does it handle several tasks at once?', r: 'In a wave, which runs up to 8 cards (5 at a time), each with its own sandbox, branch and pull request. Tasks that depend on each other become stacked pull requests: the child card starts from the parent\'s branch, and merging goes bottom-up. If the parent fails, the child is blocked.' },
    { p: 'What evidence comes with the pull request?', r: 'The test command that ran in the sandbox, its exit code and what was left out. A result is only PASS with observed evidence: what an agent merely reports does not count.' },
    { p: 'Can I run it on my own infrastructure?', r: 'Yes. The Factory is self-hosted (Docker, for example on a VPS), keeps keys in an encrypted vault, has GitHub login and opens access through the waitlist.' },
    { p: 'How do I request access?', r: 'Through the waitlist: a short qualification form for people and companies. Access is opened gradually by a member of the team.' },
  ],
}

const TEXTOS = {
  pt: {
    descricao: 'A programação morreu. A engenharia não. A Super Factory lê a demanda no Azure DevOps ou no GitHub, implementa e testa num container e abre o pull request. Você decide o merge.',
    titulo: 'Super Factory: do pedido ao pull request, com o merge na mão de uma pessoa',
    faqTitulo: 'Perguntas frequentes',
    faqLead: 'Respostas diretas sobre o que a Factory faz, o que ela se recusa a fazer e como pedir acesso.',
    locale: 'pt_BR',
    outro: 'en_US',
    alt: 'Super Factory: a programação morreu, a engenharia não. Abrir a Factory.',
    recursos: ['Do work item ou da issue ao pull request', 'Um sandbox Docker isolado por card', 'Testes com evidência observada, não relatada', 'PRs em pilha para tarefas dependentes', 'O merge é sempre de uma pessoa'],
  },
  en: {
    descricao: 'Programming is dead. Engineering is not. Super Factory reads the request from Azure DevOps or GitHub, builds and tests it in a container, and opens the pull request. You decide the merge.',
    titulo: 'Super Factory: from request to pull request, with the merge in a person\'s hands',
    faqTitulo: 'Frequently asked questions',
    faqLead: 'Direct answers about what the Factory does, what it refuses to do and how to request access.',
    locale: 'en_US',
    outro: 'pt_BR',
    alt: 'Super Factory: programming is dead, engineering is not. Open the Factory.',
    recursos: ['From work item or issue to pull request', 'One isolated Docker sandbox per card', 'Tests with observed, not reported, evidence', 'Stacked PRs for dependent tasks', 'The merge is always a person\'s'],
  },
} as const

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/

/** Endereço público da Factory, só se estiver definido e for seguro (https, ou localhost em desenvolvimento). */
export function urlPublica(env: NodeJS.ProcessEnv = process.env): string | null {
  try {
    const url = new URL((env.SUPER_FACTORY_PUBLIC_URL ?? '').trim())
    if (url.protocol === 'https:' || (url.protocol === 'http:' && LOCAL.test(url.hostname))) return url.origin
  } catch {
    // sem endereço público
  }
  return null
}

function esc(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

/** JSON dentro de <script>: o "<" vira <, então nenhum texto consegue fechar a tag. */
function jsonSeguro(dado: unknown): string {
  return JSON.stringify(dado).replace(/</g, '\\u003c')
}

export function dadosEstruturados(idioma: Idioma, base: string | null): Record<string, unknown> {
  const t = TEXTOS[idioma]
  const caminho = idioma === 'en' ? '/en' : '/'
  const grafo: Array<Record<string, unknown>> = [
    {
      '@type': 'WebSite',
      name: 'Super Factory',
      inLanguage: idioma === 'en' ? 'en-US' : 'pt-BR',
      ...(base ? { url: `${base}${caminho}` } : {}),
    },
    {
      '@type': 'SoftwareApplication',
      name: 'Super Factory',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Docker (Linux, macOS)',
      description: t.descricao,
      featureList: [...t.recursos],
      ...(base ? { url: `${base}${caminho}` } : {}),
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQ[idioma].map((q) => ({ '@type': 'Question', name: q.p, acceptedAnswer: { '@type': 'Answer', text: q.r } })),
    },
  ]
  return { '@context': 'https://schema.org', '@graph': grafo }
}

/** Tags do <head>: Open Graph, Twitter, canonical/hreflang (com endereço público) e o JSON-LD. */
export function blocoSeo(idioma: Idioma, base: string | null = urlPublica()): string {
  const t = TEXTOS[idioma]
  const caminho = idioma === 'en' ? '/en' : '/'
  const linhas = [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Super Factory" />`,
    `<meta property="og:title" content="${esc(t.titulo)}" />`,
    `<meta property="og:description" content="${esc(t.descricao)}" />`,
    `<meta property="og:locale" content="${t.locale}" />`,
    `<meta property="og:locale:alternate" content="${t.outro}" />`,
    `<meta name="twitter:card" content="${base ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${esc(t.titulo)}" />`,
    `<meta name="twitter:description" content="${esc(t.descricao)}" />`,
  ]
  if (base) {
    linhas.push(
      `<link rel="canonical" href="${base}${caminho}" />`,
      `<link rel="alternate" hreflang="pt-BR" href="${base}/" />`,
      `<link rel="alternate" hreflang="en" href="${base}/en" />`,
      `<link rel="alternate" hreflang="x-default" href="${base}/" />`,
      `<meta property="og:url" content="${base}${caminho}" />`,
      `<meta property="og:image" content="${base}/motion/super-factory-og.jpg" />`,
      `<meta property="og:image:width" content="1200" />`,
      `<meta property="og:image:height" content="630" />`,
      `<meta property="og:image:alt" content="${esc(t.alt)}" />`,
      `<meta name="twitter:image" content="${base}/motion/super-factory-og.jpg" />`,
    )
  }
  linhas.push(`<script type="application/ld+json">${jsonSeguro(dadosEstruturados(idioma, base))}</script>`)
  return linhas.join('\n  ')
}

/** A seção de perguntas. Sem id na <section>: o menu da página lista só as seções com id, e o cabeçalho já está cheio. */
export function secaoFaq(idioma: Idioma): string {
  const t = TEXTOS[idioma]
  const itens = FAQ[idioma].map((q) => `<details><summary>${esc(q.p)}</summary><p>${esc(q.r)}</p></details>`).join('\n          ')
  return `<style>
    #perguntas .faq { display: grid; gap: 10px; margin: 24px auto 0; max-width: 820px; }
    #perguntas details { border: 1px solid var(--line); border-radius: 16px; background: var(--card); padding: 0 18px; }
    #perguntas summary { cursor: pointer; padding: 15px 0; font-weight: 500; list-style: none; display: flex; justify-content: space-between; gap: 16px; }
    #perguntas summary::-webkit-details-marker { display: none; }
    #perguntas summary::after { content: "+"; color: var(--muted); font-family: var(--mono); }
    #perguntas details[open] summary::after { content: "–"; }
    #perguntas details p { margin: 0 0 16px; color: var(--muted); }
    #perguntas summary:focus-visible { outline: 2px solid var(--text); outline-offset: 4px; border-radius: 8px; }
  </style>
    <section aria-labelledby="perguntas-titulo">
      <div class="wrap" id="perguntas">
        <div class="cabeca" data-revela>
          <h2 id="perguntas-titulo">${esc(t.faqTitulo)}</h2>
          <p>${esc(t.faqLead)}</p>
        </div>
        <div class="faq" data-revela>
          ${itens}
        </div>
      </div>
    </section>`
}

const CABECALHOS_TEXTO = { 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' }

export function respostaRobots(base: string | null = urlPublica()): Response {
  const linhas = ['User-agent: *', 'Allow: /', 'Disallow: /studio', 'Disallow: /api', 'Disallow: /admin', 'Disallow: /auth', 'Disallow: /login', 'Disallow: /configuracoes', 'Disallow: /factory']
  if (base) linhas.push('', `Sitemap: ${base}/sitemap.xml`)
  return new Response(`${linhas.join('\n')}\n`, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CABECALHOS_TEXTO } })
}

/** Sem endereço público não há sitemap: a URL de um sitemap tem de ser absoluta. */
export function respostaSitemap(base: string | null = urlPublica()): Response {
  if (!base) return new Response('', { status: 404 })
  const par = (caminho: string) => [`<xhtml:link rel="alternate" hreflang="pt-BR" href="${base}/" />`, `<xhtml:link rel="alternate" hreflang="en" href="${base}/en" />`].map((l) => `    ${l}`).join('\n') + `\n    <loc>${base}${caminho}</loc>`
  const urls = ['/', '/en'].map((c) => `  <url>\n${par(c)}\n  </url>`)
  urls.push(`  <url>\n    <loc>${base}/waitlist</loc>\n  </url>`)
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`
  return new Response(xml, { status: 200, headers: { 'Content-Type': 'application/xml; charset=utf-8', ...CABECALHOS_TEXTO } })
}

/** llms.txt: um resumo em texto simples para quem consulta a Factory por um assistente de IA. */
export function respostaLlms(base: string | null = urlPublica()): Response {
  const url = (caminho: string) => (base ? `${base}${caminho}` : caminho)
  const corpo = [
    '# Super Factory',
    '',
    '> Fábrica de software com agentes: lê a demanda no Azure DevOps ou no GitHub, implementa num container Docker descartável, roda os testes do repositório e abre o pull request. A única decisão humana é o merge. A Factory não faz merge, não faz push em main e não faz deploy.',
    '',
    '## Links',
    `- [Página inicial](${url('/')}): o que é e como funciona`,
    `- [English](${url('/en')}): the same page in English`,
    `- [Lista de espera](${url('/waitlist')}): como pedir acesso (formulário de qualificação)`,
    '- [Código e documentação](https://github.com/juliopessan/super-factory): README com o passo a passo',
    '',
    '## Perguntas e respostas',
    ...FAQ.pt.flatMap((q) => [`### ${q.p}`, q.r, '']),
  ].join('\n')
  return new Response(`${corpo}\n`, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CABECALHOS_TEXTO } })
}
