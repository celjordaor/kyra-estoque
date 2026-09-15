'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'

async function getServerContext() {
  const cookieStore = await cookies()
  const supabase = createServerSupabaseClient(cookieStore)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Não autenticado')
  const admin = createAdminSupabaseClient()
  const { data: profile } = await admin.from('profiles').select('company_id').eq('id', user.id).single()
  if (!profile?.company_id) throw new Error('Empresa não encontrada')
  return { supabase, companyId: profile.company_id, userId: user.id }
}

export type PurchaseOrderStatus = 'draft' | 'sent' | 'confirmed' | 'received' | 'cancelled'

export interface PurchaseSuggestion {
  product_id: string
  product_name: string
  sku: string | null
  stock_quantity: number
  avg_daily_sales: number
  coverage_days: number
  suggested_qty: number
  supplier_id: string | null
  supplier_name: string | null
  is_urgent: boolean
}

export interface PurchaseOrderItem {
  product_id: string
  product_name: string
  quantity: number
  unit_cost: number
}

export interface CreatePurchaseOrderValues {
  supplier_id?: string | null
  expected_delivery_date?: string | null
  notes?: string | null
  freight?: number
  items: PurchaseOrderItem[]
  status: PurchaseOrderStatus
}

export interface PurchaseOrder {
  id: string
  status: PurchaseOrderStatus
  supplier_id: string | null
  supplier_name: string | null
  expected_delivery_date: string | null
  received_at: string | null
  freight: number
  subtotal: number
  total: number
  notes: string | null
  created_at: string
  item_count: number
}

export interface PurchaseOrderItemDetail {
  id: string
  product_id: string
  product_name: string
  quantity: number
  unit_cost: number
  total: number
}

export interface PurchaseOrderDetail extends PurchaseOrder {
  items: PurchaseOrderItemDetail[]
}

export interface ReceiveItemInput {
  product_id: string
  quantity_received: number
  unit_cost: number
}

// ── Suggested purchases (calculado via stock_movements) ────────
export async function getPurchaseSuggestions(): Promise<PurchaseSuggestion[]> {
  const { supabase, companyId } = await getServerContext()

  const DAYS = 30
  const REORDER_HORIZON_DAYS = 15
  const LEAD_TIME_DAYS = 7
  const sinceDate = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: movements } = await supabase
    .from('stock_movements')
    .select('product_id, quantity')
    .eq('company_id', companyId)
    .eq('type', 'SAIDA')
    .gte('created_at', sinceDate)

  const salesMap: Record<string, number> = {}
  for (const m of movements ?? []) {
    salesMap[m.product_id] = (salesMap[m.product_id] ?? 0) + Number(m.quantity)
  }

  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, sku, stock_quantity, min_stock, cost_price, supplier_id, suppliers(name)')
    .eq('company_id', companyId)
    .eq('is_active', true)

  if (error || !products) return []

  const suggestions: PurchaseSuggestion[] = []

  for (const p of products) {
    const totalSold = salesMap[p.id] ?? 0
    const avgDailySales = totalSold / DAYS
    if (avgDailySales <= 0) continue

    const coverageDays = avgDailySales > 0 ? Math.floor(p.stock_quantity / avgDailySales) : 999
    const demandInHorizon = Math.ceil(avgDailySales * REORDER_HORIZON_DAYS)
    const reorderPoint = Math.ceil(avgDailySales * LEAD_TIME_DAYS)

    if (p.stock_quantity <= reorderPoint || coverageDays <= REORDER_HORIZON_DAYS) {
      const suggestedQty = Math.max(demandInHorizon - p.stock_quantity + reorderPoint, 1)
      const supplier = Array.isArray(p.suppliers) ? p.suppliers[0] : p.suppliers

      suggestions.push({
        product_id: p.id,
        product_name: p.name,
        sku: p.sku,
        stock_quantity: p.stock_quantity,
        avg_daily_sales: Math.round(avgDailySales * 100) / 100,
        coverage_days: coverageDays,
        suggested_qty: suggestedQty,
        supplier_id: p.supplier_id ?? null,
        supplier_name: (supplier as { name: string } | null)?.name ?? null,
        is_urgent: coverageDays <= LEAD_TIME_DAYS,
      })
    }
  }

  return suggestions.sort((a, b) => a.coverage_days - b.coverage_days)
}

// ── Get purchase orders list ───────────────────────────────────
export async function getPurchaseOrders(status?: PurchaseOrderStatus): Promise<PurchaseOrder[]> {
  const { supabase } = await getServerContext()

  let query = supabase
    .from('purchase_orders')
    .select('id, status, supplier_id, expected_delivery_date, received_at, freight, subtotal, total, notes, created_at, suppliers(name), purchase_order_items(id)')
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map(o => {
    const supplier = Array.isArray(o.suppliers) ? o.suppliers[0] : o.suppliers
    const items = Array.isArray(o.purchase_order_items) ? o.purchase_order_items : []
    return {
      id: o.id,
      status: o.status as PurchaseOrderStatus,
      supplier_id: o.supplier_id,
      supplier_name: (supplier as { name: string } | null)?.name ?? null,
      expected_delivery_date: o.expected_delivery_date,
      received_at: o.received_at ?? null,
      freight: o.freight,
      subtotal: o.subtotal,
      total: o.total,
      notes: o.notes,
      created_at: o.created_at,
      item_count: items.length,
    }
  })
}

// ── Get purchase order detail (with items) ─────────────────────
export async function getPurchaseOrderDetail(id: string): Promise<PurchaseOrderDetail | null> {
  const { supabase, companyId } = await getServerContext()

  const { data, error } = await supabase
    .from('purchase_orders')
    .select(`
      id, status, supplier_id, expected_delivery_date, received_at,
      freight, subtotal, total, notes, created_at,
      suppliers(name),
      purchase_order_items(id, product_id, quantity, unit_cost, total, products(name))
    `)
    .eq('company_id', companyId)
    .eq('id', id)
    .single()

  if (error || !data) return null

  const supplier = Array.isArray(data.suppliers) ? data.suppliers[0] : data.suppliers
  const rawItems = Array.isArray(data.purchase_order_items) ? data.purchase_order_items : []

  return {
    id: data.id,
    status: data.status as PurchaseOrderStatus,
    supplier_id: data.supplier_id,
    supplier_name: (supplier as { name: string } | null)?.name ?? null,
    expected_delivery_date: data.expected_delivery_date,
    received_at: data.received_at ?? null,
    freight: data.freight,
    subtotal: data.subtotal,
    total: data.total,
    notes: data.notes,
    created_at: data.created_at,
    item_count: rawItems.length,
    items: rawItems.map(item => {
      const prod = Array.isArray((item as { products?: unknown }).products)
        ? ((item as { products: { name: string }[] }).products)[0]
        : (item as { products?: { name: string } | null }).products
      return {
        id: item.id,
        product_id: item.product_id,
        product_name: (prod as { name: string } | null)?.name ?? 'Produto',
        quantity: Number(item.quantity),
        unit_cost: Number(item.unit_cost),
        total: Number(item.total ?? (Number(item.quantity) * Number(item.unit_cost))),
      }
    }),
  }
}

// ── Receive purchase order ─────────────────────────────────────
export async function receivePurchaseOrder(
  orderId: string,
  items: ReceiveItemInput[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, companyId, userId } = await getServerContext()

    const activeItems = items.filter(i => i.quantity_received > 0)
    if (activeItems.length === 0) return { success: false, error: 'Nenhum item para receber' }

    // Create ENTRADA movements for each item received
    const movements = activeItems.map(i => ({
      company_id: companyId,
      product_id: i.product_id,
      type: 'ENTRADA' as const,
      quantity: i.quantity_received,
      unit_cost: i.unit_cost,
      reference_type: 'purchase_order',
      reference_id: orderId,
      notes: 'Recebimento de compra',
      created_by: userId,
    }))

    const { error: movErr } = await supabase.from('stock_movements').insert(movements)
    if (movErr) return { success: false, error: movErr.message }

    // Mark order as received
    const { error: updateErr } = await supabase
      .from('purchase_orders')
      .update({ status: 'received', received_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('company_id', companyId)

    if (updateErr) return { success: false, error: updateErr.message }

    revalidatePath('/purchases')
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ── Create purchase order ──────────────────────────────────────
export async function createPurchaseOrder(
  values: CreatePurchaseOrderValues
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { supabase, companyId, userId } = await getServerContext()

    const subtotal = values.items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0)
    const freight = values.freight ?? 0
    const total = subtotal + freight

    const { data: order, error: orderError } = await supabase
      .from('purchase_orders')
      .insert({
        company_id: companyId,
        supplier_id: values.supplier_id ?? null,
        expected_delivery_date: values.expected_delivery_date ?? null,
        notes: values.notes ?? null,
        freight,
        subtotal,
        total,
        status: values.status,
        created_by: userId,
      })
      .select('id')
      .single()

    if (orderError || !order) return { success: false, error: orderError?.message ?? 'Erro ao criar pedido' }

    const itemsPayload = values.items.map(item => ({
      purchase_order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
    }))

    const { error: itemsError } = await supabase.from('purchase_order_items').insert(itemsPayload)
    if (itemsError) return { success: false, error: itemsError.message }

    revalidatePath('/purchases')
    return { success: true, id: order.id }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ── Cancel purchase order ──────────────────────────────────────
export async function cancelPurchaseOrder(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, companyId } = await getServerContext()

    // Only draft orders can be cancelled
    const { data: order } = await supabase
      .from('purchase_orders')
      .select('status')
      .eq('id', id)
      .eq('company_id', companyId)
      .single()

    if (!order) return { success: false, error: 'Pedido não encontrado' }
    if (order.status !== 'draft') return { success: false, error: 'Apenas rascunhos podem ser cancelados' }

    const { error } = await supabase
      .from('purchase_orders')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('company_id', companyId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/purchases')
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ── Advance purchase order status (draft → sent) ───────────────
export async function advancePurchaseOrderStatus(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, companyId } = await getServerContext()

    const { data: order } = await supabase
      .from('purchase_orders')
      .select('status')
      .eq('id', id)
      .eq('company_id', companyId)
      .single()

    if (!order) return { success: false, error: 'Pedido não encontrado' }

    const transitions: Record<string, string> = { draft: 'sent', sent: 'confirmed' }
    const next = transitions[order.status]
    if (!next) return { success: false, error: `Status "${order.status}" não pode ser avançado` }

    const { error } = await supabase
      .from('purchase_orders')
      .update({ status: next })
      .eq('id', id)
      .eq('company_id', companyId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/purchases')
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}
