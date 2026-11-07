// Limpa segredos que já estão gravados no factory.db (snapshots de workflow,
// memória, spans). A partir da redação na porta da API, nada novo entra;
// este script cuida do que entrou antes. Uso: npm run limpar-segredos [caminho.db]
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'

import { marcarSegredos, varrerSegredos } from '../factory/guards.ts'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const arquivo = path.resolve(process.argv[2] ?? path.join(raiz, 'factory.db'))
const banco = createClient({ url: `file:${arquivo}` })

// Filtro barato no SQL; a decisão final é do varrerSegredos.
const PISTAS = ['ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_', 'github_pat_', 'AKIA', 'PRIVATE KEY', 'token', 'password', 'secret', 'api_key', 'api-key', 'apikey']

const tabelas = (await banco.execute("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'")).rows.map(
  (linha) => String(linha.name),
)

let linhasAlteradas = 0
for (const tabela of tabelas) {
  const colunas = (await banco.execute(`pragma table_info("${tabela}")`)).rows
    .filter((coluna) => /text|json|^$/i.test(String(coluna.type ?? '')))
    .map((coluna) => String(coluna.name))
  if (colunas.length === 0) continue
  const filtro = colunas.flatMap((coluna) => PISTAS.map(() => `cast("${coluna}" as text) like ?`)).join(' or ')
  const valores = colunas.flatMap(() => PISTAS.map((pista) => `%${pista}%`))
  let linhas
  try {
    // O Mastra grava JSON como JSONB binário: json() devolve o texto, e o tipo
    // original volta junto para a gravação usar jsonb() de novo.
    const selecao = colunas
      .map((c) => `case when typeof("${c}") = 'blob' then json("${c}") else "${c}" end as "${c}", typeof("${c}") as "${c}__tipo"`)
      .join(', ')
    linhas = (await banco.execute({ sql: `select rowid as _id, ${selecao} from "${tabela}" where ${filtro}`, args: valores })).rows
  } catch {
    continue
  }
  for (const linha of linhas) {
    const mudancas: Record<string, string> = {}
    for (const coluna of colunas) {
      const valor = linha[coluna]
      if (typeof valor !== 'string' || !varrerSegredos(valor).encontrado) continue
      const limpo = marcarSegredos(valor)
      if (limpo !== valor) mudancas[coluna] = limpo
    }
    const nomes = Object.keys(mudancas)
    if (nomes.length === 0) continue
    await banco.execute({
      sql: `update "${tabela}" set ${nomes.map((nome) => (linha[`${nome}__tipo`] === 'blob' ? `"${nome}" = jsonb(?)` : `"${nome}" = ?`)).join(', ')} where rowid = ?`,
      args: [...nomes.map((nome) => mudancas[nome] ?? ''), linha._id ?? null],
    })
    linhasAlteradas++
    console.log(`${tabela}: ${nomes.join(', ')}`)
  }
}

// Sem isto, o texto antigo continua nas páginas livres e no WAL.
await banco.execute('pragma wal_checkpoint(TRUNCATE)')
await banco.execute('vacuum')
banco.close()
console.log(`\n${linhasAlteradas} linha(s) limpas em ${arquivo}.`)
