import * as React from 'react'
import { cn } from '@/lib/utils'
import { Label } from './label'

// ── FormField ─────────────────────────────────────────────────────────────────
// Wrapper acessível: Label + Input/children + mensagem de erro/ajuda.
// Regra: nunca use input sem label — todos os campos precisam ser identificáveis.

export interface FormFieldProps {
  id: string
  label: string
  required?: boolean
  error?: string
  hint?: string
  className?: string
  children: React.ReactNode
}

function FormField({ id, label, required, error, hint, className, children }: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {/* Injeta id e aria-* no filho imediato quando possível */}
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
            id,
            'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined,
            'aria-invalid': error ? true : undefined,
            error: error ? true : (children as React.ReactElement<{ error?: boolean }>).props.error,
          })
        : children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  )
}

export { FormField }
