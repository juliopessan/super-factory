import type { MastraDBMessage } from '@mastra/core/memory'
import type { ProcessInputArgs, Processor } from '@mastra/core/processors'

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const TELEFONE = /(?:\+55\s?)?(?:\(?\d{2}\)?\s?)(?:9\s?)?\d{4}-\d{4}/g
const CPF = /\d{3}\.\d{3}\.\d{3}-\d{2}/g
const SEGREDO = /ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}/g

function redigir(texto: string): string {
  return texto
    .replace(EMAIL, '[e-mail]')
    .replace(TELEFONE, '[telefone]')
    .replace(CPF, '[cpf]')
    .replace(SEGREDO, '[segredo]')
}

function textoDaMensagem(message: MastraDBMessage): string {
  const partes = message.content.parts ?? []
  const dosPartes = partes
    .map((part) => (part.type === 'text' && 'text' in part && typeof part.text === 'string' ? part.text : ''))
    .filter(Boolean)
    .join('\n')
  if (dosPartes.trim()) return dosPartes
  return typeof message.content.content === 'string' ? message.content.content : ''
}

export class RedigirDadosPessoais implements Processor {
  readonly id = 'redigir-dados-pessoais'
  readonly name = 'Redigir dados pessoais'
  readonly description = 'Tira e-mail, telefone, CPF e token do texto antes de ele chegar ao modelo.'

  async processInput({ messages, abort }: ProcessInputArgs): Promise<MastraDBMessage[]> {
    const mensagensDoUsuario = messages.filter((message) => message.role === 'user')
    const original = mensagensDoUsuario
      .map((message) => textoDaMensagem(message))
      .join('\n')
      .trim()

    if (mensagensDoUsuario.length > 0 && !original) {
      abort('Manda o pedido, mesmo que ainda esteja cru.')
    }

    return messages.map((message) => ({
      ...message,
      content: {
        ...message.content,
        content: typeof message.content.content === 'string' ? redigir(message.content.content) : message.content.content,
        parts: message.content.parts?.map((part) =>
          part.type === 'text' && 'text' in part && typeof part.text === 'string'
            ? { ...part, text: redigir(part.text) }
            : part,
        ),
      },
    }))
  }
}
