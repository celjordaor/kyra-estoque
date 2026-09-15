'use client'

import * as React from 'react'
import {
  AlertTriangle, TrendingDown, ShoppingCart, ShoppingBag,
  Calendar, CalendarDays,
  CheckCircle2, XCircle, Clock, Loader2, Zap, Info,
  Plus, Play, Sparkles, Trash2, Settings2, BarChart2, FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  getCompanyAutomations, getAutomationLogs, getAutomationStats,
  toggleAutomation, triggerAutomation, deleteAutomation, getAutomationLimit,
} from '@/lib/actions/automations'
import {
  type AutomationTrigger, type CompanyAutomation, type AutomationLog,
  ACTION_LABELS, RECIPIENT_LABELS,
} from '@/lib/actions/automations-types'
import { UpgradePrompt, UpgradeBanner } from '@/components/ui/upgrade-prompt'
import { AutomationWizard } from './automation-wizard'

// ── Catálogo de tipos ──────────────────────────────────────────
interface TriggerMeta {
  type: AutomationTrigger
  title: string
  description: string
  detail: string
  icon: React.ElementType
  color: string
  triggerLabel: string
  isReport?: boolean          // relatórios agendados têm UX diferente
}

const TRIGGER_CATALOGUE: TriggerMeta[] = [
  {
    type: 'low_stock',
    title: 'Alerta de estoque baixo',
    description: 'Avisa quando um produto atinge o estoque mínimo configurado.',
    detail: 'A Kyra monitora continuamente o estoque. Assim que um produto fica abaixo do mínimo, você recebe uma notificação para iniciar a reposição a tempo.',
    icon: AlertTriangle,
    color: 'bg-amber-500',
    triggerLabel: 'Quando estoque ≤ mínimo configurado',
  },
  {
    type: 'no_sales',
    title: 'Produto parado sem vendas',
    description: 'Identifica produtos sem movimentação por 30+ dias.',
    detail: 'Produtos parados representam capital imobilizado. A Kyra detecta itens sem saída e sugere ações como promoção ou revisão de preço.',
    icon: TrendingDown,
    color: 'bg-slate-500',
    triggerLabel: 'Produto sem saída por 30+ dias',
  },
  {
    type: 'delayed_purchase',
    title: 'Compra em atraso',
    description: 'Alerta quando uma ordem de compra vence sem confirmação de entrega.',
    detail: 'Ordens de compra sem entrega no prazo podem gerar ruptura de estoque. A Kyra avisa para você acompanhar com o fornecedor.',
    icon: ShoppingCart,
    color: 'bg-red-500',
    triggerLabel: 'Prazo de entrega vencido sem baixa',
  },
  {
    type: 'sale_happened',
    title: 'Nova venda registrada',
    description: 'Notifica a cada nova venda concluída no sistema.',
    detail: 'Ideal para equipes que precisam acompanhar as vendas em tempo real. A Kyra envia o aviso assim que a venda é registrada.',
    icon: ShoppingBag,
    color: 'bg-green-500',
    triggerLabel: 'A cada nova venda registrada',
  },
  {
    type: 'weekly',
    title: 'Relatório semanal',
    description: 'Resumo de vendas, estoque e oportunidades toda segunda-feira às 08h.',
    detail: 'Toda segunda-feira você recebe: vendas e receita da semana, produtos em alerta, itens parados e oportunidades identificadas pela Kyra.',
    icon: BarChart2,
    color: 'bg-primary',
    triggerLabel: 'Toda segunda-feira às 08h',
    isReport: true,
  },
  {
    type: 'monthly',
    title: 'Relatório mensal',
    description: 'Análise completa de desempenho no 1º dia de cada mês às 08h.',
    detail: 'Primeiro dia do mês: receita total, margem, giro de estoque por categoria, top 10 produtos e recomendações de compra da Kyra.',
    icon: FileText,
    color: 'bg-purple-500',
    triggerLabel: 'No 1º dia de cada mês às 08h',
    isReport: true,
  },
]

const TYPE_ALIASES: Record<string, AutomationTrigger> = {
  slow_moving:   'no_sales',
  weekly_report: 'weekly',
}
function normalizeTrigger(t: string): AutomationTrigger {
  return (TYPE_ALIASES[t] ?? t) as AutomationTrigger
}

// ── Helpers ────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}
function fmtDuration(ms: number | null) {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

// ── Log status badge ───────────────────────────────────────────
function LogStatusBadge({ status }: { status: AutomationLog['status'] }) {
  const MAP = {
    success: { label: 'Sucesso',  variant: 'success' as const, icon: CheckCircle2 },
    failed:  { label: 'Falhou',   variant: 'danger'  as const, icon: XCircle },
    running: { label: 'Rodando',  variant: 'info'    as const, icon: Loader2 },
    partial: { label: 'Parcial',  variant: 'warning' as const, icon: AlertTriangle },
  }
  const cfg = MAP[status] ?? MAP.partial
  const Icon = cfg.icon
  return (
    <Badge variant={cfg.variant}>
      <Icon className={cn('h-3 w-3', status === 'running' && 'animate-spin')} />
      {cfg.label}
    </Badge>
  )
}

// ── Card: automação JÁ configurada ────────────────────────────
function ConfiguredCard({
  meta, automation, onToggle, onTrigger, onDelete, toggling, triggering,
}: {
  meta: TriggerMeta
  automation: CompanyAutomation
  onToggle: (type: AutomationTrigger, enabled: boolean) => void
  onTrigger: (type: AutomationTrigger) => void
  onDelete: (id: string) => void
  toggling: boolean
  triggering: boolean
}) {
  const Icon = meta.icon
  const enabled = automation.enabled
  const [expanded, setExpanded] = React.useState(false)

  const actionLabel    = ACTION_LABELS[automation.action_type]    ?? automation.action_type
  const recipientLabel = RECIPIENT_LABELS[automation.recipient_type] ?? automation.recipient_type

  return (
    <div className={cn(
      'rounded-xl border bg-card transition-all',
      enabled ? 'border-primary/30' : 'border-border',
    )}>
      <div className="flex items-start gap-4 p-5">
        <div className={cn('mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', meta.color)}>
          <Icon className="h-5 w-5 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm">{meta.title}</p>
            {enabled
              ? <Badge variant="success">Ativa</Badge>
              : <Badge variant="neutral">Pausada</Badge>}
            {meta.isReport && <Badge variant="neutral">Agendado</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{meta.description}</p>

          {/* Configuração atual */}
          <div className="mt-2 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>{meta.triggerLabel}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Zap className="h-3.5 w-3.5 shrink-0" />
              <span>{actionLabel} → {recipientLabel}</span>
            </div>
          </div>

          {expanded && (
            <div className="mt-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <div className="flex gap-1.5">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                <p>{meta.detail}</p>
              </div>
            </div>
          )}

          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={() => setExpanded(v => !v)}
              className="text-xs text-primary hover:underline"
            >
              {expanded ? 'Menos detalhes' : 'Como funciona?'}
            </button>

            {enabled && (
              <button
                onClick={() => onTrigger(meta.type)}
                disabled={triggering}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                {triggering ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                Disparar agora
              </button>
            )}

            <button
              onClick={() => onDelete(automation.id)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Remover
            </button>
          </div>
        </div>

        {/* Toggle */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Switch
            checked={enabled}
            disabled={toggling}
            onCheckedChange={checked => onToggle(meta.type, checked)}
            aria-label={enabled ? `Desativar ${meta.title}` : `Ativar ${meta.title}`}
          />
          <span className="text-xs text-muted-foreground">{enabled ? 'Ativada' : 'Pausada'}</span>
        </div>
      </div>
    </div>
  )
}

// ── Card: sugestão NÃO configurada ────────────────────────────
function SuggestionCard({
  meta, onConfigure,
}: {
  meta: TriggerMeta
  onConfigure: (type: AutomationTrigger) => void
}) {
  const Icon = meta.icon
  const [expanded, setExpanded] = React.useState(false)

  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 transition-all hover:border-border hover:bg-card">
      <div className="flex items-start gap-4 p-5">
        <div className={cn('mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl opacity-70', meta.color)}>
          <Icon className="h-5 w-5 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm text-muted-foreground">{meta.title}</p>
            {meta.isReport && <Badge variant="neutral">Agendado</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{meta.description}</p>

          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>{meta.triggerLabel}</span>
          </div>

          {expanded && (
            <div className="mt-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <div className="flex gap-1.5">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                <p>{meta.detail}</p>
              </div>
            </div>
          )}

          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={() => setExpanded(v => !v)}
              className="text-xs text-primary hover:underline"
            >
              {expanded ? 'Menos detalhes' : 'Como funciona?'}
            </button>
          </div>
        </div>

        {/* CTA */}
        <div className="shrink-0">
          <button
            onClick={() => onConfigure(meta.type)}
            className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
          >
            <Settings2 className="h-3.5 w-3.5" />
            {meta.isReport ? 'Ativar relatório' : 'Configurar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Stats card ─────────────────────────────────────────────────
function StatCard({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-4">
      {loading ? <Skeleton className="h-7 w-12 mb-1" /> : <p className="text-2xl font-bold">{value}</p>}
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────
export function AutomationsPage() {
  const [automations, setAutomations] = React.useState<CompanyAutomation[]>([])
  const [logs, setLogs]               = React.useState<AutomationLog[]>([])
  const [stats, setStats]             = React.useState({ activeCount: 0, runsToday: 0 })
  const [loading, setLoading]         = React.useState(true)
  const [logsLoading, setLogsLoading] = React.useState(true)
  const [statsLoading, setStatsLoading] = React.useState(true)
  const [toggling, setToggling]       = React.useState<AutomationTrigger | null>(null)
  const [triggering, setTriggering]   = React.useState<AutomationTrigger | null>(null)
  const [wizardOpen, setWizardOpen]   = React.useState(false)
  const [wizardInitial, setWizardInitial] = React.useState<AutomationTrigger | undefined>(undefined)
  const [upgradePrompt, setUpgradePrompt] = React.useState<{ open: boolean; limit?: number | null }>({ open: false })
  const [planAllowed, setPlanAllowed] = React.useState<boolean | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try { setAutomations(await getCompanyAutomations()) }
    catch { toast.error('Erro ao carregar automações') }
    finally { setLoading(false) }
  }, [])

  const loadLogs = React.useCallback(async () => {
    setLogsLoading(true)
    try { setLogs(await getAutomationLogs(15)) }
    catch {}
    finally { setLogsLoading(false) }
  }, [])

  const loadStats = React.useCallback(async () => {
    setStatsLoading(true)
    try { setStats(await getAutomationStats()) }
    catch {}
    finally { setStatsLoading(false) }
  }, [])

  React.useEffect(() => {
    load(); loadLogs(); loadStats()
    getAutomationLimit().then(r => setPlanAllowed(r.allowed))
  }, [load, loadLogs, loadStats])

  function getAutomation(type: AutomationTrigger) {
    return automations.find(a => normalizeTrigger(a.automation_type) === type)
  }

  function openWizard(initialTrigger?: AutomationTrigger) {
    setWizardInitial(initialTrigger)
    setWizardOpen(true)
  }

  async function handleToggle(type: AutomationTrigger, enabled: boolean) {
    setToggling(type)
    try {
      const r = await toggleAutomation(type, enabled)
      if (!r.success) {
        if (r.upgradeRequired) setUpgradePrompt({ open: true, limit: r.limit })
        else toast.error(r.error ?? 'Erro ao atualizar automação')
        return
      }
      setAutomations(prev =>
        prev.map(a => normalizeTrigger(a.automation_type) === type ? { ...a, enabled } : a)
      )
      setStats(s => ({ ...s, activeCount: s.activeCount + (enabled ? 1 : -1) }))
      toast.success(enabled ? 'Automação ativada' : 'Automação pausada')
    } finally { setToggling(null) }
  }

  async function handleTrigger(type: AutomationTrigger) {
    setTriggering(type)
    try {
      const r = await triggerAutomation(type)
      if (!r.success) { toast.error(r.error ?? 'Erro ao disparar'); return }
      toast.success('Automação disparada! Verifique seu e-mail em instantes.')
      setStats(s => ({ ...s, runsToday: s.runsToday + 1 }))
      loadLogs()
    } finally { setTriggering(null) }
  }

  async function handleDelete(id: string) {
    const r = await deleteAutomation(id)
    if (!r.success) { toast.error(r.error ?? 'Erro ao remover'); return }
    setAutomations(prev => prev.filter(a => a.id !== id))
    setStats(s => ({ ...s, activeCount: Math.max(0, s.activeCount - 1) }))
    toast.success('Automação removida')
  }

  // Separa configuradas de sugestões
  const configured   = TRIGGER_CATALOGUE.filter(m => getAutomation(m.type))
  const suggestions  = TRIGGER_CATALOGUE.filter(m => !getAutomation(m.type))

  const LOG_LABELS: Record<string, string> = {
    low_stock: 'Estoque baixo', slow_moving: 'Produto parado', no_sales: 'Produto parado',
    weekly_report: 'Relatório semanal', weekly: 'Relatório semanal', monthly: 'Relatório mensal',
    delayed_purchase: 'Compra em atraso', sale_happened: 'Nova venda',
  }

  return (
    <>
      <UpgradePrompt
        open={upgradePrompt.open}
        onClose={() => setUpgradePrompt({ open: false })}
        resource="automações"
        limit={upgradePrompt.limit}
      />
      <AutomationWizard
        open={wizardOpen}
        initialTrigger={wizardInitial}
        onClose={() => { setWizardOpen(false); setWizardInitial(undefined) }}
        onCreated={() => { load(); loadStats() }}
      />

      {/* Plan gate */}
      {planAllowed === false && (
        <div className="flex flex-col gap-6 p-6">
          <PageHeader icon={Zap} title="Automações" description="Processos recorrentes que eliminam trabalho operacional." />
          <UpgradeBanner
            resource="automações"
            message="Automações não estão disponíveis no plano Organiza. Faça upgrade para o Impulsiona ou Escala e elimine trabalho operacional com a Kyra."
          />
        </div>
      )}

      {planAllowed !== false && (
        <div className="flex flex-col gap-6 p-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <PageHeader
              icon={Zap}
              title="Automações"
              description="Processos recorrentes que eliminam trabalho operacional. Ative e a Kyra cuida do resto."
            />
            <button
              onClick={() => openWizard()}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nova automação
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="automações ativas" value={stats.activeCount} loading={statsLoading} />
            <StatCard label="execuções hoje"    value={stats.runsToday}   loading={statsLoading} />
            <div className="col-span-2 flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">E-mails automáticos via Kyra</p>
                <p className="text-xs text-muted-foreground">Enviados diretamente, sem dependências externas.</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
            </div>
          ) : (
            <>
              {/* ── Seção 1: Automações ativas/pausadas ──────── */}
              {configured.length > 0 && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Minhas automações
                  </p>
                  {configured.map(meta => {
                    const automation = getAutomation(meta.type)!
                    return (
                      <ConfiguredCard
                        key={meta.type}
                        meta={meta}
                        automation={automation}
                        onToggle={handleToggle}
                        onTrigger={handleTrigger}
                        onDelete={handleDelete}
                        toggling={toggling === meta.type}
                        triggering={triggering === meta.type}
                      />
                    )
                  })}
                </div>
              )}

              {/* ── Seção 2: Sugestões não configuradas ──────── */}
              {suggestions.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Sugestões da Kyra
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Automações disponíveis ainda não configuradas. Clique em "Configurar" para ativar.
                  </p>
                  {suggestions.map(meta => (
                    <SuggestionCard
                      key={meta.type}
                      meta={meta}
                      onConfigure={openWizard}
                    />
                  ))}
                </div>
              )}

              {/* Estado vazio — nenhuma automação ainda */}
              {configured.length === 0 && suggestions.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-12 text-center">
                  <Zap className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-semibold">Nenhuma automação ainda</p>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-4">
                    Crie sua primeira automação e deixe a Kyra trabalhar por você.
                  </p>
                  <button
                    onClick={() => openWizard()}
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Criar automação
                  </button>
                </div>
              )}
            </>
          )}

          {/* Histórico de execuções */}
          <div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Histórico de execuções
            </p>
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Automação</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Disparo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">Duração</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Detalhe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {logsLoading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <tr key={i}>
                          {Array.from({ length: 5 }).map((_, j) => (
                            <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                          ))}
                        </tr>
                      ))
                    ) : logs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                          <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">Nenhuma execução registrada ainda.</p>
                          <p className="text-xs mt-0.5">O histórico aparece aqui assim que uma automação rodar.</p>
                        </td>
                      </tr>
                    ) : (
                      logs.map(log => (
                        <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium">{LOG_LABELS[log.workflow_name] ?? log.workflow_name}</p>
                            <p className="text-xs text-muted-foreground">{fmtDate(log.started_at)}</p>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell text-xs">{log.trigger_type}</td>
                          <td className="px-4 py-3"><LogStatusBadge status={log.status} /></td>
                          <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">{fmtDuration(log.duration_ms)}</td>
                          <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell text-xs">{log.error_message ?? '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
