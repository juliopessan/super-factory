// Banco da Super Factory para dados que precisam de consulta (waitlist, acessos). LibSQL, o mesmo arquivo do resto
// (SUPER_FACTORY_DB). Mantido pequeno de propósito: uma conexão, o esquema criado se faltar, nada de ORM.

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient, type Client } from '@libsql/client'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export function urlDoBanco(): string {
  return process.env.SUPER_FACTORY_DB?.trim() || `file:${path.join(raiz, 'factory.db')}`
}

const ESQUEMA = [
  `CREATE TABLE IF NOT EXISTS waitlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('pessoa','empresa')),
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    empresa TEXT,
    cargo TEXT,
    site TEXT,
    equipe TEXT NOT NULL,
    usuarios INTEGER NOT NULL,
    uso TEXT NOT NULL,
    ferramentas TEXT NOT NULL,
    caso_de_uso TEXT NOT NULL,
    github TEXT,
    origem TEXT,
    consentimento_em TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','recusado')),
    decidido_por TEXT,
    decidido_em TEXT,
    ip_hash TEXT
  )`,
  'CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email ON waitlist (email)',
  'CREATE INDEX IF NOT EXISTS waitlist_status ON waitlist (status, criado_em)',
  'CREATE INDEX IF NOT EXISTS waitlist_github ON waitlist (github)',
]

let cliente: Client | null = null
let pronto: Promise<Client> | null = null

/** Abre o banco uma vez e garante o esquema. Em teste, passe a url do arquivo temporário. */
export function abrirBanco(url: string = urlDoBanco()): Promise<Client> {
  if (pronto && cliente && !process.env.SUPER_FACTORY_BANCO_NOVO) return pronto
  cliente = createClient({ url })
  const este = cliente
  pronto = (async () => {
    for (const comando of ESQUEMA) await este.execute(comando)
    return este
  })()
  return pronto
}

export async function fecharBanco(): Promise<void> {
  const atual = cliente
  cliente = null
  pronto = null
  atual?.close()
}
