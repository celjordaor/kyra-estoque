import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const inputVariants = cva(
  [
    'flex w-full rounded-md border bg-background px-3 py-2 text-sm',
    'text-foreground placeholder:text-muted-foreground',
    'transition-colors duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
  ],
  {
    variants: {
      variant: {
        default: 'border-border hover:border-muted-foreground',
        error: 'border-danger text-danger placeholder:text-danger/60 focus-visible:ring-danger',
        success: 'border-success focus-visible:ring-success',
      },
      inputSize: {
        sm: 'h-8 px-2 text-xs',
        md: 'h-10 px-3 text-sm',
        lg: 'h-12 px-4 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      inputSize: 'md',
    },
  }
)

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  error?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant, inputSize, leftIcon, rightIcon, error, ...props }, ref) => {
    const resolvedVariant = error ? 'error' : variant

    if (leftIcon ?? rightIcon) {
      return (
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3 flex items-center text-muted-foreground">
              {leftIcon}
            </span>
          )}
          <input
            type={type}
            ref={ref}
            className={cn(
              inputVariants({ variant: resolvedVariant, inputSize }),
              leftIcon && 'pl-9',
              rightIcon && 'pr-9',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <span className="pointer-events-none absolute right-3 flex items-center text-muted-foreground">
              {rightIcon}
            </span>
          )}
        </div>
      )
    }

    return (
      <input
        type={type}
        ref={ref}
        className={cn(inputVariants({ variant: resolvedVariant, inputSize }), className)}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input, inputVariants }
