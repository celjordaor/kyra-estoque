'use client'

import { Sparkles, Package, RefreshCw, AlertCircle } from 'lucide-react'
import Link from 'next/link'

// ── Loading Skeleton ──────────────────────────────────────────
export function DashboardLoadingSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 h-32">
            <div className="flex justify-between mb-3">
              <div className="h-3 bg-slate-100 rounded w-24" />
              <div className="h-4 w-4 bg-slate-100 rounded" />
            </div>
            <div className="h-7 bg-slate-100 rounded w-28 mb-2" />
            <div className="h-3 bg-slate-100 rounded w-20" />
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-5">
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 h-48">
            <div className="h-4 bg-slate-100 rounded w-48 mb-4" />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 bg-slate-100 rounded-xl mb-3" />
            ))}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 h-32">
            <div className="h-3 bg-slate-100 rounded w-32 mb-3" />
            <div className="grid grid-cols-3 gap-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl" />)}
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 h-80">
          <div className="h-4 bg-slate-100 rounded w-40 mb-4" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-xl mb-3" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────
export function DashboardEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-teal-600 flex items-center justify-center mb-2">
        <Sparkles className="h-8 w-8 text-white" />
      </div>
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 font-display mb-2">
          Vamos começar a conhecer sua operação
        </h2>
        <p className="text-sm text-slate-500 max-w-sm mx-auto">
          Adicione seus primeiros produtos para a Kyra começar a monitorar e gerar insights para você.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 mt-2">
        <Link
          href="/products/new"
          className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
        >
          <Package className="h-4 w-4" />
          Adicionar produto
        </Link>
        <Link
          href="/kyra"
          className="inline-flex items-center gap-2 border border-teal-200 text-teal-700 hover:bg-teal-50 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          Perguntar à Kyra
        </Link>
      </div>
    </div>
  )
}

// ── Error State ───────────────────────────────────────────────
interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

export function DashboardErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mb-2">
        <AlertCircle className="h-8 w-8 text-red-400" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">
          Não conseguimos atualizar esta análise
        </h2>
        <p className="text-sm text-slate-500 max-w-sm mx-auto">
          {message ?? 'Houve um problema ao carregar os dados. Tente novamente.'}
        </p>
      </div>
      <div className="flex gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </button>
        )}
        <Link
          href="/kyra"
          className="inline-flex items-center gap-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
        >
          Falar com Kyra
        </Link>
      </div>
    </div>
  )
}
