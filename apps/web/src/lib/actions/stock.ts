'use server'

import { revalidatePath } from 'next/cache'
import { completeCheckpoint } from '@/lib/actions/onboarding'
import { cookies } from 'next/headers'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'

type StockFilter = 'all' | 'low' | 'out' | 'slow' | 'excess' | 'fast'

async function getServerContext() {
  const cookieStore = await cookies()
  const supabase = createServerSupabaseClient(cookieStore)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Não autenticado')
  const admin = createAdminSupabaseClient()
  const { data: profileData } = await (admin as any).from('profiles').select('company_id').eq('id', user.id).single()
  const profile = profileData as { company_id: string | null } | null
  if (!profile?.company_id) throw new Error('Empresa não encontrada')
  return { supabase, companyId: profile.company_id as string }
}

// ── Helpers de status ────────────────────────────────────────
const SLOW_DAYS = 30  // dias sem venda = "Parado"

function calcStatus(
  stockQty: number,
  minStock: number | null,
  maxStock: number | null,
  avgDailySales: number,    // calculado a partir de movimentos reais
  hadSalesIn30Days: boolean, // teve pelo menos 1 saída nos últimos 30 dias
  createdAt: string          // data de cadastro do produto
): 'healthy' | 'low' | 'out' | 'slow' | 'excess' | 'fast' {
  if (stockQty <= 0) return 'out'

  // Produto novo (cadastrado há menos de 30 dias): nunca marca como Parado
  const ageMs = Date.now() - new Date(createdAt).getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  const isMatureProduct = ageDays >= SLOW_DAYS

  // Parado: produto maduro sem nenhuma saída nos últimos 30 dias
  if (isMatureProduct && !hadSalesIn30Days) return 'slow'

  const coverage = avgDailySales > 0 ? Math.floor(stockQty / avgDailySales) : null

  // Excesso: atingiu ou passou 90% do estoque máximo definido
  if (maxStock && stockQty >= maxStock * 0.9) return 'excess'

  // Estoque baixo: abaixo do mínimo OU cobertura < 7 dias
  if (stockQty <= (minStock ?? 0)) return 'low'
  if (coverage !== null && coverage < 7) return 'low'

  // Saída rápida: cobertura < 14 dias (gira muito)
  if (coverage !== null && coverage < 14) return 'fast'

  return 'healthy'
}

// ── Get products with stock info ───────────────────────────────
export async function getStockProducts(filter?: StockFilter) {
  const { supabase, companyId } = await getServerContext()

  const DAYS = SLOW_DAYS
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString()

  // Busca produtos e movimentos SAIDA dos últimos 30 dias em paralelo
  const [{ data: products, error }, { data: movements }] = await Promise.all([
    (supabase as any)
      .from('products')
      .select('id, name, sku, cost_price, stock_quantity, min_stock, max_stock, is_active, unit, created_at')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name'),
    (supabase as any)
      .from('stock_movements')
      .select('product_id, quantity')
      .eq('company_id', companyId)
      .eq('type', 'SAIDA')
      .gte('created_at', since),
  ])

  if (error) throw new Error((error as any).message ?? String(error))

  // Mapa: product_id → total vendido nos últimos 30 dias
  const salesMap: Record<string, number> = {}
  for (const m of movements ?? []) {
    salesMap[m.product_id] = (salesMap[m.product_id] ?? 0) + Number(m.quantity)
  }

  return (products ?? []).map((p: any) => {
    const totalSold = salesMap[p.id] ?? 0
    const avgDailySales = totalSold / DAYS
    const hadSalesIn30Days = totalSold > 0
    const coverage = avgDailySales > 0 ? Math.floor(p.stock_quantity / avgDailySales) : null

    const status = calcStatus(p.stock_quantity, p.min_stock, p.max_stock, avgDailySales, hadSalesIn30Days, p.created_at)
    const stock_value = p.stock_quantity * (p.cost_price ?? 0)

    if (filter && filter !== 'all') {
      if (filter === 'low'    && status !== 'low')    return null
      if (filter === 'out'    && status !== 'out')    return null
      if (filter === 'slow'   && status !== 'slow')   return null
      if (filter === 'excess' && status !== 'excess') return null
      if (filter === 'fast'   && status !== 'fast')   return null
    }

    return { ...p, coverage, status, stock_value, avg_daily_sales: avgDailySales }
  }).filter(Boolean)
}

// ── Get stock summary ─────────────────────────────────────────
export async function getStockSummary() {
  const { supabase, companyId } = await getServerContext()

  const DAYS = SLOW_DAYS
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: items, error }, { data: movements }] = await Promise.all([
    (supabase as any)
      .from('products')
      .select('id, stock_quantity, cost_price, min_stock, max_stock, is_active')
      .eq('company_id', companyId)
      .eq('is_active', true),
    (supabase as any)
      .from('stock_movements')
      .select('product_id, quantity')
      .eq('company_id', companyId)
      .eq('type', 'SAIDA')
      .gte('created_at', since),
  ])

  if (error) throw new Error((error as any).message ?? String(error))

  const salesMap: Record<string, number> = {}
  for (const m of movements ?? []) {
    salesMap[m.product_id] = (salesMap[m.product_id] ?? 0) + Number(m.quantity)
  }

  const totalValue = (items ?? []).reduce((s: number, p: any) => s + p.stock_quantity * (p.cost_price ?? 0), 0)
  const totalProducts = (items ?? []).length

  const lowStock = (items ?? []).filter((p: any) => {
    if (p.stock_quantity <= 0) return false
    const avg = (salesMap[p.id] ?? 0) / DAYS
    const coverage = avg > 0 ? Math.floor(p.stock_quantity / avg) : null
    return p.stock_quantity <= (p.min_stock ?? 0) || (coverage !== null && coverage < 7)
  }).length

  const slowMoving = (items ?? []).filter((p: any) =>
    p.stock_quantity > 0 && (salesMap[p.id] ?? 0) === 0
  ).length

  return { totalValue, totalProducts, lowStock, slowMoving }
}

// ── Get stock movements ───────────────────────────────────────
export async function getStockMovements(filters: { product_id?: string; type?: string; limit?: number } = {}) {
  const { supabase, companyId } = await getServerContext()
  const { limit = 50 } = filters

  let query = (supabase as any)
    .from('stock_movements')
    .select('id, type, quantity, unit_cost, notes, created_at, reference_type, reference_id, products(name, sku), profiles!created_by(full_name)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (filters.product_id) query = query.eq('product_id', filters.product_id)
  if (filters.type) query = query.eq('type', filters.type)

  const { data, error } = await query
  if (error) throw new Error((error as any).message ?? String(error))
  return data ?? []
}

// ── Create stock movement ─────────────────────────────────────
export async function createStockMovement(values: {
  product_id: string
  type: 'ENTRADA' | 'SAIDA' | 'AJUSTE' | 'INVENTARIO' | 'TRANSFERENCIA'
  quantity: number
  notes?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, companyId } = await getServerContext()

    // Get current stock
    const { data: product, error: prodError } = await (supabase as any)
      .from('products')
      .select('id, stock_quantity, cost_price')
      .eq('id', values.product_id)
      .eq('company_id', companyId)
      .single()

    if (prodError || !product) return { success: false, error: 'Produto não encontrado' }

    const delta = values.type === 'SAIDA' ? -Math.abs(values.quantity) :
                  values.type === 'INVENTARIO' ? (values.quantity - product.stock_quantity) :
                  values.quantity

    const { error: movError } = await (supabase as any).from('stock_movements').insert({
      company_id: companyId,
      product_id: values.product_id,
      type: values.type,
      quantity: Math.abs(delta),
      unit_cost: product.cost_price ?? 0,
      notes: values.notes ?? null,
      reference_type: 'manual',
    })

    if (movError) return { success: false, error: (movError as any).message ?? String(movError) }

    // Update cache
    const newQty = values.type === 'INVENTARIO' ? values.quantity : product.stock_quantity + delta
    await (supabase as any).from('products').update({ stock_quantity: Math.max(0, newQty) }).eq('id', values.product_id)

    revalidatePath('/stock')
    // D3: estoque_configurado — silencioso
    completeCheckpoint(companyId, 'estoque_configurado').catch(() => {})
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}
