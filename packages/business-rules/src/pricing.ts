// ── Regras de negócio: Precificação ──────────────────────────

/**
 * Margem de lucro percentual.
 * ((preço - custo) / preço) * 100
 */
export function calculateMargin(price: number, cost: number): number {
  if (price <= 0) return 0
  return ((price - cost) / price) * 100
}

/**
 * Markup sobre o custo.
 * ((preço - custo) / custo) * 100
 */
export function calculateMarkup(price: number, cost: number): number {
  if (cost <= 0) return 0
  return ((price - cost) / cost) * 100
}

/**
 * Verifica se o preço está acima do mínimo aceitável.
 */
export function isPriceAboveMinimum(price: number, minPrice: number | null): boolean {
  if (minPrice === null) return true
  return price >= minPrice
}

/**
 * Calcula o preço mínimo de venda com base no custo e margem mínima desejada.
 */
export function calculateMinPrice(cost: number, minMarginPct: number): number {
  if (minMarginPct >= 100) throw new Error('Margem mínima não pode ser ≥ 100%')
  return cost / (1 - minMarginPct / 100)
}

/**
 * Sugere preço de venda com base no custo e markup desejado.
 */
export function suggestPriceFromMarkup(cost: number, markupPct: number): number {
  return cost * (1 + markupPct / 100)
}

/**
 * Calcula o valor de desconto dado percentual e preço base.
 */
export function calculateDiscountAmount(price: number, discountPct: number): number {
  return price * (discountPct / 100)
}

/**
 * Valida se um desconto é aceitável para um item (não gera prejuízo).
 */
export function isDiscountSafe(
  price: number,
  discountPct: number,
  cost: number,
  minMarginPct = 0
): boolean {
  const discountedPrice = price * (1 - discountPct / 100)
  return calculateMargin(discountedPrice, cost) >= minMarginPct
}
