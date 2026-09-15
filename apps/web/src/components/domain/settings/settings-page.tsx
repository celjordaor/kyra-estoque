'use client'

import * as React from 'react'
import {
  Building2, Settings2, Users, Shield, Link2, Brain, CreditCard, Lock,
  Plus, Pencil, Trash2, ChevronRight, Tag, Bookmark,
  ToggleLeft, BadgePercent, User,
  CheckCircle2, XCircle, Crown, Zap, Star, AlertCircle, Clock, UserMinus, ChevronDown, UserPlus, Copy,
  Key, Wifi, WifiOff, Globe, MessageCircle, ShoppingBag, Bot, Sliders, Sparkles, Eye, EyeOff, ExternalLink, RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { FormField } from '@/components/ui/form-field'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DataTable } from '@/components/composite/data-table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetBody, SheetFooter, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { PageHeader } from '@/components/layout/page-header'
import { cn } from '@/lib/utils'
import { CepInput } from '@/components/ui/cep-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatPhone, formatCnpj, isValidCnpj, isValidEmail } from '@/lib/formatters'
import { getCategoriesAdmin, createCategory, updateCategory, deleteCategory } from '@/lib/actions/categories'
import { getBrands, createBrand, updateBrand, deleteBrand } from '@/lib/actions/brands'
import { getCoupons, createCoupon, updateCoupon, deleteCoupon } from '@/lib/actions/coupons'
import { getCompanySettings, updateCompanyProfile, updateOperationSettings, uploadCompanyLogo, getFiscalConfig, updateFiscalConfig, type FiscalConfig } from '@/lib/actions/settings'
import { getSubscriptionInfo, type SubscriptionInfo } from '@/lib/actions/billing'
import {
  getTeamMembers, updateMemberRole, removeMember, inviteMember,
  getRoles, createRole, updateRole, deleteRole,
  type TeamMember, type CompanyRole,
} from '@/lib/actions/team'
import { PERMISSION_GROUPS } from '@/lib/actions/team-constants'
import { getKyraConfig, updateKyraConfig, type KyraConfig } from '@/lib/actions/intelligence'
import { getIntegrations, upsertIntegration, type Integration, type IntegrationType } from '@/lib/actions/integrations'
import { changePassword } from '@/lib/actions/security'
import type { CouponRow, CouponInput } from '@/lib/actions/coupons'
import type { CategoryRow, BrandRow } from '@kyra/database'

type Column<T> = { key: string; header: string; cell: (row: T) => React.ReactNode; sortable?: boolean; className?: string }

// ── Navigation ─────────────────────────────────────────────────
type Section =
  | 'overview'
  | 'company' | 'operation'
  | 'users' | 'profiles'
  | 'integrations'
  | 'intelligence'
  | 'subscription' | 'security'

const OVERVIEW_CARDS: { id: Section; label: string; description: string; icon: React.ElementType }[] = [
  { id: 'company', label: 'Empresa', description: 'Nome, CNPJ, endereço e dados do negócio', icon: Building2 },
  { id: 'operation', label: 'Operação', description: 'Estoque, descontos, categorias e marcas', icon: Settings2 },
  { id: 'users', label: 'Usuários', description: 'Gerencie os membros da equipe', icon: Users },
  { id: 'profiles', label: 'Perfis e permissões', description: 'Controle de acesso por função', icon: Shield },
  { id: 'integrations', label: 'Integrações', description: 'WhatsApp, e-mail, Asaas e mais', icon: Link2 },
  { id: 'intelligence', label: 'Inteligência', description: 'Configure o comportamento da Kyra', icon: Brain },
  { id: 'subscription', label: 'Assinatura', description: 'Plano atual, uso e faturamento', icon: CreditCard },
  { id: 'security', label: 'Segurança', description: 'Senha, autenticação e auditoria', icon: Lock },
]

// ── Plan config ────────────────────────────────────────────────
const PLAN_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  starter:      { icon: Star,   color: 'text-slate-500' },
  professional: { icon: Zap,    color: 'text-blue-500' },
  enterprise:   { icon: Crown,  color: 'text-amber-500' },
}

// ── Category colors ────────────────────────────────────────────
const CATEGORY_COLORS = [
  { value: '#0D9488', label: 'Teal' }, { value: '#3B82F6', label: 'Azul' },
  { value: '#8B5CF6', label: 'Roxo' }, { value: '#EC4899', label: 'Rosa' },
  { value: '#F59E0B', label: 'Amarelo' }, { value: '#10B981', label: 'Verde' },
  { value: '#EF4444', label: 'Vermelho' }, { value: '#6B7280', label: 'Cinza' },
]

// ── Section card wrapper ───────────────────────────────────────
function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-6', className)}>
      {children}
    </div>
  )
}


function SectionHeader({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description?: string }) {
  return (
    <div className="flex items-start gap-3 mb-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="font-semibold text-sm">{title}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
  )
}

// ── Usage meter ────────────────────────────────────────────────
function UsageMeter({ label, current, limit }: { label: string; current: number; limit: number | null }) {
  const pct = limit == null ? 0 : limit === 0 ? 100 : Math.min(100, Math.round((current / limit) * 100))
  const isUnlimited = limit == null
  const isWarning = !isUnlimited && pct >= 80
  const isDanger = !isUnlimited && pct >= 100

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={cn('tabular-nums', isDanger ? 'text-destructive font-semibold' : 'text-muted-foreground')}>
          {isUnlimited ? `${current} / ilimitado` : `${current} / ${limit}`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        {!isUnlimited && (
          <div
            className={cn('h-full rounded-full transition-all', isDanger ? 'bg-destructive' : isWarning ? 'bg-warning' : 'bg-primary')}
            style={{ width: `${pct}%` }}
          />
        )}
        {isUnlimited && <div className="h-full rounded-full bg-primary/30 w-full" />}
      </div>
    </div>
  )
}

// ── User avatar ────────────────────────────────────────────────
function UserAvatar({ name, avatarUrl, size = 'md' }: { name: string; avatarUrl?: string | null; size?: 'sm' | 'md' }) {
  const initials = name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  const cls = size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm'
  return avatarUrl ? (
    <img src={avatarUrl} alt={name} className={cn(cls, 'rounded-full object-cover shrink-0')} />
  ) : (
    <div className={cn(cls, 'rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0')}>
      {initials}
    </div>
  )
}

// ── Subscription section ───────────────────────────────────────
function SubscriptionSection() {
  const [info, setInfo] = React.useState<SubscriptionInfo | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    getSubscriptionInfo()
      .then(setInfo)
      .catch(() => toast.error('Erro ao carregar assinatura'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 rounded-xl border border-border bg-card animate-pulse" />
        ))}
      </div>
    )
  }

  if (!info) {
    return (
      <SectionCard>
        <div className="flex flex-col items-center justify-center min-h-[200px] text-center gap-3">
          <AlertCircle className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-muted-foreground">Nenhuma assinatura ativa encontrada.</p>
        </div>
      </SectionCard>
    )
  }

  const planCfg = PLAN_CONFIG[info.planSlug ?? ''] ?? { icon: Star, color: 'text-muted-foreground' }
  const PlanIcon = planCfg.icon

  const isTrial = info.status === 'trialing'
  const isPastDue = info.status === 'past_due'

  const statusLabel: Record<string, string> = {
    trialing: 'Período de teste',
    active: 'Ativo',
    past_due: 'Pagamento atrasado',
    canceled: 'Cancelado',
    paused: 'Pausado',
  }

  const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
    trialing: 'neutral',
    active: 'success',
    past_due: 'warning',
    canceled: 'danger',
    paused: 'neutral',
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Trial banner */}
      {isTrial && info.trialDaysLeft != null && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-5 py-4">
          <Clock className="h-5 w-5 text-amber-500 shrink-0" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-300 text-sm">
              Seu período de teste termina em {info.trialDaysLeft} {info.trialDaysLeft === 1 ? 'dia' : 'dias'}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Faça upgrade para manter o acesso a todas as funcionalidades.
            </p>
          </div>
          <Button size="sm" className="ml-auto shrink-0">Fazer upgrade</Button>
        </div>
      )}

      {/* Past-due banner */}
      {isPastDue && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div>
            <p className="font-medium text-destructive text-sm">Pagamento atrasado</p>
            <p className="text-xs text-muted-foreground mt-0.5">Regularize seu pagamento para evitar a suspensão da conta.</p>
          </div>
          <Button size="sm" variant="destructive" className="ml-auto shrink-0">Regularizar</Button>
        </div>
      )}

      {/* Plan card */}
      <SectionCard>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted shrink-0">
            <PlanIcon className={cn('h-6 w-6', planCfg.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold">{info.planName}</p>
              <Badge variant={statusVariant[info.status] ?? 'neutral'}>{statusLabel[info.status] ?? info.status}</Badge>
            </div>
            {info.periodEnd && (
              <p className="text-xs text-muted-foreground mt-1">
                {info.status === 'trialing' ? 'Teste termina em' : 'Renova em'}{' '}
                {new Date(info.periodEnd).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" className="shrink-0">Gerenciar plano</Button>
        </div>
      </SectionCard>

      {/* Usage meters */}
      {info.usage.length > 0 && (
        <SectionCard>
          <p className="font-semibold mb-1">Uso do plano</p>
          <p className="text-sm text-muted-foreground mb-5">Acompanhe o consumo dos recursos incluídos no seu plano</p>
          <div className="flex flex-col gap-5">
            {info.usage.map(u => (
              <UsageMeter key={u.label} label={u.label} current={u.current} limit={u.limit} />
            ))}
          </div>
        </SectionCard>
      )}

      {/* Feature flags */}
      {Object.keys(info.features).length > 0 && (
        <SectionCard>
          <p className="font-semibold mb-1">Funcionalidades</p>
          <p className="text-sm text-muted-foreground mb-5">Recursos disponíveis no seu plano atual</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(info.features).map(([key, enabled]) => {
              const labels: Record<string, string> = {
                'pdv.advanced.enabled':        'PDV Avançado',
                'channels.advanced.enabled':   'Canais Avançados',
                'automations.advanced.enabled':'Automações Avançadas',
                'purchasing.advanced.enabled': 'Módulo de Compras',
                'whatsapp.operational.enabled':'WhatsApp Operacional',
                'ai.advanced.enabled':         'Kyra IA',
                'multi_stock.enabled':         'Multi-estoque',
                'bi.advanced.enabled':         'Business Intelligence',
                'reports.advanced.enabled':    'Relatórios Avançados',
                'financial.enabled':           'Módulo Financeiro',
              }
              return (
                <div key={key} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  {enabled
                    ? <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                    : <XCircle className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
                  <span className={cn('text-sm', !enabled && 'text-muted-foreground')}>{labels[key] ?? key}</span>
                  {!enabled && <Badge variant="neutral" className="ml-auto text-[10px]">Upgrade</Badge>}
                </div>
              )
            })}
          </div>
        </SectionCard>
      )}
    </div>
  )
}

// ── Invite dialog ──────────────────────────────────────────────
function InviteDialog({ open, onOpenChange, onInvited }: { open: boolean; onOpenChange: (v: boolean) => void; onInvited: () => void }) {
  const [email, setEmail] = React.useState('')
  const [role, setRole] = React.useState('member')
  const [saving, setSaving] = React.useState(false)
  const [inviteLink, setInviteLink] = React.useState<string | null>(null)

  React.useEffect(() => { if (open) { setEmail(''); setRole('member'); setInviteLink(null) } }, [open])

  async function handleInvite() {
    if (!email.trim() || !email.includes('@')) { toast.error('E-mail inválido'); return }
    setSaving(true)
    const r = await inviteMember(email.trim(), role)
    setSaving(false)
    if (!r.success) { toast.error(r.error ?? 'Erro ao convidar'); return }
    onInvited()
    if (r.inviteLink) {
      // SMTP not available — show the link to copy manually
      setInviteLink(r.inviteLink)
    } else {
      toast.success('Convite enviado para ' + email)
      onOpenChange(false)
    }
  }

  function copyLink() {
    if (!inviteLink) return
    navigator.clipboard.writeText(inviteLink)
    toast.success('Link copiado!')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{inviteLink ? 'Link de acesso gerado' : 'Convidar membro'}</DialogTitle>
        </DialogHeader>

        {inviteLink ? (
          <div className="flex flex-col gap-4 py-2">
            <p className="text-sm text-muted-foreground">
              O e-mail não pôde ser enviado automaticamente. Copie o link abaixo e envie manualmente para <strong>{email}</strong>.
            </p>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border">
              <p className="text-xs font-mono text-muted-foreground flex-1 truncate">{inviteLink}</p>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copyLink}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">O link expira em 24 horas.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-2">
            <FormField id="invite-email" label="E-mail *">
              <Input type="email" placeholder="nome@empresa.com" value={email} onChange={e => setEmail(e.target.value)} />
            </FormField>
            <FormField id="invite-role" label="Cargo">
              <div className="relative">
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="w-full appearance-none text-sm border border-border rounded-lg px-3 py-2 pr-8 bg-card focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {MEMBER_ROLES.filter(r => r.value !== 'owner').map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </FormField>
          </div>
        )}

        <DialogFooter>
          {inviteLink ? (
            <>
              <Button onClick={copyLink}><Copy className="mr-1.5 h-3.5 w-3.5" />Copiar link</Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={handleInvite} disabled={saving}>{saving ? 'Enviando...' : 'Enviar convite'}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Users section ──────────────────────────────────────────────
const MEMBER_ROLES = [
  { value: 'owner',   label: 'Proprietário' },
  { value: 'admin',   label: 'Administrador' },
  { value: 'manager', label: 'Gerente' },
  { value: 'member',  label: 'Membro' },
  { value: 'viewer',  label: 'Visualizador' },
] as const

function UsersSection() {
  const [members, setMembers] = React.useState<TeamMember[]>([])
  const [loading, setLoading] = React.useState(true)
  const [inviteOpen, setInviteOpen] = React.useState(false)
  const [removeTarget, setRemoveTarget] = React.useState<TeamMember | null>(null)
  const [removing, setRemoving] = React.useState(false)
  const [updatingRole, setUpdatingRole] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try { setMembers(await getTeamMembers()) }
    catch { toast.error('Erro ao carregar membros') }
    finally { setLoading(false) }
  }, [])

  React.useEffect(() => { load() }, [load])

  async function handleRoleChange(userId: string, role: string) {
    setUpdatingRole(userId)
    const r = await updateMemberRole(userId, role as TeamMember['role'])
    setUpdatingRole(null)
    if (!r.success) { toast.error(r.error ?? 'Erro ao atualizar cargo'); return }
    toast.success('Cargo atualizado')
    load()
  }

  async function handleRemove() {
    if (!removeTarget) return
    setRemoving(true)
    const r = await removeMember(removeTarget.id)
    setRemoving(false)
    if (!r.success) { toast.error(r.error ?? 'Erro ao remover membro'); return }
    toast.success('Membro removido')
    setRemoveTarget(null)
    load()
  }

  const cols: Column<TeamMember>[] = [
    {
      key: 'name', header: 'Membro',
      cell: (m) => (
        <div className="flex items-center gap-3">
          <UserAvatar name={m.fullName} avatarUrl={m.avatarUrl} />
          <div>
            <p className="font-medium text-sm">{m.fullName}</p>
            <p className="text-xs text-muted-foreground">{m.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role', header: 'Cargo',
      cell: (m) => (
        <div className="relative">
          <select
            disabled={m.role === 'owner' || updatingRole === m.id}
            value={m.role}
            onChange={e => handleRoleChange(m.id, e.target.value)}
            className="appearance-none text-sm border border-border rounded-lg px-3 py-1.5 pr-8 bg-card disabled:opacity-60 disabled:cursor-default cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {MEMBER_ROLES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        </div>
      ),
    },
    {
      key: 'status', header: 'Status',
      cell: (m) => <Badge variant={m.isActive ? 'success' : 'neutral'}>{m.isActive ? 'Ativo' : 'Inativo'}</Badge>,
    },
    {
      key: 'joined', header: 'Desde',
      cell: (m) => (
        <span className="text-sm text-muted-foreground">
          {new Date(m.joinedAt).toLocaleDateString('pt-BR')}
        </span>
      ),
    },
    {
      key: 'actions', header: '',
      cell: (m) => m.role === 'owner' ? null : (
        <div className="flex justify-end">
          <Button
            variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={e => { e.stopPropagation(); setRemoveTarget(m) }}
          >
            <UserMinus className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <SectionCard>
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="font-semibold">Equipe</p>
            <p className="text-sm text-muted-foreground">Gerencie quem tem acesso ao sistema e seus cargos</p>
          </div>
          <Button size="sm" onClick={() => setInviteOpen(true)}><UserPlus className="mr-1.5 h-3.5 w-3.5" />Convidar membro</Button>
        </div>
        <DataTable
          columns={cols}
          data={members}
          loading={loading}
          keyExtractor={m => m.id}
          emptyTitle="Nenhum membro"
          emptyDescription="Convide membros para sua equipe"
        />
      </SectionCard>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} onInvited={load} />

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={open => !open && setRemoveTarget(null)}
        title="Remover membro"
        description={`Remover ${removeTarget?.fullName} da equipe? O usuário perderá acesso ao sistema.`}
        confirmLabel="Remover"
        onConfirm={handleRemove}
        loading={removing}
        variant="danger"
      />
    </div>
  )
}

// ── Permission checkboxes ──────────────────────────────────────
function PermissionCheckboxes({
  permissions,
  onChange,
}: {
  permissions: string[]
  onChange: (perms: string[]) => void
}) {
  function toggle(key: string) {
    onChange(
      permissions.includes(key)
        ? permissions.filter(p => p !== key)
        : [...permissions, key]
    )
  }

  function toggleGroup(groupPerms: string[]) {
    const allChecked = groupPerms.every(p => permissions.includes(p))
    if (allChecked) {
      onChange(permissions.filter(p => !groupPerms.includes(p)))
    } else {
      const merged = [...permissions]
      groupPerms.forEach(p => { if (!merged.includes(p)) merged.push(p) })
      onChange(merged)
    }
  }

  return (
    <div className="flex flex-col gap-4 max-h-[420px] overflow-y-auto pr-1">
      {PERMISSION_GROUPS.map(group => {
        const groupKeys = group.permissions.map(p => p.key)
        const allChecked = groupKeys.every(k => permissions.includes(k))
        const someChecked = groupKeys.some(k => permissions.includes(k))
        return (
          <div key={group.group}>
            <div
              className="flex items-center gap-2 mb-2 cursor-pointer"
              onClick={() => toggleGroup(groupKeys)}
            >
              <div className={cn(
                'h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                allChecked ? 'bg-primary border-primary' : someChecked ? 'bg-primary/30 border-primary' : 'border-border'
              )}>
                {allChecked && <CheckCircle2 className="h-3 w-3 text-white" />}
                {someChecked && !allChecked && <div className="h-2 w-2 rounded-sm bg-primary" />}
              </div>
              <p className="text-sm font-semibold">{group.group}</p>
            </div>
            <div className="ml-6 flex flex-wrap gap-2">
              {group.permissions.map(perm => (
                <button
                  key={perm.key}
                  type="button"
                  onClick={() => toggle(perm.key)}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-full border transition-colors',
                    permissions.includes(perm.key)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  )}
                >
                  {perm.label}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Role dialog ────────────────────────────────────────────────
function RoleDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: CompanyRole | null
  onSaved: () => void
}) {
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [permissions, setPermissions] = React.useState<string[]>([])
  const [isDefault, setIsDefault] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setName(editing?.name ?? '')
      setDescription(editing?.description ?? '')
      setPermissions(editing?.permissions ?? [])
      setIsDefault(editing?.isDefault ?? false)
    }
  }, [open, editing])

  async function handleSave() {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return }
    setSaving(true)
    try {
      const r = editing
        ? await updateRole(editing.id, { name, description: description || undefined, permissions, isDefault })
        : await createRole({ name, description: description || undefined, permissions })
      if (!r.success) { toast.error(r.error ?? 'Erro ao salvar'); return }
      toast.success(editing ? 'Perfil atualizado' : 'Perfil criado')
      onOpenChange(false)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{editing ? 'Editar perfil' : 'Novo perfil'}</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <div className="flex flex-col gap-4">
            <FormField id="role-name" label="Nome *">
              <Input placeholder="Ex: Vendedor, Caixa, Auditor" value={name} onChange={e => setName(e.target.value)} />
            </FormField>
            <FormField id="role-description" label="Descrição">
              <Input placeholder="Descrição opcional" value={description} onChange={e => setDescription(e.target.value)} />
            </FormField>
            {editing && (
              <div className="flex items-center gap-3">
                <Switch checked={isDefault} onCheckedChange={setIsDefault} />
                <div>
                  <p className="text-sm font-medium">Perfil padrão</p>
                  <p className="text-xs text-muted-foreground">Aplicado automaticamente a novos membros</p>
                </div>
              </div>
            )}
            <div>
              <p className="text-sm font-medium mb-3">Permissões</p>
              <PermissionCheckboxes permissions={permissions} onChange={setPermissions} />
            </div>
          </div>
        </SheetBody>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ── Profiles section ───────────────────────────────────────────
function ProfilesSection() {
  const [roles, setRoles] = React.useState<CompanyRole[]>([])
  const [loading, setLoading] = React.useState(true)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<CompanyRole | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<CompanyRole | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try { setRoles(await getRoles()) }
    catch { toast.error('Erro ao carregar perfis') }
    finally { setLoading(false) }
  }, [])

  React.useEffect(() => { load() }, [load])

  function openNew() { setEditing(null); setDialogOpen(true) }
  function openEdit(r: CompanyRole) { setEditing(r); setDialogOpen(true) }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const r = await deleteRole(deleteTarget.id)
    setDeleting(false)
    if (!r.success) { toast.error(r.error ?? 'Erro ao excluir'); return }
    toast.success('Perfil removido')
    setDeleteTarget(null)
    load()
  }

  const cols: Column<CompanyRole>[] = [
    {
      key: 'name', header: 'Perfil',
      cell: (r) => (
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
          <div>
            <p className="font-medium text-sm">{r.name}</p>
            {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
          </div>
          {r.isSystem && <Badge variant="neutral" className="text-[10px] ml-1">Sistema</Badge>}
          {r.isDefault && <Badge variant="info" className="text-[10px] ml-1">Padrão</Badge>}
        </div>
      ),
    },
    {
      key: 'permissions', header: 'Permissões',
      cell: (r) => (
        <span className="text-sm text-muted-foreground tabular-nums">
          {r.permissions.length} {r.permissions.length === 1 ? 'permissão' : 'permissões'}
        </span>
      ),
    },
    {
      key: 'actions', header: '',
      cell: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); openEdit(r) }}>
            <Pencil className="h-4 w-4" />
          </Button>
          {!r.isSystem && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={e => { e.stopPropagation(); setDeleteTarget(r) }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <SectionCard>
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="font-semibold">Perfis de acesso</p>
            <p className="text-sm text-muted-foreground">Defina permissões por função na equipe</p>
          </div>
          <Button size="sm" onClick={openNew}><Plus className="mr-1.5 h-3.5 w-3.5" />Novo perfil</Button>
        </div>
        <DataTable
          columns={cols}
          data={roles}
          loading={loading}
          keyExtractor={r => r.id}
          emptyTitle="Nenhum perfil"
          emptyDescription="Crie perfis para controlar o acesso da equipe"
          emptyAction={{ label: 'Novo perfil', onClick: openNew }}
        />
      </SectionCard>

      <RoleDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} onSaved={load} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title="Remover perfil"
        description={`Remover o perfil "${deleteTarget?.name}"? Membros com este perfil perderão as permissões associadas.`}
        confirmLabel="Remover"
        onConfirm={handleDelete}
        loading={deleting}
        variant="danger"
      />
    </div>
  )
}

// ── Section: Categories CRUD ───────────────────────────────────
function CategoriesSection() {
  const [items, setItems] = React.useState<CategoryRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [formOpen, setFormOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [editing, setEditing] = React.useState<CategoryRow | null>(null)
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [color, setColor] = React.useState(CATEGORY_COLORS[0]!.value)
  const [ncm, setNcm] = React.useState('')
  const [deleteTarget, setDeleteTarget] = React.useState<CategoryRow | null>(null)
  const [deleteLoading, setDeleteLoading] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try { const r = await getCategoriesAdmin({ status: 'all' }); setItems(r.data) }
    catch { toast.error('Erro ao carregar categorias') }
    finally { setLoading(false) }
  }, [])

  React.useEffect(() => { load() }, [load])

  function openNew() { setEditing(null); setName(''); setDescription(''); setColor(CATEGORY_COLORS[0]!.value); setNcm(''); setFormOpen(true) }
  function openEdit(c: CategoryRow) { setEditing(c); setName(c.name); setDescription(c.description ?? ''); setColor(c.color ?? CATEGORY_COLORS[0]!.value); setNcm((c as any).ncm ?? ''); setFormOpen(true) }

  async function handleSave() {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return }
    setSaving(true)
    try {
      const r = editing
        ? await updateCategory(editing.id, { name, description: description || undefined, color, ncm: ncm.replace(/\D/g, '') || undefined })
        : await createCategory({ name, description: description || undefined, color, ncm: ncm.replace(/\D/g, '') || undefined })
      if (!r.success) { toast.error(r.error ?? 'Erro ao salvar'); return }
      toast.success(editing ? 'Categoria atualizada' : 'Categoria criada')
      setFormOpen(false); load()
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    const r = await deleteCategory(deleteTarget.id)
    setDeleteLoading(false)
    if (!r.success) { toast.error(r.error ?? 'Erro ao excluir'); return }
    toast.success('Categoria removida'); setDeleteTarget(null); load()
  }

  const cols: Column<CategoryRow>[] = [
    {
      key: 'name', header: 'Categoria', sortable: true,
      cell: (c) => (
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: c.color ?? '#6B7280' }} />
          <span className="font-medium text-sm">{c.name}</span>
        </div>
      )
    },
    { key: 'description', header: 'Descrição', cell: (c) => <span className="text-sm text-muted-foreground">{c.description ?? '—'}</span> },
    { key: 'ncm' as any, header: 'NCM', cell: (c) => <span className="text-sm font-mono text-muted-foreground">{(c as any).ncm ?? '—'}</span> },
    { key: 'status', header: 'Status', cell: (c) => <Badge variant={c.is_active ? 'success' : 'neutral'}>{c.is_active ? 'Ativa' : 'Inativa'}</Badge> },
    {
      key: 'actions', header: '',
      cell: (c) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); openEdit(c) }}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={e => { e.stopPropagation(); setDeleteTarget(c) }}><Trash2 className="h-4 w-4" /></Button>
        </div>
      )
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-semibold">Categorias</p>
          <p className="text-sm text-muted-foreground">Organize seus produtos por categoria</p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="mr-1.5 h-3.5 w-3.5" />Nova categoria</Button>
      </div>
      <DataTable columns={cols} data={items} loading={loading} keyExtractor={c => c.id}
        emptyTitle="Nenhuma categoria" emptyDescription="Crie categorias para organizar seus produtos"
        emptyAction={{ label: "Nova categoria", onClick: openNew }} />
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editing ? 'Editar categoria' : 'Nova categoria'}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <FormField id="category-name" label="Nome *"><Input placeholder="Nome da categoria" value={name} onChange={e => setName(e.target.value)} /></FormField>
            <FormField id="category-description" label="Descrição"><Input placeholder="Descrição opcional" value={description} onChange={e => setDescription(e.target.value)} /></FormField>
            <FormField id="category-ncm" label="NCM" hint="8 dígitos — código tributário dos produtos desta categoria">
              <Input
                placeholder="Ex: 61091000"
                maxLength={8}
                value={ncm}
                onChange={e => setNcm(e.target.value.replace(/\D/g, '').slice(0, 8))}
              />
            </FormField>
            <FormField id="category-color" label="Cor">
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLORS.map(c => (
                  <button key={c.value} type="button" title={c.label}
                    className={cn('h-6 w-6 rounded-full border-2 transition-all', color === c.value ? 'border-foreground scale-110' : 'border-transparent')}
                    style={{ backgroundColor: c.value }} onClick={() => setColor(c.value)} />
                ))}
              </div>
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}
        title="Remover categoria" description={`Remover "${deleteTarget?.name}"?`}
        confirmLabel="Remover" onConfirm={handleDelete} loading={deleteLoading} variant="danger" />
    </div>
  )
}

// ── Section: Brands CRUD ───────────────────────────────────────
function BrandsSection() {
  const [items, setItems] = React.useState<BrandRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [formOpen, setFormOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [editing, setEditing] = React.useState<BrandRow | null>(null)
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [deleteTarget, setDeleteTarget] = React.useState<BrandRow | null>(null)
  const [deleteLoading, setDeleteLoading] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try { const r = await getBrands({ status: 'all' }); setItems(r.data) }
    catch { toast.error('Erro ao carregar marcas') }
    finally { setLoading(false) }
  }, [])

  React.useEffect(() => { load() }, [load])

  function openNew() { setEditing(null); setName(''); setDescription(''); setFormOpen(true) }
  function openEdit(b: BrandRow) { setEditing(b); setName(b.name); setDescription(b.description ?? ''); setFormOpen(true) }

  async function handleSave() {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return }
    setSaving(true)
    try {
      const r = editing
        ? await updateBrand(editing.id, { name, description: description || undefined })
        : await createBrand({ name, description: description || undefined })
      if (!r.success) { toast.error(r.error ?? 'Erro ao salvar'); return }
      toast.success(editing ? 'Marca atualizada' : 'Marca criada')
      setFormOpen(false); load()
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    const r = await deleteBrand(deleteTarget.id)
    setDeleteLoading(false)
    if (!r.success) { toast.error(r.error ?? 'Erro ao excluir'); return }
    toast.success('Marca removida'); setDeleteTarget(null); load()
  }

  const cols: Column<BrandRow>[] = [
    { key: 'name', header: 'Marca', sortable: true, cell: (b) => <span className="font-medium text-sm">{b.name}</span> },
    { key: 'description', header: 'Descrição', cell: (b) => <span className="text-sm text-muted-foreground">{b.description ?? '—'}</span> },
    { key: 'status', header: 'Status', cell: (b) => <Badge variant={b.is_active ? 'success' : 'neutral'}>{b.is_active ? 'Ativa' : 'Inativa'}</Badge> },
    {
      key: 'actions', header: '',
      cell: (b) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); openEdit(b) }}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={e => { e.stopPropagation(); setDeleteTarget(b) }}><Trash2 className="h-4 w-4" /></Button>
        </div>
      )
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-semibold">Marcas</p>
          <p className="text-sm text-muted-foreground">Cadastre as marcas dos seus produtos</p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="mr-1.5 h-3.5 w-3.5" />Nova marca</Button>
      </div>
      <DataTable columns={cols} data={items} loading={loading} keyExtractor={b => b.id}
        emptyTitle="Nenhuma marca" emptyDescription="Crie marcas para identificar seus produtos"
        emptyAction={{ label: "Nova marca", onClick: openNew }} />
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editing ? 'Editar marca' : 'Nova marca'}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <FormField id="brand-name" label="Nome *"><Input placeholder="Nome da marca" value={name} onChange={e => setName(e.target.value)} /></FormField>
            <FormField id="brand-description" label="Descrição"><Input placeholder="Descrição opcional" value={description} onChange={e => setDescription(e.target.value)} /></FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}
        title="Remover marca" description={`Remover "${deleteTarget?.name}"?`}
        confirmLabel="Remover" onConfirm={handleDelete} loading={deleteLoading} variant="danger" />
    </div>
  )
}

// ── Section: Coupons CRUD ──────────────────────────────────────
function CouponsSection() {
  const [items, setItems] = React.useState<CouponRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [formOpen, setFormOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [editing, setEditing] = React.useState<CouponRow | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<CouponRow | null>(null)
  const [deleteLoading, setDeleteLoading] = React.useState(false)

  const [code, setCode] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [discountType, setDiscountType] = React.useState<'percent' | 'fixed'>('percent')
  const [discountValue, setDiscountValue] = React.useState('')
  const [minOrderValue, setMinOrderValue] = React.useState('')
  const [maxUses, setMaxUses] = React.useState('')
  const [expiresAt, setExpiresAt] = React.useState('')
  const [isActive, setIsActive] = React.useState(true)

  const load = React.useCallback(async () => {
    setLoading(true)
    try { setItems(await getCoupons()) }
    catch { toast.error('Erro ao carregar cupons') }
    finally { setLoading(false) }
  }, [])

  React.useEffect(() => { load() }, [load])

  function openNew() {
    setEditing(null)
    setCode(''); setDescription(''); setDiscountType('percent')
    setDiscountValue(''); setMinOrderValue(''); setMaxUses('')
    setExpiresAt(''); setIsActive(true)
    setFormOpen(true)
  }

  function openEdit(c: CouponRow) {
    setEditing(c)
    setCode(c.code)
    setDescription(c.description ?? '')
    setDiscountType(c.discount_type)
    setDiscountValue(String(c.discount_value))
    setMinOrderValue(c.min_order_value > 0 ? String(c.min_order_value) : '')
    setMaxUses(c.max_uses != null ? String(c.max_uses) : '')
    setExpiresAt(c.expires_at ? c.expires_at.slice(0, 10) : '')
    setIsActive(c.is_active)
    setFormOpen(true)
  }

  async function handleSave() {
    if (!code.trim()) { toast.error('Código é obrigatório'); return }
    const dv = parseFloat(discountValue.replace(',', '.'))
    if (!dv || dv <= 0) { toast.error('Valor do desconto inválido'); return }
    if (discountType === 'percent' && dv > 100) { toast.error('Percentual máximo é 100%'); return }

    const input: CouponInput = {
      code,
      description: description || undefined,
      discount_type: discountType,
      discount_value: dv,
      min_order_value: minOrderValue ? parseFloat(minOrderValue.replace(',', '.')) : 0,
      max_uses: maxUses ? parseInt(maxUses) : null,
      expires_at: expiresAt ? new Date(expiresAt + 'T23:59:59').toISOString() : null,
      is_active: isActive,
    }

    setSaving(true)
    try {
      const r = editing ? await updateCoupon(editing.id, input) : await createCoupon(input)
      if (!r.success) { toast.error(r.error ?? 'Erro ao salvar'); return }
      toast.success(editing ? 'Cupom atualizado' : 'Cupom criado')
      setFormOpen(false); load()
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    const r = await deleteCoupon(deleteTarget.id)
    setDeleteLoading(false)
    if (!r.success) { toast.error(r.error ?? 'Erro ao excluir'); return }
    toast.success('Cupom removido'); setDeleteTarget(null); load()
  }

  function fmtDiscount(c: CouponRow) {
    return c.discount_type === 'percent'
      ? `${c.discount_value}%`
      : `R$ ${Number(c.discount_value).toFixed(2).replace('.', ',')}`
  }

  function fmtExpiry(c: CouponRow) {
    if (!c.expires_at) return '—'
    return new Date(c.expires_at).toLocaleDateString('pt-BR')
  }

  const cols: Column<CouponRow>[] = [
    {
      key: 'code', header: 'Código',
      cell: (c) => (
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold text-sm tracking-widest">{c.code}</span>
          {!c.is_active && <Badge variant="neutral" className="text-[10px]">Inativo</Badge>}
        </div>
      ),
    },
    {
      key: 'discount', header: 'Desconto',
      cell: (c) => (
        <div className="flex items-center gap-1.5">
          <BadgePercent className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-sm font-semibold text-primary">{fmtDiscount(c)}</span>
        </div>
      ),
    },
    {
      key: 'uses', header: 'Usos',
      cell: (c) => (
        <span className="text-sm text-muted-foreground tabular-nums">
          {c.uses_count}{c.max_uses != null ? ` / ${c.max_uses}` : ''}
        </span>
      ),
    },
    {
      key: 'expires', header: 'Validade',
      cell: (c) => {
        const expired = c.expires_at && new Date(c.expires_at) < new Date()
        return <span className={cn('text-sm', expired ? 'text-danger' : 'text-muted-foreground')}>{fmtExpiry(c)}</span>
      },
    },
    {
      key: 'status', header: 'Status',
      cell: (c) => {
        const expired = c.expires_at && new Date(c.expires_at) < new Date()
        const exhausted = c.max_uses != null && c.uses_count >= c.max_uses
        const status = !c.is_active ? 'neutral' : expired || exhausted ? 'warning' : 'success'
        const label = !c.is_active ? 'Inativo' : expired ? 'Expirado' : exhausted ? 'Esgotado' : 'Ativo'
        return <Badge variant={status}>{label}</Badge>
      },
    },
    {
      key: 'actions', header: '',
      cell: (c) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); openEdit(c) }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={e => { e.stopPropagation(); setDeleteTarget(c) }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-semibold">Cupons de desconto</p>
          <p className="text-sm text-muted-foreground">Crie cupons para o PDV — percentual ou valor fixo</p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="mr-1.5 h-3.5 w-3.5" />Novo cupom</Button>
      </div>

      <DataTable columns={cols} data={items} loading={loading} keyExtractor={c => c.id}
        emptyTitle="Nenhum cupom" emptyDescription="Crie cupons de desconto para usar no PDV"
        emptyAction={{ label: 'Novo cupom', onClick: openNew }} />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar cupom' : 'Novo cupom'}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <FormField id="coupon-code" label="Código *">
              <Input
                placeholder="EX: DESCONTO10"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                className="font-mono tracking-widest uppercase"
              />
            </FormField>

            <div className="flex gap-3">
              <FormField id="coupon-discount-type" label="Tipo de desconto" className="flex-1">
                <div className="flex rounded-lg border border-border overflow-hidden">
                  {(['percent', 'fixed'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setDiscountType(t)}
                      className={cn(
                        'flex-1 py-2 text-xs font-medium transition-colors',
                        discountType === t ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
                      )}
                    >
                      {t === 'percent' ? '% Percentual' : 'R$ Fixo'}
                    </button>
                  ))}
                </div>
              </FormField>
              <FormField id="coupon-discount-value" label={discountType === 'percent' ? 'Valor (%)' : 'Valor (R$)'} className="w-28">
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder={discountType === 'percent' ? '10' : '20,00'}
                  value={discountValue}
                  onChange={e => setDiscountValue(e.target.value.replace(/[^0-9,\.]/g, ''))}
                />
              </FormField>
            </div>

            <FormField id="coupon-description" label="Descrição">
              <Input placeholder="Ex: Desconto de 10% para novos clientes" value={description} onChange={e => setDescription(e.target.value)} />
            </FormField>

            <div className="flex gap-3">
              <FormField id="coupon-min-order" label="Pedido mínimo (R$)" className="flex-1">
                <Input
                  type="text" inputMode="decimal" placeholder="0,00 (sem mínimo)"
                  value={minOrderValue} onChange={e => setMinOrderValue(e.target.value.replace(/[^0-9,\.]/g, ''))}
                />
              </FormField>
              <FormField id="coupon-max-uses" label="Usos máximos" className="w-28">
                <Input
                  type="text" inputMode="numeric" placeholder="Ilimitado"
                  value={maxUses} onChange={e => setMaxUses(e.target.value.replace(/\D/g, ''))}
                />
              </FormField>
            </div>

            <div className="flex gap-3 items-end">
              <FormField id="coupon-expires-at" label="Validade" className="flex-1">
                <Input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
              </FormField>
              <div className="flex items-center gap-2 pb-2">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <span className="text-sm">{isActive ? 'Ativo' : 'Inativo'}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}
        title="Remover cupom" description={`Remover o cupom "${deleteTarget?.code}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Remover" onConfirm={handleDelete} loading={deleteLoading} variant="danger"
      />
    </div>
  )
}

// ── Section: Operation ─────────────────────────────────────────
function OperationSection() {
  const [allowNegativeStock, setAllowNegativeStock] = React.useState(false)
  const [trackByMovement, setTrackByMovement] = React.useState(true)
  const [allowDiscount, setAllowDiscount] = React.useState(true)
  const [requireCustomer, setRequireCustomer] = React.useState(false)
  const [loadingSettings, setLoadingSettings] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [dirty, setDirty] = React.useState(false)

  React.useEffect(() => {
    getCompanySettings().then(s => {
      if (s) {
        setAllowNegativeStock(s.allow_negative_stock)
        setTrackByMovement(s.track_by_movement)
        setAllowDiscount(s.allow_discount)
        setRequireCustomer(s.require_customer)
      }
    }).finally(() => setLoadingSettings(false))
  }, [])

  function toggle<T>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) {
    setter(value)
    setDirty(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await updateOperationSettings({
        allow_negative_stock: allowNegativeStock,
        track_by_movement: trackByMovement,
        allow_discount: allowDiscount,
        require_customer: requireCustomer,
      })
      if (!res.success) { toast.error(res.error ?? 'Erro ao salvar'); return }
      toast.success('Configurações salvas')
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionCard>
        <p className="font-semibold mb-1">Estoque</p>
        <p className="text-sm text-muted-foreground mb-4">Configure o comportamento do controle de estoque</p>
        <div className="flex flex-col gap-0 divide-y divide-border border rounded-lg">
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium">Permitir estoque negativo</p>
              <p className="text-xs text-muted-foreground mt-0.5">Permite vender mesmo sem estoque disponível</p>
            </div>
            {loadingSettings
              ? <div className="h-5 w-10 rounded-full bg-muted animate-pulse" />
              : <Switch checked={allowNegativeStock} onCheckedChange={v => toggle(setAllowNegativeStock, v)} />}
          </div>
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium">Controlar por movimentação</p>
              <p className="text-xs text-muted-foreground mt-0.5">Toda entrada/saída gera um registro de movimentação</p>
            </div>
            {loadingSettings
              ? <div className="h-5 w-10 rounded-full bg-muted animate-pulse" />
              : <Switch checked={trackByMovement} onCheckedChange={v => toggle(setTrackByMovement, v)} />}
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <p className="font-semibold mb-1">Vendas</p>
        <p className="text-sm text-muted-foreground mb-4">Configure o comportamento do PDV e vendas</p>
        <div className="flex flex-col gap-0 divide-y divide-border border rounded-lg">
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium">Permitir desconto</p>
              <p className="text-xs text-muted-foreground mt-0.5">Habilita campo de desconto no PDV</p>
            </div>
            {loadingSettings
              ? <div className="h-5 w-10 rounded-full bg-muted animate-pulse" />
              : <Switch checked={allowDiscount} onCheckedChange={v => toggle(setAllowDiscount, v)} />}
          </div>
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium">Exigir cliente na venda</p>
              <p className="text-xs text-muted-foreground mt-0.5">Impede finalizar venda sem vincular cliente</p>
            </div>
            {loadingSettings
              ? <div className="h-5 w-10 rounded-full bg-muted animate-pulse" />
              : <Switch checked={requireCustomer} onCheckedChange={v => toggle(setRequireCustomer, v)} />}
          </div>
        </div>
        {dirty && (
          <div className="flex justify-end mt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar configurações'}
            </Button>
          </div>
        )}
      </SectionCard>

      <SectionCard><CategoriesSection /></SectionCard>
      <SectionCard><BrandsSection /></SectionCard>
      <SectionCard><CouponsSection /></SectionCard>
    </div>
  )
}

// ── Section: Company ───────────────────────────────────────────
function CompanySection() {
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  const [razaoSocial, setRazaoSocial] = React.useState('')
  const [fantasia, setFantasia] = React.useState('')
  const [cnpj, setCnpj] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [website, setWebsite] = React.useState('')
  const [cep, setCep] = React.useState('')
  const [addr, setAddr] = React.useState({ street: '', neighborhood: '', city: '', state: '', number: '', complement: '' })
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null)
  const [logoFile, setLogoFile] = React.useState<File | null>(null)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  // fiscal
  const [ie, setIe] = React.useState('')
  const [im, setIm] = React.useState('')
  const [regimeTributario, setRegimeTributario] = React.useState<string>('')
  const [cnae, setCnae] = React.useState('')
  const [cfop, setCfop] = React.useState('')
  const [fiscalAddr, setFiscalAddr] = React.useState({ street: '', number: '', complement: '', neighborhood: '', city: '', state: '', cep: '' })

  React.useEffect(() => {
    Promise.all([getCompanySettings(), getFiscalConfig()]).then(([s, f]) => {
      if (s) {
        setRazaoSocial(s.name ?? '')
        setFantasia(s.fantasy_name ?? '')
        setCnpj(s.document ? formatCnpj(s.document) : '')
        setPhone(s.phone ? formatPhone(s.phone) : '')
        setEmail(s.email ?? '')
        setWebsite(s.website ?? '')
        setCep(s.address_cep ?? '')
        setAddr({
          street: s.address_street ?? '',
          neighborhood: s.address_neighborhood ?? '',
          city: s.address_city ?? '',
          state: s.address_state ?? '',
          number: s.address_number ?? '',
          complement: s.address_complement ?? '',
        })
        setLogoUrl(s.logo_url ?? null)
      }
      setIe(f.ie ?? '')
      setIm(f.im ?? '')
      setRegimeTributario(f.regime_tributario ? String(f.regime_tributario) : '')
      setCnae(f.cnae ?? '')
      setCfop(f.cfop ?? '')
      setFiscalAddr({
        street: f.logradouro ?? '',
        number: f.numero ?? '',
        complement: f.complemento ?? '',
        neighborhood: f.bairro ?? '',
        city: f.municipio ?? '',
        state: f.uf ?? '',
        cep: f.cep ?? '',
      })
    }).finally(() => setLoading(false))
  }, [])

  function setError(field: string, msg: string) {
    setErrors(e => msg ? { ...e, [field]: msg } : Object.fromEntries(Object.entries(e).filter(([k]) => k !== field)))
  }
  function validateCnpj(v: string) {
    const d = v.replace(/\D/g, '')
    if (d.length === 0) { setError('cnpj', ''); return }
    if (d.length < 14)  { setError('cnpj', 'CNPJ deve ter 14 dígitos'); return }
    setError('cnpj', isValidCnpj(v) ? '' : 'CNPJ inválido')
  }
  function validatePhone(v: string) {
    const d = v.replace(/\D/g, '')
    setError('phone', d.length > 0 && d.length < 10 ? 'Telefone incompleto' : '')
  }
  function validateEmail(v: string) {
    setError('email', v.length > 0 && !isValidEmail(v) ? 'E-mail inválido' : '')
  }
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoUrl(URL.createObjectURL(file))
  }

  async function handleSave() {
    if (!razaoSocial.trim()) { toast.error('Razão social é obrigatória'); return }
    if (errors.cnpj || errors.phone || errors.email) { toast.error('Corrija os erros antes de salvar'); return }
    setSaving(true)
    try {
      if (logoFile) {
        const fd = new FormData()
        fd.append('logo', logoFile)
        const logoRes = await uploadCompanyLogo(fd)
        if (!logoRes.success) {
          toast.error(logoRes.error ?? 'Erro ao salvar logo')
          return
        }
        setLogoFile(null)
      }

      const res = await updateCompanyProfile({
        name: razaoSocial.trim(),
        fantasy_name: fantasia.trim() || null,
        document: cnpj.replace(/\D/g, '') || null,
        email: email.trim() || null,
        phone: phone.replace(/\D/g, '') || null,
        website: website.trim() || null,
        address_cep: cep.replace(/\D/g, '') || null,
        address_street: addr.street || null,
        address_number: addr.number || null,
        address_complement: addr.complement || null,
        address_neighborhood: addr.neighborhood || null,
        address_city: addr.city || null,
        address_state: addr.state || null,
      })
      if (!res.success) { toast.error(res.error ?? 'Erro ao salvar'); return }

      // Salvar dados fiscais junto
      await updateFiscalConfig({
        ie: ie.trim() || undefined,
        im: im.trim() || undefined,
        regime_tributario: regimeTributario ? Number(regimeTributario) : undefined,
        cnae: cnae.trim() || undefined,
        cfop: cfop.replace(/\D/g, '') || undefined,
        logradouro: fiscalAddr.street || undefined,
        numero: fiscalAddr.number || undefined,
        complemento: fiscalAddr.complement || undefined,
        bairro: fiscalAddr.neighborhood || undefined,
        municipio: fiscalAddr.city || undefined,
        uf: fiscalAddr.state || undefined,
        cep: fiscalAddr.cep.replace(/\D/g, '') || undefined,
      })

      toast.success('Dados da empresa salvos')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Dados da empresa</p>
      <div className="flex items-center gap-4 mb-6">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="h-16 w-16 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden hover:opacity-80 transition-opacity ring-2 ring-border ring-offset-2 hover:ring-primary/40"
        >
          {logoUrl
            ? <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
            : <User className="h-7 w-7 text-muted-foreground/40" />}
        </button>
        <div>
          <p className="font-medium text-sm">Logo da empresa</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => fileInputRef.current?.click()}>
            Alterar foto
          </Button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mb-8">
        <FormField id="company-razao-social" label="Razão social *">
          <Input placeholder="Razão social" value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} disabled={loading} />
        </FormField>
        <FormField id="company-nome-fantasia" label="Nome fantasia">
          <Input placeholder="Nome fantasia" value={fantasia} onChange={e => setFantasia(e.target.value)} disabled={loading} />
        </FormField>
        <FormField id="company-cnpj" label="CNPJ" error={errors.cnpj}>
          <Input
            placeholder="00.000.000/0000-00" inputMode="numeric"
            value={cnpj} onChange={e => setCnpj(formatCnpj(e.target.value))}
            onBlur={() => validateCnpj(cnpj)} disabled={loading}
          />
        </FormField>
        <FormField id="company-phone" label="Telefone" error={errors.phone}>
          <Input
            placeholder="(00) 00000-0000" inputMode="numeric"
            value={phone} onChange={e => setPhone(formatPhone(e.target.value))}
            onBlur={() => validatePhone(phone)} disabled={loading}
          />
        </FormField>
        <FormField id="company-email" label="E-mail" error={errors.email}>
          <Input
            type="email" placeholder="contato@empresa.com"
            value={email} onChange={e => { setEmail(e.target.value); if (errors.email) validateEmail(e.target.value) }}
            onBlur={() => validateEmail(email)} disabled={loading}
          />
        </FormField>
        <FormField id="company-site" label="Site">
          <Input placeholder="https://empresa.com" value={website} onChange={e => setWebsite(e.target.value)} disabled={loading} />
        </FormField>
      </div>

      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Endereço</p>
      <div className="flex flex-col gap-4">
        <div className="flex items-end gap-3">
          <div className="w-[220px]">
            <FormField id="company-cep" label="CEP">
              <CepInput
                value={cep}
                onChange={setCep}
                onAddressFound={r => setAddr(a => ({ ...a, street: r.address, neighborhood: r.neighborhood, city: r.city, state: r.state }))}
                onNotFound={() => toast.error('CEP não encontrado')}
              />
            </FormField>
          </div>
        </div>
        <div className="grid grid-cols-[1fr_80px_1fr] gap-x-4 gap-y-4">
          <FormField id="company-rua" label="Rua">
            <Input placeholder="Rua" value={addr.street} onChange={e => setAddr(a => ({ ...a, street: e.target.value }))} />
          </FormField>
          <FormField id="company-numero" label="Nº">
            <Input placeholder="Nº" value={addr.number} onChange={e => setAddr(a => ({ ...a, number: e.target.value }))} />
          </FormField>
          <FormField id="company-complemento" label="Complemento">
            <Input placeholder="Complemento" value={addr.complement} onChange={e => setAddr(a => ({ ...a, complement: e.target.value }))} />
          </FormField>
        </div>
        <div className="grid grid-cols-[1fr_1fr_80px] gap-x-4 gap-y-4">
          <FormField id="company-bairro" label="Bairro">
            <Input placeholder="Bairro" value={addr.neighborhood} onChange={e => setAddr(a => ({ ...a, neighborhood: e.target.value }))} />
          </FormField>
          <FormField id="company-cidade" label="Cidade">
            <Input placeholder="Cidade" value={addr.city} onChange={e => setAddr(a => ({ ...a, city: e.target.value }))} />
          </FormField>
          <FormField id="company-uf" label="UF">
            <Input placeholder="UF" value={addr.state} maxLength={2} onChange={e => setAddr(a => ({ ...a, state: e.target.value.toUpperCase() }))} />
          </FormField>
        </div>
      </div>

      <div className="h-px bg-border my-6" />

      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Dados Fiscais</p>
      <p className="text-xs text-muted-foreground mb-5">Necessário para emitir NF-e. Configure a IE e o regime tributário da empresa.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 mb-4">
        <FormField id="company-ie" label="Inscrição Estadual (IE)">
          <Input placeholder="Ex: 123456789" value={ie} onChange={e => setIe(e.target.value)} disabled={loading} />
        </FormField>
        <FormField id="company-im" label="Inscrição Municipal (IM)">
          <Input placeholder="Opcional" value={im} onChange={e => setIm(e.target.value)} disabled={loading} />
        </FormField>
        <FormField id="company-regime-tributario" label="Regime Tributário" className="sm:col-span-2">
          <Select value={regimeTributario} onValueChange={setRegimeTributario}>
            <SelectTrigger disabled={loading}>
              <SelectValue placeholder="Selecione o regime tributário" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Simples Nacional</SelectItem>
              <SelectItem value="2">Simples Nacional – Excesso de sublimite</SelectItem>
              <SelectItem value="3">Regime Normal (Lucro Presumido / Real)</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField id="company-cnae" label="CNAE Principal">
          <Input placeholder="Ex: 4711-3/01" value={cnae} onChange={e => setCnae(e.target.value)} disabled={loading} />
        </FormField>
        <FormField id="company-cfop" label="CFOP Padrão" hint="4 dígitos — natureza da operação fiscal (5102 = venda interna, 6102 = venda interestadual)">
          <Input
            placeholder="Ex: 5102"
            maxLength={4}
            value={cfop}
            onChange={e => setCfop(e.target.value.replace(/\D/g, '').slice(0, 4))}
            disabled={loading}
          />
        </FormField>
      </div>

      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Endereço Fiscal</p>
      <p className="text-xs text-muted-foreground mb-4">Se diferente do endereço principal, preencha o endereço fiscal usado na emissão de NF-e.</p>
      <div className="flex flex-col gap-4">
        <div className="flex items-end gap-3">
          <div className="w-[220px]">
            <FormField id="fiscal-cep" label="CEP">
              <CepInput
                value={fiscalAddr.cep}
                onChange={v => setFiscalAddr(a => ({ ...a, cep: v }))}
                onAddressFound={r => setFiscalAddr(a => ({ ...a, street: r.address, neighborhood: r.neighborhood, city: r.city, state: r.state }))}
                onNotFound={() => toast.error('CEP não encontrado')}
              />
            </FormField>
          </div>
        </div>
        <div className="grid grid-cols-[1fr_80px_1fr] gap-x-4 gap-y-4">
          <FormField id="fiscal-rua" label="Rua">
            <Input placeholder="Rua" value={fiscalAddr.street} onChange={e => setFiscalAddr(a => ({ ...a, street: e.target.value }))} disabled={loading} />
          </FormField>
          <FormField id="fiscal-numero" label="Nº">
            <Input placeholder="Nº" value={fiscalAddr.number} onChange={e => setFiscalAddr(a => ({ ...a, number: e.target.value }))} disabled={loading} />
          </FormField>
          <FormField id="fiscal-complemento" label="Complemento">
            <Input placeholder="Complemento" value={fiscalAddr.complement} onChange={e => setFiscalAddr(a => ({ ...a, complement: e.target.value }))} disabled={loading} />
          </FormField>
        </div>
        <div className="grid grid-cols-[1fr_1fr_80px] gap-x-4 gap-y-4">
          <FormField id="fiscal-bairro" label="Bairro">
            <Input placeholder="Bairro" value={fiscalAddr.neighborhood} onChange={e => setFiscalAddr(a => ({ ...a, neighborhood: e.target.value }))} disabled={loading} />
          </FormField>
          <FormField id="fiscal-cidade" label="Cidade">
            <Input placeholder="Cidade" value={fiscalAddr.city} onChange={e => setFiscalAddr(a => ({ ...a, city: e.target.value }))} disabled={loading} />
          </FormField>
          <FormField id="fiscal-uf" label="UF">
            <Input placeholder="UF" value={fiscalAddr.state} maxLength={2} onChange={e => setFiscalAddr(a => ({ ...a, state: e.target.value.toUpperCase() }))} disabled={loading} />
          </FormField>
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <Button onClick={handleSave} disabled={saving || loading}>
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </Button>
      </div>
    </SectionCard>
  )
}



// ── Intelligence Section ───────────────────────────────────────
const AI_MODULES = [
  { key: 'products', label: 'Produtos' },
  { key: 'stock', label: 'Estoque' },
  { key: 'sales', label: 'Vendas' },
  { key: 'purchases', label: 'Compras' },
  { key: 'customers', label: 'Clientes' },
  { key: 'financial', label: 'Financeiro' },
]

const TONE_OPTIONS = [
  { value: 'friendly', label: 'Amigável', description: 'Casual e acolhedora' },
  { value: 'neutral', label: 'Neutro', description: 'Equilibrado e direto' },
  { value: 'formal', label: 'Formal', description: 'Profissional e precisa' },
] as const

function IntelligenceSection() {
  const [config, setConfig] = React.useState<KyraConfig | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [dirty, setDirty] = React.useState(false)

  React.useEffect(() => {
    getKyraConfig().then(c => setConfig(c))
  }, [])

  function patch(fields: Partial<KyraConfig>) {
    setConfig(prev => prev ? { ...prev, ...fields } : prev)
    setDirty(true)
  }

  function toggleModule(key: string) {
    if (!config) return
    const has = config.enabled_modules.includes(key)
    patch({ enabled_modules: has ? config.enabled_modules.filter(m => m !== key) : [...config.enabled_modules, key] })
  }

  async function save() {
    if (!config) return
    setSaving(true)
    const res = await updateKyraConfig(config)
    setSaving(false)
    if (res.success) { toast.success('Configurações salvas'); setDirty(false) }
    else toast.error(res.error ?? 'Erro ao salvar')
  }

  if (!config) return <SectionCard><div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Carregando...</div></SectionCard>

  return (
    <div className="space-y-4">
      <SectionCard>
        <SectionHeader icon={Bot} title="Personalidade da Kyra" description="Como a assistente se apresenta e se comunica com sua equipe." />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <FormField id="kyra-persona-name" label="Nome da assistente">
            <Input
              value={config.persona_name}
              onChange={e => patch({ persona_name: e.target.value })}
              placeholder="Kyra"
              maxLength={40}
            />
          </FormField>
          <FormField id="kyra-language" label="Idioma">
            <select
              value={config.language}
              onChange={e => patch({ language: e.target.value })}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="pt-BR">Português (Brasil)</option>
              <option value="en-US">English (US)</option>
              <option value="es-ES">Español</option>
            </select>
          </FormField>
        </div>

        <FormField id="kyra-tone" label="Tom de voz" className="mt-4">
          <div className="flex gap-2 flex-wrap">
            {TONE_OPTIONS.map(t => (
              <button
                key={t.value}
                onClick={() => patch({ tone: t.value })}
                className={cn(
                  "px-4 py-2 rounded-lg border text-sm transition-colors",
                  config.tone === t.value
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border text-muted-foreground hover:border-muted-foreground"
                )}
              >
                <span className="block font-medium">{t.label}</span>
                <span className="block text-xs opacity-70">{t.description}</span>
              </button>
            ))}
          </div>
        </FormField>

        <FormField id="kyra-instructions" label="Instruções personalizadas" className="mt-4">
          <textarea
            value={config.custom_instructions}
            onChange={e => patch({ custom_instructions: e.target.value })}
            placeholder="Ex: Sempre priorize sugestões de reposição de estoque. Foque nos produtos mais vendidos..."
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            maxLength={1000}
          />
          <p className="text-xs text-muted-foreground mt-1">{config.custom_instructions.length}/1000 caracteres</p>
        </FormField>
      </SectionCard>

      <SectionCard>
        <SectionHeader icon={Sliders} title="Módulos habilitados" description="Escolha em quais áreas a Kyra pode dar sugestões e alertas." />
        <div className="flex flex-wrap gap-2 mt-4">
          {AI_MODULES.map(m => {
            const active = config.enabled_modules.includes(m.key)
            return (
              <button
                key={m.key}
                onClick={() => toggleModule(m.key)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm border transition-colors",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                )}
              >
                {active && <Sparkles className="inline h-3 w-3 mr-1 opacity-80" />}
                {m.label}
              </button>
            )
          })}
        </div>
        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <div>
            <p className="text-sm font-medium">Sugestões automáticas</p>
            <p className="text-xs text-muted-foreground">Kyra proativamente sugere ações no dashboard</p>
          </div>
          <Switch checked={config.auto_suggestions} onCheckedChange={v => patch({ auto_suggestions: v })} />
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? 'Salvando...' : 'Salvar configurações'}
        </Button>
      </div>
    </div>
  )
}

// ── Integrations Section ───────────────────────────────────────
const INTEGRATION_DEFS = [
  {
    type: 'asaas' as IntegrationType,
    label: 'Asaas',
    description: 'Gateway de pagamento — cobranças, Pix e boletos',
    icon: CreditCard,
    color: 'text-blue-500',
    fields: [{ key: 'api_key', label: 'API Key', placeholder: '$aact_xxxx...', secret: true }],
    docsUrl: 'https://docs.asaas.com',
  },
  {
    type: 'whatsapp' as IntegrationType,
    label: 'WhatsApp',
    description: 'Envio de notificações e atendimento via WhatsApp',
    icon: MessageCircle,
    color: 'text-green-500',
    fields: [
      { key: 'instance_id', label: 'Instance ID', placeholder: 'instance_xxx', secret: false },
      { key: 'token', label: 'Token', placeholder: 'Bearer token...', secret: true },
    ],
    docsUrl: 'https://evolution-api.com/docs',
  },
  {
    type: 'shopify' as IntegrationType,
    label: 'Shopify',
    description: 'Sincronize produtos e pedidos da sua loja Shopify',
    icon: ShoppingBag,
    color: 'text-teal-500',
    fields: [
      { key: 'store_url', label: 'URL da loja', placeholder: 'minha-loja.myshopify.com', secret: false },
      { key: 'api_key', label: 'API Key', placeholder: 'shpat_xxxx', secret: true },
    ],
    docsUrl: 'https://shopify.dev/docs/api',
  },
  {
    type: 'mercadolivre' as IntegrationType,
    label: 'Mercado Livre',
    description: 'Sincronize produtos e pedidos do Mercado Livre',
    icon: Globe,
    color: 'text-yellow-500',
    fields: [
      { key: 'app_id', label: 'App ID', placeholder: '1234567890', secret: false },
      { key: 'client_secret', label: 'Client Secret', placeholder: 'xxxxx', secret: true },
    ],
    docsUrl: 'https://developers.mercadolivre.com.br',
  },
  {
    type: 'woocommerce' as IntegrationType,
    label: 'WooCommerce',
    description: 'Sincronize produtos e pedidos do seu site WooCommerce',
    icon: Globe,
    color: 'text-purple-500',
    fields: [
      { key: 'store_url', label: 'URL da loja', placeholder: 'https://minha-loja.com', secret: false },
      { key: 'consumer_key', label: 'Consumer Key', placeholder: 'ck_xxxx', secret: false },
      { key: 'consumer_secret', label: 'Consumer Secret', placeholder: 'cs_xxxx', secret: true },
    ],
    docsUrl: 'https://woocommerce.com/document/woocommerce-rest-api',
  },
]

function IntegrationCard({
  def,
  integration,
  onSave,
}: {
  def: typeof INTEGRATION_DEFS[number]
  integration?: Integration
  onSave: (type: IntegrationType, config: Record<string, string>, active: boolean) => Promise<void>
}) {
  const [open, setOpen] = React.useState(false)
  const [config, setConfig] = React.useState<Record<string, string>>(integration?.config ?? {})
  const [active, setActive] = React.useState(integration?.is_active ?? false)
  const [saving, setSaving] = React.useState(false)
  const [showSecrets, setShowSecrets] = React.useState<Record<string, boolean>>({})
  const Icon = def.icon
  const isConnected = !!integration

  async function handleSave() {
    setSaving(true)
    await onSave(def.type, config, active)
    setSaving(false)
    setOpen(false)
  }

  return (
    <div className="p-4 rounded-xl border border-border bg-card">
      <div className="flex items-start gap-3">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted", def.color)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">{def.label}</p>
            {isConnected && active && <Badge variant="success" className="text-xs">Conectado</Badge>}
            {isConnected && !active && <Badge variant="neutral" className="text-xs">Inativo</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{def.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isConnected && (
            <Switch checked={active} onCheckedChange={async (v) => {
              setActive(v)
              await onSave(def.type, config, v)
            }} />
          )}
          <Button variant="outline" size="sm" onClick={() => setOpen(o => !o)}>
            {open ? 'Fechar' : (isConnected ? 'Editar' : 'Conectar')}
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-4 pt-4 border-t space-y-3">
          {def.fields.map(field => (
            <FormField key={field.key} id={field.key} label={field.label}>
              <div className="relative">
                <Input
                  type={field.secret && !showSecrets[field.key] ? 'password' : 'text'}
                  value={config[field.key] ?? ''}
                  onChange={e => setConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className={field.secret ? 'pr-9' : ''}
                />
                {field.secret && (
                  <button
                    type="button"
                    onClick={() => setShowSecrets(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecrets[field.key] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            </FormField>
          ))}
          <div className="flex items-center justify-between pt-2">
            <a href={def.docsUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <ExternalLink className="h-3 w-3" /> Documentação
            </a>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : 'Salvar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function IntegrationsSection() {
  const [integrations, setIntegrations] = React.useState<Integration[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    getIntegrations().then(d => { setIntegrations(d); setLoading(false) })
  }, [])

  async function handleSave(type: IntegrationType, config: Record<string, string>, is_active: boolean) {
    const res = await upsertIntegration(type, config, is_active)
    if (res.success) {
      toast.success('Integração salva')
      getIntegrations().then(setIntegrations)
    } else {
      toast.error(res.error ?? 'Erro ao salvar')
    }
  }

  if (loading) return <SectionCard><div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Carregando...</div></SectionCard>

  return (
    <div className="space-y-3">
      {INTEGRATION_DEFS.map(def => (
        <IntegrationCard
          key={def.type}
          def={def}
          integration={integrations.find(i => i.type === def.type)}
          onSave={handleSave}
        />
      ))}
    </div>
  )
}

// ── Security Section ───────────────────────────────────────────
function SecuritySection() {
  const [form, setForm] = React.useState({ current: '', next: '', confirm: '' })
  const [show, setShow] = React.useState({ current: false, next: false, confirm: false })
  const [saving, setSaving] = React.useState(false)

  const passwordsMatch = form.next === form.confirm
  const isStrong = form.next.length >= 8
  const canSubmit = form.current && form.next && form.confirm && passwordsMatch && isStrong

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    const res = await changePassword(form.current, form.next)
    setSaving(false)
    if (res.success) {
      toast.success('Senha alterada com sucesso')
      setForm({ current: '', next: '', confirm: '' })
    } else {
      toast.error(res.error ?? 'Erro ao alterar senha')
    }
  }

  function PasswordField({
    label, value, onChange, showKey,
  }: { label: string; value: string; onChange: (v: string) => void; showKey: keyof typeof show }) {
    return (
      <FormField id={showKey} label={label}>
        <div className="relative">
          <Input
            type={show[showKey] ? 'text' : 'password'}
            value={value}
            onChange={e => onChange(e.target.value)}
            className="pr-9"
            autoComplete={showKey === 'current' ? 'current-password' : 'new-password'}
          />
          <button
            type="button"
            onClick={() => setShow(s => ({ ...s, [showKey]: !s[showKey] }))}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {show[showKey] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
      </FormField>
    )
  }

  return (
    <div className="space-y-4">
      <SectionCard>
        <SectionHeader icon={Key} title="Alterar senha" description="Use uma senha forte com letras, números e símbolos." />
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 max-w-sm">
          <PasswordField label="Senha atual" value={form.current} onChange={v => setForm(s => ({ ...s, current: v }))} showKey="current" />
          <PasswordField label="Nova senha" value={form.next} onChange={v => setForm(s => ({ ...s, next: v }))} showKey="next" />
          {form.next && !isStrong && (
            <p className="text-xs text-destructive -mt-2">Mínimo de 8 caracteres</p>
          )}
          <PasswordField label="Confirmar nova senha" value={form.confirm} onChange={v => setForm(s => ({ ...s, confirm: v }))} showKey="confirm" />
          {form.confirm && !passwordsMatch && (
            <p className="text-xs text-destructive -mt-2">As senhas não coincidem</p>
          )}
          <Button type="submit" disabled={!canSubmit || saving} className="w-full sm:w-auto">
            {saving ? 'Alterando...' : 'Alterar senha'}
          </Button>
        </form>
      </SectionCard>

      <SectionCard>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Shield className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm">Autenticação em dois fatores</p>
            <p className="text-xs text-muted-foreground mt-0.5">Adicione uma camada extra de segurança à sua conta com TOTP (Google Authenticator, Authy).</p>
          </div>
          <Badge variant="neutral" className="text-xs shrink-0">Em breve</Badge>
        </div>
      </SectionCard>
    </div>
  )
}

// ── Section placeholders ───────────────────────────────────────
function PlaceholderSection({ title, description }: { title: string; description: string }) {
  return (
    <SectionCard>
      <div className="flex flex-col items-center justify-center min-h-[280px] text-center gap-3">
        <Brain className="h-8 w-8 text-muted-foreground/40" />
        <p className="font-medium text-muted-foreground">{title}</p>
        <p className="text-sm text-muted-foreground/70 max-w-xs">{description}</p>
        <Badge variant="neutral" className="text-xs">Em breve</Badge>
      </div>
    </SectionCard>
  )
}

// ── Overview grid ──────────────────────────────────────────────
function OverviewGrid({ onNavigate }: { onNavigate: (s: Section) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {OVERVIEW_CARDS.map(card => {
        const Icon = card.icon
        return (
          <button
            key={card.id}
            onClick={() => onNavigate(card.id)}
            className="group flex items-start gap-4 p-5 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all text-left"
          >
            <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
              <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{card.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{card.description}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground mt-0.5 transition-colors" />
          </button>
        )
      })}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────
export function SettingsPage() {
  const [active, setActive] = React.useState<Section>('overview')

  const activeCard = OVERVIEW_CARDS.find(c => c.id === active)

  function renderContent() {
    switch (active) {
      case 'overview':     return <OverviewGrid onNavigate={setActive} />
      case 'company':      return <CompanySection />
      case 'operation':    return <OperationSection />
      case 'users':        return <UsersSection />
      case 'profiles':     return <ProfilesSection />
      case 'integrations': return <IntegrationsSection />
      case 'intelligence': return <IntelligenceSection />
      case 'subscription': return <SubscriptionSection />
      case 'security':     return <SecuritySection />
    }
  }

  return (
    <div>
      <PageHeader
        icon={activeCard?.icon ?? Settings2}
        title={active === 'overview' ? 'Configurações' : (activeCard?.label ?? 'Configurações')}
        description={active === 'overview'
          ? 'Gerencie as preferências e configurações do sistema'
          : activeCard?.description}
        breadcrumbs={active !== 'overview' ? [
          { label: 'Configurações' },
          { label: activeCard?.label ?? '' },
        ] : undefined}
        actions={active !== 'overview' ? (
          <Button variant="ghost" size="sm" onClick={() => setActive('overview')}
            className="gap-1.5 text-muted-foreground hover:text-foreground">
            <ChevronRight className="h-3.5 w-3.5 rotate-180" />
            Voltar
          </Button>
        ) : undefined}
      />
      {renderContent()}
    </div>
  )
}
