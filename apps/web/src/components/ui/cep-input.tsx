'use client'

// ── CepInput ──────────────────────────────────────────────────────────────────
// Campo de CEP com busca automática via ViaCEP.
// Ao digitar os 8 dígitos, busca o endereço e chama onAddressFound.
// Mostra spinner enquanto busca; ícone de lupa quando ocioso.

import * as React from 'react'
import { Loader2, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input, type InputProps } from './input'

export interface CepAddressResult {
  address: string       // logradouro
  neighborhood: string  // bairro
  city: string          // localidade
  state: string         // uf (2 letras)
}

export interface CepInputProps extends Omit<InputProps, 'value' | 'onChange'> {
  value?: string
  onChange?: (formatted: string) => void
  onAddressFound?: (data: CepAddressResult) => void
  onNotFound?: () => void
}

function formatCep(v: string) {
  return v
    .replace(/\D/g, '')
    .slice(0, 8)
    .replace(/(\d{5})(\d{0,3})/, '$1-$2')
    .replace(/-$/, '')
}

async function fetchViaCep(clean: string): Promise<CepAddressResult | null> {
  try {
    const r = await fetch(`https://viacep.com.br/ws/${clean}/json/`)
    if (!r.ok) return null
    const data = await r.json()
    if (data.erro) return null
    return {
      address: data.logradouro ?? '',
      neighborhood: data.bairro ?? '',
      city: data.localidade ?? '',
      state: data.uf ?? '',
    }
  } catch {
    return null
  }
}

export function CepInput({
  value = '',
  onChange,
  onAddressFound,
  onNotFound,
  className,
  disabled,
  ...props
}: CepInputProps) {
  const [loading, setLoading] = React.useState(false)
  const lastFetched = React.useRef('')

  const handleChange = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatCep(e.target.value)
      onChange?.(formatted)

      const clean = formatted.replace(/\D/g, '')
      if (clean.length === 8 && clean !== lastFetched.current) {
        lastFetched.current = clean
        setLoading(true)
        const result = await fetchViaCep(clean)
        setLoading(false)
        if (result) {
          onAddressFound?.(result)
        } else {
          onNotFound?.()
        }
      }
    },
    [onChange, onAddressFound, onNotFound]
  )

  return (
    <div className="relative">
      <Input
        {...props}
        value={value}
        onChange={handleChange}
        placeholder="00000-000"
        inputMode="numeric"
        disabled={disabled}
        className={cn('pr-9', className)}
      />
      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <MapPin className="h-4 w-4 text-muted-foreground/35" />
        )}
      </div>
    </div>
  )
}
