import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Badge/Pill semântico — altura 24px, border-radius pill.
 * Usar SEMPRE com variant semântico: nunca cor apenas por decoração.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        // Verde — ativo/sucesso/disponível
        success:
          'border-transparent bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        // Amarelo — atenção/pendência
        warning:
          'border-transparent bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        // Vermelho — erro/risco/bloqueio
        danger:
          'border-transparent bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        // Neutro — informação sem urgência
        neutral:
          'border-transparent bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
        // Azul — informativo
        info:
          'border-transparent bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        // Outline — sem fundo
        outline:
          'border-border text-foreground',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), 'h-6', className)} {...props} />
  )
}

export { Badge, badgeVariants }
