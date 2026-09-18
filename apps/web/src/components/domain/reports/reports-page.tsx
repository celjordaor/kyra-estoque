'use client'

import * as React from 'react'
import {
  BarChart2, Download, Warehouse, ArrowLeftRight, TrendingUp,
  ShoppingBag, Star, Clock, DollarSign, Lock, RefreshCw,
  ChevronUp, ChevronDown, Minus
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { UpgradeBanner } from '@/components/ui/upgrade-prompt'
import { cn } from '@/lib/utils'
import {
  getStockReport, getMovementsReport, getAbcCurveReport,
  getSalesReport, getPurchasesReport, getSlowMovingReport,
  getMarginReport, exportReportCsv,
  type StockReportRow, type MovementReportRow, type AbcRow,
  type SalesProductRow, type PurchasesReportRow, type SlowMovingRow, type MarginRow,
} from '@/lib/actions/reports'

// ── Helpers ────────────────────────────────────────────────────
function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtPct(v: number) {
  return `${v.toFixed(1)}%`
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}
function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// Default date range: last 30 days
function defaultRange() {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 30)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

// ── KPI Card ───────────────────────────────────────────────────
function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={cn('mt-1.5 text-2xl font-bold tracking-tight', color)}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ── Tab definition ────────────────────────────────────────────
type TabId = 'estoque' | 'movimentacoes' | 'vendas' | 'compras' | 'abc' | 'parados' | 'margem'

interface TabDef {
  id: TabId
  label: string
  icon: React.ElementType
  locked?: boolean
}

const TABS: TabDef[] = [
  { id: 'estoque',       label: 'Estoque',        icon: Warehouse },
  { id: 'movimentacoes', label: 'Movimentações',   icon: ArrowLeftRight },
  { id: 'vendas',        label: 'Vendas',          icon: TrendingUp },
  { id: 'compras',       label: 'Compras',         icon: ShoppingBag },
  { id: 'abc',           label: 'Curva ABC',        icon: Star },
  { id: 'parados',       label: 'Produtos Parados', icon: Clock },
  { id: 'margem',        label: 'Margem',           icon: DollarSign },
]

// ── Date Range Picker ─────────────────────────────────────────
function DateRangePicker({ start, end, onChange }: {
  start: string; end: string
  onChange: (s: string, e: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-muted-foreground">De</label>
      <input
        type="date" value={start}
        onChange={ev => onChange(ev.target.value, end)}
        className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <label className="text-sm text-muted-foreground">até</label>
      <input
        type="date" value={end}
        onChange={ev => onChange(start, ev.target.value)}
        className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  )
}

// ── Locked overlay ─────────────────────────────────────────────
function LockedReport({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
        <Lock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
      </div>
      <div>
        <p className="text-lg font-semibold">Relatório bloqueado</p>
        <p className="mt-1 text-sm text-muted-foreground">
          O relatório de <strong>{name}</strong> está disponível no plano Impulsiona ou superior.
        </p>
      </div>
      <Button asChild size="sm" className="bg-amber-500 hover:bg-amber-600 text-white">
        <a href="/settings?tab=billing">Ver planos</a>
      </Button>
    </div>
  )
}

// ── Stock status badge ─────────────────────────────────────────
const STOCK_STATUS: Record<string, { label: string; class: string }> = {
  OK:    { label: 'OK',     class: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  BAIXO: { label: 'Baixo',  class: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  ZERADO:{ label: 'Zerado', class: 'bg-red-100   text-red-700   dark:bg-red-900/30   dark:text-red-400' },
}

// ── ABC Curve badge ────────────────────────────────────────────
const ABC_CONFIG: Record<string, { class: string }> = {
  A: { class: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  B: { class: 'bg-blue-100  text-blue-700  dark:bg-blue-900/30  dark:text-blue-400' },
  C: { class: 'bg-muted text-muted-foreground dark:bg-slate-800    dark:text-slate-400' },
}

// ── Purchase status badge ──────────────────────────────────────
const PO_STATUS: Record<string, string> = {
  draft:      'Rascunho',
  ordered:    'Pedido',
  partial:    'Parcial',
  received:   'Recebido',
  cancelled:  'Cancelado',
}

// ── Table wrapper ──────────────────────────────────────────────
function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}
function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={cn('px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground bg-muted/40', right && 'text-right')}>
      {children}
    </th>
  )
}
function Td({ children, right, mono }: { children: React.ReactNode; right?: boolean; mono?: boolean }) {
  return (
    <td className={cn('px-4 py-3 border-t border-border', right && 'text-right', mono && 'font-mono')}>
      {children}
    </td>
  )
}

// ── Skeleton rows ──────────────────────────────────────────────
function SkeletonRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3 border-t border-border">
              <Skeleton className="h-4 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}

// ══════════════════════════════════════════════════════════════
// TAB PANELS
// ══════════════════════════════════════════════════════════════

// ── 1. Estoque ─────────────────────────────────────────────────
function EstoqueTab() {
  const [loading, setLoading] = React.useState(true)
  const [rows, setRows] = React.useState<StockReportRow[]>([])
  const [summary, setSummary] = React.useState<{ total_items: number; total_value: number; alerts: number } | null>(null)
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'OK' | 'BAIXO' | 'ZERADO'>('all')
  const [exporting, setExporting] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const r = await getStockReport({ status: statusFilter === 'all' ? undefined : statusFilter })
      setRows(r.rows); setSummary(r.summary)
    } catch { toast.error('Erro ao carregar relatório') }
    finally { setLoading(false) }
  }, [statusFilter])

  React.useEffect(() => { load() }, [load])

  async function handleExport() {
    setExporting(true)
    try {
      const { csv, filename } = await exportReportCsv('stock')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Erro ao exportar') }
    finally { setExporting(false) }
  }

  return (
    <div className="space-y-5">
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard label="Total de itens" value={summary.total_items.toString()} />
          <KpiCard label="Valor em estoque" value={fmtCurrency(summary.total_value)} color="text-primary" />
          <KpiCard label="Alertas" value={summary.alerts.toString()} color={summary.alerts > 0 ? 'text-destructive' : undefined} />
          <KpiCard label="Saudáveis" value={(summary.total_items - summary.alerts).toString()} color="text-green-600 dark:text-green-400" />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(['all','OK','BAIXO','ZERADO'] as const).map(s => (
            <button key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                statusFilter === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-foreground/30'
              )}
            >
              {s === 'all' ? 'Todos' : s}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            <Download className="mr-1.5 h-4 w-4" />{exporting ? 'Exportando...' : 'CSV'}
          </Button>
        </div>
      </div>

      <TableWrap>
        <thead>
          <tr>
            <Th>Produto</Th><Th>SKU</Th><Th>Categoria</Th>
            <Th right>Estoque</Th><Th right>Mín</Th>
            <Th right>Custo</Th><Th right>Preço</Th><Th right>Val. Estoque</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        {loading ? <SkeletonRows cols={9} /> : (
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">Nenhum produto encontrado</td></tr>
            )}
            {rows.map(r => {
              const st = STOCK_STATUS[r.status] ?? { label: r.status, class: '' }
              return (
                <tr key={r.id} className="hover:bg-muted/30">
                  <Td><span className="font-medium">{r.name}</span></Td>
                  <Td><span className="text-muted-foreground font-mono text-xs">{r.sku ?? '—'}</span></Td>
                  <Td>{r.category ?? '—'}</Td>
                  <Td right mono>{r.stock} {r.unit}</Td>
                  <Td right mono>{r.min_stock}</Td>
                  <Td right>{fmtCurrency(r.cost_price)}</Td>
                  <Td right>{fmtCurrency(r.sale_price)}</Td>
                  <Td right><span className="font-semibold">{fmtCurrency(r.stock_value)}</span></Td>
                  <Td>
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', st.class)}>{st.label}</span>
                  </Td>
                </tr>
              )
            })}
          </tbody>
        )}
      </TableWrap>
    </div>
  )
}

// ── 2. Movimentações ───────────────────────────────────────────
function MovimentacoesTab() {
  const [loading, setLoading] = React.useState(true)
  const [rows, setRows] = React.useState<MovementReportRow[]>([])
  const [summary, setSummary] = React.useState<{ total: number; entradas: number; saidas: number; ajustes: number } | null>(null)
  const [range, setRange] = React.useState(defaultRange)
  const [exporting, setExporting] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const r = await getMovementsReport(range)
      setRows(r.rows); setSummary(r.summary)
    } catch { toast.error('Erro ao carregar relatório') }
    finally { setLoading(false) }
  }, [range])

  React.useEffect(() => { load() }, [load])

  async function handleExport() {
    setExporting(true)
    try {
      const { csv, filename } = await exportReportCsv('movements', range)
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Erro ao exportar') }
    finally { setExporting(false) }
  }

  const MOV_COLORS: Record<string, string> = {
    ENTRADA: 'text-green-600 dark:text-green-400',
    SAIDA:   'text-red-600   dark:text-red-400',
    AJUSTE:  'text-blue-600  dark:text-blue-400',
  }

  return (
    <div className="space-y-5">
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard label="Total movimentos" value={summary.total.toString()} />
          <KpiCard label="Entradas" value={summary.entradas.toString()} color="text-green-600 dark:text-green-400" />
          <KpiCard label="Saídas" value={summary.saidas.toString()} color="text-red-600 dark:text-red-400" />
          <KpiCard label="Ajustes" value={summary.ajustes.toString()} color="text-blue-600 dark:text-blue-400" />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangePicker start={range.start} end={range.end} onChange={(s, e) => setRange({ start: s, end: e })} />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            <Download className="mr-1.5 h-4 w-4" />{exporting ? 'Exportando...' : 'CSV'}
          </Button>
        </div>
      </div>

      <TableWrap>
        <thead>
          <tr>
            <Th>Data</Th><Th>Produto</Th><Th>SKU</Th><Th>Categoria</Th>
            <Th>Tipo</Th><Th right>Qtd</Th><Th>Observações</Th>
          </tr>
        </thead>
        {loading ? <SkeletonRows cols={7} /> : (
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Sem movimentações no período</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-muted/30">
                <Td><span className="text-xs text-muted-foreground">{fmtDatetime(r.created_at)}</span></Td>
                <Td><span className="font-medium">{r.product_name}</span></Td>
                <Td><span className="font-mono text-xs text-muted-foreground">{r.sku ?? '—'}</span></Td>
                <Td>{r.category ?? '—'}</Td>
                <Td>
                  <span className={cn('font-medium', MOV_COLORS[r.movement_type] ?? 'text-foreground')}>
                    {r.movement_type}
                  </span>
                </Td>
                <Td right mono>{r.quantity}</Td>
                <Td><span className="text-xs text-muted-foreground">{r.notes ?? '—'}</span></Td>
              </tr>
            ))}
          </tbody>
        )}
      </TableWrap>
    </div>
  )
}

// ── 3. Vendas ──────────────────────────────────────────────────
function VendasTab() {
  const [loading, setLoading] = React.useState(true)
  const [data, setData] = React.useState<{
    timeline: Array<{ date: string; sales_count: number; total_revenue: number; avg_ticket: number }>
    topProducts: SalesProductRow[]
    summary: { total_revenue: number; total_orders: number; avg_ticket: number; total_profit: number }
  } | null>(null)
  const [range, setRange] = React.useState(defaultRange)
  const [exporting, setExporting] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const r = await getSalesReport(range)
      setData(r)
    } catch { toast.error('Erro ao carregar relatório') }
    finally { setLoading(false) }
  }, [range])

  React.useEffect(() => { load() }, [load])

  async function handleExport() {
    setExporting(true)
    try {
      const { csv, filename } = await exportReportCsv('sales', range)
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Erro ao exportar') }
    finally { setExporting(false) }
  }

  return (
    <div className="space-y-5">
      {data?.summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard label="Receita total" value={fmtCurrency(data.summary.total_revenue)} color="text-primary" />
          <KpiCard label="Total de pedidos" value={data.summary.total_orders.toString()} />
          <KpiCard label="Ticket médio" value={fmtCurrency(data.summary.avg_ticket)} />
          <KpiCard label="Lucro bruto" value={fmtCurrency(data.summary.total_profit)} color="text-green-600 dark:text-green-400" />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangePicker start={range.start} end={range.end} onChange={(s, e) => setRange({ start: s, end: e })} />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            <Download className="mr-1.5 h-4 w-4" />{exporting ? 'Exportando...' : 'CSV'}
          </Button>
        </div>
      </div>

      {/* Top Products */}
      {!loading && data && data.topProducts.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Top Produtos</h3>
          <TableWrap>
            <thead>
              <tr>
                <Th>#</Th><Th>Produto</Th><Th>Categoria</Th>
                <Th right>Qtd</Th><Th right>Receita</Th><Th right>Lucro</Th><Th right>Margem</Th>
              </tr>
            </thead>
            {loading ? <SkeletonRows cols={7} /> : (
              <tbody>
                {data.topProducts.map((r, i) => (
                  <tr key={r.product_id} className="hover:bg-muted/30">
                    <Td><span className="text-xs font-bold text-muted-foreground">{i + 1}</span></Td>
                    <Td><span className="font-medium">{r.name}</span></Td>
                    <Td>{r.category}</Td>
                    <Td right mono>{r.qty_sold}</Td>
                    <Td right>{fmtCurrency(r.revenue)}</Td>
                    <Td right><span className="text-green-600 dark:text-green-400">{fmtCurrency(r.profit)}</span></Td>
                    <Td right>
                      <span className={cn(r.margin_pct >= 30 ? 'text-green-600 dark:text-green-400' : r.margin_pct >= 15 ? 'text-amber-600' : 'text-red-600')}>
                        {fmtPct(r.margin_pct)}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            )}
          </TableWrap>
        </div>
      )}

      {/* Timeline */}
      {!loading && data && data.timeline.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Histórico diário</h3>
          <TableWrap>
            <thead>
              <tr>
                <Th>Data</Th><Th right>Pedidos</Th><Th right>Receita</Th><Th right>Ticket Médio</Th>
              </tr>
            </thead>
            <tbody>
              {data.timeline.map(r => (
                <tr key={r.date} className="hover:bg-muted/30">
                  <Td>{fmtDate(r.date)}</Td>
                  <Td right mono>{r.sales_count}</Td>
                  <Td right>{fmtCurrency(r.total_revenue)}</Td>
                  <Td right>{fmtCurrency(r.avg_ticket)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </div>
      )}

      {loading && (
        <TableWrap>
          <thead><tr><Th>Data</Th><Th right>Pedidos</Th><Th right>Receita</Th><Th right>Ticket Médio</Th></tr></thead>
          <SkeletonRows cols={4} />
        </TableWrap>
      )}
    </div>
  )
}

// ── 4. Compras ─────────────────────────────────────────────────
function ComprasTab() {
  const [loading, setLoading] = React.useState(true)
  const [rows, setRows] = React.useState<PurchasesReportRow[]>([])
  const [summary, setSummary] = React.useState<{ total: number; total_amount: number; received: number; pending: number } | null>(null)
  const [range, setRange] = React.useState(defaultRange)
  const [exporting, setExporting] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const r = await getPurchasesReport(range)
      setRows(r.rows); setSummary(r.summary)
    } catch { toast.error('Erro ao carregar relatório') }
    finally { setLoading(false) }
  }, [range])

  React.useEffect(() => { load() }, [load])

  async function handleExport() {
    setExporting(true)
    try {
      const { csv, filename } = await exportReportCsv('purchases', range)
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Erro ao exportar') }
    finally { setExporting(false) }
  }

  return (
    <div className="space-y-5">
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard label="Total de pedidos" value={summary.total.toString()} />
          <KpiCard label="Valor total" value={fmtCurrency(summary.total_amount)} color="text-primary" />
          <KpiCard label="Recebidos" value={summary.received.toString()} color="text-green-600 dark:text-green-400" />
          <KpiCard label="Pendentes" value={summary.pending.toString()} color={summary.pending > 0 ? 'text-amber-600' : undefined} />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangePicker start={range.start} end={range.end} onChange={(s, e) => setRange({ start: s, end: e })} />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            <Download className="mr-1.5 h-4 w-4" />{exporting ? 'Exportando...' : 'CSV'}
          </Button>
        </div>
      </div>

      <TableWrap>
        <thead>
          <tr>
            <Th>Nº Pedido</Th><Th>Fornecedor</Th><Th>Status</Th>
            <Th right>Itens</Th><Th right>Total</Th><Th>Data</Th>
          </tr>
        </thead>
        {loading ? <SkeletonRows cols={6} /> : (
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Sem compras no período</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-muted/30">
                <Td><span className="font-mono text-xs font-semibold">{r.order_number}</span></Td>
                <Td>{r.supplier ?? '—'}</Td>
                <Td>
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    r.status === 'received' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    r.status === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  )}>
                    {PO_STATUS[r.status] ?? r.status}
                  </span>
                </Td>
                <Td right mono>{r.items_count}</Td>
                <Td right><span className="font-semibold">{fmtCurrency(r.total_amount)}</span></Td>
                <Td><span className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</span></Td>
              </tr>
            ))}
          </tbody>
        )}
      </TableWrap>
    </div>
  )
}

// ── 5. Curva ABC ───────────────────────────────────────────────
function AbcTab() {
  const [loading, setLoading] = React.useState(true)
  const [rows, setRows] = React.useState<AbcRow[]>([])
  const [isLocked, setIsLocked] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const r = await getAbcCurveReport()
      setRows(r.rows); setIsLocked(r.isLocked)
    } catch { toast.error('Erro ao carregar relatório') }
    finally { setLoading(false) }
  }, [])

  React.useEffect(() => { load() }, [load])

  async function handleExport() {
    setExporting(true)
    try {
      const { csv, filename } = await exportReportCsv('abc')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Erro ao exportar') }
    finally { setExporting(false) }
  }

  if (!loading && isLocked) return <LockedReport name="Curva ABC" />

  const summary = {
    A: rows.filter(r => r.curve === 'A'),
    B: rows.filter(r => r.curve === 'B'),
    C: rows.filter(r => r.curve === 'C'),
  }

  return (
    <div className="space-y-5">
      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <KpiCard label="Curva A (20% produtos)" value={`${summary.A.length} produtos`} sub={`${fmtPct(summary.A.reduce((a, r) => a + r.revenue_pct, 0))} da receita`} color="text-green-600 dark:text-green-400" />
          <KpiCard label="Curva B" value={`${summary.B.length} produtos`} sub={`${fmtPct(summary.B.reduce((a, r) => a + r.revenue_pct, 0))} da receita`} color="text-blue-600 dark:text-blue-400" />
          <KpiCard label="Curva C (80% produtos)" value={`${summary.C.length} produtos`} sub={`${fmtPct(summary.C.reduce((a, r) => a + r.revenue_pct, 0))} da receita`} color="text-muted-foreground" />
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
          <Download className="mr-1.5 h-4 w-4" />{exporting ? 'Exportando...' : 'CSV'}
        </Button>
      </div>

      <TableWrap>
        <thead>
          <tr>
            <Th>#</Th><Th>Produto</Th><Th>SKU</Th><Th>Categoria</Th>
            <Th right>Qtd vendida</Th><Th right>Receita</Th>
            <Th right>% Receita</Th><Th right>% Acum.</Th><Th>Curva</Th>
          </tr>
        </thead>
        {loading ? <SkeletonRows cols={9} /> : (
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">Sem dados suficientes para análise ABC</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.product_id} className="hover:bg-muted/30">
                <Td><span className="text-xs text-muted-foreground font-mono">{r.rank}</span></Td>
                <Td><span className="font-medium">{r.name}</span></Td>
                <Td><span className="font-mono text-xs text-muted-foreground">{r.sku ?? '—'}</span></Td>
                <Td>{r.category}</Td>
                <Td right mono>{r.total_sold_qty}</Td>
                <Td right>{fmtCurrency(r.total_revenue)}</Td>
                <Td right><span className="font-mono text-xs">{fmtPct(r.revenue_pct)}</span></Td>
                <Td right><span className="font-mono text-xs">{fmtPct(r.cumulative_pct)}</span></Td>
                <Td>
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', ABC_CONFIG[r.curve]?.class)}>
                    {r.curve}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        )}
      </TableWrap>
    </div>
  )
}

// ── 6. Produtos Parados ────────────────────────────────────────
function ParadosTab() {
  const [loading, setLoading] = React.useState(true)
  const [rows, setRows] = React.useState<SlowMovingRow[]>([])
  const [isLocked, setIsLocked] = React.useState(false)
  const [summary, setSummary] = React.useState<{ total: number; total_value: number; avg_days: number } | null>(null)
  const [days, setDays] = React.useState(60)
  const [exporting, setExporting] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const r = await getSlowMovingReport(days)
      setRows(r.rows); setIsLocked(r.isLocked); setSummary(r.summary)
    } catch { toast.error('Erro ao carregar relatório') }
    finally { setLoading(false) }
  }, [days])

  React.useEffect(() => { load() }, [load])

  async function handleExport() {
    setExporting(true)
    try {
      const { csv, filename } = await exportReportCsv('slow_moving', { days_stopped: days.toString() })
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Erro ao exportar') }
    finally { setExporting(false) }
  }

  if (!loading && isLocked) return <LockedReport name="Produtos Parados" />

  return (
    <div className="space-y-5">
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <KpiCard label="Produtos parados" value={summary.total.toString()} color={summary.total > 0 ? 'text-amber-600' : undefined} />
          <KpiCard label="Capital imobilizado" value={fmtCurrency(summary.total_value)} color="text-destructive" />
          <KpiCard label="Média de dias parado" value={`${Math.round(summary.avg_days)} dias`} />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Parados há mais de</label>
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {[30, 60, 90, 120, 180].map(d => (
              <option key={d} value={d}>{d} dias</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            <Download className="mr-1.5 h-4 w-4" />{exporting ? 'Exportando...' : 'CSV'}
          </Button>
        </div>
      </div>

      <TableWrap>
        <thead>
          <tr>
            <Th>Produto</Th><Th>SKU</Th><Th>Categoria</Th>
            <Th right>Estoque</Th><Th right>Val. Estoque</Th>
            <Th>Último mov.</Th><Th right>Dias parado</Th>
          </tr>
        </thead>
        {loading ? <SkeletonRows cols={7} /> : (
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Nenhum produto parado por mais de {days} dias</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-muted/30">
                <Td><span className="font-medium">{r.name}</span></Td>
                <Td><span className="font-mono text-xs text-muted-foreground">{r.sku ?? '—'}</span></Td>
                <Td>{r.category ?? '—'}</Td>
                <Td right mono>{r.stock}</Td>
                <Td right><span className="font-semibold text-amber-600">{fmtCurrency(r.stock_value)}</span></Td>
                <Td>{r.last_movement ? fmtDate(r.last_movement) : <span className="text-muted-foreground">Nunca</span>}</Td>
                <Td right>
                  <span className={cn('font-bold font-mono', r.days_stopped > 90 ? 'text-red-600 dark:text-red-400' : 'text-amber-600')}>
                    {r.days_stopped}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        )}
      </TableWrap>
    </div>
  )
}

// ── 7. Margem ──────────────────────────────────────────────────
function MargemTab() {
  const [loading, setLoading] = React.useState(true)
  const [rows, setRows] = React.useState<MarginRow[]>([])
  const [isLocked, setIsLocked] = React.useState(false)
  const [summary, setSummary] = React.useState<{ avg_margin: number; total_revenue: number; total_profit: number; high_margin: number } | null>(null)
  const [exporting, setExporting] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const r = await getMarginReport()
      setRows(r.rows); setIsLocked(r.isLocked); setSummary(r.summary)
    } catch { toast.error('Erro ao carregar relatório') }
    finally { setLoading(false) }
  }, [])

  React.useEffect(() => { load() }, [load])

  async function handleExport() {
    setExporting(true)
    try {
      const { csv, filename } = await exportReportCsv('margin')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Erro ao exportar') }
    finally { setExporting(false) }
  }

  if (!loading && isLocked) return <LockedReport name="Margem de Produtos" />

  return (
    <div className="space-y-5">
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard label="Margem média" value={fmtPct(summary.avg_margin)} color={summary.avg_margin >= 30 ? 'text-green-600 dark:text-green-400' : summary.avg_margin >= 15 ? 'text-amber-600' : 'text-red-600'} />
          <KpiCard label="Receita total" value={fmtCurrency(summary.total_revenue)} color="text-primary" />
          <KpiCard label="Lucro bruto total" value={fmtCurrency(summary.total_profit)} color="text-green-600 dark:text-green-400" />
          <KpiCard label="Boa margem (≥30%)" value={summary.high_margin.toString()} sub="produtos" color="text-green-600 dark:text-green-400" />
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
          <Download className="mr-1.5 h-4 w-4" />{exporting ? 'Exportando...' : 'CSV'}
        </Button>
      </div>

      <TableWrap>
        <thead>
          <tr>
            <Th>Produto</Th><Th>SKU</Th><Th>Categoria</Th>
            <Th right>Custo</Th><Th right>Preço</Th>
            <Th right>Margem R$</Th><Th right>Margem %</Th>
            <Th right>Qtd vendida</Th><Th right>Lucro total</Th>
          </tr>
        </thead>
        {loading ? <SkeletonRows cols={9} /> : (
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">Nenhum produto encontrado</td></tr>
            )}
            {rows.map(r => {
              const marginColor = r.margin_pct >= 30 ? 'text-green-600 dark:text-green-400' : r.margin_pct >= 15 ? 'text-amber-600' : 'text-red-600 dark:text-red-400'
              return (
                <tr key={r.product_id} className="hover:bg-muted/30">
                  <Td><span className="font-medium">{r.name}</span></Td>
                  <Td><span className="font-mono text-xs text-muted-foreground">{r.sku ?? '—'}</span></Td>
                  <Td>{r.category}</Td>
                  <Td right>{fmtCurrency(r.cost_price)}</Td>
                  <Td right>{fmtCurrency(r.sale_price)}</Td>
                  <Td right><span className={marginColor}>{fmtCurrency(r.margin_brl)}</span></Td>
                  <Td right>
                    <span className={cn('font-bold', marginColor)}>{fmtPct(r.margin_pct)}</span>
                  </Td>
                  <Td right mono>{r.total_sold_qty}</Td>
                  <Td right><span className="font-semibold text-green-600 dark:text-green-400">{fmtCurrency(r.total_profit)}</span></Td>
                </tr>
              )
            })}
          </tbody>
        )}
      </TableWrap>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════

const TAB_PANELS: Record<TabId, React.ComponentType> = {
  estoque: EstoqueTab,
  movimentacoes: MovimentacoesTab,
  vendas: VendasTab,
  compras: ComprasTab,
  abc: AbcTab,
  parados: ParadosTab,
  margem: MargemTab,
}

export function ReportsPage() {
  const [activeTab, setActiveTab] = React.useState<TabId>('estoque')
  const Panel = TAB_PANELS[activeTab]

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Relatórios"
        description="Análise detalhada do seu negócio"
        icon={BarChart2}
      />

      {/* Tab nav */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-muted/30 p-1">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                isActive
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {tab.label}
              {(tab.id === 'abc' || tab.id === 'parados' || tab.id === 'margem') && !isActive && (
                <Lock className="h-3 w-3 text-amber-500 opacity-70" />
              )}
            </button>
          )
        })}
      </div>

      {/* Active panel */}
      <div className="min-h-[400px]">
        <Panel />
      </div>
    </div>
  )
}
