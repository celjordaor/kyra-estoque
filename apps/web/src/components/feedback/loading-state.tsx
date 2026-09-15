import * as React from 'react'
import { cn } from '@/lib/utils'
import { Skeleton, SkeletonCard } from '@/components/ui/skeleton'

export interface LoadingStateProps {
  variant?: 'spinner' | 'skeleton-cards' | 'skeleton-table'
  rows?: number
  className?: string
  label?: string
}

export function LoadingState({
  variant = 'spinner',
  rows = 3,
  className,
  label = 'Carregando...',
}: LoadingStateProps) {
  if (variant === 'skeleton-cards') {
    return (
      <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  if (variant === 'skeleton-table') {
    return (
      <div className={cn('space-y-2', className)}>
        <Skeleton className="h-10 w-full rounded-md" />
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-md" style={{ opacity: 1 - i * 0.1 }} />
        ))}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-16', className)}>
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
