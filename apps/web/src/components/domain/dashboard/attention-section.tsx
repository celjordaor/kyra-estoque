'use client'

import Link from 'next/link'
import { AlertTriangle, TrendingDown, Sparkles, Info, ArrowRight } from 'lucide-react'
import type { AttentionItem } from '@/lib/actions/dashboard'

const PRIORITY_CONFIG = {
  high: {
    border: 'border-l-red-500',
    bg: 'bg-red-50',
    badge: 'bg-red-50 border border-red-200 text-red-700',
    label: 'Urgente',
    icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
  },
  medium: {
    border: 'border-l-amber-400',
    bg: 'bg-amber-50',
    badge: 'bg-amber-50 border border-amber-200 text-amber-700',
    label: 'Atenção',
    icon: <TrendingDown className="h-4 w-4 text-amber-500" />,
  },
  opportunity: {
    border: 'border-l-primary',
    bg: 'bg-primary/10',
    badge: 'bg-primary/10 border border-primary/20 text-primary',
    label: 'Oportunidade',
    icon: <Sparkles className="h-4 w-4 text-primary" />,
  },
  info: {
    border: 'border-l-slate-300',
    bg: 'bg-muted/50',
    badge: 'bg-muted/50 border border-border text-muted-foreground',
    label: 'Info',
    icon: <Info className="h-4 w-4 text-muted-foreground" />,
  },
}

interface AttentionSectionProps {
  items: AttentionItem[]
}

export function AttentionSection({ items }: AttentionSectionProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground mb-4">O que merece sua atenção</h2>
        <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-2">
            <Sparkles className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="text-sm font-medium text-foreground">Tudo em ordem por aqui</p>
          <p className="text-xs text-muted-foreground">Nenhum alerta no momento. Kyra está monitorando.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-foreground">O que merece sua atenção</h2>
        <span className="text-xs text-muted-foreground">{items.length} {items.length === 1 ? 'item' : 'itens'}</span>
      </div>
      <div className="flex flex-col gap-3">
        {items.map(item => {
          const config = PRIORITY_CONFIG[item.priority]
          return (
            <div
              key={item.id}
              className={`rounded-xl border border-border ${config.bg} p-4 border-l-4 ${config.border}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">{config.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">{item.title}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${config.badge}`}>
                      {config.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                  {item.href && item.action && (
                    <Link
                      href={item.href as any}
                      className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-primary hover:text-primary transition-colors"
                    >
                      {item.action}
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
