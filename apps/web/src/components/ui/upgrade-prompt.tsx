'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, X, ArrowRight, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────

export interface UpgradePromptProps {
  /** Control visibility from outside */
  open: boolean
  onClose: () => void
  /** What resource hit the limit */
  resource: string
  /** Current limit value (null = should not happen) */
  limit?: number | null
  /** Optional override message */
  message?: string
}

export interface UpgradeBannerProps {
  resource: string
  limit?: number | null
  message?: string
  className?: string
  onClose?: () => void
}

// ── UpgradePrompt (Modal) ─────────────────────────────────────

export function UpgradePrompt({ open, onClose, resource, limit, message }: UpgradePromptProps) {
  const router = useRouter()

  function handleUpgrade() {
    onClose()
    router.push('/settings?tab=billing')
  }

  const defaultMessage = limit !== undefined && limit !== null
    ? `Você atingiu o limite de ${limit} ${resource} do seu plano atual.`
    : `Você atingiu o limite de ${resource} do seu plano atual.`

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <DialogTitle className="text-lg">Limite do plano atingido</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            {message ?? defaultMessage}
            {' '}
            Faça upgrade para continuar criando {resource}.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 mt-1">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-1">
            Com o plano Pro você tem:
          </p>
          <ul className="text-sm text-amber-700 dark:text-amber-400 space-y-1">
            <li>✓ Produtos ilimitados</li>
            <li>✓ Automações ilimitadas</li>
            <li>✓ Geração de imagem com IA</li>
            <li>✓ Integrações avançadas</li>
          </ul>
        </div>

        <div className="flex gap-3 mt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Agora não
          </Button>
          <Button
            className="flex-1 gap-2 bg-amber-500 hover:bg-amber-600 text-white"
            onClick={handleUpgrade}
          >
            <Zap className="h-4 w-4" />
            Ver planos
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── UpgradeBanner (inline, dismissible) ──────────────────────

export function UpgradeBanner({ resource, limit, message, className, onClose }: UpgradeBannerProps) {
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const defaultMessage = limit !== undefined && limit !== null
    ? `Limite de ${limit} ${resource} atingido.`
    : `Limite de ${resource} atingido.`

  function handleClose() {
    setDismissed(true)
    onClose?.()
  }

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3',
      className
    )}>
      <Lock className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="flex-1 text-sm text-amber-800 dark:text-amber-300">
        {message ?? defaultMessage}
        {' '}
        <button
          onClick={() => router.push('/settings?tab=billing')}
          className="underline font-medium hover:no-underline"
        >
          Fazer upgrade
        </button>
      </p>
      <button
        onClick={handleClose}
        className="shrink-0 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
