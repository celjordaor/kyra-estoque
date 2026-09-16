'use client'

import * as React from 'react'
import {
  Building2, Users, Ticket, Activity, TrendingUp, AlertCircle,
  CheckCircle2, XCircle, Clock, ChevronDown, Search, Filter,
  MoreHorizontal, Power, Mail, ExternalLink, Tag, MessageSquare,
  BarChart3, Zap, Crown, Star, RefreshCw, Eye, Flag,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import {
  getAdminStats, getAdminTenants, getLeads, getSupportTickets, getAdminLogs,
  toggleTenantActive, updateLeadStatus, updateTicketStatus,
  getTenantDetail, changeTenantPlan, getTenantOverrides, setTenantOverride, deleteTenantOverride,
  getFeatureFlags, updateFeatureFlag, getAiUsageStats, seedOnboardingCheckpoints,
  type AdminStats, type TenantRow, type LeadRow, type SupportTicketRow, type LogEntry,
  type TenantDetail, type TenantOverrideRow, type FeatureFlagRow, type AiUsageSummary,
} from '@/lib/actions/admin'
import { provisionTenant, getProvisioningJobs, type ProvisionTenantInput, type ProvisioningJobRow } from '@/lib/actions/provisioning'

// ── Helpers ────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

// ── Plan badge ─────────────────────────────────────────────────
const PLAN_META: Record<string, { icon: React.ElementType; color: string; variant: 'neutral' | 'info' | 'warning' | 'success' }> = {
  'kyra-organiza':   { icon: Star,  color: 'text-muted-foreground', variant: 'neutral' },
  'kyra-impulsiona': { icon: Zap,   color: 'text-blue-500',         variant: 'info' },
  'kyra-escala':     { icon: Crown, color: 'text-yellow-500',       variant: 'warning' },
}

function PlanBadge({ slug, name }: { slug: string | null; name: string | null }) {
  if (!slug || !name) return <Badge variant="neutral" className="text-xs">Sem plano</Badge>
  const meta = PLAN_META[slug] ?? { icon: Star, color: 'text-muted-foreground', variant: 'neutral' as const }
  const Icon = meta.icon
  return (
    <Badge variant={meta.variant} className="text-xs gap-1">
      <Icon className={cn('h-3 w-3', meta.color)} />
      {name}
    </Badge>
  )
}

function SubStatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="neutral" className="text-xs">—</Badge>
  const map: Record<string, { label: string; variant: 'success' | 'info' | 'warning' | 'danger' | 'neutral' }> = {
    active:   { label: 'Ativo',     variant: 'success' },
    trialing: { label: 'Trial',     variant: 'info' },
    past_due: { label: 'Em atraso', variant: 'warning' },
    cancelled:{ label: 'Cancelado', variant: 'danger' },
  }
  const m = map[status] ?? { label: status, variant: 'neutral' as const }
  return <Badge variant={m.variant} className="text-xs">{m.label}</Badge>
}

// ── Stat card ──────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'text-muted-foreground' }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex items-start gap-4">
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted', color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Nav tabs ───────────────────────────────────────────────────
type Tab = 'tenants' | 'leads' | 'tickets' | 'logs' | 'onboarding' | 'assinaturas' | 'ia' | 'provisioning' | 'flags'
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'tenants',      label: 'Tenants',    icon: Building2 },
  { id: 'leads',        label: 'Leads',      icon: TrendingUp },
  { id: 'tickets',      label: 'Suporte',    icon: Ticket },
  { id: 'onboarding',   label: 'Onboarding', icon: CheckCircle2 },
  { id: 'assinaturas',  label: 'Assinaturas',icon: Crown },
  { id: 'ia',           label: 'Uso de IA',  icon: Zap },
  { id: 'provisioning', label: 'Provisionar',icon: RefreshCw },
  { id: 'flags',        label: 'Feat. Flags', icon: Flag },
  { id: 'logs',         label: 'Auditoria',  icon: Activity },
]

// ── Tenants Tab ────────────────────────────────────────────────
function TenantsTab() {
  const [tenants, setTenants] = React.useState<TenantRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [selectedTenant, setSelectedTenant] = React.useState<string | null>(null)
  const [filter, setFilter] = React.useState<'all' | 'active' | 'trialing' | 'past_due'>('all')

  const load = () => {
    setLoading(true)
    getAdminTenants().then(d => { setTenants(d); setLoading(false) })
  }
  React.useEffect(load, [])

  const filtered = tenants.filter(t => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.email?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || t.subscription_status === filter
    return matchSearch && matchFilter
  })

  async function handleToggle(id: string, active: boolean) {
    const res = await toggleTenantActive(id, active)
    if (res.success) {
      setTenants(prev => prev.map(t => t.id === id ? { ...t, is_active: active } : t))
      toast.success(active ? 'Tenant ativado' : 'Tenant suspenso')
    } else toast.error(res.error ?? 'Erro')
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar tenant..." className="pl-8 h-8 text-sm" />
        </div>
        {(['all', 'active', 'trialing', 'past_due'] as const).map(f => (
          <button key={f}
            onClick={() => setFilter(f)}
            className={cn('px-3 py-1.5 rounded-lg text-xs border transition-colors', filter === f ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:border-muted-foreground')}>
            {f === 'all' ? 'Todos' : f === 'active' ? 'Ativos' : f === 'trialing' ? 'Trial' : 'Em atraso'}
          </button>
        ))}
        <Button variant="ghost" size="sm" onClick={load} className="h-8"><RefreshCw className="h-3.5 w-3.5" /></Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Carregando...</div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Empresa</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Plano</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Assinatura</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Usuários</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Produtos</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Criado</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Ativo</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Detalhe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">Nenhum tenant encontrado</td></tr>
              ) : filtered.map(t => (
                <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.email ?? t.slug}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <PlanBadge slug={t.plan_slug} name={t.plan_name} />
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <SubStatusBadge status={t.subscription_status} />
                  </td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    <span className="tabular-nums">{t.user_count}</span>
                  </td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    <span className="tabular-nums">{t.product_count}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                    {formatDate(t.created_at)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Switch checked={t.is_active} onCheckedChange={v => handleToggle(t.id, v)} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => setSelectedTenant(prev => prev === t.id ? null : t.id)}
                      className="text-xs text-primary hover:underline">
                      {selectedTenant === t.id ? "Fechar" : "Ver"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selectedTenant && (
        <TenantDetailPanel
          companyId={selectedTenant}
          onClose={() => setSelectedTenant(null)}
        />
      )}

      <p className="text-xs text-muted-foreground">{filtered.length} de {tenants.length} tenants</p>
    </div>
  )
}

// ── Leads Tab ──────────────────────────────────────────────────
const LEAD_STATUS_LABELS: Record<LeadRow['status'], string> = {
  new: 'Novo', contacted: 'Contactado', qualified: 'Qualificado', converted: 'Convertido', lost: 'Perdido',
}
const LEAD_STATUS_VARIANTS: Record<LeadRow['status'], 'info' | 'warning' | 'success' | 'danger' | 'neutral'> = {
  new: 'info', contacted: 'warning', qualified: 'warning', converted: 'success', lost: 'danger',
}
const LEAD_STATUSES: LeadRow['status'][] = ['new', 'contacted', 'qualified', 'converted', 'lost']

function LeadsTab() {
  const [leads, setLeads] = React.useState<LeadRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [filter, setFilter] = React.useState<LeadRow['status'] | 'all'>('all')
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [savingId, setSavingId] = React.useState<string | null>(null)
  const [notes, setNotes] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    getLeads().then(d => { setLeads(d); setLoading(false) })
  }, [])

  const filtered = filter === 'all' ? leads : leads.filter(l => l.status === filter)

  async function handleStatus(id: string, status: LeadRow['status']) {
    setSavingId(id)
    const res = await updateLeadStatus(id, status, notes[id])
    setSavingId(null)
    if (res.success) {
      setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
      toast.success('Status atualizado')
    } else toast.error(res.error ?? 'Erro')
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {(['all', ...LEAD_STATUSES] as const).map(f => (
          <button key={f}
            onClick={() => setFilter(f)}
            className={cn('px-3 py-1.5 rounded-lg text-xs border transition-colors', filter === f ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:border-muted-foreground')}>
            {f === 'all' ? 'Todos' : LEAD_STATUS_LABELS[f]}
            {f !== 'all' && <span className="ml-1 tabular-nums">({leads.filter(l => l.status === f).length})</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Carregando...</div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 && <div className="text-center py-10 text-muted-foreground text-sm">Nenhum lead encontrado</div>}
          {filtered.map(lead => (
            <div key={lead.id} className="rounded-xl border border-border bg-card">
              <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                  {(lead.name?.[0] ?? '').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{lead.name}</p>
                    {lead.company && <span className="text-xs text-muted-foreground">@ {lead.company}</span>}
                    <Badge variant={LEAD_STATUS_VARIANTS[lead.status]} className="text-xs">{LEAD_STATUS_LABELS[lead.status]}</Badge>
                  </div>
                  <div className="flex gap-3 mt-0.5 flex-wrap">
                    <span className="text-xs text-muted-foreground">{lead.email}</span>
                    {lead.phone && <span className="text-xs text-muted-foreground">{lead.phone}</span>}
                    {lead.employees && <span className="text-xs text-muted-foreground">{lead.employees} funcionários</span>}
                    <span className="text-xs text-muted-foreground">{timeAgo(lead.created_at)}</span>
                  </div>
                </div>
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground shrink-0 transition-transform', expandedId === lead.id && 'rotate-180')} />
              </div>

              {expandedId === lead.id && (
                <div className="px-4 pb-4 pt-0 border-t border-border mt-0 space-y-3">
                  {lead.message && (
                    <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground italic">"{lead.message}"</div>
                  )}
                  <div>
                    <p className="text-xs font-medium mb-1.5">Notas internas</p>
                    <textarea
                      value={notes[lead.id] ?? lead.notes ?? ''}
                      onChange={e => setNotes(prev => ({ ...prev, [lead.id]: e.target.value }))}
                      rows={2}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                      placeholder="Adicionar notas..."
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <p className="text-xs font-medium self-center">Status:</p>
                    {LEAD_STATUSES.map(s => (
                      <button key={s}
                        onClick={() => handleStatus(lead.id, s)}
                        disabled={savingId === lead.id}
                        className={cn('px-2.5 py-1 rounded text-xs border transition-colors', lead.status === s ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:border-primary/50')}>
                        {LEAD_STATUS_LABELS[s]}
                      </button>
                    ))}
                    <a href={`mailto:${lead.email}`} className="ml-auto">
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1"><Mail className="h-3 w-3" />E-mail</Button>
                    </a>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Support Tickets Tab ────────────────────────────────────────
const PRIORITY_VARIANTS: Record<string, 'danger' | 'warning' | 'neutral' | 'info'> = {
  critical: 'danger', high: 'warning', medium: 'neutral', low: 'info',
}
const TICKET_STATUS_LABELS: Record<SupportTicketRow['status'], string> = {
  open: 'Aberto', in_progress: 'Em andamento', resolved: 'Resolvido', closed: 'Fechado',
}
const TICKET_STATUSES: SupportTicketRow['status'][] = ['open', 'in_progress', 'resolved', 'closed']

function TicketsTab() {
  const [tickets, setTickets] = React.useState<SupportTicketRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [filter, setFilter] = React.useState<SupportTicketRow['status'] | 'all'>('open')
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [savingId, setSavingId] = React.useState<string | null>(null)
  const [adminNotes, setAdminNotes] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    getSupportTickets().then(d => { setTickets(d); setLoading(false) })
  }, [])

  const filtered = filter === 'all' ? tickets : tickets.filter(t => t.status === filter)

  async function handleStatus(id: string, status: SupportTicketRow['status']) {
    setSavingId(id)
    const res = await updateTicketStatus(id, status, adminNotes[id])
    setSavingId(null)
    if (res.success) {
      setTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t))
      toast.success('Ticket atualizado')
    } else toast.error(res.error ?? 'Erro')
  }

  const CATEGORY_LABELS: Record<string, string> = { billing: 'Billing', bug: 'Bug', feature: 'Feature', other: 'Outro' }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {(['all', ...TICKET_STATUSES] as const).map(f => (
          <button key={f}
            onClick={() => setFilter(f)}
            className={cn('px-3 py-1.5 rounded-lg text-xs border transition-colors', filter === f ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:border-muted-foreground')}>
            {f === 'all' ? 'Todos' : TICKET_STATUS_LABELS[f]}
            {f !== 'all' && <span className="ml-1 tabular-nums">({tickets.filter(t => t.status === f).length})</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Carregando...</div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 && <div className="text-center py-10 text-muted-foreground text-sm">Nenhum ticket encontrado</div>}
          {filtered.map(ticket => (
            <div key={ticket.id} className="rounded-xl border border-border bg-card">
              <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => setExpandedId(expandedId === ticket.id ? null : ticket.id)}>
                <div className="shrink-0 mt-0.5">
                  <Badge variant={PRIORITY_VARIANTS[ticket.priority] ?? 'neutral'} className="text-xs uppercase">{ticket.priority}</Badge>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{ticket.subject}</p>
                  <div className="flex gap-2 mt-0.5 flex-wrap">
                    {ticket.company_name && <span className="text-xs text-muted-foreground">{ticket.company_name}</span>}
                    {ticket.user_email && <span className="text-xs text-muted-foreground">{ticket.user_email}</span>}
                    <Badge variant="neutral" className="text-xs">{CATEGORY_LABELS[ticket.category]}</Badge>
                    <span className="text-xs text-muted-foreground">{timeAgo(ticket.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={ticket.status === 'open' ? 'warning' : ticket.status === 'resolved' ? 'success' : 'neutral'} className="text-xs hidden sm:inline-flex">
                    {TICKET_STATUS_LABELS[ticket.status]}
                  </Badge>
                  <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', expandedId === ticket.id && 'rotate-180')} />
                </div>
              </div>

              {expandedId === ticket.id && (
                <div className="px-4 pb-4 border-t border-border space-y-3 pt-3">
                  <div>
                    <p className="text-xs font-medium mb-1.5">Notas do admin</p>
                    <textarea
                      value={adminNotes[ticket.id] ?? ticket.admin_notes ?? ''}
                      onChange={e => setAdminNotes(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                      rows={2}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                      placeholder="Anotações internas..."
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <p className="text-xs font-medium self-center">Status:</p>
                    {TICKET_STATUSES.map(s => (
                      <button key={s}
                        onClick={() => handleStatus(ticket.id, s)}
                        disabled={savingId === ticket.id}
                        className={cn('px-2.5 py-1 rounded text-xs border transition-colors', ticket.status === s ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:border-primary/50')}>
                        {TICKET_STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Logs Tab ───────────────────────────────────────────────────
const EVENT_ICONS: Record<string, React.ElementType> = {
  'subscription.created': CheckCircle2,
  'subscription.updated': RefreshCw,
  'subscription.cancelled': XCircle,
  'trial.started': Zap,
  'trial.ended': Clock,
  'payment.succeeded': CheckCircle2,
  'payment.failed': AlertCircle,
}
const EVENT_COLORS: Record<string, string> = {
  'subscription.created': 'text-green-500',
  'payment.succeeded': 'text-green-500',
  'trial.started': 'text-blue-500',
  'subscription.cancelled': 'text-destructive',
  'payment.failed': 'text-destructive',
  'trial.ended': 'text-orange-500',
}

function LogsTab() {
  const [logs, setLogs] = React.useState<LogEntry[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    getAdminLogs().then(d => { setLogs(d); setLoading(false) })
  }, [])

  return (
    <div className="space-y-2">
      <Button variant="ghost" size="sm" onClick={() => { setLoading(true); getAdminLogs().then(d => { setLogs(d); setLoading(false) }) }} className="h-8 gap-1.5 text-muted-foreground">
        <RefreshCw className="h-3.5 w-3.5" /> Atualizar
      </Button>
      {loading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Carregando...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm rounded-xl border border-border">Nenhum evento registrado</div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="divide-y divide-border">
            {logs.map((log, i) => {
              const Icon = EVENT_ICONS[log.type] ?? Activity
              const color = EVENT_COLORS[log.type] ?? 'text-muted-foreground'
              return (
                <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                  <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', color)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{log.description}</p>
                    {log.company_name && <p className="text-xs text-muted-foreground">{log.company_name}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{formatDateTime(log.created_at)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────
export function AdminPage() {
  const [stats, setStats] = React.useState<AdminStats | null>(null)
  const [tab, setTab] = React.useState<Tab>('tenants')

  React.useEffect(() => {
    getAdminStats().then(setStats)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none">Admin Portal</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Kyra Estoque — Painel interno</p>
          </div>
          <div className="ml-auto">
            <Badge variant="danger" className="text-xs">Acesso restrito</Badge>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard icon={Building2} label="Tenants ativos" value={stats.total_tenants} />
            <StatCard icon={CheckCircle2} label="Assinaturas ativas" value={stats.active_subscriptions} color="text-green-500" />
            <StatCard icon={Zap} label="Em trial" value={stats.trialing} color="text-blue-500" />
            <StatCard icon={BarChart3} label="MRR" value={stats.mrr_cents ? `R$ ${(stats.mrr_cents / 100).toFixed(0)}` : '—'} color="text-primary" />
            <StatCard icon={Ticket} label="Tickets abertos" value={stats.open_tickets} color={stats.open_tickets > 0 ? 'text-orange-500' : 'text-muted-foreground'} />
            <StatCard icon={TrendingUp} label="Leads novos" value={stats.new_leads} color={stats.new_leads > 0 ? 'text-blue-500' : 'text-muted-foreground'} />
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-border flex gap-1">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                  tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}>
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        {tab === 'tenants'      && <TenantsTab />}
        {tab === 'leads'        && <LeadsTab />}
        {tab === 'tickets'      && <TicketsTab />}
        {tab === 'onboarding'   && <OnboardingTab />}
        {tab === 'assinaturas'  && <AssinaturasTab />}
        {tab === 'ia'           && <IaUsageTab />}
        {tab === 'provisioning' && <ProvisioningTab />}
        {tab === 'flags'       && <FeatureFlagsTab />}
        {tab === 'logs'         && <LogsTab />}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// SPRINT 22b — Novas tabs do Admin Portal
// ══════════════════════════════════════════════════════════════

// ── Tenant Detail Panel ────────────────────────────────────────
function TenantDetailPanel({
  companyId,
  onClose,
}: {
  companyId: string
  onClose: () => void
}) {
  const [detail, setDetail] = React.useState<TenantDetail | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [planInput, setPlanInput] = React.useState('')
  const [savingPlan, setSavingPlan] = React.useState(false)
  const [overrideKey, setOverrideKey] = React.useState('')
  const [overrideInt, setOverrideInt] = React.useState('')
  const [overrideReason, setOverrideReason] = React.useState('')
  const [savingOverride, setSavingOverride] = React.useState(false)

  React.useEffect(() => {
    getTenantDetail(companyId).then(d => { setDetail(d); setLoading(false) })
  }, [companyId])

  async function handleChangePlan() {
    if (!planInput.trim()) return
    setSavingPlan(true)
    const r = await changeTenantPlan(companyId, planInput.trim())
    if (r.success) { toast.success('Plano alterado'); getTenantDetail(companyId).then(setDetail) }
    else toast.error(r.error ?? 'Erro ao trocar plano')
    setSavingPlan(false)
  }

  async function handleAddOverride() {
    if (!overrideKey.trim() || !overrideReason.trim()) return
    setSavingOverride(true)
    const intVal = overrideInt !== '' ? Number(overrideInt) : undefined
    const r = await setTenantOverride({ company_id: companyId, feature_key: overrideKey.trim(), int_value: intVal, reason: overrideReason.trim() })
    if (r.success) { toast.success('Override salvo'); getTenantDetail(companyId).then(setDetail); setOverrideKey(''); setOverrideInt(''); setOverrideReason('') }
    else toast.error(r.error ?? 'Erro ao salvar override')
    setSavingOverride(false)
  }

  async function handleDeleteOverride(featureKey: string) {
    const r = await deleteTenantOverride(companyId, featureKey)
    if (r.success) { toast.success('Override removido'); getTenantDetail(companyId).then(setDetail) }
    else toast.error(r.error ?? 'Erro')
  }

  if (loading) return <div className="text-sm text-muted-foreground py-6 text-center">Carregando…</div>
  if (!detail) return <div className="text-sm text-muted-foreground py-6 text-center">Tenant não encontrado.</div>

  const d = detail
  return (
    <div className="border border-border rounded-xl bg-card p-5 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-base">{d.company.name}</h3>
          <p className="text-xs text-muted-foreground">{d.company.slug} · {d.company.email ?? '—'}</p>
        </div>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Fechar ×</button>
      </div>

      {/* Assinatura + trocar plano */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assinatura</p>
        {d.subscription ? (
          <div className="text-sm space-y-1">
            <div className="flex gap-2 items-center">
              <span className="font-medium">{d.subscription.plan_name}</span>
              <SubStatusBadge status={d.subscription.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              Período: {formatDate(d.subscription.current_period_start)} → {formatDate(d.subscription.current_period_end)}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sem assinatura ativa</p>
        )}
        <div className="flex gap-2 mt-2">
          <Input
            placeholder="Slug do plano (ex: kyra-impulsiona)"
            value={planInput}
            onChange={e => setPlanInput(e.target.value)}
            className="h-8 text-xs max-w-[260px]"
          />
          <Button size="sm" variant="outline" onClick={handleChangePlan} disabled={savingPlan || !planInput}>
            {savingPlan ? 'Salvando…' : 'Trocar plano'}
          </Button>
        </div>
      </div>

      {/* Overrides */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overrides de entitlement</p>
        {d.overrides.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum override ativo</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 pr-3">Feature key</th>
                  <th className="text-left py-1.5 pr-3">Valor</th>
                  <th className="text-left py-1.5 pr-3">Motivo</th>
                  <th className="text-left py-1.5 pr-3">Expira</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {d.overrides.map(o => (
                  <tr key={o.feature_key} className="border-b border-border/50">
                    <td className="py-1.5 pr-3 font-mono">{o.feature_key}</td>
                    <td className="py-1.5 pr-3 tabular-nums">
                      {o.int_value !== null ? o.int_value : o.bool_value !== null ? String(o.bool_value) : o.str_value ?? '—'}
                    </td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{o.reason}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{o.expires_at ? formatDate(o.expires_at) : '∞'}
                    </td>
                    <td className="py-1.5">
                      <button onClick={() => handleDeleteOverride(o.feature_key)}
                        className="text-danger hover:underline text-xs">Remover</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Add override */}
        <div className="flex gap-2 flex-wrap mt-1">
          <Input placeholder="feature_key" value={overrideKey} onChange={e => setOverrideKey(e.target.value)} className="h-7 text-xs w-40 font-mono" />
          <Input placeholder="int_value" value={overrideInt} onChange={e => setOverrideInt(e.target.value)} className="h-7 text-xs w-20" />
          <Input placeholder="Motivo" value={overrideReason} onChange={e => setOverrideReason(e.target.value)} className="h-7 text-xs w-40" />
          <Button size="sm" variant="outline" onClick={handleAddOverride} disabled={savingOverride || !overrideKey || !overrideReason} className="h-7 text-xs">
            {savingOverride ? '…' : '+ Override'}
          </Button>
        </div>
      </div>

      {/* Onboarding */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Jornada de onboarding</p>
        <div className="flex flex-wrap gap-2">
          {d.onboarding.map(cp => (
            <div key={cp.checkpoint_key}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border',
                cp.completed
                  ? 'bg-success/10 border-success/30 text-success'
                  : 'bg-muted border-border text-muted-foreground',
              )}>
              {cp.completed ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              D{cp.day}: {cp.display_name}
            </div>
          ))}
          {d.onboarding.length === 0 && (
            <div className="flex items-center gap-3">
              <p className="text-xs text-muted-foreground">Sem checkpoints para este tenant.</p>
              <SeedCheckpointsButton companyId={companyId} onDone={() => getTenantDetail(companyId).then(setDetail)} />
            </div>
          )}
        </div>
      </div>

      {/* AI usage */}
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Uso de IA (acumulado)</p>
        <div className="flex gap-6 text-sm">
          <span><span className="font-bold tabular-nums">{d.ai_usage.total_calls}</span> <span className="text-muted-foreground text-xs">chamadas</span></span>
          <span><span className="font-bold tabular-nums">{d.ai_usage.total_tokens.toLocaleString('pt-BR')}</span> <span className="text-muted-foreground text-xs">tokens</span></span>
          <span><span className="font-bold tabular-nums">R$ {(d.ai_usage.total_cost_brl_cents / 100).toFixed(2)}</span> <span className="text-muted-foreground text-xs">custo</span></span>
        </div>
      </div>
    </div>
  )
}

// ── SeedCheckpointsButton ─────────────────────────────────────
function SeedCheckpointsButton({ companyId, onDone }: { companyId: string; onDone: () => void }) {
  const [loading, setLoading] = React.useState(false)

  async function handleSeed() {
    setLoading(true)
    const r = await seedOnboardingCheckpoints(companyId)
    if (r.success) {
      toast.success('Checkpoints criados com sucesso')
      onDone()
    } else {
      toast.error(r.error ?? 'Erro ao executar seed')
    }
    setLoading(false)
  }

  return (
    <Button size="sm" variant="outline" onClick={handleSeed} disabled={loading} className="h-7 text-xs gap-1">
      <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'Executando…' : 'Seed checkpoints'}
    </Button>
  )
}

// ── Onboarding Tab ─────────────────────────────────────────────
function OnboardingTab() {
  const [tenants, setTenants] = React.useState<TenantRow[]>([])
  const [selected, setSelected] = React.useState<string | null>(null)
  const [detail, setDetail] = React.useState<TenantDetail | null>(null)
  const [loadingTenants, setLoadingTenants] = React.useState(true)
  const [loadingDetail, setLoadingDetail] = React.useState(false)

  React.useEffect(() => {
    getAdminTenants().then(d => { setTenants(d); setLoadingTenants(false) })
  }, [])

  async function selectTenant(id: string) {
    setSelected(id)
    setLoadingDetail(true)
    const d = await getTenantDetail(id)
    setDetail(d)
    setLoadingDetail(false)
  }

  const DAYS = [0, 1, 3, 5, 7, 14, 21]

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loadingTenants ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Empresa</th>
                {DAYS.map(d => (
                  <th key={d} className="text-center px-2 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">D{d}</th>
                ))}
                <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Progresso</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map(t => (
                <tr key={t.id}
                  onClick={() => selectTenant(t.id)}
                  className={cn('border-b border-border/50 cursor-pointer hover:bg-muted/30 transition-colors', selected === t.id && 'bg-primary/5')}>
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  {DAYS.map(day => (
                    <td key={day} className="px-2 py-3 text-center hidden sm:table-cell">
                      <span className="text-muted-foreground text-xs">—</span>
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center">
                    <Badge variant="neutral" className="text-xs">Ver</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div>
          {loadingDetail ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Carregando jornada…</div>
          ) : detail ? (
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{detail.company.name} — Jornada D0–D21</h3>
                <button onClick={() => { setSelected(null); setDetail(null) }} className="text-xs text-muted-foreground hover:text-foreground">Fechar ×</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {detail.onboarding.length === 0 ? (
                  <div className="col-span-4 flex items-center gap-3">
                    <p className="text-xs text-muted-foreground">Sem checkpoints para este tenant.</p>
                    <SeedCheckpointsButton companyId={selected!} onDone={() => selectTenant(selected!)} />
                  </div>
                ) : detail.onboarding.map(cp => (
                  <div key={cp.checkpoint_key}
                    className={cn(
                      'rounded-lg border p-3 space-y-1',
                      cp.completed ? 'border-success/40 bg-success/5' : 'border-border bg-muted/20',
                    )}>
                    <div className="flex items-center gap-1.5">
                      {cp.completed
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        : <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span className="text-xs font-semibold">D{cp.day}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug">{cp.display_name}</p>
                    {cp.completed_at && (
                      <p className="text-[10px] text-success">{formatDate(cp.completed_at)}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

// ── Assinaturas Tab ────────────────────────────────────────────
function AssinaturasTab() {
  const [tenants, setTenants] = React.useState<TenantRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selected, setSelected] = React.useState<string | null>(null)

  React.useEffect(() => {
    getAdminTenants().then(d => { setTenants(d); setLoading(false) })
  }, [])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Empresa</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Plano</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Trial</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tenants.map(t => (
                <React.Fragment key={t.id}>
                  <tr className={cn('border-b border-border/50', selected === t.id && 'bg-primary/5')}>
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <PlanBadge slug={t.plan_slug} name={t.plan_name} />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <SubStatusBadge status={t.subscription_status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                      {t.trial_ends_at ? formatDate(t.trial_ends_at) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelected(prev => prev === t.id ? null : t.id)}
                        className="text-xs text-primary hover:underline">
                        {selected === t.id ? 'Fechar' : 'Gerenciar'}
                      </button>
                    </td>
                  </tr>
                  {selected === t.id && (
                    <tr>
                      <td colSpan={5} className="px-4 py-3 bg-muted/20">
                        <TenantDetailPanel companyId={t.id} onClose={() => setSelected(null)} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── IA Usage Tab ───────────────────────────────────────────────
function IaUsageTab() {
  const [rows, setRows] = React.useState<AiUsageSummary[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    getAiUsageStats().then(d => { setRows(d); setLoading(false) })
  }, [])

  const totalTokens = rows.reduce((s, r) => s + r.total_tokens, 0)
  const totalCost = rows.reduce((s, r) => s + r.total_cost_brl_cents, 0)
  const totalCalls = rows.reduce((s, r) => s + r.total_calls, 0)

  return (
    <div className="space-y-4">
      {/* Sumário */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-bold tabular-nums">{totalCalls}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Chamadas totais</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-bold tabular-nums">{totalTokens.toLocaleString('pt-BR')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Tokens consumidos</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-bold tabular-nums">R$ {(totalCost / 100).toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Custo total (R$)</p>
        </div>
      </div>

      {/* Tabela por empresa */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Sem registros de uso ainda.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Empresa</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Chamadas</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Tokens</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Custo (R$)</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">% do total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const pct = totalTokens > 0 ? (r.total_tokens / totalTokens) * 100 : 0
                return (
                  <tr key={r.company_id} className="border-b border-border/50">
                    <td className="px-4 py-3 font-medium">{r.company_name ?? r.company_id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.total_calls}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.total_tokens.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 text-right tabular-nums">R$ {(r.total_cost_brl_cents / 100).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">{pct.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Provisioning Tab ───────────────────────────────────────────
const PLAN_SLUGS = ['kyra-organiza', 'kyra-impulsiona', 'kyra-escala']

function ProvisioningTab() {
  const [jobs, setJobs] = React.useState<ProvisioningJobRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [showForm, setShowForm] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  const [form, setForm] = React.useState<ProvisionTenantInput>({
    company_name: '',
    company_slug: '',
    admin_email: '',
    admin_name: '',
    plan_slug: 'kyra-organiza',
    trial_days: 14,
    notes: '',
  })

  function refreshJobs() {
    setLoading(true)
    getProvisioningJobs().then(d => { setJobs(d); setLoading(false) })
  }

  React.useEffect(() => { refreshJobs() }, [])

  function slugify(name: string) {
    return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.company_name || !form.company_slug || !form.admin_email || !form.admin_name) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }
    setSubmitting(true)
    const r = await provisionTenant(form)
    if (r.success) {
      toast.success(`Tenant provisionado! Job: ${r.job_id?.slice(0, 8)}`)
      setShowForm(false)
      setForm({ company_name: '', company_slug: '', admin_email: '', admin_name: '', plan_slug: 'kyra-organiza', trial_days: 14, notes: '' })
      refreshJobs()
    } else {
      toast.error(r.error ?? 'Erro ao provisionar')
    }
    setSubmitting(false)
  }

  const statusMeta: Record<string, { label: string; variant: 'success' | 'info' | 'warning' | 'danger' | 'neutral' }> = {
    completed:   { label: 'Concluído',  variant: 'success' },
    running:     { label: 'Rodando',    variant: 'info' },
    pending:     { label: 'Pendente',   variant: 'neutral' },
    failed:      { label: 'Falhou',     variant: 'danger' },
    rolled_back: { label: 'Revertido',  variant: 'warning' },
  }

  return (
    <div className="space-y-4">
      {/* CTA */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Pipeline atômico de criação de tenants com log por etapa.</p>
        <Button size="sm" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancelar' : '+ Novo tenant'}
        </Button>
      </div>

      {/* Formulário de provisionamento */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="font-semibold">Provisionar novo tenant</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Nome da empresa *</label>
              <Input
                value={form.company_name}
                onChange={e => setForm(p => ({ ...p, company_name: e.target.value, company_slug: slugify(e.target.value) }))}
                placeholder="Organiza Distribuidora"
                className="h-9 text-sm"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Slug *</label>
              <Input
                value={form.company_slug}
                onChange={e => setForm(p => ({ ...p, company_slug: e.target.value }))}
                placeholder="organiza-distribuidora"
                className="h-9 text-sm font-mono"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Nome do admin *</label>
              <Input
                value={form.admin_name}
                onChange={e => setForm(p => ({ ...p, admin_name: e.target.value }))}
                placeholder="João Silva"
                className="h-9 text-sm"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">E-mail do admin *</label>
              <Input
                type="email"
                value={form.admin_email}
                onChange={e => setForm(p => ({ ...p, admin_email: e.target.value }))}
                placeholder="joao@organiza.com.br"
                className="h-9 text-sm"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Plano *</label>
              <select
                value={form.plan_slug}
                onChange={e => setForm(p => ({ ...p, plan_slug: e.target.value }))}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {PLAN_SLUGS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Dias de trial (0 = sem trial)</label>
              <Input
                type="number"
                min={0}
                value={form.trial_days}
                onChange={e => setForm(p => ({ ...p, trial_days: Number(e.target.value) }))}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium">Observações</label>
              <Input
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Origem do lead, negociação, etc."
                className="h-9 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? 'Provisionando…' : 'Provisionar tenant'}
            </Button>
          </div>
        </form>
      )}

      {/* Jobs list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
          <p className="text-xs font-medium text-muted-foreground">Histórico de provisionamentos</p>
          <button onClick={refreshJobs} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <RefreshCw className="h-3 w-3" /> Atualizar
          </button>
        </div>
        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : jobs.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Nenhum job ainda.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Empresa</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Etapa</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Disparado por</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Data</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(j => {
                const meta = statusMeta[j.status] ?? { label: j.status, variant: 'neutral' as const }
                return (
                  <tr key={j.id} className="border-b border-border/50">
                    <td className="px-4 py-3 font-medium">
                      {j.company_name ?? <span className="text-muted-foreground italic">—</span>}
                      {j.error_message && (
                        <p className="text-xs text-danger mt-0.5">{j.error_message}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={meta.variant} className="text-xs">{meta.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell font-mono">
                      {j.current_step ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                      {j.triggered_by_email ?? j.trigger_source}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                      {formatDateTime(j.created_at)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Feature Flags Tab ──────────────────────────────────────────
function FeatureFlagsTab() {
  const [flags, setFlags] = React.useState<FeatureFlagRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState<string | null>(null)

  const load = () => {
    setLoading(true)
    getFeatureFlags().then(d => { setFlags(d); setLoading(false) })
  }
  React.useEffect(load, [])

  async function handleCommercial(featureKey: string, commercial_enabled: boolean) {
    setSaving(featureKey)
    const r = await updateFeatureFlag(featureKey, { commercial_enabled })
    if (r.success) {
      setFlags(prev => prev.map(f => f.feature_key === featureKey ? { ...f, commercial_enabled } : f))
      toast.success('Feature flag atualizada')
    } else toast.error(r.error ?? 'Erro')
    setSaving(null)
  }

  async function handleTechnical(featureKey: string, technical_status: FeatureFlagRow['technical_status']) {
    setSaving(featureKey)
    const r = await updateFeatureFlag(featureKey, { technical_status })
    if (r.success) {
      setFlags(prev => prev.map(f => f.feature_key === featureKey ? { ...f, technical_status } : f))
      toast.success('Status técnico atualizado')
    } else toast.error(r.error ?? 'Erro')
    setSaving(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Uma feature só é liberada quando{' '}
          <code className="text-xs bg-muted px-1 rounded">commercial_enabled = true</code> E{' '}
          <code className="text-xs bg-muted px-1 rounded">technical_status = available</code>.
        </p>
        <Button variant="ghost" size="sm" onClick={load} className="h-8 gap-1.5 text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : flags.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Nenhuma feature flag cadastrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Feature</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Descrição</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Comercial</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status Técnico</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Status final</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {flags.map(f => {
                const isLive = f.commercial_enabled && f.technical_status === 'available'
                return (
                  <tr key={f.feature_key} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-medium">{f.feature_key}</p>
                      <p className="text-xs text-muted-foreground">{f.display_name}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell max-w-[200px] truncate">
                      {f.description ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Switch
                        checked={f.commercial_enabled}
                        disabled={saving === f.feature_key}
                        onCheckedChange={v => handleCommercial(f.feature_key, v)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={f.technical_status}
                        disabled={saving === f.feature_key}
                        onChange={e => handleTechnical(f.feature_key, e.target.value as FeatureFlagRow['technical_status'])}
                        className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        <option value="available">Disponível</option>
                        <option value="in_homologation">Homologação</option>
                        <option value="disabled">Desativado</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={isLive ? 'success' : 'neutral'} className="text-xs">
                        {isLive ? '✓ Live' : '✗ Off'}
                      </Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
