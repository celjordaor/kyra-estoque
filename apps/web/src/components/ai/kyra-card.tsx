'use client'

// ── KyraCard ──────────────────────────────────────────────────────────────────
// Card reutilizável para insights e sugestões da Kyra.
// Apresenta o cabeçalho com Sparkles + título + descrição,
// chips de métricas opcionais, botões de ação e um painel de explicação expansível.

import * as React from 'react'
import { Sparkles, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface KyraMetric {
  icon?: React.ElementType
  label: string
  value?: React.ReactNode
  className?: string
}

export interface KyraCardProps {
  /** Rótulo pequeno acima do título (ex: "Compras sugeridas") */
  label: string
  /** Texto explicativo abaixo do rótulo */
  description?: string
  /** Destaque principal — frase curta com números/resumo */
  summary?: React.ReactNode
  /** Chips de métricas abaixo do summary */
  metrics?: KyraMetric[]
  /** Botões de ação — passados diretamente */
  actions?: React.ReactNode
  /** Conteúdo adicional abaixo dos botões (ex: tabela de sugestões) */
  children?: React.ReactNode
  /** Texto do painel de explicação colapsável */
  explanation?: React.ReactNode
  className?: string
}

export function KyraCard({
  label,
  description,
  summary,
  metrics,
  actions,
  children,
  explanation,
  className,
}: KyraCardProps) {
  const [showExplanation, setShowExplanation] = React.useState(false)

  return (
    <div className={cn('rounded-xl border border-primary/20 bg-primary/5 p-5', className)}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">{label}</p>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
          {summary && (
            <p className="mt-2 text-base font-semibold">{summary}</p>
          )}

          {/* Metrics */}
          {metrics && metrics.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-4">
              {metrics.map((m, i) => {
                const Icon = m.icon
                return (
                  <div key={i} className={cn('flex items-center gap-1.5 text-sm text-muted-foreground', m.className)}>
                    {Icon && <Icon className="h-4 w-4" />}
                    <span>
                      {m.value !== undefined && m.value !== '' ? (
                        <>{m.label}: <strong className="text-foreground">{m.value}</strong></>
                      ) : m.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Actions + explanation toggle */}
          {(actions || explanation) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {actions}
              {explanation && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5"
                  onClick={() => setShowExplanation(v => !v)}
                >
                  <Info className="h-3.5 w-3.5" />
                  {showExplanation ? 'Fechar explicação' : 'Ver como foi calculado'}
                </Button>
              )}
            </div>
          )}

          {/* Explanation panel */}
          {showExplanation && explanation && (
            <div className="mt-4 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Como calculei</p>
              {explanation}
            </div>
          )}
        </div>
      </div>

      {/* Expanded children (tables, lists, etc.) */}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
