// Normalização de telefones brasileiros para o formato da Meta (somente dígitos, com 55).

/** "(11) 99999-8888" → "5511999998888". Retorna null se não parecer um celular/fixo BR. */
export function normalizeBrPhone(input: string): string | null {
  let d = (input ?? '').replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.length === 10 || d.length === 11) d = `55${d}`
  if (!d.startsWith('55')) return null
  if (d.length !== 12 && d.length !== 13) return null
  const ddd = Number(d.slice(2, 4))
  if (ddd < 11 || ddd > 99) return null
  return d
}

/**
 * A Meta às vezes entrega números BR sem o 9º dígito (ou com). Retorna as duas formas
 * para comparar com o que está cadastrado.
 */
export function phoneVariants(phone: string): string[] {
  const d = phone.replace(/\D/g, '')
  const out = new Set<string>([d])
  if (d.startsWith('55') && d.length === 13 && d[4] === '9') out.add(d.slice(0, 4) + d.slice(5))
  if (d.startsWith('55') && d.length === 12) out.add(d.slice(0, 4) + '9' + d.slice(4))
  return [...out]
}

export function maskPhone(phone: string): string {
  return phone.length > 4 ? `${phone.slice(0, 4)}•••••${phone.slice(-2)}` : phone
}
