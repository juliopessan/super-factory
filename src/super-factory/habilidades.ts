import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { LocalFilesystem, Workspace } from '@mastra/core/workspace'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export const habilidades = new Workspace({
  id: 'habilidades',
  name: 'Habilidades',
  filesystem: new LocalFilesystem({
    id: 'habilidades',
    basePath: path.join(root, 'skills'),
    readOnly: true,
    contained: true,
    instructions:
      'As skills são só leitura. A skill super-factory manda no contrato: sem shell, sem merge, sem force-push e sem deploy.',
  }),
  skills: ['.'],
})
