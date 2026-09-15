'use client'

// ── QuantityInput ─────────────────────────────────────────────────────────────
// Atalho para NumberInput com stepper já configurado para quantidades de estoque.
// Sempre inteiro, mínimo 0, stepper visível.

import * as React from 'react'
import { NumberInput, type NumberInputProps } from './number-input'

export interface QuantityInputProps extends Omit<NumberInputProps, 'allowDecimal' | 'showStepper'> {
  showStepper?: boolean
}

const QuantityInput = React.forwardRef<HTMLInputElement, QuantityInputProps>(
  ({ min = 0, step = 1, showStepper = true, ...props }, ref) => (
    <NumberInput
      ref={ref}
      min={min}
      step={step}
      allowDecimal={false}
      showStepper={showStepper}
      {...props}
    />
  )
)
QuantityInput.displayName = 'QuantityInput'

export { QuantityInput }
