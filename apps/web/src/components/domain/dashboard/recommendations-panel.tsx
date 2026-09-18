'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, ChevronRight, CheckCircle2, XCircle, TrendingUp } from 'lucide-react'
import type { RecommendationItem } from '@/lib/actions/dashboard'

const TYPE_LABELS: Record<string, string> = {
  LOW_STOCK: 'Estoque',
  STOCKOUT_RISK: 'Ruptura',
  SLOW_MOVING: 'Giro lento',
  OVERSTOCK: 'Excesso',
  PURCHASE_RECOMMENDATION: 'Compra',
  SALES_ANOMALY: 'Vendas',
  MARGIN_ALERT: 'Margem',
  PROMOTION_OPPORTUNITY: 'Catálogo',
}

function ConfidenceDot({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 85 ? 'bg-emerald-400' : pct >= 70 ? 'bg-amber-400' : 'bg-slate-300'
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-[10px] text-slate-500">{pct}% confiança</span>
    </div>
  )
}

interface RecommendationsPanelProps {
  recommendations: RecommendationItem[]
}

export function RecommendationsPanel({ recommendations }: RecommendationsPanelProps) {
  const router = useRouter()
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const visible = recommendations.filter(r => !dismissed.has(r.id))

  return (
    <div className="rounded-2xl border border-teal-200 bg-white p-5 sticky top-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-teal-600 flex items-center justify-center shrink-0">
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">O Kyra recomenda</p>
          <p className="text-[10px] text-slate-500">Análise em tempo real</p>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center gap-2">
          <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          <p className="text-sm font-medium text-slate-700">Tudo analisado</p>
          <p className="text-xs text-slate-500">Novas recomendações aparecem automaticamente.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map(rec => (
            <div key={rec.id} className="group rounded-xl border border-slate-100 bg-slate-50 p-4 hover:border-teal-200 hover:bg-teal-50/30 transition-all">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-700">
                    {TYPE_LABELS[rec.type] ?? rec.type}
                  </span>
                </div>
                <button
                  onClick={() => setDismissed(prev => new Set([...prev, rec.id]))}
                  className="text-slate-300 hover:text-slate-500 transition-colors shrink-0"
                  aria-label="Dispensar"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>

              <p className="text-sm font-semibold text-slate-800 mb-1">{rec.title}</p>
              <p className="text-xs text-slate-600 leading-relaxed mb-2">{rec.description}</p>

              <div className="flex items-center justify-between">
                <ConfidenceDot value={rec.confidence} />
                {rec.impact && (
                  <div className="flex items-center gap-1 text-[10px] text-teal-600 font-medium">
                    <TrendingUp className="h-3 w-3" />
                    {rec.impact}
                  </div>
                )}
              </div>

              <button onClick={() => router.push(`/kyra?q=${encodeURIComponent(rec.title + ': ' + rec.description)}`)} className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg py-2 transition-colors">
                Executar com Kyra
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-slate-100">
        <p className="text-[10px] text-slate-400 text-center">
          Kyra analisa seu estoque continuamente.
          <br />Toda ação requer sua confirmação.
        </p>
      </div>
    </div>
  )
}
