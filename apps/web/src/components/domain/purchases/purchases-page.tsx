'use client'

import * as React from 'react'
import {
  ShoppingCart, Plus, X, AlertTriangle,
  Package, CheckCircle2, Truck, Eye
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/ui/number-input'
import { CurrencyInput } from '@/components/ui/currency-input'
import { KyraCard } from '@/components/ai/kyra-card'
import { Sheet, SheetContent, SheetHeader, SheetBody, SheetFooter, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  getPurchaseSuggestions, getPurchaseOrders, createPurchaseOrder,
  getPurchaseOrderDetail, receivePurchaseOrder,
  cancelPurchaseOrder, advancePurchaseOrderStatus,
  type PurchaseSuggestion, type PurchaseOrder, type PurchaseOrderItem,
  type PurchaseOrderDetail,
} from '@/lib/actions/purchases'
import { getSuppliers } from '@/lib/actions/suppliers'
import { getStockProducts } from '@/lib/actions/stock'

// ── Formatters ────────────────────────────────────────────────
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Rascunho',   color: 'bg-muted text-muted-foreground' },
  sent:      { label: 'Enviado',    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  confirmed: { label: 'Confirmado', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  received:  { label: 'Recebido',   color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  cancelled: { label: 'Cancelado',  color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

// ── Receive Sheet ─────────────────────────────────────────────
function ReceiveSheet({
  order,
  open,
  onOpenChange,
  onSuccess,
}: {
  order: PurchaseOrderDetail | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onSuccess: () => void
}) {
  const [quantities, setQuantities] = React.useState<Record<string, number>>({})
  const [receiving, setReceiving] = React.useState(false)

  React.useEffect(() => {
    if (order) {
      const init: Record<string, number> = {}
      order.items.forEach(i => { init[i.product_id] = i.quantity })
      setQuantities(init)
    }
  }, [order])

  if (!order) return null

  const handleReceive = async () => {
    const items = order.items.map(i => ({
      product_id: i.product_id,
      quantity_received: quantities[i.product_id] ?? 0,
      unit_cost: i.unit_cost,
    }))

    setReceiving(true)
    try {
      const res = await receivePurchaseOrder(order.id, items)
      if (!res.success) { toast.error(res.error ?? 'Erro ao receber'); return }
      toast.success('Recebimento registrado! Estoque atualizado.')
      onOpenChange(false)
      onSuccess()
    } finally {
      setReceiving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-emerald-600" />
            Registrar recebimento
          </SheetTitle>
          <SheetDescription>
            Confirme as quantidades recebidas. O estoque será atualizado automaticamente.
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          <div className="space-y-4">
            {/* Order summary */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1">
              {order.supplier_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fornecedor</span>
                  <span className="font-medium">{order.supplier_name}</span>
                </div>
              )}
              {order.expected_delivery_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data prevista</span>
                  <span>{fmtDate(order.expected_delivery_date)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold pt-1 border-t border-border">
                <span>Total do pedido</span>
                <span>{brl(order.total)}</span>
              </div>
            </div>

            {/* Items */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Itens — quantidade recebida
              </p>
              <div className="space-y-2">
                {order.items.map(item => (
                  <div key={item.product_id} className="rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{item.product_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Pedido: {item.quantity} un. · {brl(item.unit_cost)}/un.
                        </p>
                      </div>
                      <div className="w-28 shrink-0">
                        <NumberInput
                          min={0}
                          max={item.quantity * 2}
                          showStepper
                          value={quantities[item.product_id] ?? item.quantity}
                          onChange={v => setQuantities(prev => ({ ...prev, [item.product_id]: v }))}
                        />
                      </div>
                    </div>
                    {(quantities[item.product_id] ?? item.quantity) !== item.quantity && (
                      <p className={cn(
                        'mt-1.5 text-xs',
                        (quantities[item.product_id] ?? 0) < item.quantity
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      )}>
                        {(quantities[item.product_id] ?? 0) < item.quantity
                          ? `⚠ Recebendo menos do que o pedido (${item.quantity - (quantities[item.product_id] ?? 0)} pendente)`
                          : `✓ Recebendo a mais (${(quantities[item.product_id] ?? 0) - item.quantity} extra)`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>Ao confirmar, o estoque de cada produto será incrementado pelas quantidades recebidas e o pedido será marcado como <strong>Recebido</strong>.</span>
            </div>
          </div>
        </SheetBody>
        <SheetFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={receiving}>Cancelar</Button>
          <Button onClick={handleReceive} disabled={receiving} className="gap-2">
            <Truck className="h-4 w-4" />
            Confirmar recebimento
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ── Detail Sheet ──────────────────────────────────────────────
function DetailSheet({
  order,
  open,
  onOpenChange,
  onReceive,
  onCancel,
  onAdvance,
}: {
  order: PurchaseOrderDetail | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onReceive: () => void
  onCancel: () => void
  onAdvance: () => void
}) {
  if (!order) return null
  const st = STATUS_LABELS[order.status] ?? STATUS_LABELS.draft

  const isDraft     = order.status === 'draft'
  const canReceive  = order.status === 'sent' || order.status === 'confirmed'
  const canAdvance  = order.status === 'draft' || order.status === 'sent'
  const advanceLabel = order.status === 'draft' ? 'Enviar pedido' : 'Confirmar pedido'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            Pedido de compra
          </SheetTitle>
          <SheetDescription>
            {order.supplier_name ?? 'Sem fornecedor'} · {fmtDate(order.created_at)}
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', st.color)}>
                {st.label}
              </span>
            </div>

            {/* Info */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-2">
              {order.supplier_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fornecedor</span>
                  <span className="font-medium">{order.supplier_name}</span>
                </div>
              )}
              {order.expected_delivery_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entrega prevista</span>
                  <span>{fmtDate(order.expected_delivery_date)}</span>
                </div>
              )}
              {order.received_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recebido em</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">{fmtDate(order.received_at)}</span>
                </div>
              )}
            </div>

            {/* Items */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Itens ({order.items.length})
              </p>
              <div className="space-y-1.5">
                {order.items.map(item => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm">
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">{item.quantity} un. × {brl(item.unit_cost)}</p>
                    </div>
                    <p className="font-semibold">{brl(item.total)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span><span>{brl(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Frete</span><span>{brl(order.freight)}</span>
              </div>
              <div className="flex justify-between font-semibold pt-1 border-t border-border text-base">
                <span>Total</span><span>{brl(order.total)}</span>
              </div>
            </div>

            {order.notes && (
              <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
                <p className="text-xs font-semibold uppercase tracking-widest mb-1">Observações</p>
                {order.notes}
              </div>
            )}
          </div>
        </SheetBody>

        {/* Footer — always rendered, actions depend on status */}
        <SheetFooter>
          {isDraft && (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 mr-auto"
              onClick={onCancel}
            >
              Cancelar pedido
            </Button>
          )}
          {!isDraft && !canReceive && (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          )}
          {canReceive && (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          )}
          {canAdvance && (
            <Button onClick={onAdvance} variant={isDraft ? 'outline' : 'default'} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {advanceLabel}
            </Button>
          )}
          {canReceive && (
            <Button onClick={() => { onOpenChange(false); onReceive() }} className="gap-2">
              <Truck className="h-4 w-4" />
              Receber mercadoria
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ── Main component ────────────────────────────────────────────
export function PurchasesPage() {
  const [suggestions, setSuggestions] = React.useState<PurchaseSuggestion[]>([])
  const [orders, setOrders] = React.useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = React.useState<{ id: string; name: string }[]>([])
  const [allProducts, setAllProducts] = React.useState<{ id: string; name: string; sku: string | null; cost_price: number }[]>([])
  const [loading, setLoading] = React.useState(true)
  const [showSuggestions, setShowSuggestions] = React.useState(false)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  // Detail + receive state
  const [selectedOrder, setSelectedOrder] = React.useState<PurchaseOrderDetail | null>(null)
  const [detailOpen, setDetailOpen] = React.useState(false)
  const [receiveOpen, setReceiveOpen] = React.useState(false)
  const [detailLoading, setDetailLoading] = React.useState(false)

  // Form state
  const [supplierId, setSupplierId] = React.useState('')
  const [deliveryDate, setDeliveryDate] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [freight, setFreight] = React.useState(0)
  const [items, setItems] = React.useState<(PurchaseOrderItem & { product_name: string })[]>([])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const [sug, ords, sups, prods] = await Promise.all([
        getPurchaseSuggestions(),
        getPurchaseOrders(),
        getSuppliers({ status: 'active', per_page: 200 }),
        getStockProducts(),
      ])
      setSuggestions(sug)
      setOrders(ords)
      setSuppliers(sups.data.map(s => ({ id: s.id, name: s.name })))
      setAllProducts(prods.map((p: { id: string; name: string; sku: string | null; cost_price: number }) => ({
        id: p.id, name: p.name, sku: p.sku, cost_price: p.cost_price
      })))
    } catch {
      toast.error('Erro ao carregar compras')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { load() }, [load])

  const openDetail = async (orderId: string) => {
    setDetailLoading(true)
    setDetailOpen(true)
    try {
      const detail = await getPurchaseOrderDetail(orderId)
      setSelectedOrder(detail)
    } catch {
      toast.error('Erro ao carregar pedido')
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  const openReceiveFromDetail = () => {
    setDetailOpen(false)
    setReceiveOpen(true)
  }

  const handleCancelOrder = async () => {
    if (!selectedOrder) return
    const res = await cancelPurchaseOrder(selectedOrder.id)
    if (!res.success) { toast.error(res.error ?? 'Erro ao cancelar'); return }
    toast.success('Pedido cancelado')
    setDetailOpen(false)
    setSelectedOrder(null)
    load()
  }

  const handleAdvanceOrder = async () => {
    if (!selectedOrder) return
    const res = await advancePurchaseOrderStatus(selectedOrder.id)
    if (!res.success) { toast.error(res.error ?? 'Erro ao avançar status'); return }
    const nextLabel = selectedOrder.status === 'draft' ? 'Pedido enviado' : 'Pedido confirmado'
    toast.success(nextLabel)
    setDetailOpen(false)
    setSelectedOrder(null)
    load()
  }

  const openReceiveDirect = async (orderId: string) => {
    setDetailLoading(true)
    try {
      const detail = await getPurchaseOrderDetail(orderId)
      setSelectedOrder(detail)
      setReceiveOpen(true)
    } catch {
      toast.error('Erro ao carregar pedido')
    } finally {
      setDetailLoading(false)
    }
  }

  const resetForm = () => {
    setSupplierId(''); setDeliveryDate(''); setNotes(''); setFreight(0); setItems([])
  }

  const openSheet = () => { resetForm(); setSheetOpen(true) }

  const addItem = () => {
    setItems(prev => [...prev, { product_id: '', product_name: '', quantity: 1, unit_cost: 0 }])
  }

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

  const updateItem = (idx: number, field: string, value: string | number) => {
    setItems(prev => {
      const next = [...prev]
      if (field === 'product_id') {
        const prod = allProducts.find(p => p.id === value)
        next[idx] = { ...next[idx], product_id: String(value), product_name: prod?.name ?? '', unit_cost: prod?.cost_price ?? 0 }
      } else {
        next[idx] = { ...next[idx], [field]: value }
      }
      return next
    })
  }

  const subtotal = items.reduce((s, i) => s + (Number(i.quantity) * Number(i.unit_cost)), 0)
  const total = subtotal + freight

  const handleSave = async (status: 'draft' | 'sent') => {
    if (items.length === 0) { toast.error('Adicione pelo menos um produto'); return }
    const invalid = items.find(i => !i.product_id || Number(i.quantity) <= 0)
    if (invalid) { toast.error('Preencha todos os produtos corretamente'); return }

    setSaving(true)
    try {
      const res = await createPurchaseOrder({
        supplier_id: supplierId || null,
        expected_delivery_date: deliveryDate || null,
        notes: notes || null,
        freight: freight,
        items: items.map(i => ({ product_id: i.product_id, product_name: i.product_name, quantity: Number(i.quantity), unit_cost: Number(i.unit_cost) })),
        status,
      })
      if (!res.success) { toast.error(res.error ?? 'Erro ao salvar'); return }
      toast.success(status === 'draft' ? 'Rascunho salvo' : 'Pedido enviado')
      setSheetOpen(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  const urgentCount = suggestions.filter(s => s.is_urgent).length

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        icon={ShoppingCart}
        title="Compras"
        description="Veja o que precisa ser comprado, o que está em andamento e o que merece sua atenção."
        actions={
          <Button onClick={openSheet} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova compra
          </Button>
        }
      />

      {/* ── AI Suggestions card ── */}
      {loading ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : suggestions.length > 0 ? (
        <KyraCard
          label="Compras sugeridas"
          description="Analisei suas vendas, estoque e histórico de compras."
          summary={`${suggestions.length} produto${suggestions.length > 1 ? 's' : ''} pode${suggestions.length === 1 ? '' : 'm'} precisar de reposição nos próximos 15 dias`}
          metrics={[
            { icon: Package, label: 'Produtos', value: suggestions.length },
            ...(urgentCount > 0
              ? [{ icon: AlertTriangle, label: `${urgentCount} urgente${urgentCount > 1 ? 's' : ''}`, className: 'text-amber-600 dark:text-amber-400' }]
              : []),
          ]}
          actions={
            <Button size="sm" variant="default" onClick={() => setShowSuggestions(v => !v)}>
              {showSuggestions ? 'Ocultar sugestões' : 'Ver sugestões'}
            </Button>
          }
          explanation={
            <>
              <p>Recomendo reposição quando o estoque atual cobre menos de 15 dias de vendas, considerando o tempo médio de entrega de 7 dias.</p>
              <p className="mt-1">Produtos urgentes são aqueles com cobertura inferior ao prazo de entrega (risco de ruptura antes da chegada do pedido).</p>
            </>
          }
        >
          {showSuggestions && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 text-left font-medium text-muted-foreground">Produto</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground">Estoque</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground hidden sm:table-cell">Venda média</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground hidden md:table-cell">Cobertura</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground">Sugestão</th>
                    <th className="pb-2 text-left font-medium text-muted-foreground hidden lg:table-cell pl-4">Fornecedor</th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions.map(s => (
                    <tr key={s.product_id} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          {s.is_urgent && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                          <div>
                            <p className="font-medium">{s.product_name}</p>
                            {s.sku && <p className="text-xs text-muted-foreground">{s.sku}</p>}
                          </div>
                          {s.is_urgent && (
                            <Badge className="ml-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">Urgente</Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 text-right">{s.stock_quantity}</td>
                      <td className="py-2.5 text-right hidden sm:table-cell">{s.avg_daily_sales.toFixed(1)}/dia</td>
                      <td className="py-2.5 text-right hidden md:table-cell">
                        <span className={cn(s.coverage_days <= 7 ? 'text-red-600 dark:text-red-400 font-medium' : '')}>
                          {s.coverage_days} dias
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-semibold">{s.suggested_qty} un.</td>
                      <td className="py-2.5 pl-4 hidden lg:table-cell text-muted-foreground">{s.supplier_name ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </KyraCard>
      ) : null}

      {/* ── Orders list ── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Pedidos</h2>
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-12 text-center">
            <ShoppingCart className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">Nenhum pedido de compra ainda.</p>
            <Button size="sm" variant="outline" className="mt-4" onClick={openSheet}>Criar primeiro pedido</Button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fornecedor</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Data prevista</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden md:table-cell">Itens</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Ação</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => {
                  const st = STATUS_LABELS[o.status] ?? STATUS_LABELS.draft
                  const canReceive = o.status === 'sent' || o.status === 'confirmed'
                  return (
                    <tr
                      key={o.id}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => openDetail(o.id)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">{o.supplier_name ?? 'Sem fornecedor'}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(o.created_at)}</p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                        {o.expected_delivery_date ? fmtDate(o.expected_delivery_date) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{brl(o.total)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', st.color)}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell text-muted-foreground">{o.item_count}</td>
                      <td className="px-4 py-3 text-right">
                        {canReceive ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1.5 text-xs"
                            onClick={e => { e.stopPropagation(); openReceiveDirect(o.id) }}
                            disabled={detailLoading}
                          >
                            <Truck className="h-3.5 w-3.5" />
                            Receber
                          </Button>
                        ) : o.status === 'received' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Recebido
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Detail Sheet ── */}
      <DetailSheet
        order={selectedOrder}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onReceive={openReceiveFromDetail}
        onCancel={handleCancelOrder}
        onAdvance={handleAdvanceOrder}
      />

      {/* ── Receive Sheet ── */}
      <ReceiveSheet
        order={selectedOrder}
        open={receiveOpen}
        onOpenChange={setReceiveOpen}
        onSuccess={load}
      />

      {/* ── Nova compra Sheet ── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Nova compra</SheetTitle>
            <SheetDescription>Crie um pedido de compra para um fornecedor.</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <div className="space-y-5">
              <FormField label="Fornecedor">
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar fornecedor" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Data prevista de entrega">
                <Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
              </FormField>

              <FormField label="Observação">
                <textarea
                  className="flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                  placeholder="Observações sobre o pedido..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </FormField>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Produtos</p>
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="rounded-lg border border-border p-3">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0 space-y-2">
                          <Select
                            value={item.product_id}
                            onValueChange={v => updateItem(idx, 'product_id', v)}
                          >
                            <SelectTrigger><SelectValue placeholder="Selecionar produto" /></SelectTrigger>
                            <SelectContent>
                              {allProducts.map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name}{p.sku ? ` · ${p.sku}` : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="grid grid-cols-2 gap-2">
                            <FormField label="Qtd">
                              <NumberInput
                                min={1}
                                showStepper
                                value={item.quantity}
                                onChange={v => updateItem(idx, 'quantity', v)}
                              />
                            </FormField>
                            <FormField label="Custo unit.">
                              <CurrencyInput
                                value={item.unit_cost}
                                onChange={v => updateItem(idx, 'unit_cost', v)}
                              />
                            </FormField>
                          </div>
                        </div>
                        <button
                          onClick={() => removeItem(idx)}
                          className="mt-1 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {item.product_id && (
                        <p className="mt-1.5 text-xs text-right text-muted-foreground">
                          Total: {brl(Number(item.quantity) * Number(item.unit_cost))}
                        </p>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={addItem}>
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar produto
                  </Button>
                </div>
              </div>

              <FormField label="Frete (R$)">
                <CurrencyInput value={freight} onChange={setFreight} />
              </FormField>

              {items.length > 0 && (
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span><span>{brl(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Frete</span><span>{brl(freight)}</span>
                  </div>
                  <div className="flex justify-between font-semibold pt-1 border-t border-border">
                    <span>Total</span><span>{brl(total)}</span>
                  </div>
                </div>
              )}
            </div>
          </SheetBody>
          <SheetFooter>
            <Button variant="ghost" onClick={() => setSheetOpen(false)} disabled={saving}>Cancelar</Button>
            <Button variant="outline" onClick={() => handleSave('draft')} disabled={saving}>Salvar como rascunho</Button>
            <Button onClick={() => handleSave('sent')} disabled={saving}>Salvar e enviar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
