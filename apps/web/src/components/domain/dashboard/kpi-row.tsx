'use client'

import { TrendingUp, TrendingDown, Package, ShoppingCart, BarChart2, DollarSign } from 'lucide-react'
import type { DashboardKPIs } from '@/lib/actions/dashboard'
import { cn } from '@/lib/utils'

function fmtCurrency(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
}

function fmtCurrencyFull(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
}

function pctChange(current: number, prev: number): number | null {
  if (prev === 0) return null
  return ((current - prev) / prev) * 100
}

interface KPICardProps {
  label: string
  value: string
  sub: string
  change?: number | null   // % de variação vs período anterior
  changeSuffix?: string    // override do sufixo (ex: "pp" para margem)
  icon: React.ElementType
  iconColor: string
  iconBg: string
}

function KPICard({ label, value, sub, change, changeSuffix = '%', icon: Icon, iconColor, iconBg }: KPICardProps) {
  const hasChange = change !== null && change !== undefined
  const isUp = (change ?? 0) >= 0
  const absPct = Math.abs(change ?? 0).toFixed(1)

  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-3 hover:border-primary/20 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', iconBg)}>
          <Icon className={cn('h-4 w-4', iconColor)} />
        </div>
      </div>

      <div>
        <p className="text-2xl font-extrabold tracking-tight">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
      </div>

      {hasChange && (
        <div className={cn(
          'flex items-center gap-1 text-xs font-semibold',
          isUp ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
        )}>
          {isUp
            ? <TrendingUp className="h-3.5 w-3.5" />
            : <TrendingDown className="h-3.5 w-3.5" />
          }
          {isUp ? '+' : ''}{absPct}{changeSuffix} vs mês anterior
        </div>
      )}

      {!hasChange && (
        <div className="text-xs text-muted-foreground">Sem dados do mês anterior</div>
      )}
    </div>
  )
}

interface KPIRowProps {
  kpis: DashboardKPIs
}

export function KPIRow({ kpis }: KPIRowProps) {
  const salesChange  = pctChange(kpis.salesRevenue,  kpis.salesRevenuePrev)
  const ticketChange = pctChange(kpis.avgTicket,      kpis.avgTicketPrev)
  const marginDiff   = kpis.grossMarginPrev > 0
    ? kpis.grossMargin - kpis.grossMarginPrev
    : null

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Vendas */}
      <KPICard
        label="Vendas"
        value={fmtCurrency(kpis.salesRevenue)}
        sub={`${kpis.salesCount} ${kpis.salesCount === 1 ? 'venda' : 'vendas'} este mês`}
        change={salesChange}
        icon={ShoppingCart}
        iconBg="bg-primary/10"
        iconColor="text-primary"
      />

      {/* Margem */}
      <KPICard
        label="Margem"
        value={`${kpis.grossMargin.toFixed(1)}%`}
        sub="Margem bruta sobre vendas"
        change={marginDiff}
        changeSuffix=" pp"
        icon={BarChart2}
        iconBg={kpis.grossMargin >= 30 ? 'bg-green-500/10' : 'bg-amber-500/10'}
        iconColor={kpis.grossMargin >= 30 ? 'text-green-600' : 'text-amber-500'}
      />

      {/* Estoque */}
      <KPICard
        label="Estoque"
        value={fmtCurrency(kpis.stockValue)}
        sub={`${kpis.totalProducts} produtos ativos`}
        change={kpis.outOfStockCount > 0 ? null : undefined}
        icon={Package}
        iconBg={kpis.outOfStockCount > 0 ? 'bg-red-500/10' : 'bg-blue-500/10'}
        iconColor={kpis.outOfStockCount > 0 ? 'text-red-500' : 'text-blue-500'}
      />

      {/* Ticket Médio */}
      <KPICard
        label="Ticket Médio"
        value={fmtCurrencyFull(kpis.avgTicket)}
        sub="Valor médio por venda"
        change={ticketChange}
        icon={DollarSign}
        iconBg="bg-green-500/10"
        iconColor="text-green-600"
      />
    </div>
  )
}
