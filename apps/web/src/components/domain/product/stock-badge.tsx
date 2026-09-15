import { Badge } from '@/components/ui/badge'
import { getStockStatus } from '@kyra/business-rules'

interface StockBadgeProps {
  quantity: number
  minStock: number
  aiReorderPoint?: number | null
  showQuantity?: boolean
  unit?: string
}

const CONFIG = {
  out: { variant: 'danger' as const,  label: 'Sem estoque' },
  low: { variant: 'warning' as const, label: 'Estoque baixo' },
  ok:  { variant: 'success' as const, label: 'Em estoque' },
}

export function StockBadge({
  quantity,
  minStock,
  aiReorderPoint,
  showQuantity = false,
  unit = 'un',
}: StockBadgeProps) {
  const status = getStockStatus(quantity, minStock, aiReorderPoint ?? null)
  const { variant, label } = CONFIG[status]

  return (
    <div className="flex flex-col items-start gap-0.5">
      <Badge variant={variant}>{label}</Badge>
      {showQuantity && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {quantity % 1 === 0 ? quantity : quantity.toFixed(2)} {unit}
        </span>
      )}
    </div>
  )
}
