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
    border: 'border-l-teal-400',
    bg: 'bg-teal-50',
    badge: 'bg-teal-50 border border-teal-200 text-teal-700',
    label: 'Oportunidade',
    icon: <Sparkles className="h-4 w-4 text-teal-500" />,
  },
  info: {
    border: 'border-l-slate-300',
    bg: 'bg-slate-50',
    badge: 'bg-slate-50 border border-slate-200 text-slate-600',
    label: 'Info',
    icon: <Info className="h-4 w-4 text-slate-400" />,
  },
}

interface AttentionSectionProps {
  items: AttentionItem[]
}

export function AttentionSection({ items }: AttentionSectionProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">O que merece sua atenção</h2>
        <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-2">
            <Sparkles className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="text-sm font-medium text-slate-700">Tudo em ordem por aqui</p>
          <p className="text-xs text-slate-500">Nenhum alerta no momento. Kyra está monitorando.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-slate-900">O que merece sua atenção</h2>
        <span className="text-xs text-slate-400">{items.length} {items.length === 1 ? 'item' : 'itens'}</span>
      </div>
      <div className="flex flex-col gap-3">
        {items.map(item => {
          const config = PRIORITY_CONFIG[item.priority]
          return (
            <div
              key={item.id}
              className={`rounded-xl border border-slate-200 ${config.bg} p-4 border-l-4 ${config.border}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">{config.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800">{item.title}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${config.badge}`}>
                      {config.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                  {item.href && item.action && (
                    <Link
                      href={item.href as any}
                      className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors"
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
