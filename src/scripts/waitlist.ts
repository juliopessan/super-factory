// Administração da waitlist pela linha de comando (alternativa à página /admin/waitlist).
//   node --experimental-strip-types src/scripts/waitlist.ts listar [pendente|aprovado|recusado]
//   node --experimental-strip-types src/scripts/waitlist.ts aprovar <email|id>
//   node --experimental-strip-types src/scripts/waitlist.ts recusar <email|id>
// Na VPS: docker exec -it super-factory node --experimental-strip-types src/scripts/waitlist.ts listar pendente

import { abrirBanco, fecharBanco } from '../factory/banco.ts'
import { decidir, listar, normalizarEmail, type Status } from '../factory/waitlist.ts'

const [, , comando, alvo] = process.argv
const db = await abrirBanco()
try {
  if (comando === 'listar') {
    const filtro = alvo === 'pendente' || alvo === 'aprovado' || alvo === 'recusado' ? (alvo as Status) : undefined
    const linhas = await listar(db, filtro)
    for (const l of linhas) console.log(`#${l.id}\t${l.status}\t${l.nome}\t${l.email}\t${l.github ? '@' + l.github : '-'}\t${l.tipo}${l.empresa ? ' ' + l.empresa : ''}\t${l.equipe}`)
    console.log(`${linhas.length} cadastro(s)`)
  } else if ((comando === 'aprovar' || comando === 'recusar') && alvo) {
    const todos = await listar(db)
    const achado = todos.find((l) => String(l.id) === alvo || l.email === normalizarEmail(alvo))
    if (!achado) {
      console.error(`Não achei "${alvo}".`)
      process.exitCode = 1
    } else {
      await decidir(db, achado.id, comando === 'aprovar' ? 'aprovado' : 'recusado', `cli:${process.env.USER ?? 'root'}`)
      console.log(`${achado.email}: ${comando === 'aprovar' ? 'aprovado' : 'recusado'}. Vale em até 30 s.`)
    }
  } else {
    console.error('Uso: listar [estado] | aprovar <email|id> | recusar <email|id>')
    process.exitCode = 1
  }
} finally {
  await fecharBanco()
}
