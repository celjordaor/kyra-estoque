'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Input, type InputProps } from './input'

export interface CurrencyInputProps extends Omit<InputProps, 'type' | 'value' | 'onChange' | 'defaultValue'> {
  value?: number          // em reais (ex: 29.90)
  defaultValue?: number
  onChange?: (value: number) => void
  currency?: string
  locale?: string
}

function formatBRL(value: number, locale: string, currency: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      className,
      value: controlledValue,
      defaultValue = 0,
      onChange,
      currency = 'BRL',
      locale = 'pt-BR',
      disabled,
      onBlur,
      onFocus,
      ...props
    },
    ref
  ) => {
    const isControlled = controlledValue !== undefined
    const initialValue = isControlled ? controlledValue! : defaultValue

    const [numericValue, setNumericValue] = React.useState<number>(initialValue)
    const [editing, setEditing] = React.useState(false)
    const [rawText, setRawText] = React.useState('')

    React.useEffect(() => {
      if (isControlled) setNumericValue(controlledValue!)
    }, [isControlled, controlledValue])

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setEditing(true)
      setRawText(numericValue === 0 ? '' : numericValue.toFixed(2).replace('.', ','))
      onFocus?.(e)
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setEditing(false)
      const digits = rawText.replace(/\D/g, '')
      const num = digits ? parseInt(digits, 10) / 100 : 0
      setNumericValue(num)
      onChange?.(num)
      onBlur?.(e)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const onlyDigits = e.target.value.replace(/\D/g, '')
      const num = onlyDigits ? parseInt(onlyDigits, 10) / 100 : 0
      setRawText(num.toFixed(2).replace('.', ','))
    }

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={editing ? rawText : formatBRL(numericValue, locale, currency)}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        className={cn('text-right font-mono', className)}
        {...props}
      />
    )
  }
)
CurrencyInput.displayName = 'CurrencyInput'

export { CurrencyInput }
