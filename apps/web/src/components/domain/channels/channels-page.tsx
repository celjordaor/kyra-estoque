'use client'

import * as React from 'react'
import {
  Globe, Plus, AlertCircle, CheckCircle2,
  ShoppingBag, Package, RefreshCw, ArrowLeft,
  Zap, Link2, ToggleLeft, ToggleRight, Wifi, WifiOff,
  ChevronRight, Store, Instagram, MessageCircle,
  TrendingUp, Box, ShoppingCart, Activity,
  AlertTriangle, ExternalLink, Unlink, Lock, Eye, EyeOff,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  getChannels, connectChannel, disconnectChannel,
  updateChannelConfig, syncChannel,
  getChannelOrders, getChannelListings,
} from '@/lib/actions/channels'
import type { ChannelData, ChannelType, ChannelSyncConfig } from '@/lib/actions/channels'

// ── Channel type meta ─────────────────────────────────────────

const CHANNEL_META: Record<ChannelType, {
  label: string; description: string; icon: React.ElementType; iconColor: string
  fields: { key: string; label: string; placeholder: string; secret?: boolean }[]
}> = {
  mercado_livre: {
    label: 'Mercado Livre',
    description: 'Maior marketplace da América Latina',
    icon: ShoppingBag,
    iconColor: 'text-yellow-500',
    fields: [
      { key: 'token',      label: 'Access Token',  placeholder: 'APP_USR-...', secret: true },
      { key: 'account_name', label: 'Nome da loja', placeholder: 'Ex: loja_kyra_oficial' },
    ],
  },
  shopify: {
    label: 'Shopify',
    description: 'Loja virtual completa',
    icon: Store,
    iconColor: 'text-green-500',
    fields: [
      { key: 'store_url', label: 'URL da loja',   placeholder: 'minha-loja.myshopify.com' },
      { key: 'token',     label: 'Admin API Token', placeholder: 'shpat_...', secret: true },
    ],
  },
  woocommerce: {
    label: 'WooCommerce',
    description: 'Plugin para WordPress',
    icon: Globe,
    iconColor: 'text-purple-500',
    fields: [
      { key: 'store_url',     label: 'URL do site',      placeholder: 'https://meusite.com.br' },
      { key: 'api_key',       label: 'Consumer Key',     placeholder: 'ck_...', secret: true },
      { key: 'client_secret', label: 'Consumer Secret',  placeholder: 'cs_...', secret: true },
    ],
  },
  loja_integrada: {
    label: 'Loja Integrada',
    description: 'Plataforma de e-commerce',
    icon: Box,
    iconColor: 'text-blue-500',
    fields: [
      { key: 'api_key',    label: 'Chave de API',   placeholder: 'sua-chave-api', secret: true },
      { key: 'account_name', label: 'Nome da conta', placeholder: 'Ex: minhaloja' },
    ],
  },
  instagram: {
    label: 'Instagram / Facebook',
    description: 'Shopping nas redes sociais',
    icon: Instagram,
    iconColor: 'text-pink-500',
    fields: [
      { key: 'token',       label: 'Access Token',    placeholder: 'EAA...', secret: true },
      { key: 'account_name', label: 'Handle / página', placeholder: '@minha_loja' },
    ],
  },
  whatsapp: {
    label: 'WhatsApp',
    description: 'Catálogo e vendas via WhatsApp',
    icon: MessageCircle,
    iconColor: 'text-emerald-500',
    fields: [
      { key: 'token',       label: 'Token da API',    placeholder: 'Bearer ...', secret: true },
      { key: 'account_name', label: 'Número / conta',  placeholder: '+55 11 9...' },
    ],
  },
  loja_virtual: {
    label: 'Loja virtual própria',
    description: 'Integração via API',
    icon: Globe,
    iconColor: 'text-indigo-500',
    fields: [
      { key: 'store_url', label: 'URL da API',     placeholder: 'https://api.meusite.com.br' },
      { key: 'api_key',   label: 'Chave de API',   placeholder: 'sk_...', secret: true },
    ],
  },
}

const CHANNEL_TYPES = Object.keys(CHANNEL_META) as ChannelType[]

// ── Formatters ────────────────────────────────────────────────

function fmtRelative(iso: string | null) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora mesmo'
  if (mins < 60) return `há ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `há ${hrs}h`
  return `há ${Math.floor(hrs / 24)}d`
}

const STATUS_CONFIG = {
  connected: { label: 'Conectado',    color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  error:     { label: 'Erro',         color: 'text-red-600 dark:text-red-400',          bg: 'bg-red-50 dark:bg-red-900/20' },
  inactive:  { label: 'Inativo',      color: 'text-muted-foreground',                   bg: 'bg-muted' },
}

// ── Toggle ────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
        checked ? 'bg-primary' : 'bg-muted'
      )}
    >
      <span className={cn(
        'inline-block h-4 w-4 transform rounded-full bg-card shadow-sm transition-transform',
        checked ? 'translate-x-4' : 'translate-x-0.5'
      )} />
    </button>
  )
}

// ── KPI Card ──────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, highlight }: {
  icon: React.ElementType; label: string; value: string; sub?: string; highlight?: boolean
}) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-4', highlight && 'border-primary/30')}>
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <Icon className={cn('h-4 w-4', highlight && 'text-primary')} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ── Channel Card ──────────────────────────────────────────────

function ChannelCard({ channel, onClick, onSync }: {
  channel: ChannelData; onClick: () => void; onSync: (id: string) => void
}) {
  const meta = CHANNEL_META[channel.type]
  const st = STATUS_CONFIG[channel.status]
  const Icon = meta.icon

  return (
    <div
      className="rounded-xl border border-border bg-card p-5 cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
            <Icon className={cn('h-5 w-5', meta.iconColor)} />
          </div>
          <div>
            <p className="font-semibold">{meta.label}</p>
            <p className="text-xs text-muted-foreground">{channel.account_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {channel.status === 'connected' ? <Wifi className={cn('h-3.5 w-3.5', st.color)} />
            : channel.status === 'error' ? <WifiOff className={cn('h-3.5 w-3.5', st.color)} />
            : <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className={cn('text-xs font-medium', st.color)}>{st.label}</span>
        </div>
      </div>

      <div className="flex gap-4 text-sm mb-3">
        <div>
          <p className="text-xs text-muted-foreground">Produtos</p>
          <p className="font-semibold">{channel.products_published}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Pedidos hoje</p>
          <p className="font-semibold">{channel.orders_today}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Última sync</p>
          <p className="font-medium">{fmtRelative(channel.last_sync_at)}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs mb-3">
        {!channel.sync_error ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <AlertCircle className="h-3.5 w-3.5 text-red-500" />
        )}
        <span className={!channel.sync_error ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
          {!channel.sync_error ? 'Sincronização OK' : 'Sincronização com erros'}
        </span>
      </div>

      {channel.sync_error && (
        <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2.5 text-xs text-red-700 dark:text-red-400 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{channel.sync_error}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs"
          onClick={e => { e.stopPropagation(); onSync(channel.id) }}>
          <RefreshCw className="h-3.5 w-3.5" />
          Sincronizar
        </Button>
        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          Ver detalhes <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Connection Wizard ─────────────────────────────────────────

function ConnectionWizard({ onClose, onConnected, canAdd, limit }: {
  onClose: () => void
  onConnected: () => void
  canAdd: boolean
  limit: number | null
}) {
  const [step, setStep] = React.useState<1 | 2 | 3 | 4>(1)
  const [selectedType, setSelectedType] = React.useState<ChannelType | null>(null)
  const [syncConfig, setSyncConfig] = React.useState<ChannelSyncConfig>({ sync_stock: true, sync_prices: true, auto_publish: false })
  const [credentials, setCredentials] = React.useState<Record<string, string>>({})
  const [showSecret, setShowSecret] = React.useState<Record<string, boolean>>({})
  const [saving, setSaving] = React.useState(false)

  if (!canAdd) {
    return (
      <div className="flex flex-col items-center text-center gap-4 py-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="font-semibold">Limite de canais atingido</p>
          <p className="text-sm text-muted-foreground mt-1">
            Seu plano permite até {limit} canal(is). Faça upgrade para conectar mais canais.
          </p>
        </div>
        <Button variant="outline" onClick={onClose}>Fechar</Button>
      </div>
    )
  }

  const meta = selectedType ? CHANNEL_META[selectedType] : null

  const handleConnect = async () => {
    if (!selectedType) return
    setSaving(true)
    try {
      const result = await connectChannel({
        type: selectedType,
        credentials: {
          api_key:       credentials.api_key,
          token:         credentials.token,
          store_url:     credentials.store_url,
          client_id:     credentials.client_id,
          client_secret: credentials.client_secret,
        },
        sync_config: syncConfig,
        account_name: credentials.account_name || credentials.store_url || selectedType,
      })

      if (!result.ok) {
        toast.error(result.error ?? 'Erro ao conectar canal')
        return
      }
      setStep(4)
    } finally {
      setSaving(false)
    }
  }

  const STEPS = [
    { n: 1, label: 'Escolha' },
    { n: 2, label: 'Credenciais' },
    { n: 3, label: 'Configurar' },
    { n: 4, label: 'Concluído' },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Stepper */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.n}>
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                step >= s.n ? 'bg-primary text-primary-foreground' : 'border border-border bg-muted text-muted-foreground'
              )}>
                {step > s.n ? <CheckCircle2 className="h-4 w-4" /> : s.n}
              </div>
              <span className={cn('text-xs hidden sm:block', step >= s.n ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('h-px flex-1 mb-4 mx-2 transition-colors', step > s.n ? 'bg-primary' : 'bg-border')} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1 — Choose */}
      {step === 1 && (
        <div>
          <h3 className="font-semibold mb-1">Qual canal deseja conectar?</h3>
          <p className="text-sm text-muted-foreground mb-4">Selecione a plataforma para iniciar a integração.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {CHANNEL_TYPES.map(type => {
              const m = CHANNEL_META[type]
              const Icon = m.icon
              return (
                <button key={type} onClick={() => setSelectedType(type)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-3 text-left transition-all',
                    selectedType === type ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/40 hover:bg-muted/30'
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
                    <Icon className={cn('h-4 w-4', m.iconColor)} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.description}</p>
                  </div>
                  {selectedType === type && <CheckCircle2 className="ml-auto h-4 w-4 text-primary shrink-0" />}
                </button>
              )
            })}
          </div>
          <div className="flex justify-between mt-6">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => setStep(2)} disabled={!selectedType}>
              Próximo <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2 — Credentials */}
      {step === 2 && meta && selectedType && (
        <div>
          <h3 className="font-semibold mb-1">Credenciais do {meta.label}</h3>
          <p className="text-sm text-muted-foreground mb-5">
            Informe as chaves de acesso para conectar sua conta. Elas são armazenadas com segurança.
          </p>
          <div className="space-y-4">
            {meta.fields.map(field => (
              <div key={field.key}>
                <Label>{field.label}</Label>
                <div className="relative mt-1.5">
                  <Input
                    type={field.secret && !showSecret[field.key] ? 'password' : 'text'}
                    placeholder={field.placeholder}
                    value={credentials[field.key] ?? ''}
                    onChange={e => setCredentials(p => ({ ...p, [field.key]: e.target.value }))}
                  />
                  {field.secret && (
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowSecret(p => ({ ...p, [field.key]: !p[field.key] }))}
                    >
                      {showSecret[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            <Button onClick={() => setStep(3)}>
              Próximo <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3 — Sync config */}
      {step === 3 && (
        <div>
          <h3 className="font-semibold mb-1">Configurar sincronização</h3>
          <p className="text-sm text-muted-foreground mb-5">Defina como o Kyra deve se comportar com este canal.</p>
          <div className="space-y-4">
            {([
              { key: 'sync_stock',   label: 'Sincronizar estoque',     desc: 'Atualiza as quantidades em tempo real no canal' },
              { key: 'sync_prices',  label: 'Sincronizar preços',      desc: 'Replica alterações de preço automaticamente' },
              { key: 'auto_publish', label: 'Publicar novos produtos', desc: 'Publica automaticamente ao criar um produto' },
            ] as const).map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between rounded-xl border border-border p-4">
                <div>
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
                <Toggle checked={syncConfig[key]} onChange={v => setSyncConfig(p => ({ ...p, [key]: v }))} />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            <Button onClick={handleConnect} disabled={saving}>
              {saving ? <><RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />Conectando...</> : 'Conectar canal'}
            </Button>
          </div>
        </div>
      )}

      {/* Step 4 — Done */}
      {step === 4 && meta && (
        <div className="flex flex-col items-center text-center gap-6 py-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Canal conectado!</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {meta.label} foi integrado com sucesso ao Kyra Estoque.
            </p>
          </div>
          <Button onClick={onConnected} className="gap-2 px-6">
            <ExternalLink className="h-4 w-4" />
            Ver canal
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Channel Detail ────────────────────────────────────────────

type DetailTab = 'overview' | 'products' | 'orders' | 'settings'

function ChannelDetail({ channel, onBack, onDisconnect, onConfigChange, onSync }: {
  channel: ChannelData
  onBack: () => void
  onDisconnect: (id: string) => void
  onConfigChange: (id: string, cfg: ChannelSyncConfig) => void
  onSync: (id: string) => void
}) {
  const [tab, setTab] = React.useState<DetailTab>('overview')
  const [config, setConfig] = React.useState<ChannelSyncConfig>(channel.sync_config)
  const [syncing, setSyncing] = React.useState(false)
  const [orders, setOrders] = React.useState<Array<{ id: string; external_order_id: string; customer_name: string | null; total_cents: number | null; status: string }>>([])
  const [listings, setListings] = React.useState<Awaited<ReturnType<typeof getChannelListings>>>([])
  const [loadingTab, setLoadingTab] = React.useState(false)
  const meta = CHANNEL_META[channel.type]
  const st = STATUS_CONFIG[channel.status]
  const Icon = meta.icon

  React.useEffect(() => {
    if (tab === 'orders' && orders.length === 0) {
      setLoadingTab(true)
      getChannelOrders(channel.id).then(data => setOrders(data as Array<{ id: string; external_order_id: string; customer_name: string | null; total_cents: number | null; status: string }>)).finally(() => setLoadingTab(false))
    }
    if (tab === 'products' && listings.length === 0) {
      setLoadingTab(true)
      getChannelListings(channel.id).then(setListings).finally(() => setLoadingTab(false))
    }
  }, [tab])

  const handleSync = async () => {
    setSyncing(true)
    await syncChannel(channel.id)
    setSyncing(false)
    onSync(channel.id)
    toast.success('Sincronização concluída')
  }

  const updateConfig = async (key: keyof ChannelSyncConfig, value: boolean) => {
    const next = { ...config, [key]: value }
    setConfig(next)
    await updateChannelConfig(channel.id, next)
    onConfigChange(channel.id, next)
    toast.success('Configuração salva')
  }

  const TABS: { key: DetailTab; label: string }[] = [
    { key: 'overview', label: 'Visão geral' },
    { key: 'products', label: 'Produtos' },
    { key: 'orders',   label: 'Pedidos' },
    { key: 'settings', label: 'Configurações' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Canais
          </button>
          <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted">
              <Icon className={cn('h-4 w-4', meta.iconColor)} />
            </div>
            <span className="font-semibold">{meta.label}</span>
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', st.color, st.bg)}>
              {channel.status === 'connected' ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {st.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={cn('h-3.5 w-3.5', syncing && 'animate-spin')} />
            {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
          </Button>
          <Button variant="ghost" size="sm" className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
            onClick={() => onDisconnect(channel.id)}>
            <Unlink className="h-3.5 w-3.5" /> Desconectar
          </Button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              tab === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-4">
          {channel.sync_error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm text-red-700 dark:text-red-400">Ação necessária</p>
                <p className="text-sm text-red-600 dark:text-red-400/80 mt-0.5">{channel.sync_error}</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard icon={Box}          label="Produtos publicados"  value={String(channel.products_published)} />
            <KpiCard icon={ShoppingCart} label="Pedidos hoje"         value={String(channel.orders_today)} highlight={channel.orders_today > 0} />
            <KpiCard icon={Activity}     label="Última sincronização" value={fmtRelative(channel.last_sync_at)} />
            <KpiCard icon={!channel.sync_error ? CheckCircle2 : AlertCircle}
              label="Status sync" value={!channel.sync_error ? 'Saudável' : 'Com erros'} />
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Conta conectada</p>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted">
                <Icon className={cn('h-5 w-5', meta.iconColor)} />
              </div>
              <div>
                <p className="font-medium">{channel.account_name}</p>
                <p className="text-xs text-muted-foreground">{meta.label}</p>
              </div>
              <span className={cn('ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', st.color, st.bg)}>
                {st.label}
              </span>
            </div>
          </div>
        </div>
      )}

      {tab === 'products' && (
        loadingTab ? (
          <div className="flex justify-center py-12"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : listings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-12 text-center">
            <Package className="mx-auto h-8 w-8 text-muted-foreground/30" />
            <p className="mt-2 font-medium text-sm">Nenhum produto publicado</p>
            <p className="mt-1 text-xs text-muted-foreground">Os produtos publicados neste canal aparecerão aqui.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {listings.map((l: Record<string, unknown>) => {
              const product = l.products as Record<string, unknown> | null
              return (
                <div key={l.id as string} className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div>
                    <p className="font-medium text-sm">{product?.name as string ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">ID externo: {l.external_id as string}</p>
                  </div>
                  <span className="text-xs text-emerald-600">Ativo</span>
                </div>
              )
            })}
          </div>
        )
      )}

      {tab === 'orders' && (
        loadingTab ? (
          <div className="flex justify-center py-12"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-12 text-center">
            <ShoppingCart className="mx-auto h-8 w-8 text-muted-foreground/30" />
            <p className="mt-2 font-medium text-sm">Nenhum pedido recebido</p>
            <p className="mt-1 text-xs text-muted-foreground">Pedidos recebidos por este canal aparecerão aqui.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map(o => (
              <div key={o.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                <div>
                  <p className="font-medium text-sm">#{o.external_order_id}</p>
                  <p className="text-xs text-muted-foreground">{o.customer_name ?? '—'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {o.total_cents != null ? `R$ ${(o.total_cents / 100).toFixed(2).replace('.', ',')}` : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">{o.status}</p>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'settings' && (
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Sincronização</p>
          {([
            { key: 'sync_stock',   label: 'Sincronizar estoque',     desc: 'Atualiza quantidades em tempo real' },
            { key: 'sync_prices',  label: 'Sincronizar preços',      desc: 'Replica alterações de preço automaticamente' },
            { key: 'auto_publish', label: 'Publicar novos produtos', desc: 'Publica automaticamente ao criar um produto' },
          ] as const).map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between rounded-xl border border-border p-4">
              <div>
                <p className="font-medium text-sm">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
              <Toggle checked={config[key]} onChange={v => updateConfig(key, v)} />
            </div>
          ))}
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between rounded-xl border border-border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted">
                  <Icon className={cn('h-4 w-4', meta.iconColor)} />
                </div>
                <div>
                  <p className="font-medium text-sm">{channel.account_name}</p>
                  <p className="text-xs text-muted-foreground">{meta.label}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 gap-1.5"
                onClick={() => onDisconnect(channel.id)}>
                <Unlink className="h-3.5 w-3.5" /> Desconectar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────

export function ChannelsPage() {
  const [channels, setChannels] = React.useState<ChannelData[]>([])
  const [canAddMore, setCanAddMore] = React.useState(true)
  const [limit, setLimit] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [view, setView] = React.useState<'list' | 'wizard' | 'detail'>('list')
  const [selectedChannel, setSelectedChannel] = React.useState<ChannelData | null>(null)
  const [syncingId, setSyncingId] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const result = await getChannels()
      setChannels(result.channels.filter(c => c.is_active))
      setCanAddMore(result.canAddMore)
      setLimit(result.limit)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { load() }, [load])

  // Keep selectedChannel in sync
  React.useEffect(() => {
    if (selectedChannel) {
      const updated = channels.find(c => c.id === selectedChannel.id)
      if (updated) setSelectedChannel(updated)
    }
  }, [channels])

  const handleSync = async (id: string) => {
    setSyncingId(id)
    toast.info('Sincronização iniciada')
    await syncChannel(id)
    await load()
    setSyncingId(null)
    toast.success('Sincronização concluída')
  }

  const handleDisconnect = async (id: string) => {
    const result = await disconnectChannel(id)
    if (!result.ok) { toast.error(result.error); return }
    await load()
    setView('list')
    setSelectedChannel(null)
    toast.success('Canal desconectado')
  }

  const handleConfigChange = async (id: string, cfg: ChannelSyncConfig) => {
    setChannels(prev => prev.map(c => c.id === id ? { ...c, sync_config: cfg } : c))
  }

  const handleConnected = async () => {
    await load()
    setView('list')
    toast.success('Canal conectado com sucesso!')
  }

  const totalProducts = channels.reduce((s, c) => s + c.products_published, 0)
  const totalOrdersToday = channels.reduce((s, c) => s + c.orders_today, 0)
  const errorCount = channels.filter(c => c.status === 'error').length

  if (view === 'detail' && selectedChannel) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <ChannelDetail
          channel={selectedChannel}
          onBack={() => { setView('list'); setSelectedChannel(null) }}
          onDisconnect={handleDisconnect}
          onConfigChange={handleConfigChange}
          onSync={id => { handleSync(id) }}
        />
      </div>
    )
  }

  if (view === 'wizard') {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('list')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <span className="text-muted-foreground/40">/</span>
          <span className="font-semibold">Conectar canal</span>
        </div>
        <div className="w-full max-w-2xl mx-auto">
          <ConnectionWizard onClose={() => setView('list')} onConnected={handleConnected} canAdd={canAddMore} limit={limit} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        icon={Globe}
        title="Canais"
        description="Gerencie os canais de venda conectados ao Kyra Estoque."
        actions={
          <Button onClick={() => setView('wizard')} className="gap-2" disabled={!canAddMore}>
            <Plus className="h-4 w-4" />
            Conectar canal
            {!canAddMore && <Lock className="h-3.5 w-3.5 ml-1" />}
          </Button>
        }
      />

      {!canAddMore && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 flex items-center gap-3">
          <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Limite de {limit} canal(is) atingido. Faça upgrade para conectar mais canais.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard icon={Link2}        label="Canais ativos"       value={loading ? '—' : String(channels.length)} />
        <KpiCard icon={Package}      label="Produtos publicados" value={loading ? '—' : String(totalProducts)} sub="em todos os canais" />
        <KpiCard icon={ShoppingCart} label="Pedidos hoje"        value={loading ? '—' : String(totalOrdersToday)} highlight={totalOrdersToday > 0} />
        <KpiCard icon={errorCount > 0 ? AlertCircle : CheckCircle2}
          label="Alertas" value={loading ? '—' : errorCount > 0 ? `${errorCount} erro${errorCount > 1 ? 's' : ''}` : 'Tudo certo'}
          sub={errorCount > 0 ? 'Requer atenção' : undefined} />
      </div>

      {channels.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Seus canais</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {channels.map(ch => (
              <ChannelCard key={ch.id} channel={ch}
                onClick={() => { setSelectedChannel(ch); setView('detail') }}
                onSync={handleSync}
              />
            ))}
          </div>
        </div>
      )}

      {channels.length === 0 && !loading && (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <Globe className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-base font-medium">Nenhum canal conectado</p>
          <p className="mt-1 text-sm text-muted-foreground max-w-xs mx-auto">
            Conecte canais de venda para publicar produtos e sincronizar pedidos automaticamente.
          </p>
          <Button onClick={() => setView('wizard')} className="mt-4 gap-2">
            <Plus className="h-4 w-4" /> Conectar primeiro canal
          </Button>
        </div>
      )}

      {/* Canais disponíveis */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {channels.length > 0 ? 'Mais canais disponíveis' : 'Canais disponíveis'}
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {CHANNEL_TYPES
            .filter(type => !channels.some(c => c.type === type))
            .slice(0, 6)
            .map(type => {
              const m = CHANNEL_META[type]
              const Icon = m.icon
              return (
                <button key={type} onClick={() => setView('wizard')}
                  className="flex items-center justify-between rounded-xl border border-border bg-card p-4 text-left hover:border-primary/30 hover:shadow-sm transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
                      <Icon className={cn('h-4 w-4', m.iconColor)} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{m.label}</p>
                      <p className="text-xs text-muted-foreground">{m.description}</p>
                    </div>
                  </div>
                  <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 ml-2" />
                </button>
              )
            })}
        </div>
      </div>

      {/* Insights */}
      {channels.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-primary/20 dark:border-primary/30 bg-primary/10 dark:bg-primary/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-primary dark:text-primary/80" />
              <span className="text-xs font-semibold uppercase tracking-widest text-primary dark:text-primary/80">Insight do Kyra</span>
            </div>
            <p className="text-sm font-medium mb-1">Sincronize regularmente</p>
            <p className="text-xs text-muted-foreground">Mantenha seu estoque atualizado em todos os canais para evitar vendas de produtos indisponíveis.</p>
          </div>
          <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <span className="text-xs font-semibold uppercase tracking-widest text-orange-600 dark:text-orange-400">Dica</span>
            </div>
            <p className="text-sm font-medium mb-1">Ative a publicação automática</p>
            <p className="text-xs text-muted-foreground">Novos produtos são publicados automaticamente nos canais com essa opção ativada.</p>
          </div>
        </div>
      )}
    </div>
  )
}
