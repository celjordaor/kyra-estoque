import type { StockMovementRow, StockMovementType } from '@kyra/database'

// ── Regras de negócio: Estoque ────────────────────────────────
// REGRA FUNDAMENTAL: saldo = soma de movimentos, nunca products.stock_quantity sozinho.

const CREDIT_TYPES = new Set<StockMovementType>([
  'ENTRADA', 'AJUSTE', 'TRANSFERENCIA', 'DEVOLUCAO', 'INVENTARIO',
])

const DEBIT_TYPES = new Set<StockMovementType>([
  'SAIDA',
])

/**
 * Retorna true se o tipo de movimento debita o estoque.
 */
export function isDebitMovement(type: StockMovementType): boolean {
  return DEBIT_TYPES.has(type)
}

/**
 * Retorna true se o tipo de movimento credita o estoque.
 */
export function isCreditMovement(type: StockMovementType): boolean {
  return CREDIT_TYPES.has(type)
}

/**
 * Valida se um tipo de movimento é reconhecido pelo sistema.
 */
export function isValidMovementType(type: string): type is StockMovementType {
  return CREDIT_TYPES.has(type as StockMovementType) || DEBIT_TYPES.has(type as StockMovementType)
}

/**
 * Calcula o saldo de estoque a partir de uma lista de movimentos.
 * SAIDA debita, todos os outros tipos creditam.
 */
export function calculateStockBalance(movements: Pick<StockMovementRow, 'type' | 'quantity'>[]): number {
  return movements.reduce((balance, m) => {
    return balance + (isDebitMovement(m.type) ? -m.quantity : m.quantity)
  }, 0)
}

/**
 * Verifica se um produto está com estoque baixo.
 * Usa ponto de reposição da IA se disponível; fallback para min_stock.
 */
export function isLowStock(
  stockQuantity: number,
  minStock: number,
  aiReorderPoint: number | null = null
): boolean {
  const threshold = aiReorderPoint ?? minStock
  return stockQuantity <= threshold
}

/**
 * Verifica se um produto está sem estoque.
 */
export function isOutOfStock(stockQuantity: number): boolean {
  return stockQuantity <= 0
}

/**
 * Estima dias de cobertura de estoque baseado na venda média diária.
 * Retorna null se não há dados de venda.
 */
export function estimateDaysCoverage(
  stockQuantity: number,
  avgDailySales: number | null
): number | null {
  if (!avgDailySales || avgDailySales <= 0) return null
  return Math.floor(stockQuantity / avgDailySales)
}

/**
 * Determina o status semântico do estoque para badges e alertas.
 */
export function getStockStatus(
  stockQuantity: number,
  minStock: number,
  aiReorderPoint: number | null = null
): 'out' | 'low' | 'ok' | 'excess' {
  if (isOutOfStock(stockQuantity)) return 'out'
  if (isLowStock(stockQuantity, minStock, aiReorderPoint)) return 'low'
  return 'ok'
}

/**
 * Calcula a quantidade sugerida de reposição.
 * Regra: (max_stock ?? min_stock * 3) - stock_atual
 */
export function calculateReplenishmentQty(
  stockQuantity: number,
  minStock: number,
  maxStock: number | null = null
): number {
  const target = maxStock ?? minStock * 3
  return Math.max(0, target - stockQuantity)
}
