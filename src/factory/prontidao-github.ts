// Prontidão de um repositório lida direto do GitHub, sem clonar: serve para o chat responder "esse repositório
// está pronto para a Factory trabalhar nele?" antes de ligar a autonomia. Só lê.

import { lerProtecaoDeBranchGithub, type ResultadoDaLeitura } from './github-leitura.ts'
import { avaliarProntidao, prontidaoEmTexto, type Prontidao } from './mapa.ts'
import { lerArquivoGithub, listarArquivosGithub } from './repositorio.ts'
import { escolherPasta } from './projeto-pasta.ts'
import { extrasDoNode } from './verificacao.ts'

export type ProntidaoDoGithub = Prontidao & { branch: string; protecao: string; pasta: string }

export async function diagnosticarProntidaoGithub(repositorio: string, branch?: string): Promise<ResultadoDaLeitura<ProntidaoDoGithub>> {
  const falha = (nota: string) => ({ ok: false, dado: null, nota })
  let usada = branch ?? 'main'
  let lista = await listarArquivosGithub(repositorio, usada)
  if (!lista.ok && !branch) {
    usada = 'master'
    lista = await listarArquivosGithub(repositorio, usada)
  }
  if (!lista.ok) return falha(lista.nota ?? 'Não consegui listar os arquivos.')
  const arquivos = lista.arquivos.map((a) => a.caminho)
  // O projeto pode estar numa subpasta (src-maf/, backend/): a mesma regra do modo autônomo.
  const manifestos = arquivos.filter((c) => c.split('/').length <= 2 && /^(package\.json|pyproject\.toml|requirements\.txt|go\.mod|Makefile|[^/]+\.(sln|csproj))$/.test(c.split('/').pop() ?? ''))
  const pasta = escolherPasta(manifestos)?.pasta ?? ''
  const daPasta = pasta ? arquivos.filter((c) => c.startsWith(`${pasta}/`) && c.split('/').length === 2).map((c) => c.split('/')[1]!) : arquivos.filter((c) => !c.includes('/'))
  const caminho = (nome: string) => (pasta ? `${pasta}/${nome}` : nome)
  let comandoDeTeste: string | null = null
  let extras: string[] = []
  if (daPasta.includes('package.json')) {
    const pacote = await lerArquivoGithub(repositorio, usada, caminho('package.json'))
    try {
      const scripts = (JSON.parse(pacote.conteudo) as { scripts?: Record<string, string> }).scripts ?? {}
      const alvo = ['test', 'check'].find((n) => scripts[n] && !/no test specified/.test(scripts[n] ?? ''))
      comandoDeTeste = alvo ? `npm run ${alvo}` : null
      extras = extrasDoNode(scripts, 'npm', comandoDeTeste).map((e) => e.nome)
    } catch {}
  } else if (daPasta.includes('go.mod')) {
    comandoDeTeste = 'go test ./...'
    extras = ['lint', 'build']
  } else if (daPasta.some((a) => /\.(sln|csproj)$/.test(a))) {
    comandoDeTeste = 'dotnet test'
    extras = ['build']
  } else if (daPasta.includes('pyproject.toml') || daPasta.includes('requirements.txt')) {
    const declarado = daPasta.includes('pyproject.toml') ? (await lerArquivoGithub(repositorio, usada, caminho('pyproject.toml'))).conteudo : ''
    comandoDeTeste = /pytest/i.test(declarado) || daPasta.includes('pytest.ini') ? 'python -m pytest -q' : 'python -m unittest discover'
    if (/ruff/i.test(declarado) || daPasta.includes('ruff.toml')) extras = ['lint']
  } else if (daPasta.includes('Makefile')) {
    comandoDeTeste = null
  }
  const prontidao = avaliarProntidao({ arquivos: [...arquivos, ...daPasta], comandoDeTeste, extras })
  const protecao = await lerProtecaoDeBranchGithub(repositorio, usada)
  const textoDaProtecao = protecao.dado
    ? protecao.dado.exigePullRequest
      ? `A branch ${usada} exige pull request${protecao.dado.aprovacoesExigidas ? ` com ${protecao.dado.aprovacoesExigidas} aprovação(ões)` : ''}: o merge fica com uma pessoa.`
      : `A branch ${usada} NÃO exige pull request: configure a proteção para o merge ficar com uma pessoa.`
    : `Proteção da branch não lida: ${protecao.nota}`
  return { ok: true, dado: { ...prontidao, branch: usada, protecao: textoDaProtecao, pasta }, nota: `${pasta ? `Projeto em ${pasta}/. ` : ''}${prontidaoEmTexto(prontidao)} ${textoDaProtecao}${lista.truncado ? ' (lista de arquivos cortada: o resultado pode subestimar)' : ''}` }
}
