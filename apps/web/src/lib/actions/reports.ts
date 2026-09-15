'use server'

import { cookies } from 'next/headers'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'
import { hasFeature } from '@kyra/business-rules'

// ── Context ───────────────────────────────────────────────────

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

// ── Types ─────────────────────────────────────────────────────

export interface StockReportRow {
  id: string; name: string; sku: string | null; category: string | null
  stock: number; min_stock: number; unit: string
  cost_price: number; sale_price: number; stock_value: number
  status: 'OK' | 'BAIXO' | 'ZERADO'
}

export interface MovementReportRow {
  id: string; product_name: string; sku: string | null
  movement_type: string; quantity: number; notes: string | null
  created_at: string; category: string | null
}

export interface AbcRow {
  rank: number; product_id: string; name: string; sku: string | null
  category: string; total_revenue: number; revenue_pct: number
  cumulative_pct: number; curve: 'A' | 'B' | 'C'
  total_sold_qty: number; total_gross_profit: number
}

export interface SalesReportRow {
  date: string; sales_count: number; total_revenue: number; avg_ticket: number
}

export interface SalesProductRow {
  product_id: string; name: string; category: string
  qty_sold: number; revenue: number; profit: number; margin_pct: number
}

export interface PurchasesReportRow {
  id: string; order_number: string; supplier: string | null
  status: string; total_amount: number; items_count: number; created_at: string
}

export interface SlowMovingRow {
  id: string; name: string; sku: string | null; category: string | null
  stock: number; cost_price: number; stock_value: number
  last_movement: string | null; days_stopped: number
}

export interface MarginRow {
  product_id: string; name: string; sku: string | null; category: string
  cost_price: number; sale_price: number; margin_brl: number; margin_pct: number
  total_sold_qty: number; total_revenue: number; total_profit: number
}

// ── 1. Estoque atual ──────────────────────────────────────────

export async function getStockReport(filters?: {
  category?: string; status?: 'ZERADO' | 'BAIXO' | 'OK' | 'all'
}): Promise<{ rows: StockReportRow[]; summary: { total_items: number; total_value: number; alerts: number } }> {
  const { admin, companyId } = await getServerContext()

  let q = (admin as any)
    .from('products')
    .select('id, name, sku, stock_quantity, min_stock, unit, cost_price, sale_price, category:categories(name)')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name')

  if (filters?.category) q = q.eq('categories.name', filters.category)

  const { data } = await q
  let rows: StockReportRow[] = (data ?? []).map((p: any) => {
    const status: StockReportRow['status'] =
      p.stock_quantity <= 0 ? 'ZERADO' :
      p.min_stock > 0 && p.stock_quantity <= p.min_stock ? 'BAIXO' : 'OK'
    return {
      id: p.id, name: p.name, sku: p.sku,
      category: (p.category as { name: string } | null)?.name ?? null,
      stock: p.stock_quantity, min_stock: p.min_stock, unit: p.unit,
      cost_price: p.cost_price, sale_price: p.sale_price,
      stock_value: p.stock_quantity * p.cost_price,
      status,
    }
  })

  if (filters?.status && filters.status !== 'all') {
    rows = rows.filter(r => r.status === filters.status)
  }

  const total_value = rows.reduce((s, r) => s + r.stock_value, 0)
  const alerts = rows.filter(r => r.status !== 'OK').length

  return { rows, summary: { total_items: rows.length, total_value, alerts } }
}

// ── 2. Movimentações ──────────────────────────────────────────

export async function getMovementsReport(params: {
  start: string; end: string; category?: string
}): Promise<{ rows: MovementReportRow[]; summary: { total: number; entradas: number; saidas: number; ajustes: number } }> {
  const { admin, companyId } = await getServerContext()

  const { data } = await (admin as any)
    .from('stock_movements')
    .select('id, movement_type, quantity, notes, created_at, products(name, sku, categories(name))')
    .eq('company_id', companyId)
    .gte('created_at', params.start)
    .lte('created_at', params.end)
    .order('created_at', { ascending: false })
    .limit(500)

  const rows: MovementReportRow[] = (data ?? []).map((m: any) => ({
    id: m.id,
    product_name: (m.products as any)?.name ?? 'Desconhecido',
    sku: (m.products as any)?.sku ?? null,
    movement_type: m.movement_type,
    quantity: m.quantity,
    notes: m.notes,
    created_at: m.created_at,
    category: (m.products as any)?.categories?.name ?? null,
  }))

  const total = rows.length
  const entradas = rows.filter(r => ['ENTRADA', 'INVENTARIO', 'DEVOLUCAO'].includes(r.movement_type)).length
  const saidas = rows.filter(r => r.movement_type === 'SAIDA').length
  const ajustes = rows.filter(r => r.movement_type === 'AJUSTE' || r.movement_type === 'TRANSFERENCIA').length

  return { rows, summary: { total, entradas, saidas, ajustes } }
}

// ── 3. Curva ABC (Impulsiona+) ────────────────────────────────

export async function getAbcCurveReport(): Promise<{
  rows: AbcRow[]; isLocked: boolean
}> {
  const { admin, companyId } = await getServerContext()
  const isAdvanced = await hasFeature(companyId, 'reports.advanced.enabled')
  if (!isAdvanced) return { rows: [], isLocked: true }

  const { data } = await (admin as any)
    .from('mv_product_sales_summary')
    .select('product_id, name, sku, category_name, total_revenue, total_sold_qty, total_gross_profit')
    .eq('company_id', companyId)
    .gt('total_sold_qty', 0)
    .order('total_revenue', { ascending: false })
    .limit(500)

  const totalRevenue = (data ?? []).reduce((s: number, r: any) => s + Number(r.total_revenue), 0)
  let cumulative = 0
  const rows: AbcRow[] = (data ?? []).map((r: any, i: number) => {
    const revPct = totalRevenue > 0 ? (Number(r.total_revenue) / totalRevenue) * 100 : 0
    cumulative += revPct
    return {
      rank: i + 1,
      product_id: r.product_id,
      name: r.name,
      sku: r.sku,
      category: r.category_name ?? 'Sem categoria',
      total_revenue: Number(r.total_revenue),
      revenue_pct: revPct,
      cumulative_pct: cumulative,
      curve: cumulative <= 80 ? 'A' : cumulative <= 95 ? 'B' : 'C',
      total_sold_qty: Number(r.total_sold_qty),
      total_gross_profit: Number(r.total_gross_profit),
    }
  })

  return { rows, isLocked: false }
}

// ── 4. Vendas por período ─────────────────────────────────────

export async function getSalesReport(params: {
  start: string; end: string; breakdown?: 'day' | 'week' | 'month'
}): Promise<{
  timeline: SalesReportRow[]
  topProducts: SalesProductRow[]
  summary: { total_orders: number; total_revenue: number; avg_ticket: number; total_profit: number }
}> {
  const { admin, companyId } = await getServerContext()

  const { data: sales } = await (admin as any)
    .from('sales')
    .select('id, total_amount, created_at, sale_items(product_id, quantity, unit_price, products(name, cost_price, categories(name)))')
    .eq('company_id', companyId)
    .eq('status', 'completed')
    .gte('created_at', params.start)
    .lte('created_at', params.end)
    .order('created_at')

  // Timeline
  const dayMap: Record<string, { count: number; revenue: number }> = {}
  for (const s of sales ?? []) {
    const day = s.created_at.substring(0, 10)
    if (!dayMap[day]) dayMap[day] = { count: 0, revenue: 0 }
    dayMap[day].count++
    dayMap[day].revenue += Number(s.total_amount)
  }
  const timeline: SalesReportRow[] = Object.entries(dayMap).map(([date, d]) => ({
    date, sales_count: d.count, total_revenue: d.revenue,
    avg_ticket: d.count > 0 ? d.revenue / d.count : 0,
  }))

  // Top products
  const prodMap: Record<string, { name: string; category: string; qty: number; revenue: number; profit: number }> = {}
  for (const s of sales ?? []) {
    for (const item of (s as any).sale_items ?? []) {
      const pid = item.product_id
      if (!prodMap[pid]) prodMap[pid] = {
        name: item.products?.name ?? 'Desconhecido',
        category: item.products?.categories?.name ?? 'Sem categoria',
        qty: 0, revenue: 0, profit: 0,
      }
      prodMap[pid].qty += item.quantity
      prodMap[pid].revenue += item.quantity * item.unit_price
      prodMap[pid].profit += item.quantity * (item.unit_price - (item.products?.cost_price ?? 0))
    }
  }
  const topProducts: SalesProductRow[] = Object.entries(prodMap)
    .map(([pid, d]) => ({
      product_id: pid, name: d.name, category: d.category,
      qty_sold: d.qty, revenue: d.revenue, profit: d.profit,
      margin_pct: d.revenue > 0 ? (d.profit / d.revenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20)

  const total_revenue = (sales ?? []).reduce((s: number, x: any) => s + Number(x.total_amount), 0)
  const total_profit = topProducts.reduce((s, r) => s + r.profit, 0)

  return {
    timeline,
    topProducts,
    summary: {
      total_orders: sales?.length ?? 0,
      total_revenue,
      avg_ticket: (sales?.length ?? 0) > 0 ? total_revenue / (sales?.length ?? 1) : 0,
      total_profit,
    },
  }
}

// ── 5. Compras realizadas ─────────────────────────────────────

export async function getPurchasesReport(params: {
  start: string; end: string
}): Promise<{
  rows: PurchasesReportRow[]
  summary: { total: number; total_amount: number; received: number; pending: number }
}> {
  const { admin, companyId } = await getServerContext()

  const { data } = await (admin as any)
    .from('purchase_orders')
    .select('id, order_number, status, total_amount, created_at, suppliers(name), purchase_order_items(id)')
    .eq('company_id', companyId)
    .gte('created_at', params.start)
    .lte('created_at', params.end)
    .order('created_at', { ascending: false })

  const rows: PurchasesReportRow[] = (data ?? []).map((o: any) => ({
    id: o.id,
    order_number: o.order_number,
    supplier: (o.suppliers as any)?.name ?? null,
    status: o.status,
    total_amount: Number(o.total_amount),
    items_count: Array.isArray(o.purchase_order_items) ? o.purchase_order_items.length : 0,
    created_at: o.created_at,
  }))

  const total_amount = rows.filter(r => r.status !== 'cancelled').reduce((s, r) => s + r.total_amount, 0)
  const received = rows.filter(r => r.status === 'received').length
  const pending = rows.filter(r => r.status !== 'received' && r.status !== 'cancelled').length

  return {
    rows,
    summary: { total: rows.length, total_amount, received, pending },
  }
}

// ── 6. Produtos parados (Impulsiona+) ─────────────────────────

export async function getSlowMovingReport(daysStopped = 30): Promise<{
  rows: SlowMovingRow[]; isLocked: boolean; summary: { total: number; total_value: number; avg_days: number }
}> {
  const { admin, companyId } = await getServerContext()
  const isAdvanced = await hasFeature(companyId, 'reports.advanced.enabled')
  if (!isAdvanced) return { rows: [], isLocked: true, summary: { total: 0, total_value: 0, avg_days: 0 } }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysStopped)

  const { data: products } = await (admin as any)
    .from('products')
    .select('id, name, sku, stock_quantity, cost_price, categories(name)')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .gt('stock_quantity', 0)

  // Last movement per product
  const productIds = (products ?? []).map((p: any) => p.id)
  const { data: lastMovs } = await (admin as any)
    .from('stock_movements')
    .select('product_id, created_at')
    .eq('company_id', companyId)
    .in('product_id', productIds)
    .eq('movement_type', 'SAIDA')
    .order('created_at', { ascending: false })

  const lastMovMap: Record<string, string> = {}
  for (const m of lastMovs ?? []) {
    if (!lastMovMap[m.product_id]) lastMovMap[m.product_id] = m.created_at
  }

  const today = new Date()
  const rows: SlowMovingRow[] = (products ?? [])
    .filter((p: any) => {
      const last = lastMovMap[p.id]
      if (!last) return true // never sold = parado desde o cadastro
      return new Date(last) < cutoff
    })
    .map((p: any) => {
      const last = lastMovMap[p.id] ?? null
      const days = last
        ? Math.floor((today.getTime() - new Date(last).getTime()) / 86400000)
        : 999
      return {
        id: p.id, name: p.name, sku: p.sku,
        category: (p.categories as any)?.name ?? null,
        stock: p.stock_quantity,
        cost_price: p.cost_price,
        stock_value: p.stock_quantity * p.cost_price,
        last_movement: last,
        days_stopped: days,
      }
    })
    .sort((a: SlowMovingRow, b: SlowMovingRow) => b.days_stopped - a.days_stopped)

  return {
    rows,
    isLocked: false,
    summary: { total: rows.length, total_value: rows.reduce((s, r) => s + r.stock_value, 0), avg_days: rows.length > 0 ? rows.reduce((s, r) => s + r.days_stopped, 0) / rows.length : 0 },
  }
}

// ── 7. Margem e rentabilidade (Impulsiona+) ───────────────────

export async function getMarginReport(): Promise<{
  rows: MarginRow[]; isLocked: boolean
  summary: { avg_margin: number; total_revenue: number; total_profit: number; high_margin: number }
}> {
  const { admin, companyId } = await getServerContext()
  const isAdvanced = await hasFeature(companyId, 'reports.advanced.enabled')
  if (!isAdvanced) return {
    rows: [], isLocked: true,
    summary: { avg_margin: 0, total_revenue: 0, total_profit: 0, high_margin: 0 },
  }

  const { data } = await (admin as any)
    .from('mv_product_sales_summary')
    .select('product_id, name, sku, category_name, cost_price, sale_price, total_sold_qty, total_revenue, total_gross_profit')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('total_gross_profit', { ascending: false })
    .limit(300)

  const rows: MarginRow[] = (data ?? []).map((r: any) => {
    const sale_price = Number(r.sale_price)
    const cost_price = Number(r.cost_price)
    const margin_brl = sale_price - cost_price
    const margin_pct = sale_price > 0 ? (margin_brl / sale_price) * 100 : 0
    return {
      product_id: r.product_id,
      name: r.name,
      sku: r.sku,
      category: r.category_name ?? 'Sem categoria',
      cost_price,
      sale_price,
      margin_brl,
      margin_pct,
      total_sold_qty: Number(r.total_sold_qty),
      total_revenue: Number(r.total_revenue),
      total_profit: Number(r.total_gross_profit),
    }
  })

  const total_revenue = rows.reduce((s, r) => s + r.total_revenue, 0)
  const total_profit = rows.reduce((s, r) => s + r.total_profit, 0)
  const avg_margin_pct = total_revenue > 0 ? (total_profit / total_revenue) * 100 : 0

  const high_margin = rows.filter(r => r.margin_pct >= 30).length
  return { rows, isLocked: false, summary: { avg_margin: avg_margin_pct, total_revenue, total_profit, high_margin } }
}

// ── CSV Export ────────────────────────────────────────────────

export async function exportReportCsv(
  reportType: 'stock' | 'movements' | 'abc' | 'sales' | 'purchases' | 'slow_moving' | 'margin',
  params?: Record<string, string>
): Promise<{ csv: string; filename: string }> {
  const today = new Date().toISOString().substring(0, 10)
  const start = params?.start ?? new Date(Date.now() - 30 * 86400000).toISOString()
  const end = params?.end ?? new Date().toISOString()

  function toCsv(headers: string[], rows: string[][]): string {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
    return [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n')
  }

  switch (reportType) {
    case 'stock': {
      const { rows } = await getStockReport()
      return {
        csv: toCsv(
          ['Nome', 'SKU', 'Categoria', 'Estoque', 'Mín.', 'Unidade', 'Custo', 'Venda', 'Valor em estoque', 'Status'],
          rows.map(r => [r.name, r.sku ?? '', r.category ?? '', String(r.stock), String(r.min_stock), r.unit,
            r.cost_price.toFixed(2), r.sale_price.toFixed(2), r.stock_value.toFixed(2), r.status])
        ),
        filename: `estoque-${today}.csv`,
      }
    }
    case 'movements': {
      const { rows } = await getMovementsReport({ start, end })
      return {
        csv: toCsv(
          ['Produto', 'SKU', 'Tipo', 'Quantidade', 'Data', 'Categoria', 'Observações'],
          rows.map(r => [r.product_name, r.sku ?? '', r.movement_type, String(r.quantity),
            r.created_at, r.category ?? '', r.notes ?? ''])
        ),
        filename: `movimentacoes-${today}.csv`,
      }
    }
    case 'abc': {
      const { rows } = await getAbcCurveReport()
      return {
        csv: toCsv(
          ['Rank', 'Curva', 'Produto', 'SKU', 'Categoria', 'Receita (R$)', '% Receita', '% Acumulado', 'Qtd Vendida', 'Lucro (R$)'],
          rows.map(r => [String(r.rank), r.curve, r.name, r.sku ?? '', r.category,
            r.total_revenue.toFixed(2), r.revenue_pct.toFixed(2), r.cumulative_pct.toFixed(2),
            String(r.total_sold_qty), r.total_gross_profit.toFixed(2)])
        ),
        filename: `curva-abc-${today}.csv`,
      }
    }
    case 'purchases': {
      const { rows } = await getPurchasesReport({ start, end })
      return {
        csv: toCsv(
          ['Pedido', 'Fornecedor', 'Status', 'Itens', 'Total (R$)', 'Data'],
          rows.map(r => [r.order_number, r.supplier ?? '', r.status, String(r.items_count),
            r.total_amount.toFixed(2), r.created_at])
        ),
        filename: `compras-${today}.csv`,
      }
    }
    case 'slow_moving': {
      const daysStopped = params?.days_stopped ? Number(params.days_stopped) : 60
      const { rows } = await getSlowMovingReport(daysStopped)
      return {
        csv: toCsv(
          ['Produto', 'SKU', 'Categoria', 'Estoque', 'Custo Unit.', 'Valor em Estoque', 'Última Saída', 'Dias Parado'],
          rows.map(r => [r.name, r.sku ?? '', r.category ?? '', String(r.stock),
            r.cost_price.toFixed(2), r.stock_value.toFixed(2),
            r.last_movement ?? 'Nunca', String(r.days_stopped)])
        ),
        filename: `produtos-parados-${today}.csv`,
      }
    }
    case 'margin': {
      const { rows } = await getMarginReport()
      return {
        csv: toCsv(
          ['Produto', 'SKU', 'Categoria', 'Custo', 'Venda', 'Margem R$', 'Margem %', 'Qtd Vendida', 'Receita Total', 'Lucro Total'],
          rows.map(r => [r.name, r.sku ?? '', r.category, r.cost_price.toFixed(2),
            r.sale_price.toFixed(2), r.margin_brl.toFixed(2), r.margin_pct.toFixed(1),
            String(r.total_sold_qty), r.total_revenue.toFixed(2), r.total_profit.toFixed(2)])
        ),
        filename: `margem-${today}.csv`,
      }
    }
    default:
      return { csv: '', filename: `relatorio-${today}.csv` }
  }
}
