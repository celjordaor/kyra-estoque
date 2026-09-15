'use client'

import * as React from 'react'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input, type InputProps } from './input'

export interface NumberInputProps extends Omit<InputProps, 'type' | 'value' | 'onChange' | 'defaultValue'> {
  value?: number
  defaultValue?: number
  onChange?: (value: number) => void
  min?: number
  max?: number
  step?: number
  showStepper?: boolean
  allowDecimal?: boolean
  decimalPlaces?: number
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      className,
      value: controlledValue,
      defaultValue,
      onChange,
      min,
      max,
      step = 1,
      showStepper = false,
      allowDecimal = false,
      decimalPlaces = 2,
      disabled,
      ...props
    },
    ref
  ) => {
    const isControlled = controlledValue !== undefined
    const initialValue = isControlled ? controlledValue : (defaultValue ?? 0)

    const [internalValue, setInternalValue] = React.useState<string>(String(initialValue))

    React.useEffect(() => {
      if (isControlled) setInternalValue(String(controlledValue))
    }, [isControlled, controlledValue])

    const clamp = (n: number) => {
      let result = n
      if (min !== undefined) result = Math.max(min, result)
      if (max !== undefined) result = Math.min(max, result)
      return result
    }

    const commit = (raw: string) => {
      const parsed = allowDecimal ? parseFloat(raw) : parseInt(raw, 10)
      if (!isNaN(parsed)) {
        const clamped = clamp(parsed)
        const formatted = allowDecimal ? clamped.toFixed(decimalPlaces) : String(clamped)
        setInternalValue(formatted)
        onChange?.(clamped)
      } else {
        setInternalValue(String(isControlled ? controlledValue : defaultValue ?? 0))
      }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      if (allowDecimal ? /^-?\d*\.?\d*$/.test(raw) : /^-?\d*$/.test(raw)) {
        setInternalValue(raw)
      }
    }

    const increment = () => commit(String((parseFloat(internalValue) || 0) + step))
    const decrement = () => commit(String((parseFloat(internalValue) || 0) - step))

    const isDecrDisabled = disabled || (min !== undefined && (parseFloat(internalValue) || 0) <= min)
    const isIncrDisabled = disabled || (max !== undefined && (parseFloat(internalValue) || 0) >= max)

    const inputProps = {
      ref,
      type: 'text' as const,
      inputMode: (allowDecimal ? 'decimal' : 'numeric') as React.HTMLAttributes<HTMLInputElement>['inputMode'],
      value: internalValue,
      onChange: handleChange,
      onBlur: () => commit(internalValue),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') commit(internalValue)
        if (e.key === 'ArrowUp') { e.preventDefault(); increment() }
        if (e.key === 'ArrowDown') { e.preventDefault(); decrement() }
      },
      disabled,
      ...props,
    }

    if (showStepper) {
      return (
        <div className="flex items-center">
          <button
            type="button"
            onClick={decrement}
            disabled={isDecrDisabled}
            aria-label="Diminuir"
            className={cn(
              'flex h-10 w-9 shrink-0 items-center justify-center',
              'rounded-l-md border border-r-0 border-border bg-muted',
              'text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <Input {...inputProps} className={cn('rounded-none text-center focus-visible:z-10', className)} />
          <button
            type="button"
            onClick={increment}
            disabled={isIncrDisabled}
            aria-label="Aumentar"
            className={cn(
              'flex h-10 w-9 shrink-0 items-center justify-center',
              'rounded-r-md border border-l-0 border-border bg-muted',
              'text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      )
    }

    return <Input {...inputProps} className={className} />
  }
)
NumberInput.displayName = 'NumberInput'

export { NumberInput }
