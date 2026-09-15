'use client'

import * as React from 'react'
import { Package, MoreHorizontal, Pencil, Trash2, ToggleLeft, ToggleRight, ArrowUpDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '@/lib/utils'
import { createStockMovement } from '@/lib/actions/stock'
import { toast } from 'sonner'
import type { Column } from '@/components/composite/data-table'
import type { ProductWithCategory } from '@/lib/actions/products'

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** Determina o status combinado (ativo + estoque) igual ao Figma */
function getProductStatus(p: ProductWithCategory): 'active' | 'low_stock' | 'out_of_stock' | 'inactive' {
  if (!p.is_active) return 'inactive'
  if (p.stock_quantity <= 0) return 'out_of_stock'
  if (p.min_stock && p.stock_quantity <= p.min_stock) return 'low_stock'
  return 'active'
}

function StatusBadge({ product }: { product: ProductWithCategory }) {
  const status = getProductStatus(product)
  const map = {
    active:      { label: 'Ativo',          variant: 'success'   },
    low_stock:   { label: 'Estoque baixo',  variant: 'warning'   },
    out_of_stock:{ label: 'Sem estoque',    variant: 'danger'    },
    inactive:    { label: 'Inativo',        variant: 'secondary' },
  } as const
  const { label, variant } = map[status]
  return <Badge variant={variant}>{label}</Badge>
}

function StockCell({ product }: { product: ProductWithCategory }) {
  const status = getProductStatus(product)
  const qty = product.stock_quantity
  const unit = product.unit ?? 'un.'

  const colorClass =
    status === 'out_of_stock' ? 'text-danger font-semibold' :
    status === 'low_stock'    ? 'text-warning font-semibold' :
    'text-foreground'

  return (
    <span className={cn('text-sm tabular-nums', colorClass)}>
      {qty} {unit}
    </span>
  )
}


// ── Stock Movement Popover ────────────────────────────────────
type MovType = 'ENTRADA' | 'SAIDA' | 'AJUSTE'

function StockMovementPopover({
  product,
  onDone,
}: {
  product: ProductWithCategory
  onDone?: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [type, setType] = React.useState<MovType>('ENTRADA')
  const [qty, setQty] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const quantity = parseFloat(qty.replace(',', '.'))
    if (!quantity || quantity <= 0) { toast.error('Quantidade inválida'); return }
    setLoading(true)
    const result = await createStockMovement({
      product_id: product.id,
      type,
      quantity,
      notes: notes.trim() || undefined,
    })
    setLoading(false)
    if (result.success) {
      toast.success('Estoque atualizado')
      setOpen(false)
      setQty('')
      setNotes('')
      onDone?.()
    } else {
      toast.error(result.error ?? 'Erro ao movimentar estoque')
    }
  }

  const TYPE_OPTS: { value: MovType; label: string; color: string }[] = [
    { value: 'ENTRADA',  label: 'Entrada',  color: 'text-success' },
    { value: 'SAIDA',    label: 'Saída',    color: 'text-destructive' },
    { value: 'AJUSTE',   label: 'Ajuste',   color: 'text-warning' },
  ]

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
          title="Movimentar estoque"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="left"
          align="center"
          sideOffset={8}
          className={cn(
            'z-50 w-64 rounded-lg border border-border bg-background p-4 shadow-lg',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          )}
        >
          <div className="mb-3">
            <p className="text-sm font-medium leading-tight line-clamp-1">{product.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Estoque atual: <span className="font-medium tabular-nums">{product.stock_quantity} {product.unit}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Tipo */}
            <div className="flex rounded-md border border-border overflow-hidden text-xs">
              {TYPE_OPTS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={cn(
                    'flex-1 py-1.5 font-medium transition-colors',
                    type === opt.value
                      ? `bg-muted ${opt.color}`
                      : 'text-muted-foreground hover:bg-muted/50'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Quantidade */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Quantidade</label>
              <input
                type="number"
                min="0.001"
                step="any"
                value={qty}
                onChange={e => setQty(e.target.value)}
                placeholder="0"
                className={cn(
                  'w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm tabular-nums',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0'
                )}
                autoFocus
                required
              />
            </div>

            {/* Observação */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Observação <span className="opacity-50">(opcional)</span></label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="ex: Compra NF 1234"
                className={cn(
                  'w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0'
                )}
              />
            </div>

            <Button type="submit" className="w-full h-8 text-xs" disabled={loading}>
              {loading ? 'Salvando...' : 'Confirmar movimentação'}
            </Button>
          </form>

          <PopoverPrimitive.Arrow className="fill-border" />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

export function getProductColumns({
  onEdit,
  onToggleActive,
  onDelete,
  onStockMove,
}: {
  onEdit: (p: ProductWithCategory) => void
  onToggleActive: (p: ProductWithCategory) => void
  onDelete: (p: ProductWithCategory) => void
  onStockMove?: () => void
}): Column<ProductWithCategory>[] {
  return [
    // PRODUTO — thumbnail + nome
    {
      key: 'name',
      header: 'Produto',
      sortable: true,
      cell: (p) => (
        <div className="flex items-center gap-3 min-w-[160px]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            {p.image_url ? (
              <img src={p.image_url} alt={p.name} className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <Package className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <span className="font-medium text-foreground leading-tight line-clamp-2">{p.name}</span>
        </div>
      ),
    },

    // SKU — coluna separada (igual ao Figma)
    {
      key: 'sku',
      header: 'SKU',
      cell: (p) =>
        p.sku ? (
          <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>
        ) : (
          <span className="text-xs text-muted-foreground/50">—</span>
        ),
    },

    // CATEGORIA
    {
      key: 'category',
      header: 'Categoria',
      cell: (p) =>
        p.category ? (
          <div className="flex items-center gap-1.5">
            {p.category.color && (
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: p.category.color }}
              />
            )}
            <span className="text-sm">{p.category.name}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/50">—</span>
        ),
    },

    // ESTOQUE — quantidade colorida
    {
      key: 'stock',
      header: 'Estoque',
      headerClassName: 'text-right',
      className: 'text-right',
      cell: (p) => <StockCell product={p} />,
    },

    // CUSTO
    {
      key: 'cost_price',
      header: 'Custo',
      sortable: true,
      headerClassName: 'text-right',
      className: 'text-right',
      cell: (p) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {BRL.format(p.cost_price)}
        </span>
      ),
    },

    // PREÇO — preço de venda
    {
      key: 'sale_price',
      header: 'Preço',
      sortable: true,
      headerClassName: 'text-right',
      className: 'text-right',
      cell: (p) => (
        <span className="text-sm tabular-nums font-medium">
          {BRL.format(p.sale_price)}
        </span>
      ),
    },

    // STATUS — combina is_active + nível de estoque
    {
      key: 'status',
      header: 'Status',
      cell: (p) => <StatusBadge product={p} />,
    },

    // MOVIMENTAÇÃO DE ESTOQUE
    {
      key: 'stock_move',
      header: '',
      className: 'w-8',
      cell: (p) => (
        <StockMovementPopover product={p} onDone={onStockMove} />
      ),
    },

    // AÇÕES
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      cell: (p) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Ações</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(p)}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggleActive(p)}>
              {p.is_active ? (
                <><ToggleLeft className="mr-2 h-3.5 w-3.5" />Desativar</>
              ) : (
                <><ToggleRight className="mr-2 h-3.5 w-3.5" />Ativar</>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(p)}
              className="text-danger focus:text-danger"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]
}
