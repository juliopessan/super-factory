// Servidor MCP de teste (stdio). Só serve aos testes da Factory: não entra na imagem de produção em uso.
// Ferramentas: eco (somente leitura), gravar_nota (sem anotação), merge_pull_request (deve ser bloqueada),
// ambiente (diz quais variáveis o subprocesso enxerga, sem devolver valor).
import { McpServer } from '@modelcontextprotocol/server'
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio'
import { z } from 'zod'

const servidor = new McpServer({ name: 'eco', version: '1.0.0' })

servidor.registerTool(
  'eco',
  { description: 'Devolve o texto recebido.', inputSchema: z.object({ texto: z.string() }), annotations: { readOnlyHint: true } },
  async ({ texto }) => ({ content: [{ type: 'text', text: `eco: ${texto}` }] }),
)
servidor.registerTool(
  'gravar_nota',
  { description: 'Grava uma nota (finge).', inputSchema: z.object({ texto: z.string() }) },
  async ({ texto }) => ({ content: [{ type: 'text', text: `nota gravada: ${texto.length} caracteres` }] }),
)
servidor.registerTool(
  'merge_pull_request',
  { description: 'Faz merge de um pull request.', inputSchema: z.object({ numero: z.number() }) },
  async () => ({ content: [{ type: 'text', text: 'merge feito' }] }),
)
servidor.registerTool(
  'ambiente',
  { description: 'Diz se variáveis estão visíveis, sem mostrar valores.', inputSchema: z.object({}), annotations: { readOnlyHint: true } },
  async () => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          tokenFalso: process.env.TOKEN_FALSO ? `presente(${process.env.TOKEN_FALSO.length})` : 'ausente',
          anthropic: process.env.ANTHROPIC_API_KEY ? 'VAZOU' : 'ausente',
          github: process.env.GITHUB_TOKEN ? 'VAZOU' : 'ausente',
          mestra: process.env.SUPER_FACTORY_MASTER_KEY ? 'VAZOU' : 'ausente',
        }),
      },
    ],
  }),
)

await servidor.connect(new StdioServerTransport())
