'use client'

import { ArrowUpDown, Clock } from 'lucide-react'
import type { RecentActivityItem } from '@/lib/actions/dashboard'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}min atrás`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h atrás`
  const days = Math.floor(hours / 24)
  return `${days}d atrás`
}

interface RecentActivityProps {
  items: RecentActivityItem[]
}

export function RecentActivity({ items }: RecentActivityProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Atividade recente</h3>
        <div className="flex flex-col items-center py-6 text-center gap-1">
          <Clock className="h-8 w-8 text-muted-foreground/40 mb-1" />
          <p className="text-xs text-muted-foreground">Nenhuma movimentação ainda</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-3">Atividade recente</h3>
      <div className="flex flex-col divide-y divide-slate-100">
        {items.map(item => (
          <div key={item.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground leading-snug truncate">{item.description}</p>
              {item.meta && <p className="text-[10px] text-muted-foreground truncate">{item.meta}</p>}
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{timeAgo(item.timestamp)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
