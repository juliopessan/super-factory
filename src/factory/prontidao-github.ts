// Prontidão de um repositório lida direto do GitHub, sem clonar: serve para o chat responder "esse repositório
// está pronto para a Factory trabalhar nele?" antes de ligar a autonomia. Só lê.

import { lerProtecaoDeBranchGithub, type ResultadoDaLeitura } from './github-leitura.ts'
import { avaliarProntidao, prontidaoEmTexto, type Prontidao } from './mapa.ts'
import { lerArquivoGithub, listarArquivosGithub } from './repositorio.ts'
import { extrasDoNode } from './verificacao.ts'

export type ProntidaoDoGithub = Prontidao & { branch: string; protecao: string }

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
  let comandoDeTeste: string | null = null
  let extras: string[] = []
  if (arquivos.includes('package.json')) {
    const pacote = await lerArquivoGithub(repositorio, usada, 'package.json')
    try {
      const scripts = (JSON.parse(pacote.conteudo) as { scripts?: Record<string, string> }).scripts ?? {}
      const alvo = ['test', 'check'].find((n) => scripts[n] && !/no test specified/.test(scripts[n] ?? ''))
      comandoDeTeste = alvo ? `npm run ${alvo}` : null
      extras = extrasDoNode(scripts, 'npm', comandoDeTeste).map((e) => e.nome)
    } catch {}
  } else if (arquivos.includes('go.mod')) {
    comandoDeTeste = 'go test ./...'
    extras = ['lint', 'build']
  } else if (arquivos.some((a) => /\.(sln|csproj)$/.test(a))) {
    comandoDeTeste = 'dotnet test'
    extras = ['build']
  } else if (arquivos.includes('pyproject.toml') || arquivos.includes('requirements.txt')) {
    comandoDeTeste = 'python -m unittest discover'
  } else if (arquivos.includes('Makefile')) {
    comandoDeTeste = null
  }
  const prontidao = avaliarProntidao({ arquivos, comandoDeTeste, extras })
  const protecao = await lerProtecaoDeBranchGithub(repositorio, usada)
  const textoDaProtecao = protecao.dado
    ? protecao.dado.exigePullRequest
      ? `A branch ${usada} exige pull request${protecao.dado.aprovacoesExigidas ? ` com ${protecao.dado.aprovacoesExigidas} aprovação(ões)` : ''}: o merge fica com uma pessoa.`
      : `A branch ${usada} NÃO exige pull request: configure a proteção para o merge ficar com uma pessoa.`
    : `Proteção da branch não lida: ${protecao.nota}`
  return { ok: true, dado: { ...prontidao, branch: usada, protecao: textoDaProtecao }, nota: `${prontidaoEmTexto(prontidao)} ${textoDaProtecao}${lista.truncado ? ' (lista de arquivos cortada: o resultado pode subestimar)' : ''}` }
}
