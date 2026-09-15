'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronLeft, Sparkles, ImageIcon, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { FormField } from '@/components/ui/form-field'
import { CurrencyInput } from '@/components/ui/currency-input'
import { QuantityInput } from '@/components/ui/quantity-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createProduct, getCategories, uploadProductImage } from '@/lib/actions/products'
import { getBrands } from '@/lib/actions/brands'
import { productSchema, type ProductFormValues } from '@/lib/validations/product'

type Category = { id: string; name: string; color: string | null; ncm: string | null }
type Brand = { id: string; name: string }

const UNITS = [
  { value: 'un',  label: 'Unidade (un)' },
  { value: 'kg',  label: 'Quilograma (kg)' },
  { value: 'lt',  label: 'Litro (lt)' },
  { value: 'cx',  label: 'Caixa (cx)' },
  { value: 'm',   label: 'Metro (m)' },
  { value: 'g',   label: 'Grama (g)' },
  { value: 'ml',  label: 'Mililitro (ml)' },
  { value: 'par', label: 'Par (par)' },
]

const TABS = [
  { id: 'info',        label: 'Informações básicas' },
  { id: 'prices',      label: 'Preços' },
  { id: 'stock',       label: 'Estoque' },
  { id: 'images',      label: 'Imagens' },
  { id: 'description', label: 'Descrição' },
  { id: 'extra',       label: 'Dados adicionais' },
]

// ── ImageUploadField ──────────────────────────────────────────
function ImageUploadField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Apenas imagens são permitidas')
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const result = await uploadProductImage(fd)
      if (result.success && result.url) {
        onChange(result.url)
        toast.success('Imagem adicionada')
      } else {
        toast.error(result.error ?? 'Erro ao fazer upload da imagem')
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      {value ? (
        <div className="flex items-start gap-4">
          <div className="relative h-40 w-40 overflow-hidden rounded-xl border border-border bg-muted/30">
            <img src={value} alt="Imagem do produto" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute right-1.5 top-1.5 rounded-full bg-background/90 p-0.5 shadow-sm hover:bg-destructive hover:text-white transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex flex-col gap-2 pt-1">
            <p className="text-sm font-medium text-foreground">Imagem adicionada</p>
            <p className="text-xs text-muted-foreground">Clique no × para remover</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="mt-1"
            >
              {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Trocar imagem
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]) }}
          className="flex flex-col items-center justify-center gap-3 h-48 w-full rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/20 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {uploading
            ? <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
            : <ImageIcon className="h-8 w-8 text-muted-foreground" />
          }
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              {uploading ? 'Fazendo upload...' : 'Adicionar imagem'}
            </p>
            {!uploading && (
              <p className="text-xs text-muted-foreground mt-0.5">Clique ou arraste — JPG, PNG, WebP até 5 MB</p>
            )}
          </div>
        </button>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────
export default function ProductManualPage() {
  const router = useRouter()
  const [categories, setCategories] = React.useState<Category[]>([])
  const [brands, setBrands] = React.useState<Brand[]>([])
  const [activeTab, setActiveTab] = React.useState('info')
  const [submitting, setSubmitting] = React.useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '', description: '', sku: '', barcode: '',
      category_id: '', cost_price: 0, sale_price: 0,
      min_price: undefined, min_stock: 0, max_stock: undefined,
      unit: 'un', is_active: true, is_featured: false, image_url: '',
    },
  })

  const isActive = watch('is_active')
  const isFeatured = watch('is_featured')
  const unit = watch('unit')
  const categoryId = watch('category_id')
  const brandId = watch('brand_id')
  const imageUrl = watch('image_url')

  React.useEffect(() => {
    getCategories().then(setCategories).catch(() => {})
    getBrands().then(r => setBrands(r.data)).catch(() => {})
  }, [])

  const onSubmit = async (values: ProductFormValues) => {
    setSubmitting(true)
    try {
      const result = await createProduct(values)
      if (result.success) {
        toast.success('Produto criado com sucesso!')
        router.push('/products')
      } else {
        toast.error(result.error ?? 'Erro ao criar produto')
      }
    } catch {
      toast.error('Erro inesperado ao criar produto')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* ── Header ── */}
      <div className="border-b border-border bg-background px-6 py-4">
        <button
          onClick={() => router.push('/products/new')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar
        </button>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">Novo produto</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1">
        {/* ── Tab bar (sticky) ── */}
        <div className="border-b border-border bg-background sticky top-0 z-10">
          <div className="max-w-4xl mx-auto w-full px-6">
            <div className="flex items-center">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'relative shrink-0 whitespace-nowrap px-4 pb-3 pt-3 text-sm font-medium transition-colors focus-visible:outline-none',
                    activeTab === tab.id
                      ? 'text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Form content (centered) ── */}
        <div className="max-w-4xl mx-auto w-full px-6 py-8 flex-1 pb-32">

          {/* TAB: Informações básicas */}
          {activeTab === 'info' && (
            <div className="flex flex-col gap-5 max-w-2xl">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">
                    Nome <span className="text-destructive">*</span>
                  </label>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-md border border-primary px-3 py-1 text-xs font-medium text-primary hover:bg-primary/5 transition-colors"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Preencher com IA
                  </button>
                </div>
                <Input {...register('name')} placeholder="Nome do produto" />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField id="sku" label="SKU" error={errors.sku?.message}>
                  <Input {...register('sku')} placeholder="Ex: CAM-PRE-M" className="font-mono" />
                </FormField>
                <FormField id="barcode" label="EAN / GTIN" error={errors.barcode?.message}>
                  <Input {...register('barcode')} placeholder="0000000000000" className="font-mono" />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField id="category_id" label="Categoria" error={errors.category_id?.message}>
                  <Select value={categoryId} onValueChange={(v) => setValue('category_id', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField id="brand_id" label="Marca">
                  <Select value={brandId ?? ''} onValueChange={(v) => setValue('brand_id', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sem marca</SelectItem>
                      {brands.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField id="unit" label="Unidade" error={errors.unit?.message}>
                  <Select value={unit} onValueChange={(v) => setValue('unit', v as ProductFormValues['unit'])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNITS.map((u) => (
                        <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField id="type" label="Tipo">
                  <Input placeholder="Produto acabado" disabled className="bg-muted/40" />
                </FormField>
              </div>
            </div>
          )}

          {/* TAB: Preços */}
          {activeTab === 'prices' && (
            <div className="flex flex-col gap-5 max-w-2xl">
              <div className="grid grid-cols-2 gap-4">
                <FormField id="cost_price" label="Custo" error={errors.cost_price?.message}>
                  <CurrencyInput
                    value={watch('cost_price')}
                    onChange={(v) => setValue('cost_price', v)}
                    placeholder="R$ 0,00"
                  />
                </FormField>
                <FormField id="sale_price" label="Preço de venda" error={errors.sale_price?.message}>
                  <CurrencyInput
                    value={watch('sale_price')}
                    onChange={(v) => setValue('sale_price', v)}
                    placeholder="R$ 0,00"
                  />
                </FormField>
              </div>
              <FormField id="min_price" label="Preço mínimo" error={errors.min_price?.message}>
                <CurrencyInput
                  value={watch('min_price')}
                  onChange={(v) => setValue('min_price', v)}
                  placeholder="R$ 0,00 (opcional)"
                />
              </FormField>
            </div>
          )}

          {/* TAB: Estoque */}
          {activeTab === 'stock' && (
            <div className="flex flex-col gap-5 max-w-2xl">
              <div className="grid grid-cols-2 gap-4">
                <FormField id="min_stock" label="Estoque mínimo" error={errors.min_stock?.message}>
                  <QuantityInput
                    value={watch('min_stock')}
                    onChange={(v) => setValue('min_stock', v)}
                  />
                </FormField>
                <FormField id="max_stock" label="Estoque máximo" error={errors.max_stock?.message}>
                  <QuantityInput
                    value={watch('max_stock')}
                    onChange={(v) => setValue('max_stock', v)}
                    placeholder="Sem limite"
                  />
                </FormField>
              </div>
            </div>
          )}

          {/* TAB: Imagens */}
          {activeTab === 'images' && (
            <div className="flex flex-col gap-5 max-w-2xl">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Imagem do produto</label>
                <p className="text-xs text-muted-foreground">
                  Adicione uma foto clara do produto. A imagem aparece na lista e no ponto de venda.
                </p>
              </div>
              <ImageUploadField
                value={imageUrl ?? ''}
                onChange={(url) => setValue('image_url', url)}
              />
            </div>
          )}

          {/* TAB: Descrição */}
          {activeTab === 'description' && (
            <div className="flex flex-col gap-5 max-w-2xl">
              <FormField id="description" label="Descrição" error={errors.description?.message}>
                <Textarea
                  {...register('description')}
                  placeholder="Descreva o produto, materiais, características..."
                  rows={6}
                />
              </FormField>
            </div>
          )}

          {/* TAB: Dados adicionais */}
          {activeTab === 'extra' && (
            <div className="flex flex-col gap-4 max-w-2xl">
              <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
                <div>
                  <Label htmlFor="is_active" className="text-sm font-medium">Produto ativo</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Produto visível e disponível para venda</p>
                </div>
                <Switch
                  id="is_active"
                  checked={isActive}
                  onCheckedChange={(v) => setValue('is_active', v)}
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
                <div>
                  <Label htmlFor="is_featured" className="text-sm font-medium">Produto em destaque</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Exibir em seções de destaque</p>
                </div>
                <Switch
                  id="is_featured"
                  checked={isFeatured}
                  onCheckedChange={(v) => setValue('is_featured', v)}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Sticky footer ── */}
        <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur px-6 py-4 flex items-center justify-end gap-3 z-20">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/products/new')}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Salvando...' : 'Salvar produto'}
          </Button>
        </div>
      </form>
    </div>
  )
}
