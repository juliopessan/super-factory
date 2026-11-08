// Quem fez o pedido, para a trilha de auditoria (cofre de chaves, MCPs). O porteiro registra o usuário da sessão
// e os handlers leem. Fica num módulo à parte para não criar dependência circular.

const usuarios = new WeakMap<Request, string>()

export function registrarUsuario(req: Request, login: string): void {
  usuarios.set(req, login)
}

export function usuarioRegistrado(req: Request): string | null {
  return usuarios.get(req) ?? null
}
