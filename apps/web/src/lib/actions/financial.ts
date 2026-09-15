'use server'

import { cookies } from 'next/headers'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'
import { hasFeature } from '@kyra/business-rules'
import { getBillingProvider } from '@kyra/business-rules'

// ── Context ───────────────────────────────────────────────────────────────────

async function getServerContext() {
  const cookieStore = await cookies()
  const supabase = createServerSupabaseClient(cookieStore)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Não autenticado')
  const admin = createAdminSupabaseClient()
  const { data: profileData } = await (admin as any)
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()
  const profile = profileData as { company_id: string | null } | null
  if (!profile?.company_id) throw new Error('Empresa não encontrada')
  return { supabase, admin, companyId: profile.company_id as string }
}

async function assertFinancialEnabled() {
  const ctx = await getServerContext()
  const enabled = await hasFeature(ctx.companyId, 'financial.enabled')
  if (!enabled) throw new Error('FEATURE_LOCKED')
  return ctx
}

// ── tipos ─────────────────────────────────────────────────────────────────────

export type FinancialSummary = {
  isLocked: boolean
  totalReceivable: number
  totalPayable: number
  overdueReceivable: number
  overduePayable: number
  netBalance: number
  upcoming7Days: number
}

export type FinancialTransaction = {
  id: string
  type: 'receivable' | 'payable'
  description: string
  amount_cents: number
  due_date: string
  paid_at: string | null
  status: 'pending' | 'paid' | 'overdue' | 'canceled'
  category: string | null
  reference_type: string | null
  provider_charge_id: string | null
  created_at: string
}

export type FinancialAccount = {
  id: string
  name: string
  type: 'checking' | 'cash' | 'savings'
  balance_cents: number
  is_default: boolean
}

// ── getFinancialSummary ───────────────────────────────────────────────────────

export async function getFinancialSummary(): Promise<FinancialSummary> {
  let ctx: Awaited<ReturnType<typeof getServerContext>>
  try {
    ctx = await assertFinancialEnabled()
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'FEATURE_LOCKED') {
      return { isLocked: true, totalReceivable: 0, totalPayable: 0, overdueReceivable: 0, overduePayable: 0, netBalance: 0, upcoming7Days: 0 }
    }
    throw e
  }

  const { supabase, companyId } = ctx
  const { data: txs } = await (supabase as any)
    .from('financial_transactions')
    .select('type, amount_cents, status, due_date')
    .eq('company_id', companyId)
    .neq('status', 'canceled')

  const today = new Date()
  const in7Days = new Date(today)
  in7Days.setDate(in7Days.getDate() + 7)
  const todayStr = today.toISOString().slice(0, 10)
  const in7DaysStr = in7Days.toISOString().slice(0, 10)

  let totalReceivable = 0, totalPayable = 0
  let overdueReceivable = 0, overduePayable = 0
  let upcoming7Days = 0

  for (const tx of txs ?? []) {
    if (tx.status === 'paid') continue
    const overdue = tx.due_date < todayStr
    const soonDue = tx.due_date >= todayStr && tx.due_date <= in7DaysStr

    if (tx.type === 'receivable') {
      totalReceivable += tx.amount_cents
      if (overdue) overdueReceivable += tx.amount_cents
      if (soonDue) upcoming7Days += tx.amount_cents
    } else {
      totalPayable += tx.amount_cents
      if (overdue) overduePayable += tx.amount_cents
      if (soonDue) upcoming7Days += tx.amount_cents
    }
  }

  return { isLocked: false, totalReceivable, totalPayable, overdueReceivable, overduePayable, netBalance: totalReceivable - totalPayable, upcoming7Days }
}

// ── getTransactions ───────────────────────────────────────────────────────────

export async function getTransactions(params?: {
  type?: 'receivable' | 'payable'
  status?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}): Promise<{ rows: FinancialTransaction[]; total: number }> {
  const { supabase, companyId } = await assertFinancialEnabled()

  const page = params?.page ?? 0
  const pageSize = params?.pageSize ?? 50

  let query = (supabase as any)
    .from('financial_transactions')
    .select('*', { count: 'exact' })
    .eq('company_id', companyId)
    .order('due_date', { ascending: true })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (params?.type) query = query.eq('type', params.type)
  if (params?.status && params.status !== 'all') query = query.eq('status', params.status)
  if (params?.dateFrom) query = query.gte('due_date', params.dateFrom)
  if (params?.dateTo) query = query.lte('due_date', params.dateTo)

  const { data, count } = await query
  return { rows: (data ?? []) as FinancialTransaction[], total: count ?? 0 }
}

// ── getAccounts ───────────────────────────────────────────────────────────────

export async function getAccounts(): Promise<FinancialAccount[]> {
  const { supabase, companyId } = await assertFinancialEnabled()

  const { data } = await (supabase as any)
    .from('financial_accounts')
    .select('*')
    .eq('company_id', companyId)
    .order('is_default', { ascending: false })
    .order('name')

  return (data ?? []) as FinancialAccount[]
}

// ── createAccount ─────────────────────────────────────────────────────────────

export async function createAccount(data: {
  name: string
  type: 'checking' | 'cash' | 'savings'
  balance_cents?: number
}): Promise<{ data?: FinancialAccount; error?: string }> {
  const { supabase, companyId } = await assertFinancialEnabled()

  const { data: account, error } = await (supabase as any)
    .from('financial_accounts')
    .insert({ company_id: companyId, name: data.name, type: data.type, balance_cents: data.balance_cents ?? 0 })
    .select()
    .single()

  if (error) return { error: (error as any).message ?? String(error) }
  return { data: account as FinancialAccount }
}

// ── createTransaction ─────────────────────────────────────────────────────────

export async function createTransaction(data: {
  type: 'receivable' | 'payable'
  description: string
  amount_cents: number
  due_date: string
  account_id?: string
  category?: string
  reference_id?: string
  reference_type?: 'sale' | 'purchase' | 'manual'
  generate_charge?: boolean
  billing_type?: 'BOLETO' | 'PIX'
  customer_asaas_id?: string
}): Promise<{ data?: FinancialTransaction; charge?: { bankSlipUrl?: string; pixCopyPaste?: string }; error?: string }> {
  const { supabase, companyId } = await assertFinancialEnabled()

  let providerChargeId: string | undefined
  let chargeResult: { bankSlipUrl?: string; pixCopyPaste?: string } | undefined

  if (data.generate_charge && data.type === 'receivable' && data.customer_asaas_id) {
    try {
      const provider = getBillingProvider()
      const result = await provider.createCharge({
        customerId: data.customer_asaas_id,
        description: data.description,
        amountCents: data.amount_cents,
        dueDate: data.due_date,
        billingType: data.billing_type ?? 'PIX',
        externalReference: companyId,
      })
      providerChargeId = result.chargeId
      chargeResult = { bankSlipUrl: result.bankSlipUrl, pixCopyPaste: result.pixCopyPaste }
    } catch (e) {
      console.error('[financial] Asaas charge error:', e)
    }
  }

  const { data: tx, error } = await (supabase as any)
    .from('financial_transactions')
    .insert({
      company_id: companyId,
      account_id: data.account_id,
      type: data.type,
      description: data.description,
      amount_cents: data.amount_cents,
      due_date: data.due_date,
      category: data.category,
      reference_id: data.reference_id,
      reference_type: data.reference_type ?? 'manual',
      provider_charge_id: providerChargeId,
    })
    .select()
    .single()

  if (error) return { error: (error as any).message ?? String(error) }
  return { data: tx as FinancialTransaction, charge: chargeResult }
}

// ── markAsPaid ────────────────────────────────────────────────────────────────

export async function markAsPaid(transactionId: string, paidAt?: string): Promise<{ error?: string }> {
  const { supabase, companyId } = await assertFinancialEnabled()

  const { error } = await (supabase as any)
    .from('financial_transactions')
    .update({ status: 'paid', paid_at: paidAt ?? new Date().toISOString() })
    .eq('id', transactionId)
    .eq('company_id', companyId)

  if (error) return { error: (error as any).message ?? String(error) }
  return {}
}

// ── cancelTransaction ─────────────────────────────────────────────────────────

export async function cancelTransaction(transactionId: string): Promise<{ error?: string }> {
  const { supabase, companyId } = await assertFinancialEnabled()

  const { data: tx } = await (supabase as any)
    .from('financial_transactions')
    .select('provider_charge_id')
    .eq('id', transactionId)
    .eq('company_id', companyId)
    .single()

  if (tx?.provider_charge_id) {
    try {
      const provider = getBillingProvider()
      await provider.cancelCharge(tx.provider_charge_id)
    } catch (e) {
      console.error('[financial] Asaas cancel error:', e)
    }
  }

  const { error } = await (supabase as any)
    .from('financial_transactions')
    .update({ status: 'canceled' })
    .eq('id', transactionId)
    .eq('company_id', companyId)

  if (error) return { error: (error as any).message ?? String(error) }
  return {}
}

// ── exportFinancialCsv ────────────────────────────────────────────────────────

export async function exportFinancialCsv(type?: 'receivable' | 'payable'): Promise<string> {
  const { rows } = await getTransactions({ type, pageSize: 5000 })

  const headers = ['Tipo', 'Descrição', 'Valor (R$)', 'Vencimento', 'Status', 'Categoria', 'Referência', 'Pago em']
  const csvRows = rows.map(r => [
    r.type === 'receivable' ? 'A Receber' : 'A Pagar',
    `"${r.description.replace(/"/g, '""')}"`,
    (r.amount_cents / 100).toFixed(2).replace('.', ','),
    r.due_date,
    r.status,
    r.category ?? '',
    r.reference_type ?? '',
    r.paid_at ? r.paid_at.slice(0, 10) : '',
  ].join(';'))

  return [headers.join(';'), ...csvRows].join('\n')
}
