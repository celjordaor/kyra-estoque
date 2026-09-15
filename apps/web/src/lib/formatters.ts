// ── Formatadores de campos brasileiro ─────────────────────────────────────────
// Funções puras de máscara/formatação — sem side-effects, sem dependências.

/** Máscara de telefone: detecta fixo (10 dígitos) ou celular (11 dígitos). */
export function formatPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
}

/** Máscara de CPF ou CNPJ conforme tipo. */
export function formatDoc(v: string, type: 'individual' | 'company') {
  const d = v.replace(/\D/g, '')
  if (type === 'individual') {
    return d.slice(0, 11).replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4').replace(/-$/, '')
  }
  return d.slice(0, 14).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5').replace(/-$/, '')
}

/** Máscara de CNPJ isolado (sem tipo). */
export function formatCnpj(v: string) {
  const d = v.replace(/\D/g, '')
  return d.slice(0, 14).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5').replace(/-$/, '')
}

/** Valida CNPJ pelo algoritmo dos dígitos verificadores. */
export function isValidCnpj(v: string): boolean {
  const d = v.replace(/\D/g, '')
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false
  function calcDigit(base: string, weights: number[]) {
    const sum = base.split('').reduce((acc, ch, i) => acc + Number(ch) * weights[i], 0)
    const rem = sum % 11
    return rem < 2 ? 0 : 11 - rem
  }
  const d1 = calcDigit(d.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2])
  const d2 = calcDigit(d.slice(0, 13), [6,5,4,3,2,9,8,7,6,5,4,3,2])
  return d1 === Number(d[12]) && d2 === Number(d[13])
}

/** Valida CPF pelo algoritmo dos dígitos verificadores. */
export function isValidCpf(v: string): boolean {
  const d = v.replace(/\D/g, '')
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
  function calcDigit(base: string, len: number) {
    const sum = base.split('').reduce((acc, ch, i) => acc + Number(ch) * (len + 1 - i), 0)
    const rem = (sum * 10) % 11
    return rem === 10 || rem === 11 ? 0 : rem
  }
  return calcDigit(d.slice(0, 9), 9) === Number(d[9]) && calcDigit(d.slice(0, 10), 10) === Number(d[10])
}

/** E-mail básico. */
export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}
