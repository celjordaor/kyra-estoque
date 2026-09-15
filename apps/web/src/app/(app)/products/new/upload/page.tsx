'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload, ChevronLeft, CheckCircle2, AlertTriangle,
  Sparkles, ImageIcon, Loader2, Star, Pencil, X, Check
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { EntitySelect, type EntityRef } from '@/components/ui/entity-select'
import { createProduct, uploadProductImage } from '@/lib/actions/products'
import { searchCategories, createCategoryAndReturn } from '@/lib/actions/categories'
import { searchBrands, createBrandAndReturn } from '@/lib/actions/brands'

// ── Types ──────────────────────────────────────────────────────

type AIField = { value: string; confidence: number }

type AIResult = {
  overallConfidence: number
  fields: {
    name:        AIField
    category:    AIField
    brand:       AIField
    color:       AIField
    size:        AIField
    description: AIField
    tags:        AIField
  }
}

/** Categoria e Marca armazenam {id, label} — id=null enquanto não resolvido */
type ProductDraft = {
  name:         string
  category:     EntityRef
  brand:        EntityRef
  color:        string
  size:         string
  description:  string
  tags:         string
  sku?:         string
  imageDataUrl?: string
  sale_price?:  number
  cost_price?:  number
}

type ExistingProduct = { id: string; name: string; sku: string; stock: number }

type WizardState =
  | { step: 'upload' }
  | { step: 'analyzing';  imageDataUrl: string }
  | { step: 'result';     imageDataUrl: string; result: AIResult; draft: ProductDraft }
  | { step: 'low_conf';   imageDataUrl: string; result: AIResult }
  | { step: 'editing';    draft: ProductDraft }
  | { step: 'duplicate';  imageDataUrl: string; result: AIResult; existing: ExistingProduct }
  | { step: 'validation'; draft: ProductDraft }
  | { step: 'success';    name: string }

// ── AI simulation ──────────────────────────────────────────────

async function analyzeProductImage(_url: string): Promise<AIResult> {
  await new Promise((r) => setTimeout(r, 2200))
  return {
    overallConfidence: 0.87,
    fields: {
      name:        { value: 'Camiseta Básica Preta — M', confidence: 0.98 },
      category:    { value: 'Vestuário',                  confidence: 0.96 },
      brand:       { value: 'Marca X',                    confidence: 0.72 },
      color:       { value: 'Preto',                      confidence: 0.85 },
      size:        { value: 'M',                          confidence: 0.90 },
      description: { value: 'Camiseta básica de algodão, confortável e versátil.', confidence: 0.80 },
      tags:        { value: 'camiseta, básico, algodão',  confidence: 0.75 },
    },
  }
}

/**
 * Tenta resolver automaticamente o label contra o banco.
 * Match exato (case-insensitive) → retorna o ID.
 * Caso contrário → { id: null, label }.
 */
async function resolveEntity(
  label: string,
  searchFn: (q: string) => Promise<{ id: string; name: string }[]>
): Promise<EntityRef> {
  if (!label.trim()) return { id: null, label }
  try {
    const results = await searchFn(label)
    const exact = results.find((r) => r.name.toLowerCase() === label.toLowerCase())
    if (exact) return { id: exact.id, label: exact.name }
  } catch { /* continua sem resolver */ }
  return { id: null, label }
}

// ── Confidence helpers ─────────────────────────────────────────

function confBarColor(c: number) {
  if (c >= 0.85) return 'bg-emerald-500'
  if (c >= 0.60) return 'bg-amber-400'
  return 'bg-red-400'
}
function dotColor(c: number) {
  if (c === 0)   return 'bg-muted-foreground/40'
  if (c >= 0.70) return 'bg-emerald-500'
  if (c >= 0.50) return 'bg-amber-400'
  return 'bg-red-500'
}
function dotLabelText(c: number) {
  if (c === 0)   return 'Não identificada'
  if (c >= 0.70) return 'Alta confiança'
  if (c >= 0.50) return 'Média confiança'
  return 'Precisa confirmar'
}
function dotLabelColor(c: number) {
  if (c === 0)   return 'text-muted-foreground/60'
  if (c >= 0.70) return 'text-emerald-600'
  if (c >= 0.50) return 'text-amber-500'
  return 'text-red-500'
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden max-w-[80px]">
        <div className={cn('h-full rounded-full', confBarColor(confidence))} style={{ width: `${Math.round(confidence * 100)}%` }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{Math.round(confidence * 100)}%</span>
    </div>
  )
}

// ── InlineEditField ────────────────────────────────────────────

function InlineEditField({ label, value, confidence, onChange, multiline }: {
  label: string; value: string; confidence?: number
  onChange: (v: string) => void; multiline?: boolean
}) {
  const [editing, setEditing] = React.useState(false)
  const [draft,   setDraft]   = React.useState(value)
  const inputRef = React.useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  React.useEffect(() => {
    if (editing) { setDraft(value); setTimeout(() => inputRef.current?.focus(), 0) }
  }, [editing])

  function confirm() { onChange(draft); setEditing(false) }
  function cancel()  { setDraft(value); setEditing(false) }

  return (
    <div className="flex flex-col gap-0.5 group">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        {confidence !== undefined && !editing && <ConfidenceBar confidence={confidence} />}
      </div>
      {editing ? (
        <div className="flex items-start gap-1.5 mt-0.5">
          {multiline ? (
            <textarea ref={inputRef as React.Ref<HTMLTextAreaElement>} value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') cancel(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirm() } }}
              rows={3} className="flex-1 text-sm rounded-md border border-primary bg-background px-2 py-1 outline-none resize-none" />
          ) : (
            <input ref={inputRef as React.Ref<HTMLInputElement>} value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') cancel(); if (e.key === 'Enter') confirm() }}
              className="flex-1 text-sm rounded-md border border-primary bg-background px-2 py-1 outline-none" />
          )}
          <button onClick={confirm} className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 shrink-0">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={cancel} className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-muted shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground leading-snug">
            {value || <span className="text-muted-foreground italic">Não identificado</span>}
          </span>
          <button onClick={() => setEditing(true)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground transition-all">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Shell ──────────────────────────────────────────────────────

function Shell({ children, backLabel, onBack }: { children: React.ReactNode; backLabel?: string; onBack?: () => void }) {
  return (
    <div className="flex flex-col min-h-full">
      <div className="max-w-2xl mx-auto w-full flex flex-col flex-1 px-6 py-8 gap-6">
        {onBack && (
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
            <ChevronLeft className="h-4 w-4" />{backLabel ?? 'Voltar'}
          </button>
        )}
        {children}
      </div>
    </div>
  )
}

const ANALYSIS_STEPS = ['Analisando imagem...', 'Identificando produto...', 'Procurando dados...', 'Preparando cadastro...']

// ── Helpers ────────────────────────────────────────────────────

async function buildDraft(result: AIResult, imageDataUrl?: string): Promise<ProductDraft> {
  // Resolve categoria e marca contra o banco em paralelo
  const [category, brand] = await Promise.all([
    resolveEntity(result.fields.category.value, searchCategories),
    resolveEntity(result.fields.brand.value,    searchBrands),
  ])
  return {
    name:        result.fields.name.value,
    category,
    brand,
    color:       result.fields.color.value,
    size:        result.fields.size.value,
    description: result.fields.description.value,
    tags:        result.fields.tags.value,
    imageDataUrl,
  }
}

// ── EntityRef label helper ─────────────────────────────────────
function entityLabel(ref: EntityRef) {
  return ref.label || ''
}

// ── Main ───────────────────────────────────────────────────────

export default function ProductUploadPage() {
  const router = useRouter()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [state,        setState]        = React.useState<WizardState>({ step: 'upload' })
  const [analysisStep, setAnalysisStep] = React.useState(0)
  const [submitting,   setSubmitting]   = React.useState(false)
  const [dragging,     setDragging]     = React.useState(false)

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) { toast.error('Envie uma imagem JPEG, PNG ou WEBP.'); return }
    const reader = new FileReader()
    reader.onload = (e) => setState({ step: 'analyzing', imageDataUrl: e.target?.result as string })
    reader.readAsDataURL(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]; if (file) handleFile(file)
  }

  React.useEffect(() => {
    if (state.step !== 'analyzing') return
    setAnalysisStep(0)
    let step = 0
    const interval = setInterval(() => { step++; if (step < ANALYSIS_STEPS.length) setAnalysisStep(step); else clearInterval(interval) }, 550)
    const { imageDataUrl } = state
    analyzeProductImage(imageDataUrl).then(async (result) => {
      clearInterval(interval)
      setAnalysisStep(ANALYSIS_STEPS.length)
      const draft = await buildDraft(result, imageDataUrl)
      setTimeout(() => {
        if (result.overallConfidence >= 0.70) setState({ step: 'result', imageDataUrl, result, draft })
        else setState({ step: 'low_conf', imageDataUrl, result })
      }, 400)
    })
    return () => clearInterval(interval)
  }, [state.step])

  async function handleCreate(draft: ProductDraft) {
    setSubmitting(true)
    try {
      let imageUrl = ''
      if (draft.imageDataUrl) {
        try {
          const res = await fetch(draft.imageDataUrl)
          const blob = await res.blob()
          const ext = blob.type.split('/')[1] ?? 'jpg'
          const file = new File([blob], `product.${ext}`, { type: blob.type })
          const fd = new FormData(); fd.append('file', file)
          const upload = await uploadProductImage(fd)
          if (upload.success && upload.url) imageUrl = upload.url
        } catch {}
      }

      // Resolve category_id — cria se ainda não tiver ID
      let categoryId = draft.category.id
      if (!categoryId && draft.category.label.trim()) {
        const r = await createCategoryAndReturn(draft.category.label.trim())
        if (r.success && r.id) categoryId = r.id
      }

      // Resolve brand_id — cria se ainda não tiver ID
      let brandId = draft.brand.id
      if (!brandId && draft.brand.label.trim()) {
        const r = await createBrandAndReturn(draft.brand.label.trim())
        if (r.success && r.id) brandId = r.id
      }

      const result = await createProduct({
        name:        draft.name || 'Produto sem nome',
        description: draft.description || '',
        sku:         draft.sku || '',
        barcode:     '',
        category_id: categoryId || '',
        brand_id:    brandId    || '',
        cost_price:  draft.cost_price  ?? 0,
        sale_price:  draft.sale_price  ?? 0,
        min_stock:   0,
        unit:        'un',
        is_active:   true,
        is_featured: false,
        image_url:   imageUrl,
      })
      if (result.success) setState({ step: 'success', name: draft.name })
      else toast.error(result.error ?? 'Erro ao criar produto')
    } catch { toast.error('Erro inesperado ao criar produto') }
    finally { setSubmitting(false) }
  }

  // ═══════════════════════════════════════════
  // UPLOAD
  // ═══════════════════════════════════════════

  if (state.step === 'upload') return (
    <Shell backLabel="Voltar para Novo" onBack={() => router.push('/products/new')}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cadastre seu produto em segundos.</h1>
        <p className="mt-1 text-muted-foreground text-sm">Tire uma foto e deixe a IA preparar o cadastro para você.</p>
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn('flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/40')}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
          <ImageIcon className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="font-medium text-foreground">Arraste uma imagem ou tire uma foto</p>
          <p className="mt-1 text-sm text-muted-foreground">JPEG, PNG ou WEBP · até 10 MB</p>
        </div>
        <Button variant="outline" size="sm" className="mt-2" type="button">
          <Upload className="mr-1.5 h-4 w-4" />Escolher arquivo
        </Button>
      </div>
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
      <p className="text-sm text-muted-foreground">
        Prefere digitar?{' '}
        <button onClick={() => router.push('/products/new/manual')} className="font-medium text-primary underline-offset-4 hover:underline">
          Fazer cadastro manual
        </button>
      </p>
    </Shell>
  )

  // ═══════════════════════════════════════════
  // ANALYZING
  // ═══════════════════════════════════════════

  if (state.step === 'analyzing') return (
    <Shell>
      <div className="flex flex-col items-center gap-8 py-8">
        <div className="h-28 w-28 overflow-hidden rounded-2xl border border-border shadow-sm">
          <img src={state.imageDataUrl} alt="Produto" className="h-full w-full object-cover" />
        </div>
        <div className="flex flex-col gap-4 w-full max-w-xs">
          {ANALYSIS_STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-3">
              {i < analysisStep  ? <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              : i === analysisStep ? <Loader2 className="h-5 w-5 text-primary shrink-0 animate-spin" />
              : <div className="h-5 w-5 rounded-full border-2 border-muted shrink-0" />}
              <span className={cn('text-sm transition-colors',
                i < analysisStep ? 'text-foreground' : i === analysisStep ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  )

  // ═══════════════════════════════════════════
  // RESULT — alta confiança, edição inline
  // ═══════════════════════════════════════════

  if (state.step === 'result') {
    const { result, imageDataUrl, draft } = state
    const isHighConf = result.overallConfidence >= 0.85

    function updateDraft(patch: Partial<ProductDraft>) {
      setState({ step: 'result', imageDataUrl, result, draft: { ...draft, ...patch } })
    }

    return (
      <Shell backLabel="Voltar" onBack={() => setState({ step: 'upload' })}>
        <div className="flex items-start gap-3">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            isHighConf ? 'bg-emerald-100 dark:bg-emerald-950/40' : 'bg-amber-100 dark:bg-amber-950/40')}>
            <Sparkles className={cn('h-5 w-5', isHighConf ? 'text-emerald-600' : 'text-amber-500')} />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">O Kyra preparou este cadastro</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Passe o mouse sobre cada campo para editar antes de salvar.</p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-border">
            <img src={imageDataUrl} alt="Produto" className="h-full w-full object-cover" />
          </div>
          <div className="flex flex-col gap-3 flex-1 rounded-xl border border-border bg-card p-4">
            <InlineEditField label="Nome do produto" value={draft.name} confidence={result.fields.name.confidence}
              onChange={(v) => updateDraft({ name: v })} />

            {/* Categoria — EntitySelect */}
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Categoria</span>
                <ConfidenceBar confidence={result.fields.category.confidence} />
              </div>
              <EntitySelect
                value={draft.category}
                onChange={(v) => updateDraft({ category: v })}
                entityName="categoria"
                searchFn={searchCategories}
                createFn={createCategoryAndReturn}
                placeholder="Selecionar categoria…"
              />
            </div>

            {/* Marca — EntitySelect */}
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Marca</span>
                <ConfidenceBar confidence={result.fields.brand.confidence} />
              </div>
              <EntitySelect
                value={draft.brand}
                onChange={(v) => updateDraft({ brand: v })}
                entityName="marca"
                searchFn={searchBrands}
                createFn={createBrandAndReturn}
                placeholder="Selecionar marca…"
              />
            </div>

            <InlineEditField label="Cor"      value={draft.color} confidence={result.fields.color.confidence} onChange={(v) => updateDraft({ color: v })} />
            <InlineEditField label="Tamanho"  value={draft.size}  confidence={result.fields.size.confidence}  onChange={(v) => updateDraft({ size: v })} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <InlineEditField label="Descrição" value={draft.description} confidence={result.fields.description.confidence} multiline
            onChange={(v) => updateDraft({ description: v })} />
        </div>

        <div className={cn('flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium',
          isHighConf ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                     : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400')}>
          <Sparkles className="h-4 w-4 shrink-0" />
          {isHighConf ? `Identificado com ${Math.round(result.overallConfidence * 100)}% de confiança`
                      : `Confiança moderada: ${Math.round(result.overallConfidence * 100)}%`}
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={() => setState({ step: 'validation', draft })}>Confirmar e salvar</Button>
          <Button variant="outline" onClick={() => setState({ step: 'editing', draft })}>Editar em formulário completo</Button>
        </div>
      </Shell>
    )
  }

  // ═══════════════════════════════════════════
  // LOW CONF
  // ═══════════════════════════════════════════

  if (state.step === 'low_conf') {
    const { result, imageDataUrl } = state
    const fieldRows = [
      { label: 'Nome',      field: result.fields.name },
      { label: 'Categoria', field: result.fields.category },
      { label: 'Marca',     field: result.fields.brand },
      { label: 'Cor',       field: result.fields.color },
      { label: 'Tamanho',   field: result.fields.size },
    ]

    return (
      <Shell backLabel="Voltar" onBack={() => setState({ step: 'upload' })}>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Não conseguimos identificar o produto com segurança.</h1>
            <p className="mt-1 text-sm text-muted-foreground">Complete os dados manualmente ou envie uma foto melhor.</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {fieldRows.map(({ label, field }) => (
            <div key={label} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-medium text-foreground mt-0.5">{field.value || 'Não identificado'}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={cn('h-2 w-2 rounded-full shrink-0', dotColor(field.confidence))} />
                <span className={cn('text-xs font-medium', dotLabelColor(field.confidence))}>{dotLabelText(field.confidence)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <Button onClick={async () => {
            const draft = await buildDraft(result, imageDataUrl)
            setState({ step: 'editing', draft })
          }}>
            Editar cadastro
          </Button>
          <Button variant="outline" onClick={() => setState({ step: 'upload' })}>Enviar outra foto</Button>
        </div>
      </Shell>
    )
  }

  // ═══════════════════════════════════════════
  // EDITING — formulário completo com EntitySelect
  // ═══════════════════════════════════════════

  if (state.step === 'editing') {
    const { draft } = state
    function setField<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) {
      setState({ step: 'editing', draft: { ...draft, [key]: value } })
    }
    const inputCls = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition'
    const labelCls = 'text-xs font-medium text-muted-foreground'

    return (
      <Shell backLabel="Voltar" onBack={() => setState({ step: 'upload' })}>
        <div>
          <h1 className="text-xl font-bold">Editar cadastro</h1>
          <p className="mt-1 text-sm text-muted-foreground">Confira e ajuste as informações identificadas pela IA.</p>
        </div>

        {draft.imageDataUrl && (
          <div className="h-24 w-24 overflow-hidden rounded-xl border border-border">
            <img src={draft.imageDataUrl} alt={draft.name} className="h-full w-full object-cover" />
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Nome do produto *</label>
            <input className={inputCls} value={draft.name}
              onChange={(e) => setField('name', e.target.value)} placeholder="Ex: Camiseta Básica Preta M" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>SKU (código interno)</label>
            <input className={inputCls} value={draft.sku ?? ''}
              onChange={(e) => setField('sku', e.target.value)} placeholder="Ex: CAM-PRT-M-001" />
          </div>

          {/* Categoria + Marca — EntitySelect */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Categoria</label>
              <EntitySelect
                value={draft.category}
                onChange={(v) => setField('category', v)}
                entityName="categoria"
                searchFn={searchCategories}
                createFn={createCategoryAndReturn}
                placeholder="Selecionar…"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Marca</label>
              <EntitySelect
                value={draft.brand}
                onChange={(v) => setField('brand', v)}
                entityName="marca"
                searchFn={searchBrands}
                createFn={createBrandAndReturn}
                placeholder="Selecionar…"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Cor</label>
              <input className={inputCls} value={draft.color}
                onChange={(e) => setField('color', e.target.value)} placeholder="Ex: Preto" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Tamanho</label>
              <input className={inputCls} value={draft.size}
                onChange={(e) => setField('size', e.target.value)} placeholder="Ex: M" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Preço de venda (R$)</label>
              <input className={inputCls} type="number" min={0} step={0.01} value={draft.sale_price ?? ''}
                onChange={(e) => setField('sale_price', e.target.value ? Number(e.target.value) : undefined)}
                placeholder="0,00" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Preço de custo (R$)</label>
              <input className={inputCls} type="number" min={0} step={0.01} value={draft.cost_price ?? ''}
                onChange={(e) => setField('cost_price', e.target.value ? Number(e.target.value) : undefined)}
                placeholder="0,00" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Descrição</label>
            <textarea className={inputCls} rows={3} value={draft.description}
              onChange={(e) => setField('description', e.target.value)} placeholder="Descreva o produto…" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Tags (separadas por vírgula)</label>
            <input className={inputCls} value={draft.tags}
              onChange={(e) => setField('tags', e.target.value)} placeholder="Ex: camiseta, básico, algodão" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button disabled={!draft.name.trim()} onClick={() => setState({ step: 'validation', draft })}>
            Revisar e confirmar
          </Button>
          <Button variant="outline" onClick={() => setState({ step: 'upload' })}>Cancelar</Button>
        </div>
      </Shell>
    )
  }

  // ═══════════════════════════════════════════
  // DUPLICATE
  // ═══════════════════════════════════════════

  if (state.step === 'duplicate') {
    const { result, imageDataUrl, existing } = state

    return (
      <Shell backLabel="Voltar" onBack={async () => {
        const draft = await buildDraft(result, imageDataUrl)
        setState({ step: 'result', imageDataUrl, result, draft })
      }}>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40">
            <Star className="h-5 w-5 text-amber-500 fill-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Encontramos um produto parecido</h1>
            <p className="mt-0.5 text-sm font-medium text-amber-600 dark:text-amber-400">Talvez este produto já esteja cadastrado.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-3 rounded-xl border-2 border-primary p-4 bg-primary/5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Você está cadastrando</p>
            <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-border bg-muted overflow-hidden">
              {imageDataUrl ? <img src={imageDataUrl} alt={result.fields.name.value} className="h-full w-full object-cover" />
                            : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm leading-tight">{result.fields.name.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">Novo</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-border p-4 bg-card">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Já existe no catálogo</p>
            <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-border bg-muted">
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm leading-tight">{existing.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">SKU: {existing.sku}</p>
              <p className="text-xs text-muted-foreground">Estoque: {existing.stock} unidades</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Button onClick={() => router.push(`/products/${existing.id}/edit`)}>Usar produto existente</Button>
          <Button variant="outline">Comparar</Button>
          <Button variant="ghost" className="text-muted-foreground" onClick={async () => {
            const draft = await buildDraft(result, imageDataUrl)
            setState({ step: 'validation', draft })
          }}>
            Criar mesmo assim
          </Button>
        </div>
      </Shell>
    )
  }

  // ═══════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════

  if (state.step === 'validation') {
    const { draft } = state
    const pendingFields = [
      !draft.sale_price && 'Preço de venda',
      !draft.cost_price && 'Custo',
    ].filter(Boolean) as string[]

    const fieldStatus = [
      { label: 'Nome',           value: draft.name,                ok: !!draft.name },
      { label: 'Categoria',      value: entityLabel(draft.category), ok: !!draft.category.label },
      { label: 'Marca',          value: entityLabel(draft.brand),    ok: !!draft.brand.label },
      { label: 'Cor',            value: draft.color,               ok: !!draft.color },
      { label: 'Tamanho',        value: draft.size,                ok: !!draft.size },
      { label: 'Imagem',         value: 'Adicionada',              ok: !!draft.imageDataUrl },
      { label: 'Descrição',      value: draft.description,         ok: !!draft.description },
      { label: 'Preço de venda', value: draft.sale_price ? `R$ ${draft.sale_price.toFixed(2).replace('.', ',')}` : undefined, ok: !!draft.sale_price },
      { label: 'Custo',          value: draft.cost_price ? `R$ ${draft.cost_price.toFixed(2).replace('.', ',')}` : undefined, ok: !!draft.cost_price },
    ]

    // Badge "nova" para entidades ainda não persistidas
    const newCategory = !draft.category.id && draft.category.label
    const newBrand    = !draft.brand.id    && draft.brand.label

    return (
      <Shell backLabel="Voltar e editar" onBack={() => setState({ step: 'editing', draft })}>
        <div>
          <h1 className="text-xl font-bold">Tudo pronto para cadastrar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Confira o resumo antes de salvar.</p>
        </div>

        {/* Aviso de entidades novas */}
        {(newCategory || newBrand) && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              {[newCategory && `Categoria "${draft.category.label}"`, newBrand && `Marca "${draft.brand.label}"`]
                .filter(Boolean).join(' e ')}{' '}
              {(newCategory && newBrand) ? 'serão criadas' : 'será criada'} automaticamente ao confirmar.
            </span>
          </div>
        )}

        {pendingFields.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {pendingFields.join(' e ')} {pendingFields.length === 1 ? 'está pendente.' : 'estão pendentes.'}
          </div>
        )}

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted overflow-hidden">
              {draft.imageDataUrl
                ? <img src={draft.imageDataUrl} alt={draft.name} className="h-full w-full object-cover" />
                : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
            </div>
            <div>
              <p className="font-medium text-foreground">{draft.name || 'Produto sem nome'}</p>
              {draft.sku && <p className="text-xs text-muted-foreground">{draft.sku}</p>}
            </div>
          </div>
          <div className="divide-y divide-border">
            {fieldStatus.map(({ label, value, ok }) => (
              <div key={label} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm text-muted-foreground">{label}</span>
                {ok
                  ? <span className="text-sm text-foreground flex items-center gap-1.5">
                      {label === 'Imagem' ? '✓ Adicionada' : label === 'Descrição' ? '✓ Preparada' : value}
                      {label === 'Categoria' && newCategory && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">nova</span>
                      )}
                      {label === 'Marca' && newBrand && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">nova</span>
                      )}
                    </span>
                  : <span className="text-sm font-medium text-amber-500">Pendente</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button disabled={submitting} onClick={() => handleCreate(draft)}>
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cadastrando…</> : 'Confirmar produto'}
          </Button>
          <Button variant="outline" onClick={() => setState({ step: 'editing', draft })}>Voltar e editar</Button>
        </div>
      </Shell>
    )
  }

  // ═══════════════════════════════════════════
  // SUCCESS
  // ═══════════════════════════════════════════

  if (state.step === 'success') return (
    <Shell>
      <div className="flex flex-col items-center gap-6 py-12 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-10 w-10 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Produto criado.</h1>
          <p className="mt-1 text-muted-foreground">{state.name}</p>
        </div>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <p className="text-sm font-medium text-muted-foreground mb-1">Próximas ações</p>
          <Button onClick={() => router.push('/stock')} variant="outline" className="w-full">Cadastrar estoque</Button>
          <Button onClick={() => router.push('/products')} variant="outline" className="w-full">Ver produtos</Button>
          <Button onClick={() => setState({ step: 'upload' })} className="w-full">Cadastrar outro produto</Button>
        </div>
      </div>
    </Shell>
  )

  return null
}
