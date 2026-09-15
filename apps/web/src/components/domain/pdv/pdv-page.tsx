'use client'

import * as React from 'react'
import {
  Search, Trash2, Plus, Minus, ShoppingCart, CheckCircle2, X,
  CreditCard, Banknote, QrCode, Barcode, Smartphone,
  Package, User, Tag, Printer, Receipt,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { CurrencyInput } from '@/components/ui/currency-input'
import { searchProductsForPdv, searchCustomersForPdv, createSale, validateCoupon, getCategoriesForPdv } from '@/lib/actions/sales'
import type { PdvProduct, PaymentMethod, PdvCustomer, CouponValidation, PdvCategory } from '@/lib/actions/sales'
import { getCompanySettings } from '@/lib/actions/settings'

// ── Helpers ─────────────────────────────────────────────────────
function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d: Date) {
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Cart item ────────────────────────────────────────────────────
interface CartItem {
  product: PdvProduct
  quantity: number
  unit_price: number
  discount_amount: number
}

// ── Receipt snapshot ─────────────────────────────────────────────
interface ReceiptData {
  sale_number: string
  sale_id: string
  date: Date
  items: CartItem[]
  subtotal: number
  coupon_discount: number
  total: number
  payment: PaymentMethod
  customer_name: string
  cash_received: number
  troco: number
  coupon_code: string
}

// ── Payment methods ──────────────────────────────────────────────
const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ElementType }[] = [
  { value: 'CASH',        label: 'Dinheiro',    icon: Banknote },
  { value: 'PIX',         label: 'Pix',         icon: QrCode },
  { value: 'CREDIT_CARD', label: 'Crédito',     icon: CreditCard },
  { value: 'DEBIT_CARD',  label: 'Débito',      icon: Smartphone },
  { value: 'OTHER',       label: 'Outro',       icon: Barcode },
]

// ── Product card (grid) ──────────────────────────────────────────
function ProductCard({ product, onAdd, allowNegativeStock }: { product: PdvProduct; onAdd: (p: PdvProduct) => void; allowNegativeStock: boolean }) {
  const outOfStock = product.stock_quantity <= 0 && !allowNegativeStock
  return (
    <button
      type="button"
      disabled={outOfStock}
      onClick={() => onAdd(product)}
      className={cn(
        'group relative flex flex-col rounded-xl border border-border bg-card p-3 text-left transition-all',
        'hover:border-primary/40 hover:shadow-sm',
        outOfStock && 'opacity-50 cursor-not-allowed'
      )}
    >
      <div className="mb-2 flex h-16 w-full items-center justify-center rounded-lg bg-muted">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="h-full w-full rounded-lg object-cover" />
        ) : (
          <Package className="h-7 w-7 text-muted-foreground/40" />
        )}
      </div>
      <p className="line-clamp-2 text-xs font-medium leading-tight">{product.name}</p>
      {product.sku && <p className="mt-0.5 text-[10px] text-muted-foreground">{product.sku}</p>}
      <p className="mt-1.5 text-sm font-semibold text-primary">{fmtCurrency(product.sale_price)}</p>
      <p className="text-[10px] text-muted-foreground">
        {outOfStock ? 'Sem estoque' : `Estoque: ${product.stock_quantity}`}
      </p>
      {!outOfStock && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-primary/5 opacity-0 transition-opacity group-hover:opacity-100">
          <Plus className="h-6 w-6 text-primary" />
        </div>
      )}
    </button>
  )
}

// ── Cart row ─────────────────────────────────────────────────────
function CartRow({
  item, onQtyChange, onRemove, allowDiscount, allowNegativeStock, onDiscountChange,
}: {
  item: CartItem
  onQtyChange: (id: string, qty: number) => void
  onRemove: (id: string) => void
  allowDiscount: boolean
  allowNegativeStock: boolean
  onDiscountChange: (id: string, discount: number) => void
}) {
  const lineTotal = item.unit_price * item.quantity - item.discount_amount
  const maxQty = allowNegativeStock ? Infinity : item.product.stock_quantity
  return (
    <div className="flex flex-col py-2 border-b border-border last:border-0 gap-1.5">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.product.name}</p>
          <p className="text-xs text-muted-foreground">{fmtCurrency(item.unit_price)} / {item.product.unit}</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onQtyChange(item.product.id, item.quantity - 1)}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-border hover:bg-muted transition-colors">
            <Minus className="h-3 w-3" />
          </button>
          <span className="w-8 text-center text-sm font-medium tabular-nums">{item.quantity}</span>
          <button type="button" onClick={() => onQtyChange(item.product.id, item.quantity + 1)}
            disabled={item.quantity >= maxQty}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-40">
            <Plus className="h-3 w-3" />
          </button>
        </div>
        <p className="w-20 text-right text-sm font-semibold tabular-nums">{fmtCurrency(lineTotal)}</p>
        <button type="button" onClick={() => onRemove(item.product.id)}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-danger transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {allowDiscount && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">Desconto</span>
          <CurrencyInput
            value={item.discount_amount}
            onChange={v => {
              const max = item.unit_price * item.quantity
              onDiscountChange(item.product.id, Math.max(0, Math.min(v, max)))
            }}
            className="h-6 w-24 text-xs py-0 px-2"
          />
          {item.discount_amount > 0 && (
            <span className="text-[10px] text-success shrink-0">- {fmtCurrency(item.discount_amount)}</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Customer combobox ─────────────────────────────────────────────
function CustomerCombobox({ value, onChange }: { value: string; onChange: (name: string, phone?: string) => void }) {
  const [query, setQuery] = React.useState(value)
  const [open, setOpen] = React.useState(false)
  const [customers, setCustomers] = React.useState<PdvCustomer[]>([])
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => { setQuery(value) }, [value])

  React.useEffect(() => {
    const t = setTimeout(async () => {
      try { setCustomers(await searchCustomersForPdv(query)) } catch {}
    }, 200)
    return () => clearTimeout(t)
  }, [query])

  React.useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="relative">
        <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input type="text" placeholder="Buscar ou digitar cliente..." value={query}
          onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          className={cn(
            'w-full rounded-lg border border-border bg-background pl-8 pr-3 py-1.5 text-xs',
            'placeholder:text-muted-foreground outline-none',
            'focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all'
          )}
        />
      </div>
      {open && customers.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-card shadow-lg overflow-hidden">
          {customers.map(c => (
            <button key={c.id} type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { setQuery(c.name); onChange(c.name, c.phone ?? undefined); setOpen(false) }}
              className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-muted transition-colors">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                <User className="h-3 w-3 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{c.name}</p>
                {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Receipt modal ─────────────────────────────────────────────────
function ReceiptModal({ receipt, onClose }: { receipt: ReceiptData; onClose: () => void }) {
  const paymentLabel = PAYMENT_METHODS.find(p => p.value === receipt.payment)?.label ?? receipt.payment

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 print:bg-white print:items-start">
      <div className={cn(
        'relative w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl overflow-hidden',
        'print:shadow-none print:border-0 print:rounded-none print:max-w-none'
      )}>
        {/* Close button — hidden on print */}
        <button type="button" onClick={onClose}
          className="print:hidden absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors">
          <X className="h-4 w-4" />
        </button>

        <div className="px-6 pt-6 pb-4">
          {/* Header */}
          <div className="flex flex-col items-center gap-2 mb-5 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="font-bold text-base">{receipt.sale_number}</p>
              <p className="text-xs text-muted-foreground">{fmtDate(receipt.date)}</p>
              {receipt.customer_name && (
                <p className="text-xs text-muted-foreground mt-0.5">Cliente: {receipt.customer_name}</p>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="space-y-1.5 mb-4 text-xs border-t border-dashed border-border pt-4">
            {receipt.items.map(item => (
              <div key={item.product.id} className="flex justify-between gap-2">
                <span className="flex-1 truncate text-muted-foreground">
                  {item.quantity}x {item.product.name}
                </span>
                <span className="font-medium tabular-nums shrink-0">
                  {fmtCurrency(item.unit_price * item.quantity - item.discount_amount)}
                </span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-dashed border-border pt-3 space-y-1 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{fmtCurrency(receipt.subtotal)}</span>
            </div>
            {receipt.coupon_discount > 0 && (
              <div className="flex justify-between text-success">
                <span>Desconto{receipt.coupon_code ? ` (${receipt.coupon_code})` : ''}</span>
                <span className="tabular-nums">- {fmtCurrency(receipt.coupon_discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm pt-1 border-t border-border">
              <span>Total</span>
              <span className="tabular-nums text-primary">{fmtCurrency(receipt.total)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Pagamento</span>
              <span>{paymentLabel}</span>
            </div>
            {receipt.payment === 'CASH' && receipt.cash_received > 0 && (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span>Recebido</span>
                  <span className="tabular-nums">{fmtCurrency(receipt.cash_received)}</span>
                </div>
                <div className="flex justify-between font-semibold text-sm">
                  <span>Troco</span>
                  <span className="tabular-nums">{fmtCurrency(receipt.troco)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="print:hidden flex gap-2 px-6 pb-6 pt-2">
          <Button variant="outline" className="flex-1 gap-1.5 h-9 text-sm" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" />
            Imprimir
          </Button>
          <Button className="flex-1 gap-1.5 h-9 text-sm" onClick={onClose}>
            <ShoppingCart className="h-3.5 w-3.5" />
            Nova venda
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────
export function PdvPage() {
  const [search, setSearch] = React.useState('')
  const [selectedCategory, setSelectedCategory] = React.useState('')
  const [categories, setCategories] = React.useState<PdvCategory[]>([])
  const [products, setProducts] = React.useState<PdvProduct[]>([])
  const [loadingProducts, setLoadingProducts] = React.useState(false)
  const [cart, setCart] = React.useState<CartItem[]>([])
  const [payment, setPayment] = React.useState<PaymentMethod>('PIX')
  const [customerName, setCustomerName] = React.useState('')
  const [customerPhone, setCustomerPhone] = React.useState('')

  // Company operation settings
  const [allowNegativeStock, setAllowNegativeStock] = React.useState(false)
  const [allowDiscount, setAllowDiscount] = React.useState(false)

  // Cupom
  const [couponInput, setCouponInput] = React.useState('')
  const [couponLoading, setCouponLoading] = React.useState(false)
  const [appliedCoupon, setAppliedCoupon] = React.useState<CouponValidation | null>(null)
  const [couponError, setCouponError] = React.useState('')

  // Troco
  const [cashReceived, setCashReceived] = React.useState('')

  // Sale state
  const [completing, setCompleting] = React.useState(false)
  const [receipt, setReceipt] = React.useState<ReceiptData | null>(null)

  const searchRef = React.useRef<HTMLInputElement>(null)

  // Search products
  React.useEffect(() => {
    const t = setTimeout(async () => {
      setLoadingProducts(true)
      try { setProducts(await searchProductsForPdv(search, selectedCategory || undefined)) }
      catch { toast.error('Erro ao buscar produtos') }
      finally { setLoadingProducts(false) }
    }, 250)
    return () => clearTimeout(t)
  }, [search, selectedCategory])

  React.useEffect(() => { searchProductsForPdv('').then(setProducts).catch(() => {}) }, [])

  // Load categories
  React.useEffect(() => { getCategoriesForPdv().then(setCategories).catch(() => {}) }, [])

  // Load operation settings
  React.useEffect(() => {
    getCompanySettings().then(s => {
      if (s) {
        setAllowNegativeStock(s.allow_negative_stock)
        setAllowDiscount(s.allow_discount)
      }
    }).catch(() => {})
  }, [])

  function addToCart(product: PdvProduct) {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) {
        if (!allowNegativeStock && existing.quantity >= product.stock_quantity) {
          toast.error('Quantidade máxima atingida')
          return prev
        }
        return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { product, quantity: 1, unit_price: product.sale_price, discount_amount: 0 }]
    })
    // Remove coupon error when cart changes
    setCouponError('')
  }

  function changeQty(productId: string, qty: number) {
    if (qty <= 0) setCart(prev => prev.filter(i => i.product.id !== productId))
    else setCart(prev => prev.map(i => i.product.id === productId ? { ...i, quantity: qty } : i))
    setCouponError('')
  }

  function changeDiscount(productId: string, discount: number) {
    setCart(prev => prev.map(i =>
      i.product.id === productId ? { ...i, discount_amount: discount } : i
    ))
  }

  function removeItem(productId: string) {
    setCart(prev => prev.filter(i => i.product.id !== productId))
  }

  function clearCart() {
    setCart([])
    setCustomerName('')
    setCustomerPhone('')
    setPayment('PIX')
    setAppliedCoupon(null)
    setCouponInput('')
    setCouponError('')
    setCashReceived('')
    setReceipt(null)
    searchRef.current?.focus()
  }

  // Totals
  const subtotal = cart.reduce((acc, i) => acc + i.unit_price * i.quantity - i.discount_amount, 0)
  const couponDiscount = appliedCoupon?.valid
    ? appliedCoupon.discount_type === 'percent'
      ? subtotal * ((appliedCoupon.discount_value ?? 0) / 100)
      : (appliedCoupon.discount_value ?? 0)
    : 0
  const total = Math.max(0, subtotal - couponDiscount)
  const itemCount = cart.reduce((acc, i) => acc + i.quantity, 0)

  // Troco
  const cashReceivedNum = parseFloat(cashReceived.replace(',', '.')) || 0
  const troco = payment === 'CASH' && cashReceivedNum > total ? cashReceivedNum - total : 0

  // Apply coupon
  async function handleApplyCoupon() {
    if (!couponInput.trim()) return
    setCouponLoading(true)
    setCouponError('')
    try {
      const result = await validateCoupon(couponInput.trim(), subtotal)
      if (result.valid) {
        setAppliedCoupon(result)
        toast.success(`Cupom "${result.code}" aplicado!`)
      } else {
        setCouponError(result.error ?? 'Cupom inválido')
        setAppliedCoupon(null)
      }
    } catch {
      setCouponError('Erro ao validar cupom')
    } finally {
      setCouponLoading(false)
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null)
    setCouponInput('')
    setCouponError('')
  }

  async function handleConfirm() {
    if (cart.length === 0) { toast.error('Carrinho vazio'); return }
    if (payment === 'CASH' && cashReceivedNum > 0 && cashReceivedNum < total) {
      toast.error('Valor recebido menor que o total'); return
    }
    setCompleting(true)
    try {
      const result = await createSale({
        items: cart.map(i => ({
          product_id: i.product.id,
          product_name: i.product.name,
          product_sku: i.product.sku,
          unit: i.product.unit,
          quantity: i.quantity,
          unit_price: i.unit_price,
          unit_cost: i.product.cost_price,
          discount_amount: i.discount_amount,
        })),
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        payment_method: payment,
        discount_amount: couponDiscount,
        coupon_code: appliedCoupon?.code || undefined,
      })

      // Build receipt snapshot
      setReceipt({
        sale_number: result.sale_number,
        sale_id: result.id,
        date: new Date(),
        items: [...cart],
        subtotal,
        coupon_discount: couponDiscount,
        total,
        payment,
        customer_name: customerName,
        cash_received: cashReceivedNum,
        troco,
        coupon_code: appliedCoupon?.code ?? '',
      })

      // Atualiza estoque dos cards de produto
      searchProductsForPdv(search).then(setProducts).catch(() => {})

      // Clear cart (receipt stays open)
      setCart([])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao finalizar venda')
    } finally {
      setCompleting(false)
    }
  }

  return (
    <>
      {/* ── Receipt overlay ─────────────────────────────────────── */}
      {receipt && <ReceiptModal receipt={receipt} onClose={clearCart} />}

      <div className="flex flex-col gap-0 h-[calc(100vh-4rem)]">
        <PageHeader title="PDV" description="Ponto de Venda" icon={ShoppingCart} />

        <div className="flex flex-1 overflow-hidden gap-0">
          {/* ── Left: Product search ─────────────────────────── */}
          <div className="flex flex-1 flex-col overflow-hidden border-r border-border">
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input ref={searchRef} placeholder="Buscar produto, SKU ou código..."
                    value={search} onChange={e => setSearch(e.target.value)} className="pl-9" autoFocus />
                </div>
                <div className="relative shrink-0">
                  <select
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    className={cn(
                      'h-9 appearance-none rounded-md border border-input bg-background',
                      'pl-3 pr-8 text-sm text-foreground outline-none cursor-pointer',
                      'focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all',
                      !selectedCategory && 'text-muted-foreground',
                    )}
                    style={{ minWidth: '9rem', maxWidth: '13rem' }}
                  >
                    <option value="">Todas categorias</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <svg
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
                    xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loadingProducts ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-border bg-card p-3 animate-pulse">
                      <div className="h-16 rounded-lg bg-muted mb-2" />
                      <div className="h-3 bg-muted rounded mb-1" />
                      <div className="h-3 bg-muted rounded w-2/3" />
                    </div>
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                  <Package className="h-10 w-10 opacity-30" />
                  <p className="text-sm">Nenhum produto encontrado</p>
                  {search && <Button variant="ghost" size="sm" onClick={() => setSearch('')}>Limpar busca</Button>}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {products.map(p => <ProductCard key={p.id} product={p} onAdd={addToCart} allowNegativeStock={allowNegativeStock} />)}
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Cart + payment ───────────────────────── */}
          <div className="flex w-[400px] shrink-0 flex-col overflow-hidden bg-card">
            {/* Cart header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">Carrinho</span>
                {itemCount > 0 && (
                  <Badge variant="info" className="text-xs">{itemCount} {itemCount === 1 ? 'item' : 'itens'}</Badge>
                )}
              </div>
              {cart.length > 0 && (
                <button type="button" onClick={clearCart}
                  className="text-xs text-muted-foreground hover:text-danger flex items-center gap-1 transition-colors">
                  <X className="h-3 w-3" />
                  Limpar
                </button>
              )}
            </div>

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto px-4 py-2">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 h-full text-muted-foreground py-8">
                  <ShoppingCart className="h-8 w-8 opacity-30" />
                  <p className="text-sm text-center">Clique nos produtos para<br />adicioná-los ao carrinho</p>
                </div>
              ) : (
                cart.map(item => (
                  <CartRow
                    key={item.product.id}
                    item={item}
                    onQtyChange={changeQty}
                    onRemove={removeItem}
                    allowDiscount={allowDiscount}
                    allowNegativeStock={allowNegativeStock}
                    onDiscountChange={changeDiscount}
                  />
                ))
              )}
            </div>

            {/* Payment section */}
            <div className="border-t border-border px-4 pt-3 pb-4 space-y-3">
              {/* Customer */}
              <CustomerCombobox value={customerName}
                onChange={(name, phone) => { setCustomerName(name); if (phone) setCustomerPhone(phone) }} />

              {/* Cupom de desconto */}
              {appliedCoupon?.valid ? (
                <div className="flex items-center justify-between rounded-lg border border-success/40 bg-success/5 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Tag className="h-3.5 w-3.5 text-success shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-success">{appliedCoupon.code}</p>
                      {appliedCoupon.description && (
                        <p className="text-[10px] text-muted-foreground truncate">{appliedCoupon.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-xs font-bold text-success">
                      {appliedCoupon.discount_type === 'percent'
                        ? `-${appliedCoupon.discount_value}%`
                        : `- ${fmtCurrency(appliedCoupon.discount_value ?? 0)}`}
                    </span>
                    <button type="button" onClick={removeCoupon}
                      className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-success/20 transition-colors">
                      <X className="h-3 w-3 text-success" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex gap-1.5">
                    <div className="relative flex-1">
                      <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Cupom de desconto"
                        value={couponInput}
                        onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError('') }}
                        onKeyDown={e => { if (e.key === 'Enter') handleApplyCoupon() }}
                        className={cn(
                          'w-full rounded-lg border bg-background pl-8 pr-3 py-1.5 text-xs uppercase tracking-wide',
                          'placeholder:text-muted-foreground placeholder:normal-case placeholder:tracking-normal outline-none',
                          'focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all',
                          couponError ? 'border-danger/60' : 'border-border'
                        )}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={!couponInput.trim() || couponLoading}
                      className={cn(
                        'shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-all',
                        'hover:border-primary/40 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed'
                      )}
                    >
                      {couponLoading ? '...' : 'Aplicar'}
                    </button>
                  </div>
                  {couponError && <p className="text-[10px] text-danger">{couponError}</p>}
                </div>
              )}

              {/* Payment methods */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Pagamento</p>
                <div className="flex flex-wrap gap-1.5">
                  {PAYMENT_METHODS.map(pm => {
                    const Icon = pm.icon
                    return (
                      <button key={pm.value} type="button"
                        onClick={() => { setPayment(pm.value); setCashReceived('') }}
                        className={cn(
                          'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all',
                          payment === pm.value
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:border-primary/30'
                        )}>
                        <Icon className="h-3 w-3" />
                        {pm.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Troco (somente CASH) */}
              {payment === 'CASH' && (
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <p className="text-xs text-muted-foreground font-medium">Valor recebido</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground shrink-0">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={cashReceived}
                      onChange={e => setCashReceived(e.target.value.replace(/[^0-9,\.]/g, ''))}
                      className={cn(
                        'flex-1 rounded-md border bg-background px-2 py-1 text-sm tabular-nums outline-none',
                        'focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all',
                        'border-border'
                      )}
                    />
                  </div>
                  {cashReceivedNum > 0 && (
                    <div className={cn(
                      'flex justify-between items-center text-sm font-bold pt-1 border-t border-border',
                      troco > 0 ? 'text-success' : 'text-danger'
                    )}>
                      <span>{troco > 0 ? 'Troco' : 'Falta'}</span>
                      <span className="tabular-nums">
                        {troco > 0 ? fmtCurrency(troco) : `- ${fmtCurrency(total - cashReceivedNum)}`}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Totals */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{fmtCurrency(subtotal)}</span>
                </div>
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-xs text-success">
                    <span>Desconto</span>
                    <span className="tabular-nums">- {fmtCurrency(couponDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
                  <span>Total</span>
                  <span className="tabular-nums text-primary">{fmtCurrency(total)}</span>
                </div>
              </div>

              {/* Confirm button */}
              <Button className="w-full gap-2 h-11" disabled={cart.length === 0 || completing} onClick={handleConfirm}>
                {completing ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Receipt className="h-4 w-4" />
                    Finalizar venda · {fmtCurrency(total)}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
