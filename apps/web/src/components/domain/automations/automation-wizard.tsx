'use client'

import * as React from 'react'
import {
  AlertTriangle, TrendingDown, ShoppingCart, ShoppingBag,
  Calendar, CalendarDays, Bell, MessageSquare, Mail,
  ClipboardList, BarChart3, PackagePlus, FileWarning,
  User, Package, Users, Check, ChevronRight, ChevronLeft,
  Sparkles, Zap, BarChart2, FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Sheet, SheetContent, SheetHeader, SheetBody, SheetFooter,
  SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import {
  AutomationTrigger, AutomationAction, AutomationRecipient,
} from '@/lib/actions/automations-types'
import { createAutomation } from '@/lib/actions/automations'

// ── Tipos de fluxo ────────────────────────────────────────────
// "event"    → gatilho baseado em evento (estoque baixo, venda, etc.)
//               steps: Gatilho → Ação → Destinatário → Revisão
// "report"   → relatório agendado com conteúdo fixo (semanal, mensal)
//               steps: Relatório → Destinatário → Revisão

type WizardMode = 'event' | 'report'

function getMode(t: AutomationTrigger | null): WizardMode {
  return t === 'weekly' || t === 'monthly' ? 'report' : 'event'
}

// ── Option types ──────────────────────────────────────────────

interface TriggerOption {
  value: AutomationTrigger
  label: string
  description: string
  icon: React.ElementType
  color: string
}

interface ReportOption {
  value: AutomationTrigger
  label: string
  description: string
  schedule: string
  contents: string[]
  icon: React.ElementType
  color: string
}

interface ActionOption {
  value: AutomationAction
  label: string
  description: string
  icon: React.ElementType
  available: boolean
}

interface RecipientOption {
  value: AutomationRecipient
  label: string
  description: string
  icon: React.ElementType
}

// ── Catalogues ────────────────────────────────────────────────

const TRIGGERS: TriggerOption[] = [
  {
    value: 'low_stock',
    label: 'Estoque mínimo atingido',
    description: 'Quando um produto cair abaixo do estoque mínimo configurado',
    icon: AlertTriangle,
    color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/30',
  },
  {
    value: 'no_sales',
    label: 'Produto parado sem vendas',
    description: 'Quando um produto ficar 30+ dias sem nenhuma venda registrada',
    icon: TrendingDown,
    color: 'text-slate-500 bg-slate-100 dark:bg-slate-800/40',
  },
  {
    value: 'delayed_purchase',
    label: 'Compra em atraso',
    description: 'Quando uma ordem de compra vencer sem confirmação de entrega',
    icon: ShoppingCart,
    color: 'text-red-500 bg-red-50 dark:bg-red-950/30',
  },
  {
    value: 'sale_happened',
    label: 'Nova venda registrada',
    description: 'A cada nova venda concluída no sistema',
    icon: ShoppingBag,
    color: 'text-green-500 bg-green-50 dark:bg-green-950/30',
  },
]

const REPORTS: ReportOption[] = [
  {
    value: 'weekly',
    label: 'Relatório semanal de estoque e vendas',
    description: 'Resumo automático toda segunda-feira às 08h',
    schedule: 'Toda segunda-feira às 08h',
    contents: [
      'Vendas e receita da semana anterior',
      'Produtos com estoque em alerta',
      'Itens parados sem movimentação',
      'Oportunidades identificadas pela Kyra',
    ],
    icon: BarChart2,
    color: 'text-primary bg-primary/10',
  },
  {
    value: 'monthly',
    label: 'Relatório mensal de desempenho',
    description: 'Análise completa no 1º dia de cada mês às 08h',
    schedule: 'No 1º dia de cada mês às 08h',
    contents: [
      'Receita total e margem do mês',
      'Giro de estoque por categoria',
      'Top 10 produtos mais vendidos',
      'Recomendações de compra da Kyra',
    ],
    icon: FileText,
    color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/30',
  },
]

const ACTIONS: ActionOption[] = [
  {
    value: 'email',
    label: 'Enviar um e-mail',
    description: 'E-mail com os detalhes do evento que disparou a automação',
    icon: Mail,
    available: true,
  },
  {
    value: 'notification',
    label: 'Enviar uma notificação',
    description: 'Notificação dentro do Kyra Estoque',
    icon: Bell,
    available: false,
  },
  {
    value: 'whatsapp',
    label: 'Enviar WhatsApp',
    description: 'Mensagem via WhatsApp Business',
    icon: MessageSquare,
    available: false,
  },
  {
    value: 'create_task',
    label: 'Criar uma tarefa',
    description: 'Abre uma tarefa automática na lista',
    icon: ClipboardList,
    available: false,
  },
  {
    value: 'generate_analysis',
    label: 'Gerar uma análise',
    description: 'Kyra IA analisa e gera relatório contextual',
    icon: BarChart3,
    available: false,
  },
  {
    value: 'suggest_purchase',
    label: 'Sugerir uma compra',
    description: 'Kyra sugere itens e quantidades a repor',
    icon: PackagePlus,
    available: false,
  },
  {
    value: 'register_occurrence',
    label: 'Registrar uma ocorrência',
    description: 'Cria um registro de ocorrência para acompanhamento',
    icon: FileWarning,
    available: false,
  },
]

const RECIPIENTS: RecipientOption[] = [
  {
    value: 'self',
    label: 'Você',
    description: 'Enviado para o seu e-mail cadastrado',
    icon: User,
  },
  {
    value: 'stock_manager',
    label: 'Responsável pelo estoque',
    description: 'Usuário responsável pelo controle de estoque',
    icon: Package,
  },
  {
    value: 'sales_team',
    label: 'Equipe comercial',
    description: 'Todos os membros da equipe de vendas',
    icon: Users,
  },
]

// ── Step indicator ────────────────────────────────────────────
// Modo event: Gatilho(0) → Ação(1) → Destinatário(2) → Revisão(3)
// Modo report: Relatório(0) → Destinatário(2) → Revisão(3)  [step 1 não existe]

const EVENT_STEPS  = ['Gatilho', 'Ação', 'Destinatário', 'Revisão']
const REPORT_STEPS = ['Relatório', 'Destinatário', 'Revisão']

function StepIndicator({ step, mode }: { step: number; mode: WizardMode }) {
  const labels = mode === 'report' ? REPORT_STEPS : EVENT_STEPS
  // Para relatório: step 0,2,3 mapeiam para índice 0,1,2
  const current = mode === 'report' ? (step === 0 ? 0 : step === 2 ? 1 : 2) : step
  return (
    <div className="flex items-center gap-1 mb-6">
      {labels.map((label, i) => {
        const done   = i < current
        const active = i === current
        return (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                'h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
                done   && 'bg-primary text-white',
                active && 'bg-primary text-white ring-4 ring-primary/20',
                !done && !active && 'bg-muted text-muted-foreground',
              )}>
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={cn(
                'text-[10px] font-medium hidden sm:block',
                active ? 'text-primary' : 'text-muted-foreground',
              )}>{label}</span>
            </div>
            {i < labels.length - 1 && (
              <div className={cn('h-px flex-1 mb-4 transition-colors', done ? 'bg-primary' : 'bg-border')} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ── Step 0 — Seleção de gatilho (evento) ──────────────────────

function TriggerStep({
  selected, onSelect,
}: { selected: AutomationTrigger | null; onSelect: (v: AutomationTrigger) => void }) {
  return (
    <div>
      <p className="text-sm font-semibold mb-1">Quando isso acontecer…</p>
      <p className="text-xs text-muted-foreground mb-4">
        A Kyra monitora o evento e dispara a ação automaticamente.
      </p>
      <div className="flex flex-col gap-2">
        {TRIGGERS.map(t => {
          const Icon   = t.icon
          const active = selected === t.value
          return (
            <button
              key={t.value}
              onClick={() => onSelect(t.value)}
              className={cn(
                'flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all w-full',
                active
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-border bg-card hover:border-primary/40 hover:bg-muted/40',
              )}
            >
              <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', t.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight">{t.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
              </div>
              {active && <Check className="ml-auto h-4 w-4 shrink-0 text-primary mt-0.5" />}
            </button>
          )
        })}
      </div>

      {/* Separador para relatórios */}
      <div className="flex items-center gap-3 my-4">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">ou ative um relatório agendado</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="flex flex-col gap-2">
        {REPORTS.map(r => {
          const Icon   = r.icon
          const active = selected === r.value
          return (
            <button
              key={r.value}
              onClick={() => onSelect(r.value)}
              className={cn(
                'flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all w-full',
                active
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-border bg-card hover:border-primary/40 hover:bg-muted/40',
              )}
            >
              <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', r.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium leading-tight">{r.label}</p>
                  <Badge variant="neutral" className="text-[9px] px-1.5 py-0 shrink-0">Agendado</Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{r.description}</p>
                {active && (
                  <div className="mt-2.5 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                    <p className="text-[11px] font-semibold text-primary mb-1.5">Este relatório vai incluir:</p>
                    <ul className="space-y-1">
                      {r.contents.map((item, idx) => (
                        <li key={idx} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Check className="h-3 w-3 text-primary shrink-0" />{item}
                        </li>
                      ))}
                    </ul>
                    <p className="text-[11px] text-muted-foreground mt-2 pt-2 border-t border-primary/10">
                      📅 {r.schedule}. O próximo passo é escolher quem recebe.
                    </p>
                  </div>
                )}
              </div>
              {active && !active && <Check className="ml-auto h-4 w-4 shrink-0 text-primary mt-0.5" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Step 1 — Seleção de ação (só para evento) ─────────────────

function ActionStep({
  selected, onSelect, triggerType,
}: { selected: AutomationAction | null; onSelect: (v: AutomationAction) => void; triggerType: AutomationTrigger | null }) {
  const triggerMeta = TRIGGERS.find(t => t.value === triggerType)
  return (
    <div>
      <p className="text-sm font-semibold mb-1">A Kyra vai…</p>
      {triggerMeta && (
        <p className="text-xs text-muted-foreground mb-4">
          Quando <span className="font-medium text-foreground">{triggerMeta.label.toLowerCase()}</span>,
          executar automaticamente:
        </p>
      )}
      <div className="flex flex-col gap-2">
        {ACTIONS.map(a => {
          const Icon   = a.icon
          const active = selected === a.value
          return (
            <button
              key={a.value}
              disabled={!a.available}
              onClick={() => a.available && onSelect(a.value)}
              className={cn(
                'flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all w-full',
                !a.available && 'opacity-50 cursor-not-allowed',
                a.available && active
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : a.available
                  ? 'border-border bg-card hover:border-primary/40 hover:bg-muted/40'
                  : 'border-border bg-card',
              )}
            >
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium leading-tight">{a.label}</p>
                  {!a.available && (
                    <Badge variant="neutral" className="text-[9px] px-1.5 py-0">Em breve</Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{a.description}</p>
              </div>
              {a.available && active && <Check className="ml-auto h-4 w-4 shrink-0 text-primary mt-0.5" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Step 2 — Destinatário ─────────────────────────────────────

function RecipientStep({
  selected, onSelect, mode, trigger,
}: {
  selected: AutomationRecipient | null
  onSelect: (v: AutomationRecipient) => void
  mode: WizardMode
  trigger: AutomationTrigger | null
}) {
  const reportMeta = REPORTS.find(r => r.value === trigger)
  return (
    <div>
      <p className="text-sm font-semibold mb-1">Para quem?</p>
      {mode === 'report' && reportMeta ? (
        <p className="text-xs text-muted-foreground mb-4">
          Quem deve receber o <span className="font-medium text-foreground">{reportMeta.label.toLowerCase()}</span>.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground mb-4">Quem deve receber o e-mail quando a automação disparar.</p>
      )}
      <div className="flex flex-col gap-2">
        {RECIPIENTS.map(r => {
          const Icon   = r.icon
          const active = selected === r.value
          return (
            <button
              key={r.value}
              onClick={() => onSelect(r.value)}
              className={cn(
                'flex items-center gap-4 rounded-xl border p-4 text-left transition-all w-full',
                active
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-border bg-card hover:border-primary/40 hover:bg-muted/40',
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <Icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{r.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
              </div>
              {active && <Check className="h-5 w-5 shrink-0 text-primary" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Step 3 — Revisão ──────────────────────────────────────────

function ReviewStep({
  trigger, action, recipient, mode,
}: {
  trigger: AutomationTrigger
  action: AutomationAction
  recipient: AutomationRecipient
  mode: WizardMode
}) {
  const triggerMeta   = TRIGGERS.find(t => t.value === trigger)
  const reportMeta    = REPORTS.find(r => r.value === trigger)
  const actionMeta    = ACTIONS.find(a => a.value === action)!
  const recipientMeta = RECIPIENTS.find(r => r.value === recipient)!
  const ActionIcon    = actionMeta.icon
  const RecipientIcon = recipientMeta.icon

  if (mode === 'report' && reportMeta) {
    const ReportIcon = reportMeta.icon
    return (
      <div>
        <p className="text-sm font-semibold mb-1">Revisão</p>
        <p className="text-xs text-muted-foreground mb-4">Confirme o relatório antes de ativar.</p>

        <div className="rounded-xl border border-border overflow-hidden mb-4">
          <div className="bg-primary/5 border-b border-border px-4 py-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-primary">Relatório agendado pela Kyra</span>
          </div>
          <div className="divide-y divide-border">
            <div className="flex items-center gap-4 px-4 py-3.5">
              <div className="w-20 shrink-0">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">RELATÓRIO</span>
              </div>
              <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', reportMeta.color)}>
                <ReportIcon className="h-3.5 w-3.5" />
              </div>
              <p className="text-sm font-medium">{reportMeta.label}</p>
            </div>
            <div className="flex items-center gap-4 px-4 py-3.5">
              <div className="w-20 shrink-0">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">ENVIO</span>
              </div>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">{reportMeta.schedule}</p>
            </div>
            <div className="flex items-center gap-4 px-4 py-3.5">
              <div className="w-20 shrink-0">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">PARA</span>
              </div>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                <RecipientIcon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">{recipientMeta.label}</p>
            </div>
          </div>
        </div>

        {/* Conteúdo do relatório */}
        <div className="rounded-xl border border-border overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">O relatório vai incluir</p>
          </div>
          <div className="px-4 py-3 flex flex-col gap-2">
            {reportMeta.contents.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
          <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-primary">Gerado automaticamente pela Kyra</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              O relatório é montado com os dados reais do período e enviado automaticamente.
              Você pode desativar a qualquer momento.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Modo evento
  const TriggerIcon = triggerMeta?.icon ?? AlertTriangle
  return (
    <div>
      <p className="text-sm font-semibold mb-1">Revisão</p>
      <p className="text-xs text-muted-foreground mb-4">Confira a automação antes de ativar.</p>

      <div className="rounded-xl border border-border overflow-hidden mb-4">
        <div className="bg-primary/5 border-b border-border px-4 py-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-primary">Automação configurada pela Kyra</span>
        </div>
        <div className="divide-y divide-border">
          <div className="flex items-center gap-4 px-4 py-3.5">
            <div className="w-20 shrink-0">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">QUANDO</span>
            </div>
            <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', triggerMeta?.color ?? 'bg-muted')}>
              <TriggerIcon className="h-3.5 w-3.5" />
            </div>
            <p className="text-sm font-medium">{triggerMeta?.label}</p>
          </div>
          <div className="flex items-center gap-4 px-4 py-3.5">
            <div className="w-20 shrink-0">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">FAZER</span>
            </div>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
              <ActionIcon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">{actionMeta.label}</p>
          </div>
          <div className="flex items-center gap-4 px-4 py-3.5">
            <div className="w-20 shrink-0">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">PARA</span>
            </div>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
              <RecipientIcon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">{recipientMeta.label}</p>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
        <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-primary">Kyra recomenda esta combinação</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Esta automação economiza tempo e evita trabalho operacional recorrente.
            Você pode desativar a qualquer momento.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Wizard sheet ──────────────────────────────────────────────

interface AutomationWizardProps {
  open: boolean
  initialTrigger?: AutomationTrigger
  onClose: () => void
  onCreated: () => void
}

export function AutomationWizard({ open, initialTrigger, onClose, onCreated }: AutomationWizardProps) {
  const [step, setStep]           = React.useState(0)
  const [trigger, setTrigger]     = React.useState<AutomationTrigger | null>(null)
  const [action, setAction]       = React.useState<AutomationAction | null>(null)
  const [recipient, setRecipient] = React.useState<AutomationRecipient | null>(null)
  const [saving, setSaving]       = React.useState(false)

  const mode = getMode(trigger)

  // Pré-seleciona quando wizard abre via "Configurar" / "Ativar relatório"
  React.useEffect(() => {
    if (!open) return
    if (initialTrigger) {
      setTrigger(initialTrigger)
      setRecipient(null)
      setSaving(false)
      const isReport = initialTrigger === 'weekly' || initialTrigger === 'monthly'
      if (isReport) {
        setAction('email')
        setStep(2)
      } else {
        setAction(null)
        setStep(0)
      }
    } else {
      setStep(0); setTrigger(null); setAction(null); setRecipient(null); setSaving(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function reset() {
    setStep(0); setTrigger(null); setAction(null); setRecipient(null); setSaving(false)
  }

  function handleClose() { reset(); onClose() }

  function handleNext() {
    if (step === 0 && mode === 'report') {
      // Relatório: pula Ação (step 1), vai direto ao Destinatário (step 2)
      setAction('email')
      setStep(2)
    } else {
      setStep(s => s + 1)
    }
  }

  function handleBack() {
    if (step === 2 && mode === 'report') {
      // Volta do Destinatário para a seleção do relatório
      setAction(null)
      setStep(0)
    } else if (step === 0) {
      handleClose()
    } else {
      setStep(s => s - 1)
    }
  }

  function canNext() {
    if (step === 0) return trigger !== null
    if (step === 1) return action !== null
    if (step === 2) return recipient !== null
    return true
  }

  async function handleActivate() {
    if (!trigger || !action || !recipient) return
    setSaving(true)

    const triggerMeta   = [...TRIGGERS, ...REPORTS].find(t => t.value === trigger)!
    const actionMeta    = ACTIONS.find(a => a.value === action)!
    const recipientMeta = RECIPIENTS.find(r => r.value === recipient)!
    const title = `${triggerMeta.label} → ${actionMeta.label} para ${recipientMeta.label}`

    const result = await createAutomation(trigger, action, recipient, title)
    setSaving(false)

    if (!result.success) {
      if (result.upgradeRequired) {
        toast.error(`Limite de ${result.limit ?? '?'} automações atingido. Faça upgrade para adicionar mais.`)
      } else {
        toast.error(result.error ?? 'Erro ao criar automação')
      }
      return
    }

    toast.success('Automação ativada com sucesso!')
    reset(); onCreated(); onClose()
  }

  const sheetDescription = mode === 'report'
    ? 'Escolha o relatório e quem deve receber.'
    : 'Configure em 4 passos o que vai acontecer e quando.'

  return (
    <Sheet open={open} onOpenChange={v => !v && handleClose()}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Nova automação
          </SheetTitle>
          <SheetDescription>{sheetDescription}</SheetDescription>
        </SheetHeader>

        <SheetBody>
          <StepIndicator step={step} mode={mode} />

          {step === 0 && (
            <TriggerStep selected={trigger} onSelect={setTrigger} />
          )}
          {step === 1 && mode === 'event' && (
            <ActionStep selected={action} onSelect={setAction} triggerType={trigger} />
          )}
          {step === 2 && (
            <RecipientStep selected={recipient} onSelect={setRecipient} mode={mode} trigger={trigger} />
          )}
          {step === 3 && trigger && action && recipient && (
            <ReviewStep trigger={trigger} action={action} recipient={recipient} mode={mode} />
          )}
        </SheetBody>

        <SheetFooter>
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {step === 0 ? 'Cancelar' : 'Voltar'}
          </button>

          {step < 3 ? (
            <button
              onClick={handleNext}
              disabled={!canNext()}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold transition-colors',
                canNext()
                  ? 'bg-primary text-white hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed',
              )}
            >
              Próximo
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleActivate}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {saving ? (
                <><div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />Ativando…</>
              ) : (
                <><Zap className="h-4 w-4" />Ativar automação</>
              )}
            </button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
