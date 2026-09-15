'use server'

import { cookies } from 'next/headers'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'

async function getServerContext() {
  const cookieStore = await cookies()
  const supabase = createServerSupabaseClient(cookieStore)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Não autenticado')
  const admin = createAdminSupabaseClient()
  const { data: profileData } = await (admin as any).from('profiles').select('company_id').eq('id', user.id).single()
  const profile = profileData as { company_id: string | null } | null
  if (!profile?.company_id) throw new Error('Empresa não encontrada')
  return { supabase, companyId: profile.company_id as string, userId: user.id }
}

export type SaleStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED'
export type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX' | 'BOLETO' | 'TRANSFER' | 'OTHER'

export interface Sale {
  id: string
  sale_number: string
  status: SaleStatus
  customer_name: string | null
  customer_email: string | null
  subtotal: number
  discount_amount: number
  total_amount: number
  cost_total: number
  margin: number | null
  payment_method: PaymentMethod | null
  paid_at: string | null
  notes: string | null
  created_at: string
  created_by: string | null
  creator_name: string | null
  item_count: number
}

export interface SaleItemDetail {
  id: string
  product_id: string
  product_name: string
  product_sku: string | null
  unit: string
  quantity: number
  unit_price: number
  unit_cost: number
  discount_amount: number
  total_price: number
  total_cost: number
  margin: number | null
}

export interface NfeEmissionDoc {
  id: string
  status: string
  pdf_url: string | null
}

export interface SaleDetail extends Sale {
  customer_phone: string | null
  items: SaleItemDetail[]
  nfe_emission: NfeEmissionDoc | null
}

export interface SalesFilters {
  status?: SaleStatus | 'all'
  search?: string
  from?: string
  to?: string
  page?: number
  per_page?: number
}

export interface SalesSummary {
  total_revenue: number
  total_sales: number
  avg_ticket: number
  total_margin: number | null
}

// ── List sales ────────────────────────────────────────────────
export async function getSales(filters: SalesFilters = {}): Promise<{ data: Sale[]; total: number }> {
  const { supabase, companyId } = await getServerContext()
  const { status = 'all', search, from, to, page = 1, per_page = 50 } = filters
  const start = (page - 1) * per_page
  const end = start + per_page - 1

  let query = (supabase as any)
    .from('sales')
    .select(`
      id, sale_number, status, customer_name, customer_email,
      subtotal, discount_amount, total_amount, cost_total, margin,
      payment_method, paid_at, notes, created_at, created_by
    `, { count: 'exact' })
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .range(start, end)

  if (status !== 'all') query = query.eq('status', status)
  if (search) query = query.or(`sale_number.ilike.%${search}%,customer_name.ilike.%${search}%`)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  return {
    data: (data ?? []).map((s: any) => ({
      id: s.id,
      sale_number: s.sale_number,
      status: s.status as SaleStatus,
      customer_name: s.customer_name,
      customer_email: s.customer_email,
      subtotal: s.subtotal,
      discount_amount: s.discount_amount,
      total_amount: s.total_amount,
      cost_total: s.cost_total,
      margin: s.margin,
      payment_method: s.payment_method as PaymentMethod | null,
      paid_at: s.paid_at,
      notes: s.notes,
      created_at: s.created_at,
      created_by: s.created_by,
      creator_name: null,
      item_count: 0,
    })),
    total: count ?? 0,
  }
}

// ── Sales summary ─────────────────────────────────────────────
export async function getSalesSummary(from?: string, to?: string): Promise<SalesSummary> {
  const { supabase, companyId } = await getServerContext()

  let query = (supabase as any)
    .from('sales')
    .select('total_amount, cost_total, margin')
    .eq('company_id', companyId)
    .eq('status', 'COMPLETED')

  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)

  const { data } = await query

  if (!data || data.length === 0) {
    return { total_revenue: 0, total_sales: 0, avg_ticket: 0, total_margin: null }
  }

  const total_revenue = data.reduce((s: any, r: any) => s + r.total_amount, 0)
  const total_sales = data.length
  const avg_ticket = total_sales > 0 ? total_revenue / total_sales : 0
  const margins = data.filter((r: any) => r.margin !== null)
  const total_margin = margins.length > 0
    ? margins.reduce((s: any, r: any) => s + (r.margin ?? 0), 0) / margins.length
    : null

  return { total_revenue, total_sales, avg_ticket, total_margin }
}

// ── Get sale detail (with items) ──────────────────────────────
export async function getSaleDetail(id: string): Promise<SaleDetail | null> {
  const { supabase, companyId } = await getServerContext()

  const { data, error } = await (supabase as any)
    .from('sales')
    .select(`
      id, sale_number, status, customer_name, customer_email, customer_phone,
      subtotal, discount_amount, total_amount, cost_total, margin,
      payment_method, paid_at, notes, created_at, created_by,
      sale_items(
        id, product_id, product_name, product_sku, unit,
        quantity, unit_price, unit_cost, discount_amount,
        total_price, total_cost, margin
      )
    `)
    .eq('company_id', companyId)
    .eq('id', id)
    .single()

  if (error || !data) return null

  const items = Array.isArray(data.sale_items) ? data.sale_items : []

  // Fetch linked emission NF-e (if any)
  const { data: nfeRow } = await (supabase as any)
    .from('nfe_documents')
    .select('id, status, pdf_url')
    .eq('company_id', companyId)
    .eq('sale_id', id)
    .eq('doc_type', 'emission')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nfe_emission: NfeEmissionDoc | null = nfeRow
    ? { id: nfeRow.id, status: nfeRow.status, pdf_url: nfeRow.pdf_url }
    : null

  return {
    id: data.id,
    sale_number: data.sale_number,
    status: data.status as SaleStatus,
    customer_name: data.customer_name,
    customer_email: data.customer_email,
    customer_phone: (data as { customer_phone?: string | null }).customer_phone ?? null,
    subtotal: data.subtotal,
    discount_amount: data.discount_amount,
    total_amount: data.total_amount,
    cost_total: data.cost_total,
    margin: data.margin,
    payment_method: data.payment_method as PaymentMethod | null,
    paid_at: data.paid_at,
    notes: data.notes,
    created_at: data.created_at,
    created_by: data.created_by,
    creator_name: null,
    item_count: items.length,
    nfe_emission,
    items: items.map((item: any) => ({
      id: item.id,
      product_id: item.product_id,
      product_name: item.product_name,
      product_sku: item.product_sku,
      unit: item.unit,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
      unit_cost: Number(item.unit_cost),
      discount_amount: Number(item.discount_amount),
      total_price: Number(item.total_price),
      total_cost: Number(item.total_cost),
      margin: item.margin ?? null,
    })),
  }
}

// ── Refund sale ───────────────────────────────────────────────
export async function refundSale(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, companyId, userId } = await getServerContext()

    // Fetch sale + items
    const { data: sale, error: saleErr } = await (supabase as any)
      .from('sales')
      .select('id, status, sale_items(product_id, quantity, unit_cost)')
      .eq('company_id', companyId)
      .eq('id', id)
      .single()

    if (saleErr || !sale) return { success: false, error: 'Venda não encontrada' }
    if (sale.status !== 'COMPLETED') return { success: false, error: 'Apenas vendas concluídas podem ser devolvidas' }

    const items = Array.isArray(sale.sale_items) ? sale.sale_items : []

    // Create DEVOLUCAO movements to return stock
    if (items.length > 0) {
      const movements = items.map((item: any) => ({
        company_id: companyId,
        product_id: item.product_id,
        type: 'DEVOLUCAO' as const,
        quantity: Number(item.quantity),
        unit_cost: Number(item.unit_cost),
        reference_type: 'sale',
        reference_id: id,
        notes: 'Devolução de venda',
        created_by: userId,
      }))

      const { error: movErr } = await (supabase as any).from('stock_movements').insert(movements)
      if (movErr) return { success: false, error: movErr.message }
    }

    // Update sale status to REFUNDED
    const { error: updateErr } = await (supabase as any)
      .from('sales')
      .update({ status: 'REFUNDED' })
      .eq('id', id)
      .eq('company_id', companyId)

    if (updateErr) return { success: false, error: updateErr.message }

    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ── Create sale (PDV) ─────────────────────────────────────────
export interface SaleItemInput {
  product_id: string
  product_name: string
  product_sku: string | null
  unit: string
  quantity: number
  unit_price: number
  unit_cost: number
  discount_amount: number
}

export interface CreateSaleInput {
  items: SaleItemInput[]
  customer_name?: string
  customer_phone?: string
  payment_method: PaymentMethod
  discount_amount?: number
  coupon_code?: string
  notes?: string
}

export async function createSale(input: CreateSaleInput): Promise<{ id: string; sale_number: string }> {
  const { supabase, companyId } = await getServerContext()
  const { data: { user } } = await supabase.auth.getUser()

  if (!input.items || input.items.length === 0) throw new Error('Carrinho vazio')

  // ── Enforce operation settings ──────────────────────────────
  const { data: company } = await (supabase as any)
    .from('companies')
    .select('require_customer, allow_negative_stock')
    .eq('id', companyId)
    .single()

  if (company?.require_customer && !input.customer_name?.trim()) {
    throw new Error('Cliente é obrigatório para finalizar a venda. Configure em Configurações > Operação.')
  }

  if (company && !company.allow_negative_stock) {
    // Verify sufficient stock for each item
    const productIds = input.items.map(i => i.product_id)
    const { data: products } = await (supabase as any)
      .from('products')
      .select('id, name, stock_quantity')
      .eq('company_id', companyId)
      .in('id', productIds)

    if (products) {
      for (const item of input.items) {
        const prod = products.find((p: any) => p.id === item.product_id)
        if (prod && prod.stock_quantity < item.quantity) {
          throw new Error(
            `Estoque insuficiente para "${item.product_name}": disponível ${prod.stock_quantity}, solicitado ${item.quantity}. Ative "Permitir estoque negativo" em Configurações > Operação.`
          )
        }
      }
    }
  }
  // ─────────────────────────────────────────────────────────────

  const { data: numData, error: numErr } = await (supabase as any)
    .rpc('generate_sale_number' as any, { p_company_id: companyId } as any)
  if (numErr) throw new Error(numErr.message)
  const sale_number = numData as string

  const subtotal = input.items.reduce((acc, it) => {
    return acc + (it.unit_price * it.quantity - it.discount_amount)
  }, 0)
  const discount_amount = input.discount_amount ?? 0
  const total_amount = Math.max(0, subtotal - discount_amount)
  const cost_total = input.items.reduce((acc, it) => acc + it.unit_cost * it.quantity, 0)
  const margin = total_amount > 0 ? Math.round(((total_amount - cost_total) / total_amount) * 100 * 100) / 100 : 0

  const { data: sale, error: saleErr } = await (supabase as any)
    .from('sales')
    .insert({
      company_id: companyId,
      sale_number,
      status: 'COMPLETED',
      customer_name: input.customer_name || null,
      customer_phone: input.customer_phone || null,
      subtotal,
      discount_amount,
      total_amount,
      cost_total,
      margin,
      payment_method: input.payment_method,
      paid_at: new Date().toISOString(),
      notes: input.notes || null,
      created_by: user?.id || null,
    })
    .select('id, sale_number')
    .single()

  if (saleErr || !sale) throw new Error(saleErr?.message ?? 'Erro ao criar venda')

  if (input.coupon_code) {
    try {
      const code = input.coupon_code.trim()
      const { data: couponRow } = await (supabase as any)
        .from('discount_coupons')
        .select('id, uses_count')
        .eq('company_id', companyId)
        .ilike('code', code)
        .single()
      if (couponRow) {
        await (supabase as any)
          .from('discount_coupons')
          .update({ uses_count: couponRow.uses_count + 1 })
          .eq('id', couponRow.id)
      }
    } catch { /* silencioso */ }
  }

  const saleItems = input.items.map(it => {
    const total_price = it.unit_price * it.quantity - it.discount_amount
    const total_cost = it.unit_cost * it.quantity
    const item_margin = total_price > 0 ? Math.round(((total_price - total_cost) / total_price) * 100 * 100) / 100 : 0
    return {
      sale_id: sale.id,
      company_id: companyId,
      product_id: it.product_id,
      product_name: it.product_name,
      product_sku: it.product_sku,
      unit: it.unit,
      quantity: it.quantity,
      unit_price: it.unit_price,
      unit_cost: it.unit_cost,
      discount_amount: it.discount_amount,
      total_price,
      total_cost,
      margin: item_margin,
    }
  })

  const { error: itemsErr } = await (supabase as any).from('sale_items').insert(saleItems)
  if (itemsErr) throw new Error(itemsErr.message)

  return { id: sale.id, sale_number: sale.sale_number }
}

// ── Search products for PDV ───────────────────────────────────
export interface PdvProduct {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  unit: string
  sale_price: number
  cost_price: number
  stock_quantity: number
  image_url: string | null
}

export interface PdvCategory {
  id: string
  name: string
}

export async function getCategoriesForPdv(): Promise<PdvCategory[]> {
  const { supabase, companyId } = await getServerContext()
  const { data } = await (supabase as any)
    .from('categories')
    .select('id, name')
    .eq('company_id', companyId)
    .order('name', { ascending: true })
  return (data ?? []) as PdvCategory[]
}

export async function searchProductsForPdv(q: string, categoryId?: string): Promise<PdvProduct[]> {
  const { supabase, companyId } = await getServerContext()

  let query = (supabase as any)
    .from('products')
    .select('id, name, sku, barcode, unit, sale_price, cost_price, stock_quantity, image_url')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(60)

  if (q.trim()) {
    query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,barcode.eq.${q}`)
  }

  if (categoryId) {
    query = query.eq('category_id', categoryId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []) as PdvProduct[]
}

// ── Search customers for PDV ──────────────────────────────────
export interface PdvCustomer {
  id: string
  name: string
  phone: string | null
  email: string | null
  document: string | null
}

export async function searchCustomersForPdv(q: string): Promise<PdvCustomer[]> {
  const { supabase, companyId } = await getServerContext()

  let query = (supabase as any)
    .from('customers')
    .select('id, name, phone, email, document')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(8)

  if (q.trim()) {
    query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,document.ilike.%${q}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as PdvCustomer[]
}

// ── Validate coupon ────────────────────────────────────────────
export interface CouponValidation {
  valid: boolean
  error?: string
  code?: string
  description?: string | null
  discount_type?: 'percent' | 'fixed'
  discount_value?: number
  min_order_value?: number
}

export async function validateCoupon(code: string, orderValue: number): Promise<CouponValidation> {
  try {
    const { supabase, companyId } = await getServerContext()

    const { data: coupon, error } = await (supabase as any)
      .from('discount_coupons')
      .select('code, description, discount_type, discount_value, min_order_value, max_uses, uses_count, expires_at, is_active')
      .eq('company_id', companyId)
      .ilike('code', code.trim())
      .single()

    if (error || !coupon) return { valid: false, error: 'Cupom não encontrado' }
    if (!coupon.is_active) return { valid: false, error: 'Cupom inativo' }
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return { valid: false, error: 'Cupom expirado' }
    }
    if (coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses) {
      return { valid: false, error: 'Cupom esgotado' }
    }
    if (coupon.min_order_value && orderValue < coupon.min_order_value) {
      return { valid: false, error: `Pedido mínimo para este cupom: R$ ${Number(coupon.min_order_value).toFixed(2).replace('.', ',')}` }
    }

    return {
      valid: true,
      code: coupon.code,
      description: coupon.description,
      discount_type: coupon.discount_type as 'percent' | 'fixed',
      discount_value: Number(coupon.discount_value),
      min_order_value: Number(coupon.min_order_value ?? 0),
    }
  } catch {
    return { valid: false, error: 'Erro ao validar cupom' }
  }
}
