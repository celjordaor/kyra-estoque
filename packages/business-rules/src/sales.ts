import type { SaleItemRow } from '@kyra/database'

// ── Regras de negócio: Vendas ─────────────────────────────────

/**
 * Calcula o subtotal de uma venda (antes de desconto global).
 */
export function calculateSubtotal(
  items: Pick<SaleItemRow, 'total_price'>[]
): number {
  return items.reduce((sum, item) => sum + item.total_price, 0)
}

/**
 * Calcula o total da venda com desconto global.
 */
export function calculateSaleTotal(subtotal: number, discountAmount: number): number {
  return Math.max(0, subtotal - discountAmount)
}

/**
 * Calcula o custo total de uma venda.
 */
export function calculateSaleCost(
  items: Pick<SaleItemRow, 'total_cost'>[]
): number {
  return items.reduce((sum, item) => sum + item.total_cost, 0)
}

/**
 * Calcula a margem geral da venda.
 */
export function calculateSaleMargin(total: number, cost: number): number {
  if (total <= 0) return 0
  return ((total - cost) / total) * 100
}

/**
 * Valida se uma venda pode ser concluída.
 * Retorna lista de erros; vazio = válida.
 */
export function validateSaleCompletion(
  items: Array<Pick<SaleItemRow, 'quantity' | 'unit_price'>>,
  totalAmount: number
): string[] {
  const errors: string[] = []
  if (items.length === 0) errors.push('A venda deve ter pelo menos 1 item')
  if (items.some(i => i.quantity <= 0)) errors.push('Todas as quantidades devem ser positivas')
  if (items.some(i => i.unit_price < 0)) errors.push('Os preços não podem ser negativos')
  if (totalAmount < 0) errors.push('O total da venda não pode ser negativo')
  return errors
}
