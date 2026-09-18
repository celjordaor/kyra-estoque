'use client'

import { Package, AlertTriangle, Tag } from 'lucide-react'

interface OperationsOverviewProps {
  activeProducts: number
  attentionProducts: number
  categories: number
}

export function OperationsOverview({ activeProducts, attentionProducts, categories }: OperationsOverviewProps) {
  const healthColor = attentionProducts === 0
    ? 'text-emerald-600'
    : attentionProducts <= 5
      ? 'text-amber-500'
      : 'text-red-500'

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">A saúde da sua operação</h3>
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/50">
          <Package className="h-5 w-5 text-primary" />
          <span className="text-xl font-extrabold text-foreground font-display">{activeProducts}</span>
          <span className="text-[10px] text-muted-foreground text-center">produtos ativos</span>
        </div>
        <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/50">
          <AlertTriangle className={`h-5 w-5 ${healthColor}`} />
          <span className={`text-xl font-extrabold font-display ${healthColor}`}>{attentionProducts}</span>
          <span className="text-[10px] text-muted-foreground text-center">em atenção</span>
        </div>
        <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/50">
          <Tag className="h-5 w-5 text-muted-foreground" />
          <span className="text-xl font-extrabold text-foreground font-display">{categories}</span>
          <span className="text-[10px] text-muted-foreground text-center">categorias</span>
        </div>
      </div>
    </div>
  )
}
