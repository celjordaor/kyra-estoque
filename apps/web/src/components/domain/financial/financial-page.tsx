'use client'

import React from 'react'
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  Plus, CheckCircle, XCircle, Clock, Download, RefreshCw,
  Building2, Wallet, CreditCard, Lock,
} from 'lucide-react'
import {
  getFinancialSummary, getTransactions, getAccounts,
  markAsPaid, cancelTransaction, createTransaction, createAccount,
  exportFinancialCsv,
} from '@/lib/actions/financial'
import type { FinancialSummary, FinancialTransaction, FinancialAccount } from '@/lib/actions/financial'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet, SheetContent, SheetHeader, SheetBody, SheetFooter, SheetTitle,
} from '@/components/ui/sheet'
import { CurrencyInput } from '@/components/ui/currency-input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(dateStr: string) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function isOverdue(dueDate: string, status: string) {
  return status === 'overdue' || (status === 'pending' && dueDate < new Date().toISOString().slice(0, 10))
}

// ── sub-componentes shared ────────────────────────────────────────────────────

function KpiCard({
  title, value, icon: Icon, variant = 'default', subtitle,
}: {
  title: string
  value: string
  icon: React.ElementType
  variant?: 'default' | 'green' | 'red' | 'yellow'
  subtitle?: string
}) {
  const colors = {
    default: 'text-foreground',
    green: 'text-emerald-600 dark:text-emerald-400',
    red: 'text-red-600 dark:text-red-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
  }
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{title}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className={cn('text-2xl font-bold', colors[variant])}>{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: string }> = {
    pending:  { label: 'Pendente',  variant: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
    paid:     { label: 'Pago',      variant: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
    overdue:  { label: 'Vencido',   variant: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
    canceled: { label: 'Cancelado', variant: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  }
  const s = map[status] ?? { label: status, variant: 'bg-gray-100 text-gray-600' }
  return <span className={cn('px-2 py-0.5 rounded text-xs font-medium', s.variant)}>{s.label}</span>
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={cn('px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap', right && 'text-right')}>{children}</th>
}

function Td({ children, right, className }: { children: React.ReactNode; right?: boolean; className?: string }) {
  return <td className={cn('px-3 py-2 text-sm', right && 'text-right', className)}>{children}</td>
}

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <tbody>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b">
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className="px-3 py-2">
              <div className="h-4 bg-muted animate-pulse rounded" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}

function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full">{children}</table>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-12 text-center text-muted-foreground text-sm">{message}</div>
  )
}

function LockedFinancial() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center">
      <div className="rounded-full bg-muted p-4">
        <Lock className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <h3 className="text-lg font-semibold">Módulo Financeiro</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie contas a pagar e receber, gere boletos e Pix com o plano Impulsiona+.
        </p>
      </div>
      <a
        href="/settings?tab=billing"
        className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Ver planos
      </a>
    </div>
  )
}

// ── modal: Nova Transação ─────────────────────────────────────────────────────

function TransactionModal({
  open,
  defaultType,
  accounts,
  onClose,
  onSuccess,
}: {
  open: boolean
  defaultType: 'receivable' | 'payable'
  accounts: FinancialAccount[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState({
    type: defaultType,
    description: '',
    due_date: new Date().toISOString().slice(0, 10),
    account_id: '',
    category: '',
  })
  const [amountValue, setAmountValue] = React.useState<number>(0)

  React.useEffect(() => {
    setForm(f => ({ ...f, type: defaultType, description: '', due_date: new Date().toISOString().slice(0, 10), account_id: '', category: '' }))
    setAmountValue(0)
  }, [defaultType, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description || amountValue <= 0 || !form.due_date) return
    setSaving(true)
    try {
      const amountCents = Math.round(amountValue * 100)
      await createTransaction({
        type: form.type as 'receivable' | 'payable',
        description: form.description,
        amount_cents: amountCents,
        due_date: form.due_date,
        account_id: form.account_id || undefined,
        category: form.category || undefined,
        reference_type: 'manual',
      })
      onSuccess()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Nova {form.type === 'receivable' ? 'Conta a Receber' : 'Conta a Pagar'}</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <form id="tx-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as 'receivable' | 'payable' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="receivable">A Receber</SelectItem>
                  <SelectItem value="payable">A Pagar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição *</Label>
              <Input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Ex: Fatura cliente ABC"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor (R$) *</Label>
                <CurrencyInput
                  value={amountValue}
                  onChange={v => setAmountValue(v)}
                />
              </div>
              <div>
                <Label>Vencimento *</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div>
              <Label>Categoria</Label>
              <Input
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                placeholder="Ex: Serviços, Fornecedores, Aluguel…"
              />
            </div>
            {accounts.length > 0 && (
              <div>
                <Label>Conta</Label>
                <Select value={form.account_id} onValueChange={v => setForm(f => ({ ...f, account_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar conta..." /></SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form>
        </SheetBody>
        <SheetFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="tx-form" disabled={saving || amountValue <= 0}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ── tab: Resumo ───────────────────────────────────────────────────────────────

function ResumoTab({
  summary,
  accounts,
  loading,
  onRefresh,
}: {
  summary: FinancialSummary | null
  accounts: FinancialAccount[]
  loading: boolean
  onRefresh: () => void
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    )
  }

  if (!summary) return null

  const accountTypeLabel = { checking: 'Corrente', cash: 'Caixa', savings: 'Poupança' }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard title="A Receber" value={fmt(summary.totalReceivable)} icon={TrendingUp} variant="green" />
        <KpiCard title="A Pagar" value={fmt(summary.totalPayable)} icon={TrendingDown} variant="red" />
        <KpiCard
          title="Saldo Projetado"
          value={fmt(summary.netBalance)}
          icon={DollarSign}
          variant={summary.netBalance >= 0 ? 'green' : 'red'}
        />
        <KpiCard
          title="Receber Vencidos"
          value={fmt(summary.overdueReceivable)}
          icon={AlertTriangle}
          variant={summary.overdueReceivable > 0 ? 'red' : 'default'}
        />
        <KpiCard
          title="Pagar Vencidos"
          value={fmt(summary.overduePayable)}
          icon={AlertTriangle}
          variant={summary.overduePayable > 0 ? 'red' : 'default'}
        />
        <KpiCard
          title="A vencer em 7 dias"
          value={fmt(summary.upcoming7Days)}
          icon={Clock}
          variant={summary.upcoming7Days > 0 ? 'yellow' : 'default'}
        />
      </div>

      {accounts.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Contas</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {accounts.map(acc => {
              const icons = { checking: Building2, cash: Wallet, savings: CreditCard }
              const Icon = icons[acc.type] ?? Wallet
              return (
                <div key={acc.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="rounded-full bg-muted p-2"><Icon className="h-4 w-4 text-muted-foreground" /></div>
                  <div>
                    <p className="text-sm font-medium">{acc.name}</p>
                    <p className="text-xs text-muted-foreground">{accountTypeLabel[acc.type]}</p>
                    <p className="text-sm font-semibold">{fmt(acc.balance_cents)}</p>
                  </div>
                  {acc.is_default && <Badge variant="secondary" className="ml-auto text-xs">Padrão</Badge>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── tab: Transações (Receber / Pagar) ─────────────────────────────────────────

function TransacoesTab({
  type,
  onRefresh,
}: {
  type: 'receivable' | 'payable'
  onRefresh: () => void
}) {
  const [rows, setRows] = React.useState<FinancialTransaction[]>([])
  const [total, setTotal] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [statusFilter, setStatusFilter] = React.useState('all')
  const [actionId, setActionId] = React.useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const result = await getTransactions({
        type,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        pageSize: 100,
      })
      setRows(result.rows)
      setTotal(result.total)
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { load() }, [type, statusFilter])

  async function handleMarkPaid(id: string) {
    setActionId(id)
    await markAsPaid(id)
    await load()
    onRefresh()
    setActionId(null)
  }

  async function handleCancel(id: string) {
    if (!confirm('Cancelar esta transação?')) return
    setActionId(id)
    await cancelTransaction(id)
    await load()
    onRefresh()
    setActionId(null)
  }

  async function handleExport() {
    const csv = await exportFinancialCsv(type)
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `financeiro-${type === 'receivable' ? 'receber' : 'pagar'}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const emptyMsg = type === 'receivable'
    ? 'Nenhuma conta a receber encontrada.'
    : 'Nenhuma conta a pagar encontrada.'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="overdue">Vencido</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
            <SelectItem value="canceled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">{total} registro(s)</span>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" /> Exportar CSV
        </Button>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} /> Atualizar
        </Button>
      </div>

      {loading ? (
        <TableWrap>
          <thead>
            <tr className="border-b">
              <Th>Descrição</Th><Th>Categoria</Th>
              <Th right>Valor</Th><Th>Vencimento</Th>
              <Th>Status</Th><Th>Ações</Th>
            </tr>
          </thead>
          <SkeletonRows cols={6} />
        </TableWrap>
      ) : rows.length === 0 ? (
        <EmptyState message={emptyMsg} />
      ) : (
        <TableWrap>
          <thead>
            <tr className="border-b bg-muted/30">
              <Th>Descrição</Th><Th>Categoria</Th>
              <Th right>Valor</Th><Th>Vencimento</Th>
              <Th>Status</Th><Th>Ações</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const overdue = isOverdue(row.due_date, row.status)
              return (
                <tr key={row.id} className={cn('border-b hover:bg-muted/20', overdue && row.status !== 'canceled' && 'bg-red-50/50 dark:bg-red-950/10')}>
                  <Td>
                    <span className="font-medium">{row.description}</span>
                    {row.provider_charge_id && (
                      <span className="ml-2 text-xs text-muted-foreground">(Asaas)</span>
                    )}
                  </Td>
                  <Td>{row.category ?? <span className="text-muted-foreground">—</span>}</Td>
                  <Td right className="font-semibold">
                    <span className={type === 'receivable' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                      {fmt(row.amount_cents)}
                    </span>
                  </Td>
                  <Td className={cn(overdue && row.status !== 'paid' && row.status !== 'canceled' && 'text-red-600 dark:text-red-400 font-medium')}>
                    {fmtDate(row.due_date)}
                  </Td>
                  <Td><StatusBadge status={overdue && row.status === 'pending' ? 'overdue' : row.status} /></Td>
                  <Td>
                    {row.status !== 'paid' && row.status !== 'canceled' && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleMarkPaid(row.id)}
                          disabled={actionId === row.id}
                          className="text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                          title="Marcar como pago"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleCancel(row.id)}
                          disabled={actionId === row.id}
                          className="text-red-500 hover:text-red-600 disabled:opacity-50 ml-1"
                          title="Cancelar"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    {row.status === 'paid' && row.paid_at && (
                      <span className="text-xs text-muted-foreground">
                        Pago {fmtDate(row.paid_at.slice(0, 10))}
                      </span>
                    )}
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </TableWrap>
      )}
    </div>
  )
}

// ── tabs definition ───────────────────────────────────────────────────────────

type TabId = 'resumo' | 'receber' | 'pagar'

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'resumo',  label: 'Resumo',         icon: DollarSign },
  { id: 'receber', label: 'A Receber',       icon: TrendingUp },
  { id: 'pagar',   label: 'A Pagar',         icon: TrendingDown },
]

// ── FinancialPage (export) ────────────────────────────────────────────────────

export function FinancialPage() {
  const [activeTab, setActiveTab] = React.useState<TabId>('resumo')
  const [summary, setSummary] = React.useState<FinancialSummary | null>(null)
  const [accounts, setAccounts] = React.useState<FinancialAccount[]>([])
  const [loading, setLoading] = React.useState(true)
  const [modalOpen, setModalOpen] = React.useState(false)
  const [modalType, setModalType] = React.useState<'receivable' | 'payable'>('receivable')

  async function loadSummary() {
    setLoading(true)
    try {
      const s = await getFinancialSummary()
      setSummary(s)
      if (!s.isLocked) {
        const a = await getAccounts()
        setAccounts(a)
      }
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { loadSummary() }, [])

  if (!loading && summary?.isLocked) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          title="Financeiro"
          description="Contas a pagar e receber"
          icon={DollarSign}
        />
        <LockedFinancial />
      </div>
    )
  }

  function openModal(type: 'receivable' | 'payable') {
    setModalType(type)
    setModalOpen(true)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Financeiro"
        description="Contas a pagar e receber"
        icon={DollarSign}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => openModal('payable')}>
              <Plus className="h-4 w-4 mr-1" /> A Pagar
            </Button>
            <Button size="sm" onClick={() => openModal('receivable')}>
              <Plus className="h-4 w-4 mr-1" /> A Receber
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Conteúdo */}
      <div className="min-h-[400px]">
        {activeTab === 'resumo' && (
          <ResumoTab
            summary={summary}
            accounts={accounts}
            loading={loading}
            onRefresh={loadSummary}
          />
        )}
        {activeTab === 'receber' && (
          <TransacoesTab type="receivable" onRefresh={loadSummary} />
        )}
        {activeTab === 'pagar' && (
          <TransacoesTab type="payable" onRefresh={loadSummary} />
        )}
      </div>

      {/* Modal */}
      <TransactionModal
        open={modalOpen}
        defaultType={modalType}
        accounts={accounts}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          setModalOpen(false)
          loadSummary()
        }}
      />
    </div>
  )
}
