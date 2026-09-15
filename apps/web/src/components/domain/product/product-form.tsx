'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogFooter,
  DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { FormField } from '@/components/ui/form-field'
import { CurrencyInput } from '@/components/ui/currency-input'
import { QuantityInput } from '@/components/ui/quantity-input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { createProduct, updateProduct } from '@/lib/actions/products'
import { productSchema, type ProductFormValues } from '@/lib/validations/product'
import type { ProductWithCategory } from '@/lib/actions/products'
import { UpgradePrompt } from '@/components/ui/upgrade-prompt'

type Category = { id: string; name: string; color: string | null; ncm: string | null }

interface ProductFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: ProductWithCategory
  categories: Category[]
  onSuccess: () => void
}

const UNITS = [
  { value: 'un', label: 'Unidade (un)' },
  { value: 'kg', label: 'Quilograma (kg)' },
  { value: 'lt', label: 'Litro (lt)' },
  { value: 'cx', label: 'Caixa (cx)' },
  { value: 'm',  label: 'Metro (m)' },
  { value: 'g',  label: 'Grama (g)' },
  { value: 'ml', label: 'Mililitro (ml)' },
  { value: 'par', label: 'Par (par)' },
]

export function ProductForm({ open, onOpenChange, product, categories, onSuccess }: ProductFormProps) {
  const isEdit = !!product
  const [loading, setLoading] = React.useState(false)
  const [upgradePrompt, setUpgradePrompt] = React.useState<{ open: boolean; limit?: number | null }>({ open: false })
  const [inheritedNcm, setInheritedNcm] = React.useState<string | null>(null)

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          name: product.name,
          description: product.description ?? '',
          sku: product.sku ?? '',
          barcode: product.barcode ?? '',
          category_id: product.category_id ?? '',
          cost_price: product.cost_price,
          sale_price: product.sale_price,
          min_price: product.min_price ?? undefined,
          min_stock: product.min_stock,
          max_stock: product.max_stock ?? undefined,
          unit: product.unit as ProductFormValues['unit'],
          is_active: product.is_active,
          is_featured: product.is_featured,
          image_url: product.image_url ?? '',
        }
      : {
          name: '',
          description: '',
          sku: '',
          barcode: '',
          category_id: '',
          cost_price: 0,
          sale_price: 0,
          min_stock: 0,
          unit: 'un',
          is_active: true,
          is_featured: false,
          image_url: '',
        },
  })

  // Reset form when dialog opens/closes or product changes
  React.useEffect(() => {
    if (open) {
      reset(product ? {
        name: product.name,
        description: product.description ?? '',
        sku: product.sku ?? '',
        barcode: product.barcode ?? '',
        category_id: product.category_id ?? '',
        cost_price: product.cost_price,
        sale_price: product.sale_price,
        min_price: product.min_price ?? undefined,
        min_stock: product.min_stock,
        max_stock: product.max_stock ?? undefined,
        unit: product.unit as ProductFormValues['unit'],
        is_active: product.is_active,
        is_featured: product.is_featured,
        image_url: product.image_url ?? '',
        ncm: (product as any).ncm ?? '',
      } : {
        name: '', description: '', sku: '', barcode: '', category_id: '',
        cost_price: 0, sale_price: 0, min_stock: 0, unit: 'un',
        is_active: true, is_featured: false, image_url: '',
      })
    }
  }, [open, product, reset])

  const watchedCategoryId = watch('category_id')

  // When category changes, update inheritedNcm from categories list
  React.useEffect(() => {
    if (!watchedCategoryId) { setInheritedNcm(null); return }
    const cat = categories.find(c => c.id === watchedCategoryId)
    setInheritedNcm(cat?.ncm ?? null)
  }, [watchedCategoryId, categories])

  // Init inheritedNcm when form opens with existing product
  React.useEffect(() => {
    if (open && product?.category_id) {
      const cat = categories.find(c => c.id === product.category_id)
      setInheritedNcm(cat?.ncm ?? null)
    } else if (!open) {
      setInheritedNcm(null)
    }
  }, [open, product, categories])

  const watchedCost = watch('cost_price') ?? 0
  const watchedSale = watch('sale_price') ?? 0
  const margin = watchedSale > 0 ? ((watchedSale - watchedCost) / watchedSale) * 100 : 0

  const onSubmit = async (values: ProductFormValues) => {
    setLoading(true)
    try {
      const result = isEdit
        ? await updateProduct(product!.id, values)
        : await createProduct(values)

      if (result.success) {
        toast.success(isEdit ? 'Produto atualizado!' : 'Produto criado com sucesso!')
        onOpenChange(false)
        onSuccess()
      } else if ((result as any).upgradeRequired) {
        setUpgradePrompt({ open: true, limit: (result as any).limit })
      } else {
        toast.error(result.error ?? 'Erro ao salvar produto')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <UpgradePrompt
        open={upgradePrompt.open}
        onClose={() => setUpgradePrompt({ open: false })}
        resource="produtos"
        limit={upgradePrompt.limit}
      />
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Atualize as informacoes do produto.' : 'Preencha os dados para cadastrar um novo produto.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Informacoes basicas */}
          <div className="space-y-4">
            <FormField id="name" label="Nome do produto" required error={errors.name?.message}>
              <Input placeholder="Ex: Camiseta Polo Masculina" {...register('name')} />
            </FormField>

            <FormField id="description" label="Descricao" error={errors.description?.message}>
              <Textarea placeholder="Descricao detalhada do produto..." rows={3} {...register('description')} />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField id="sku" label="SKU" error={errors.sku?.message}>
                <Input placeholder="Ex: CAM-001" {...register('sku')} />
              </FormField>
              <FormField id="barcode" label="Codigo de barras" error={errors.barcode?.message}>
                <Input placeholder="Ex: 7891234567890" {...register('barcode')} />
              </FormField>
            </div>

            {/* NCM fiscal — inherited from category, optional per-product override */}
            <div className="space-y-2">
              <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">NCM (código fiscal)</p>
                {inheritedNcm ? (
                  <p className="text-sm font-mono">{inheritedNcm}
                    <span className="ml-2 text-xs text-muted-foreground">herdado da categoria</span>
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Nenhum NCM na categoria selecionada</p>
                )}
              </div>
              <FormField
                id="ncm"
                label="NCM específico do produto (opcional)"
                error={errors.ncm?.message}
                hint="Preencha apenas se este produto tiver NCM diferente da categoria"
              >
                <Input
                  placeholder={inheritedNcm ? `Padrão: ${inheritedNcm}` : "Ex: 61091000"}
                  maxLength={8}
                  {...register('ncm')}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 8)
                    e.target.value = v
                    register('ncm').onChange(e)
                  }}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField id="category_id" label="Categoria">
                <Select
                  defaultValue={product?.category_id ?? ''}
                  onValueChange={(v) => setValue('category_id', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sem categoria</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <div className="flex items-center gap-2">
                          {c.color && (
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                          )}
                          {c.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField id="unit" label="Unidade de medida" required error={errors.unit?.message}>
                <Select
                  defaultValue={product?.unit ?? 'un'}
                  onValueChange={(v) => setValue('unit', v as ProductFormValues['unit'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          </div>

          <Separator />

          {/* Precos */}
          <div className="space-y-4">
            <p className="text-sm font-medium text-foreground">Precificacao</p>
            <div className="grid grid-cols-2 gap-4">
              <FormField id="cost_price" label="Preco de custo" required error={errors.cost_price?.message}>
                <CurrencyInput
                  value={watchedCost}
                  onChange={(v) => setValue('cost_price', v, { shouldValidate: true })}
                />
              </FormField>
              <FormField id="sale_price" label="Preco de venda" required error={errors.sale_price?.message}>
                <CurrencyInput
                  value={watchedSale}
                  onChange={(v) => setValue('sale_price', v, { shouldValidate: true })}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField id="min_price" label="Preco minimo (opcional)" error={errors.min_price?.message}>
                <CurrencyInput
                  value={watch('min_price') ?? 0}
                  onChange={(v) => setValue('min_price', v)}
                />
              </FormField>
              <div className="flex items-end pb-0.5">
                <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 w-full">
                  <p className="text-xs text-muted-foreground">Margem calculada</p>
                  <p className={`text-lg font-bold ${margin >= 30 ? 'text-success' : margin >= 10 ? 'text-warning' : 'text-danger'}`}>
                    {margin.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Estoque */}
          <div className="space-y-4">
            <p className="text-sm font-medium text-foreground">Controle de estoque</p>
            <div className="grid grid-cols-2 gap-4">
              <FormField id="min_stock" label="Estoque minimo" required error={errors.min_stock?.message}>
                <QuantityInput
                  value={watch('min_stock')}
                  onChange={(v) => setValue('min_stock', v, { shouldValidate: true })}
                />
              </FormField>
              <FormField id="max_stock" label="Estoque maximo (opcional)" error={errors.max_stock?.message}>
                <QuantityInput
                  value={watch('max_stock') ?? 0}
                  onChange={(v) => setValue('max_stock', v === 0 ? undefined : v)}
                />
              </FormField>
            </div>
          </div>

          <Separator />

          {/* Flags */}
          <div className="flex gap-8">
            <div className="flex items-center gap-3">
              <Switch
                id="is_active"
                checked={watch('is_active')}
                onCheckedChange={(v) => setValue('is_active', v)}
              />
              <Label htmlFor="is_active">Produto ativo</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="is_featured"
                checked={watch('is_featured')}
                onCheckedChange={(v) => setValue('is_featured', v)}
              />
              <Label htmlFor="is_featured">Produto em destaque</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" loading={loading}>
              {isEdit ? 'Salvar alteracoes' : 'Criar produto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  )
}
