'use client'

/**
 * OnboardingChecklist — Sprint 22b
 *
 * Barra de progresso D0–D21 exibida no dashboard do tenant.
 * - Busca checkpoints via Server Action
 * - Colapsa automaticamente quando todos concluídos (ou após dismiss)
 * - Dismiss salvo em localStorage por company (não é estado crítico)
 */

import { useEffect, useState, useTransition } from 'react'
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Rocket } from 'lucide-react'
import { getOnboardingProgress, type OnboardingCheckpoint } from '@/lib/actions/onboarding'

const DISMISS_KEY = 'kyra_onboarding_dismissed'

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw))
  } catch {
    return new Set()
  }
}

function setDismissed(companyKey: string) {
  try {
    const current = getDismissed()
    current.add(companyKey)
    localStorage.setItem(DISMISS_KEY, JSON.stringify([...current]))
  } catch { /* silencioso */ }
}

export function OnboardingChecklist({ companyId }: { companyId: string }) {
  const [checkpoints, setCheckpoints] = useState<OnboardingCheckpoint[]>([])
  const [open, setOpen] = useState(true)
  const [hidden, setHidden] = useState(false)
  const [, startTransition] = useTransition()

  useEffect(() => {
    // Verifica se já foi dispensado
    const dismissed = getDismissed()
    if (dismissed.has(companyId)) {
      setHidden(true)
      return
    }

    startTransition(async () => {
      const data = await getOnboardingProgress()
      setCheckpoints(data)
      // Se todos concluídos, esconde silenciosamente
      if (data.length > 0 && data.every(c => c.completed)) {
        setHidden(true)
      }
    })
  }, [companyId])

  if (hidden || checkpoints.length === 0) return null

  const completed = checkpoints.filter(c => c.completed).length
  const total = checkpoints.length
  const pct = Math.round((completed / total) * 100)

  function handleDismiss() {
    setDismissed(companyId)
    setHidden(true)
  }

  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50/60 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-teal-50 transition-colors"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-teal-100 shrink-0">
          <Rocket className="h-4 w-4 text-teal-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-teal-900">Configure seu estoque</p>
          <div className="flex items-center gap-2 mt-0.5">
            {/* Progress bar */}
            <div className="flex-1 h-1.5 rounded-full bg-teal-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-teal-500 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-teal-700 shrink-0">{completed}/{total} concluído{completed !== 1 ? 's' : ''}</span>
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-teal-500 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-teal-500 shrink-0" />
        )}
      </button>

      {/* Checklist body */}
      {open && (
        <div className="border-t border-teal-200 divide-y divide-teal-100">
          {checkpoints.map(cp => (
            <div
              key={cp.checkpoint_key}
              className={`flex items-center gap-3 px-4 py-2.5 ${cp.completed ? 'opacity-60' : ''}`}
            >
              {cp.completed ? (
                <CheckCircle2 className="h-4 w-4 text-teal-500 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-teal-300 shrink-0" />
              )}
              <span className={`text-sm ${cp.completed ? 'line-through text-teal-700' : 'text-slate-700'}`}>
                {cp.display_name}
              </span>
              {cp.completed && cp.completed_at && (
                <span className="ml-auto text-xs text-teal-500 shrink-0">
                  {new Date(cp.completed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </span>
              )}
            </div>
          ))}

          {/* Dismiss */}
          <div className="px-4 py-2.5 flex justify-end">
            <button
              onClick={handleDismiss}
              className="text-xs text-teal-600 hover:text-teal-800 transition-colors"
            >
              Não mostrar novamente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
