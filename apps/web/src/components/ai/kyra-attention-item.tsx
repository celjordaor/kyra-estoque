'use client'

// ── KyraAttentionItem ─────────────────────────────────────────────────────────
// Item individual dentro de um KyraCard de atenção.
// Exibe ícone colorido + título + subtítulo + botão de ação opcional.

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface KyraAttentionItemProps {
  icon: React.ElementType
  /** Classe Tailwind para o fundo do ícone, ex: "bg-amber-500" */
  iconColor: string
  title: string
  sub?: string
  action?: string
  onAction?: () => void
  className?: string
}

export function KyraAttentionItem({
  icon: Icon,
  iconColor,
  title,
  sub,
  action,
  onAction,
  className,
}: KyraAttentionItemProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border border-border bg-card p-4',
        'hover:border-primary/30 transition-colors',
        className
      )}
    >
      <div
        className={cn(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          iconColor
        )}
      >
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      {action && (
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-primary text-xs"
          onClick={onAction}
        >
          {action}
        </Button>
      )}
    </div>
  )
}
