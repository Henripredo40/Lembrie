export function emailValido(email: string) {
  return email.length <= 254 && /^[A-Z0-9.!#$%&'*+/=?^_{}|~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i.test(email);
}

export function codigoEmailValido(codigo: string) {
  return /^\d{6}$/.test(codigo);
}

export function senhaTemTamanhoMinimo(senha: string) { return senha.length >= 6; }
export function senhasIguais(senha: string, confirmacao: string) { return senha === confirmacao; }
