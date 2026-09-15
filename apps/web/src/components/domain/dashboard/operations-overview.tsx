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
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">A saúde da sua operação</h3>
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-50">
          <Package className="h-5 w-5 text-teal-600" />
          <span className="text-xl font-extrabold text-slate-900 font-display">{activeProducts}</span>
          <span className="text-[10px] text-slate-500 text-center">produtos ativos</span>
        </div>
        <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-50">
          <AlertTriangle className={`h-5 w-5 ${healthColor}`} />
          <span className={`text-xl font-extrabold font-display ${healthColor}`}>{attentionProducts}</span>
          <span className="text-[10px] text-slate-500 text-center">em atenção</span>
        </div>
        <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-50">
          <Tag className="h-5 w-5 text-slate-400" />
          <span className="text-xl font-extrabold text-slate-900 font-display">{categories}</span>
          <span className="text-[10px] text-slate-500 text-center">categorias</span>
        </div>
      </div>
    </div>
  )
}
