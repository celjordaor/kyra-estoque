'use client'

import * as React from 'react'
import { Search, TrendingUp, ShoppingBag, Receipt, Percent, RotateCcw, X, FileText, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetHeader, SheetBody, SheetFooter, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import {
  getSales, getSalesSummary, getSaleDetail, refundSale,
  type Sale, type SaleStatus, type SalesSummary, type SaleDetail, type NfeEmissionDoc,
} from '@/lib/actions/sales'
import { emitNfe, checkNfeEmissionFeature } from '@/lib/actions/nfe'

// ── Formatters ────────────────────────────────────────────────
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const fmtDateShort = (d: string) => new Date(d).toLocaleDateString('pt-BR')

const STATUS_CONFIG: Record<SaleStatus, { label: string; color: string }> = {
  PENDING:   { label: 'Pendente',  color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  COMPLETED: { label: 'Concluída', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  CANCELLED: { label: 'Cancelada', color: 'bg-muted text-muted-foreground' },
  REFUNDED:  { label: 'Devolvida', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Dinheiro', CREDIT_CARD: 'Crédito', DEBIT_CARD: 'Débito',
  PIX: 'Pix', BOLETO: 'Boleto', TRANSFER: 'Transferência', OTHER: 'Outro',
}

const STATUS_FILTERS: { key: SaleStatus | 'all'; label: string }[] = [
  { key: 'all',       label: 'Todas' },
  { key: 'COMPLETED', label: 'Concluídas' },
  { key: 'PENDING',   label: 'Pendentes' },
  { key: 'CANCELLED', label: 'Canceladas' },
  { key: 'REFUNDED',  label: 'Devolvidas' },
]

// ── KPI Card ──────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub }: {
  icon: React.ElementType; label: string; value: string; sub?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ── Refund confirm dialog ─────────────────────────────────────
function RefundConfirm({
  open,
  sale,
  onConfirm,
  onCancel,
  loading,
}: {
  open: boolean
  sale: SaleDetail | null
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  if (!open || !sale) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm mx-4 rounded-xl border border-border bg-card p-6 shadow-xl">
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <RotateCcw className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="font-semibold">Confirmar devolução</p>
            <p className="text-xs text-muted-foreground">Venda {sale.sale_number}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          O estoque de <strong>{sale.item_count} {sale.item_count === 1 ? 'produto' : 'produtos'}</strong> será restituído
          e a venda de <strong>{brl(sale.total_amount)}</strong> será marcada como <strong>Devolvida</strong>.
          Esta ação não pode ser desfeita.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>Cancelar</Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={loading}
            className="gap-2"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Confirmar devolução
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Sale detail Sheet ─────────────────────────────────────────
function SaleDetailSheet({
  sale,
  open,
  onOpenChange,
  onRefund,
  hasNfeEmission,
  onNfeEmitted,
}: {
  sale: SaleDetail | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onRefund: () => void
  hasNfeEmission: boolean
  onNfeEmitted: () => void
}) {
  const [emitting, setEmitting] = React.useState(false)

  const handleEmit = async () => {
    if (!sale) return
    setEmitting(true)
    const res = await emitNfe({ saleId: sale.id })
    setEmitting(false)
    if (res.ok) {
      toast.success('NF-e enviada para processamento!')
      onNfeEmitted()
    } else {
      toast.error(res.error ?? 'Erro ao emitir NF-e')
    }
  }

  if (!sale) return null
  const st = STATUS_CONFIG[sale.status]
  const canRefund = sale.status === 'COMPLETED'
  const canEmit = hasNfeEmission && sale.status === 'COMPLETED'
  const nfe = sale.nfe_emission

  const nfeBadgeColor: Record<string, string> = {
    authorized:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    processing:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    pending:     'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    rejected:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    cancelled:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }
  const nfeLabel: Record<string, string> = {
    authorized: 'NF-e Autorizada',
    processing: 'NF-e em processamento',
    pending:    'NF-e aguardando',
    rejected:   'NF-e Rejeitada',
    cancelled:  'NF-e Cancelada',
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold">{sale.sale_number}</span>
          </SheetTitle>
          <SheetDescription>{fmtDate(sale.created_at)}</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <div className="space-y-4">
            {/* Status + payment */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', st.color)}>
                {st.label}
              </span>
              {sale.payment_method && (
                <span className="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                  {PAYMENT_LABELS[sale.payment_method] ?? sale.payment_method}
                </span>
              )}
            </div>

            {/* Customer */}
            {(sale.customer_name || sale.customer_email || sale.customer_phone) && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Cliente</p>
                {sale.customer_name && <p className="font-medium">{sale.customer_name}</p>}
                {sale.customer_phone && <p className="text-muted-foreground">{sale.customer_phone}</p>}
                {sale.customer_email && <p className="text-muted-foreground">{sale.customer_email}</p>}
              </div>
            )}

            {/* Items */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Itens ({sale.items.length})
              </p>
              <div className="space-y-1.5">
                {sale.items.map(item => (
                  <div key={item.id} className="rounded-lg border border-border px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">{item.product_name}</p>
                        {item.product_sku && (
                          <p className="text-xs text-muted-foreground">{item.product_sku}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.quantity} × {brl(item.unit_price)}
                          {item.discount_amount > 0 && ` − ${brl(item.discount_amount)} desc.`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-sm">{brl(item.total_price)}</p>
                        {item.margin != null && (
                          <p className={cn(
                            'text-xs',
                            item.margin >= 20 ? 'text-emerald-600 dark:text-emerald-400' :
                            item.margin < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
                          )}>
                            {item.margin.toFixed(1)}% mg
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1.5">
              {sale.discount_amount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span><span>{brl(sale.subtotal)}</span>
                </div>
              )}
              {sale.discount_amount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Desconto</span><span>− {brl(sale.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-base pt-1 border-t border-border">
                <span>Total</span><span>{brl(sale.total_amount)}</span>
              </div>
              {sale.margin != null && (
                <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t border-border">
                  <span>Margem</span>
                  <span className={cn(
                    sale.margin >= 20 ? 'text-emerald-600 dark:text-emerald-400' :
                    sale.margin < 0 ? 'text-red-600 dark:text-red-400' : ''
                  )}>
                    {sale.margin.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>

            {/* Notes */}
            {sale.notes && (
              <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
                <p className="text-xs font-semibold uppercase tracking-widest mb-1">Observações</p>
                {sale.notes}
              </div>
            )}

            {/* Refunded notice */}
            {sale.status === 'REFUNDED' && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-xs text-red-700 dark:text-red-400 flex items-start gap-2">
                <RotateCcw className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>Esta venda foi devolvida. O estoque foi restituído automaticamente.</span>
              </div>
            )}
          </div>
        </SheetBody>
        {/* NF-e status badge inside body */}
        {canEmit && nfe && (
          <div className={cn('rounded-lg px-3 py-2.5 text-sm flex items-center gap-2', nfeBadgeColor[nfe.status] ?? 'bg-muted text-muted-foreground')}>
            <FileText className="h-4 w-4 shrink-0" />
            <span className="flex-1">{nfeLabel[nfe.status] ?? `NF-e: ${nfe.status}`}</span>
            {nfe.pdf_url && (
              <a href={nfe.pdf_url} target="_blank" rel="noopener noreferrer" className="underline flex items-center gap-1 text-xs">
                DANFE <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}
        {(canRefund || canEmit) && (
          <SheetFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
            {canEmit && (!nfe || nfe.status === 'rejected' || nfe.status === 'cancelled') && (
              <Button onClick={handleEmit} disabled={emitting} className="gap-2">
                <FileText className="h-4 w-4" />
                {emitting ? 'Enviando…' : 'Emitir NF-e'}
              </Button>
            )}
            {canRefund && (
              <Button variant="destructive" onClick={onRefund} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Devolver venda
              </Button>
            )}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ── Main component ────────────────────────────────────────────
export function SalesPage() {
  const [sales, setSales] = React.useState<Sale[]>([])
  const [summary, setSummary] = React.useState<SalesSummary | null>(null)
  const [total, setTotal] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [statusFilter, setStatusFilter] = React.useState<SaleStatus | 'all'>('all')
  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')

  // Detail sheet state
  const [selectedSale, setSelectedSale] = React.useState<SaleDetail | null>(null)
  const [detailOpen, setDetailOpen] = React.useState(false)
  const [detailLoading, setDetailLoading] = React.useState(false)

  // Refund state
  const [refundOpen, setRefundOpen] = React.useState(false)
  const [refunding, setRefunding] = React.useState(false)

  // NF-e emission feature flag
  const [hasNfeEmission, setHasNfeEmission] = React.useState(false)
  React.useEffect(() => {
    checkNfeEmissionFeature().then(setHasNfeEmission)
  }, [])

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const [{ data, total: t }, sum] = await Promise.all([
        getSales({ status: statusFilter, search: debouncedSearch }),
        getSalesSummary(),
      ])
      setSales(data)
      setTotal(t)
      setSummary(sum)
    } catch {
      toast.error('Erro ao carregar vendas')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, debouncedSearch])

  React.useEffect(() => { load() }, [load])

  const openDetail = async (saleId: string) => {
    setDetailLoading(true)
    setDetailOpen(true)
    try {
      const detail = await getSaleDetail(saleId)
      setSelectedSale(detail)
    } catch {
      toast.error('Erro ao carregar venda')
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleRefund = async () => {
    if (!selectedSale) return
    setRefunding(true)
    try {
      const res = await refundSale(selectedSale.id)
      if (!res.success) { toast.error(res.error ?? 'Erro ao devolver'); return }
      toast.success('Devolução registrada. Estoque restituído.')
      setRefundOpen(false)
      setDetailOpen(false)
      load()
    } finally {
      setRefunding(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        icon={ShoppingBag}
        title="Vendas"
        description="Consulte e gerencie o histórico de vendas realizadas."
      />

      {/* ── KPI Summary ── */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard icon={TrendingUp}  label="Receita total"  value={brl(summary.total_revenue)} sub="vendas concluídas" />
          <KpiCard icon={ShoppingBag} label="Vendas"         value={String(summary.total_sales)} />
          <KpiCard icon={Receipt}     label="Ticket médio"   value={brl(summary.avg_ticket)} />
          <KpiCard
            icon={Percent}
            label="Margem média"
            value={summary.total_margin != null ? `${summary.total_margin.toFixed(1)}%` : '—'}
          />
        </div>
      ) : null}

      {/* ── Filters ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                statusFilter === f.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto sm:w-64">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por número ou cliente..."
            className="pl-8 h-8 text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── Sales table ── */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </div>
      ) : sales.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <ShoppingBag className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">
            {search || statusFilter !== 'all' ? 'Nenhuma venda encontrada com esses filtros.' : 'Nenhuma venda registrada ainda.'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">As vendas realizadas pelo PDV aparecerão aqui.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Venda</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Cliente</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Pagamento</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden lg:table-cell">Margem</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sales.map(sale => {
                const st = STATUS_CONFIG[sale.status]
                return (
                  <tr
                    key={sale.id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => openDetail(sale.id)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-semibold text-foreground">{sale.sale_number}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(sale.created_at)}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <p className="font-medium">{sale.customer_name ?? '—'}</p>
                      {sale.creator_name && (
                        <p className="text-xs text-muted-foreground">por {sale.creator_name}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                      {sale.payment_method ? PAYMENT_LABELS[sale.payment_method] ?? sale.payment_method : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{brl(sale.total_amount)}</td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell">
                      {sale.margin != null ? (
                        <span className={cn('font-medium', sale.margin >= 20 ? 'text-emerald-600 dark:text-emerald-400' : sale.margin < 0 ? 'text-red-600 dark:text-red-400' : '')}>
                          {sale.margin.toFixed(1)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', st.color)}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {hasNfeEmission && sale.status === 'COMPLETED' && (
                          <button
                            type="button"
                            title="Emitir / Ver NF-e"
                            className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            onClick={() => openDetail(sale.id)}
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                        )}
                        {sale.status === 'COMPLETED' && (
                          <button
                            type="button"
                            title="Devolver venda"
                            className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                            onClick={() => openDetail(sale.id)}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {total > sales.length && (
            <div className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground">
              Exibindo {sales.length} de {total} vendas
            </div>
          )}
        </div>
      )}

      {/* ── Sale Detail Sheet ── */}
      {detailLoading ? null : (
        <SaleDetailSheet
          sale={selectedSale}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          onRefund={() => setRefundOpen(true)}
          hasNfeEmission={hasNfeEmission}
          onNfeEmitted={() => {
            // Reload detail to show updated NF-e status
            if (selectedSale) openDetail(selectedSale.id)
          }}
        />
      )}

      {/* ── Refund confirm ── */}
      <RefundConfirm
        open={refundOpen}
        sale={selectedSale}
        onConfirm={handleRefund}
        onCancel={() => setRefundOpen(false)}
        loading={refunding}
      />
    </div>
  )
}
