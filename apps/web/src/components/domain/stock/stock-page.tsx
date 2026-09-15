'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Plus, ArrowDown, ArrowUp, ArrowLeftRight, ClipboardList, Warehouse,
  Package, TrendingDown, AlertTriangle, X, ChevronDown, Info
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { NumberInput } from '@/components/ui/number-input'
import { KyraCard, KyraAttentionItem } from '@/components/ai'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetBody, SheetFooter, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { getStockProducts, getStockSummary, getStockMovements, createStockMovement } from '@/lib/actions/stock'

type StockFilter = 'all' | 'low' | 'out' | 'slow' | 'excess' | 'fast'
type MovType = 'ENTRADA' | 'SAIDA' | 'AJUSTE' | 'INVENTARIO'

type StockProduct = {
  id: string; name: string; sku: string | null; cost_price: number
  stock_quantity: number; min_stock: number; ai_avg_daily_sales: number | null
  coverage: number | null; status: 'healthy' | 'low' | 'out' | 'slow' | 'excess' | 'fast'
  stock_value: number; unit: string
}

type Movement = {
  id: string; type: string; quantity: number; notes: string | null; created_at: string
  reference_type: string | null
  products: { name: string; sku: string | null } | null
  profiles: { full_name: string | null } | null
}

// ── Helpers ────────────────────────────────────────────────────
function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const STATUS_CONFIG = {
  healthy: { label: 'Saudável', variant: 'neutral' as const },
  low: { label: 'Estoque baixo', variant: 'warning' as const },
  out: { label: 'Sem estoque', variant: 'danger' as const },
  slow: { label: 'Parado', variant: 'neutral' as const },
  excess: { label: 'Excesso', variant: 'info' as const },
  fast: { label: 'Saída rápida', variant: 'success' as const },
}

const MOV_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  ENTRADA: { label: 'Entrada', icon: ArrowDown, color: 'text-green-600' },
  SAIDA: { label: 'Saída', icon: ArrowUp, color: 'text-red-500' },
  AJUSTE: { label: 'Ajuste', icon: ArrowLeftRight, color: 'text-blue-500' },
  INVENTARIO: { label: 'Inventário', icon: ClipboardList, color: 'text-purple-500' },
  TRANSFERENCIA: { label: 'Transferência', icon: ArrowLeftRight, color: 'text-orange-500' },
  DEVOLUCAO: { label: 'Devolução', icon: ArrowDown, color: 'text-teal-600' },
}

// ── KPI Card ───────────────────────────────────────────────────
function KpiCard({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-5', highlight && 'border-destructive/30')}>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={cn('mt-1.5 text-2xl font-bold tracking-tight', highlight && 'text-destructive')}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────
export function StockPage() {
  const [products, setProducts] = React.useState<StockProduct[]>([])
  const [movements, setMovements] = React.useState<Movement[]>([])
  const [summary, setSummary] = React.useState({ totalValue: 0, totalProducts: 0, lowStock: 0, slowMoving: 0 })
  const [loading, setLoading] = React.useState(true)
  const [movLoading, setMovLoading] = React.useState(true)
  const [searchParams] = useSearchParams ? [useSearchParams()] : [null]
  const urlFilter = (searchParams?.get('filter') as StockFilter) ?? 'all'
  const [filter, setFilter] = React.useState<StockFilter>(urlFilter)

  // Movement drawer
  const [movOpen, setMovOpen] = React.useState(false)
  const [movType, setMovType] = React.useState<MovType>('ENTRADA')
  const [movProductId, setMovProductId] = React.useState('')
  const [movQty, setMovQty] = React.useState('')
  const [movNotes, setMovNotes] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const [productsR, summaryR] = await Promise.all([
        getStockProducts(filter),
        getStockSummary(),
      ])
      setProducts(productsR as StockProduct[])
      setSummary(summaryR)
    } catch (e) { toast.error('Erro ao carregar estoque') }
    finally { setLoading(false) }
  }, [filter])

  const loadMovements = React.useCallback(async () => {
    setMovLoading(true)
    try {
      const r = await getStockMovements({ limit: 20 })
      setMovements(r as Movement[])
    } catch { }
    finally { setMovLoading(false) }
  }, [])

  React.useEffect(() => { load() }, [load])
  React.useEffect(() => { loadMovements() }, [loadMovements])

  function openMovement(type?: MovType) {
    setMovType(type ?? 'ENTRADA')
    setMovProductId('')
    setMovQty('')
    setMovNotes('')
    setMovOpen(true)
  }

  async function handleMovement() {
    if (!movProductId) { toast.error('Selecione um produto'); return }
    const qty = parseFloat(movQty.replace(',', '.'))
    if (!qty || qty <= 0) { toast.error('Informe uma quantidade válida'); return }
    setSaving(true)
    try {
      const r = await createStockMovement({ product_id: movProductId, type: movType, quantity: qty, notes: movNotes || undefined })
      if (!r.success) { toast.error(r.error ?? 'Erro ao registrar movimentação'); return }
      toast.success('Movimentação registrada')
      setMovOpen(false)
      load(); loadMovements()
    } finally { setSaving(false) }
  }

  const FILTERS: { id: StockFilter; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'low', label: 'Estoque baixo' },
    { id: 'out', label: 'Sem estoque' },
    { id: 'slow', label: 'Parados' },
    { id: 'excess', label: 'Excesso' },
    { id: 'fast', label: 'Saída rápida' },
  ]

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        icon={Warehouse}
        title="Estoque"
        description="Veja o que você tem, o que está acabando e o que merece sua atenção."
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Movimentar estoque<ChevronDown className="ml-2 h-3.5 w-3.5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openMovement('ENTRADA')}><ArrowDown className="mr-2 h-4 w-4 text-green-600" />Entrada</DropdownMenuItem>
              <DropdownMenuItem onClick={() => openMovement('SAIDA')}><ArrowUp className="mr-2 h-4 w-4 text-red-500" />Saída</DropdownMenuItem>
              <DropdownMenuItem onClick={() => openMovement('AJUSTE')}><ArrowLeftRight className="mr-2 h-4 w-4 text-blue-500" />Ajuste</DropdownMenuItem>
              <DropdownMenuItem onClick={() => openMovement('INVENTARIO')}><ClipboardList className="mr-2 h-4 w-4 text-purple-500" />Inventário</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Valor em estoque" value={fmtCurrency(summary.totalValue)} sub="estimado pelo custo" />
        <KpiCard label="Produtos" value={String(summary.totalProducts)} sub="ativos" />
        <KpiCard label="Estoque baixo" value={String(summary.lowStock)} sub="produtos" highlight={summary.lowStock > 0} />
        <KpiCard label="Estoque parado" value={String(summary.slowMoving)} sub="sem movimentação" />
      </div>

      {/* Kyra attention */}
      {(summary.lowStock > 0 || summary.slowMoving > 0) && (
        <KyraCard label="O que merece sua atenção">
          <div className="flex flex-col gap-2">
            {summary.lowStock > 0 && (
              <KyraAttentionItem
                icon={AlertTriangle}
                iconColor="bg-amber-500"
                title={`${summary.lowStock} produto${summary.lowStock > 1 ? 's' : ''} pode${summary.lowStock > 1 ? 'm' : ''} acabar em breve`}
                sub="Estoque abaixo do mínimo configurado"
                action="Ver produtos"
              />
            )}
            {summary.slowMoving > 0 && (
              <KyraAttentionItem
                icon={TrendingDown}
                iconColor="bg-slate-400"
                title={`${summary.slowMoving} produto${summary.slowMoving > 1 ? 's' : ''} sem movimentação`}
                sub="Nenhuma venda registrada — considere promoção"
                action="Ver produtos"
              />
            )}
          </div>
        </KyraCard>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              filter === f.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Products table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Produto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">SKU</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Estoque</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-1 cursor-default">
                          Cobertura
                          <Info className="h-3 w-3 text-muted-foreground/60" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[220px] text-center text-xs">
                        Tempo estimado para consumir o estoque atual no ritmo de vendas dos últimos 30 dias
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Custo</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Valor em estoque</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhum produto encontrado</p>
                  </td>
                </tr>
              ) : (
                products.map(p => {
                  const status = STATUS_CONFIG[p.status]
                  return (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{p.sku ?? '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className={cn(p.stock_quantity <= 0 ? 'text-destructive font-semibold' : '')}>
                          {p.stock_quantity} {p.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">
                        {p.coverage !== null ? `${p.coverage} dias` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground tabular-nums hidden lg:table-cell">
                        {fmtCurrency(p.cost_price)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums hidden lg:table-cell">
                        {fmtCurrency(p.stock_value)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Movimentações */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold">Movimentações recentes</p>
          <Button variant="ghost" size="sm" className="text-primary">Ver todas</Button>
        </div>
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Produto</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipo</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Quantidade</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {movLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                ) : movements.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                      Nenhuma movimentação registrada
                    </td>
                  </tr>
                ) : (
                  movements.map(m => {
                    const cfg = MOV_CONFIG[m.type] ?? { label: m.type, icon: ArrowLeftRight, color: 'text-muted-foreground' }
                    const Icon = cfg.icon
                    const isDebit = m.type === 'SAIDA'
                    return (
                      <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(m.created_at)}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{m.products?.name ?? '—'}</p>
                          {m.products?.sku && <p className="text-xs text-muted-foreground">{m.products.sku}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Icon className={cn('h-3.5 w-3.5', cfg.color)} />
                            <span>{cfg.label}</span>
                          </div>
                        </td>
                        <td className={cn('px-4 py-3 text-right tabular-nums font-medium', isDebit ? 'text-red-500' : 'text-green-600')}>
                          {isDebit ? '-' : '+'}{m.quantity}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{m.notes ?? m.reference_type ?? '—'}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Movement Sheet */}
      <Sheet open={movOpen} onOpenChange={setMovOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Movimentar estoque</SheetTitle>
            <SheetDescription>Registre uma entrada, saída, ajuste ou inventário.</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <div className="flex flex-col gap-4">
              <FormField id="mov-type" label="Tipo de movimentação">
                <Select value={movType} onValueChange={v => setMovType(v as MovType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ENTRADA">Entrada</SelectItem>
                    <SelectItem value="SAIDA">Saída</SelectItem>
                    <SelectItem value="AJUSTE">Ajuste</SelectItem>
                    <SelectItem value="INVENTARIO">Inventário</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>

              <FormField id="mov-product" label="Produto *">
                <Select value={movProductId} onValueChange={setMovProductId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                  <SelectContent>
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}{p.sku ? ` — ${p.sku}` : ''} ({p.stock_quantity} {p.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField id="mov-qty" label="Quantidade *">
                <NumberInput
                  allowDecimal
                  decimalPlaces={3}
                  min={0.001}
                  placeholder="0"
                  value={parseFloat(movQty) || 0}
                  onChange={v => setMovQty(String(v))}
                />
              </FormField>

              <FormField id="mov-notes" label="Motivo / observação">
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Ex: compra NF 1234, venda #1048, contagem física..."
                  value={movNotes}
                  onChange={e => setMovNotes(e.target.value)}
                />
              </FormField>
            </div>
          </SheetBody>
          <SheetFooter>
            <Button variant="outline" onClick={() => setMovOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleMovement} disabled={saving}>
              {saving ? 'Registrando...' : 'Registrar movimentação'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
