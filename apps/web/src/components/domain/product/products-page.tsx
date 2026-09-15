'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, SlidersHorizontal, Search, X, Package } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DataTable, TablePagination } from '@/components/composite/data-table'
import { ProductForm } from './product-form'
import { getProductColumns } from './product-columns'
import { getProducts, updateProduct, getCategories } from '@/lib/actions/products'
import type { ProductWithCategory } from '@/lib/actions/products'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Category = { id: string; name: string; color: string | null; ncm: string | null }
type QuickFilter = 'all' | 'active' | 'low_stock' | 'no_image' | 'no_cost'

/** Filtros rápidos idênticos ao Figma */
const QUICK_FILTERS: { value: QuickFilter; label: string }[] = [
  { value: 'all',       label: 'Todos' },
  { value: 'active',    label: 'Ativos' },
  { value: 'low_stock', label: 'Estoque baixo' },
  { value: 'no_image',  label: 'Sem imagem' },
  { value: 'no_cost',   label: 'Sem custo' },
]

export function ProductsPage() {
  const router = useRouter()
  const [products, setProducts] = React.useState<ProductWithCategory[]>([])
  const [categories, setCategories] = React.useState<Category[]>([])
  const [loading, setLoading] = React.useState(true)
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const perPage = 20

  const [searchParams] = useSearchParams ? [useSearchParams()] : [null]
  const urlFilter = (searchParams?.get('filter') as QuickFilter) ?? 'all'
  const [quickFilter, setQuickFilter] = React.useState<QuickFilter>(urlFilter)
  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  const [filterOpen, setFilterOpen] = React.useState(false)
  const [filterCategoryId, setFilterCategoryId] = React.useState('')

  // Edit dialog (kept for backward compat — edit also navigates full-page)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingProduct, setEditingProduct] = React.useState<ProductWithCategory | undefined>()
  const [deleteTarget, setDeleteTarget] = React.useState<ProductWithCategory | undefined>()
  const [deleteLoading, setDeleteLoading] = React.useState(false)

  // Debounce search
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  function getActionParams(qf: QuickFilter) {
    switch (qf) {
      case 'active':    return { status: 'active' as const, stock_status: 'all' as const }
      case 'low_stock': return { status: 'active' as const, stock_status: 'low' as const }
      case 'no_image':  return { status: 'all'    as const, stock_status: 'all' as const, no_image: true }
      case 'no_cost':   return { status: 'all'    as const, stock_status: 'all' as const, no_cost: true }
      default:          return { status: 'all'    as const, stock_status: 'all' as const }
    }
  }

  const fetchProducts = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = getActionParams(quickFilter)
      const result = await getProducts({
        search: debouncedSearch || undefined,
        category_id: filterCategoryId || undefined,
        page,
        per_page: perPage,
        ...params,
      })
      setProducts(result.data)
      setTotal(result.total)
    } catch {
      toast.error('Erro ao carregar produtos')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, quickFilter, page, filterCategoryId])

  React.useEffect(() => { fetchProducts() }, [fetchProducts])
  React.useEffect(() => {
    getCategories().then(setCategories).catch(() => {})
  }, [])

  // Reset page ao mudar filtros
  React.useEffect(() => { setPage(1) }, [debouncedSearch, quickFilter, filterCategoryId])

  const handleEdit = (p: ProductWithCategory) => {
    router.push(`/products/${p.id}/edit`)
  }

  const handleNew = () => {
    router.push('/products/new')
  }

  const handleToggleActive = async (p: ProductWithCategory) => {
    const result = await updateProduct(p.id, { is_active: !p.is_active })
    if (result.success) {
      toast.success(p.is_active ? 'Produto desativado' : 'Produto ativado')
      fetchProducts()
    } else {
      toast.error(result.error ?? 'Erro ao atualizar produto')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    const result = await updateProduct(deleteTarget.id, { is_active: false })
    setDeleteLoading(false)
    if (result.success) {
      toast.success('Produto removido')
      setDeleteTarget(undefined)
      fetchProducts()
    } else {
      toast.error(result.error ?? 'Erro ao remover produto')
    }
  }

  const columns = React.useMemo(
    () => getProductColumns({
      onEdit: handleEdit,
      onToggleActive: handleToggleActive,
      onDelete: setDeleteTarget,
      onStockMove: fetchProducts,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const totalPages = Math.ceil(total / perPage)
  const hasActiveFilters = !!filterCategoryId

  return (
    <>
      {/* ── Conteúdo principal ── */}
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          icon={Package}
          title="Produtos"
          description="Gerencie seus produtos, preços e estoque."
          breadcrumbs={[{ label: 'Produtos' }]}
          actions={
            <Button variant="primary" onClick={handleNew}>
              <Plus className="mr-1.5 h-4 w-4" />
              Novo produto
            </Button>
          }
        />

        {/* ── Toolbar: busca + Filtros ── */}
        <div className="flex items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar produto, SKU ou código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            className={cn('gap-1.5 shrink-0', hasActiveFilters && 'border-primary text-primary')}
            onClick={() => setFilterOpen((o) => !o)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
            {hasActiveFilters && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                1
              </span>
            )}
          </Button>

          {total > 0 && (
            <span className="ml-auto text-sm text-muted-foreground shrink-0">
              {total} produto{total !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* ── Painel de filtros (expandível) ── */}
        {filterOpen && (
          <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-end gap-4 -mt-3">
            <div className="flex flex-col gap-1.5 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground">Categoria</label>
              <Select
                value={filterCategoryId}
                onValueChange={setFilterCategoryId}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas as categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas as categorias</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={() => { setFilterCategoryId('') }}
              >
                <X className="h-3.5 w-3.5" />
                Limpar filtros
              </Button>
            )}
          </div>
        )}

        {/* ── Filtros rápidos ── */}
        <div className="-mt-3 flex items-center gap-1 border-b border-border">
          {QUICK_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setQuickFilter(f.value)}
              className={cn(
                'relative px-3 pb-2.5 pt-1 text-sm font-medium transition-colors focus-visible:outline-none',
                quickFilter === f.value
                  ? 'text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ── Tabela ── */}
        <DataTable
          columns={columns}
          data={products}
          loading={loading}
          keyExtractor={(p) => p.id}
          emptyTitle="Nenhum produto encontrado"
          emptyDescription="Cadastre seu primeiro produto clicando em Novo produto."
          emptyAction={{ label: 'Novo produto', onClick: handleNew }}
        />

        {totalPages > 1 && (
          <TablePagination
            page={page}
            totalPages={totalPages}
            total={total}
            perPage={perPage}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* ── Formulário de edição (fallback — preferir rota /products/[id]/edit) ── */}
      <ProductForm
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editingProduct}
        categories={categories}
        onSuccess={fetchProducts}
      />

      {/* ── Confirmação de exclusão ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(undefined)}
        title="Remover produto?"
        description={`"${deleteTarget?.name}" será desativado. Você pode reativá-lo depois.`}
        confirmLabel="Remover"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDelete}
      />
    </>
  )
}
