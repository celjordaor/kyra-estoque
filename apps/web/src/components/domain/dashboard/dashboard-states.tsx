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
          <div key={i} className="rounded-2xl border border-border bg-card p-5 h-32">
            <div className="flex justify-between mb-3">
              <div className="h-3 bg-muted rounded w-24" />
              <div className="h-4 w-4 bg-muted rounded" />
            </div>
            <div className="h-7 bg-muted rounded w-28 mb-2" />
            <div className="h-3 bg-muted rounded w-20" />
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-5">
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-6 h-48">
            <div className="h-4 bg-muted rounded w-48 mb-4" />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 bg-muted rounded-xl mb-3" />
            ))}
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 h-32">
            <div className="h-3 bg-muted rounded w-32 mb-3" />
            <div className="grid grid-cols-3 gap-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl" />)}
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 h-80">
          <div className="h-4 bg-muted rounded w-40 mb-4" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded-xl mb-3" />
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
      <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-2">
        <Sparkles className="h-8 w-8 text-white" />
      </div>
      <div>
        <h2 className="text-xl font-extrabold text-foreground font-display mb-2">
          Vamos começar a conhecer sua operação
        </h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Adicione seus primeiros produtos para a Kyra começar a monitorar e gerar insights para você.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 mt-2">
        <Link
          href="/products/new"
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
        >
          <Package className="h-4 w-4" />
          Adicionar produto
        </Link>
        <Link
          href="/kyra"
          className="inline-flex items-center gap-2 border border-primary/20 text-primary hover:bg-primary/10 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
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
        <h2 className="text-lg font-bold text-foreground mb-1">
          Não conseguimos atualizar esta análise
        </h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          {message ?? 'Houve um problema ao carregar os dados. Tente novamente.'}
        </p>
      </div>
      <div className="flex gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </button>
        )}
        <Link
          href="/kyra"
          className="inline-flex items-center gap-2 border border-border text-muted-foreground hover:bg-muted/50 text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
        >
          Falar com Kyra
        </Link>
      </div>
    </div>
  )
}
