'use client'

/**
 * EntitySelect
 * Combobox para entidades com cadastro próprio (Categoria, Marca…).
 * Busca registros existentes via server action, oferece "criar novo" se não houver match.
 * Armazena { id, label }: id=null quando a entidade ainda não existe no banco.
 */

import * as React from 'react'
import { Check, ChevronsUpDown, Plus, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type EntityRef = {
  id: string | null  // null = entidade nova, ainda não persistida
  label: string
}

interface EntitySelectProps {
  value:       EntityRef
  onChange:    (v: EntityRef) => void
  placeholder?: string
  entityName:  string                                         // ex: "categoria", "marca"
  searchFn:    (q: string) => Promise<{ id: string; name: string }[]>
  createFn:    (name: string) => Promise<{ success: boolean; id?: string; error?: string }>
  className?:  string
  disabled?:   boolean
}

export function EntitySelect({
  value,
  onChange,
  placeholder = 'Selecionar…',
  entityName,
  searchFn,
  createFn,
  className,
  disabled,
}: EntitySelectProps) {
  const [open,    setOpen]    = React.useState(false)
  const [query,   setQuery]   = React.useState('')
  const [results, setResults] = React.useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)
  const inputRef  = React.useRef<HTMLInputElement>(null)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Abre o dropdown e pré-preenche a query com o label atual
  function openDropdown() {
    if (disabled) return
    setQuery(value.label)
    setOpen(true)
    setCreateError(null)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  // Busca com debounce de 300ms
  React.useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const r = await searchFn(query)
        setResults(r)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, open])

  // Selecionar item existente
  function selectItem(item: { id: string; name: string }) {
    onChange({ id: item.id, label: item.name })
    setOpen(false)
    setCreateError(null)
  }

  // Criar novo e já selecionar
  async function handleCreate() {
    const name = query.trim()
    if (!name) return
    setCreating(true)
    setCreateError(null)
    try {
      const res = await createFn(name)
      if (res.success && res.id) {
        onChange({ id: res.id, label: name })
        setOpen(false)
      } else {
        setCreateError(res.error ?? 'Erro ao criar')
      }
    } finally {
      setCreating(false)
    }
  }

  // Fecha ao clicar fora
  const containerRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const trimmedQuery  = query.trim()
  const exactMatch    = results.some((r) => r.name.toLowerCase() === trimmedQuery.toLowerCase())
  const showCreate    = trimmedQuery.length > 0 && !exactMatch
  const isNew         = value.id === null && value.label.length > 0

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={openDropdown}
        className={cn(
          'flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
          'hover:border-primary/50 transition-colors',
          disabled && 'opacity-50 cursor-not-allowed',
          open && 'border-primary ring-2 ring-primary/20'
        )}
      >
        <span className={cn('truncate', !value.label && 'text-muted-foreground')}>
          {value.label || placeholder}
        </span>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {isNew && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              nova
            </span>
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="border-b border-border px-3 py-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setOpen(false)
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (results.length === 1) selectItem(results[0]!)
                  else if (showCreate) handleCreate()
                }
              }}
              placeholder={`Buscar ${entityName}…`}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Results */}
          <div className="max-h-52 overflow-y-auto">
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando…
              </div>
            ) : results.length === 0 && !showCreate ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">
                {trimmedQuery ? `Nenhuma ${entityName} encontrada.` : `Digite para buscar.`}
              </p>
            ) : (
              results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectItem(item)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-muted transition-colors',
                    value.id === item.id && 'bg-primary/5 font-medium'
                  )}
                >
                  {value.id === item.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  <span className={value.id === item.id ? '' : 'pl-5'}>{item.name}</span>
                </button>
              ))
            )}

            {/* Criar novo */}
            {showCreate && (
              <button
                type="button"
                disabled={creating}
                onClick={handleCreate}
                className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-sm text-left text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
              >
                {creating
                  ? <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  : <Plus className="h-4 w-4 shrink-0" />}
                {creating ? `Criando…` : `Criar "${trimmedQuery}"`}
              </button>
            )}

            {/* Erro de criação */}
            {createError && (
              <div className="flex items-center gap-2 border-t border-border px-3 py-2 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {createError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
