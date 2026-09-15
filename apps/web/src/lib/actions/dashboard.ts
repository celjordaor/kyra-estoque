'use server'

import { cookies } from 'next/headers'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'

// ── Helper ─────────────────────────────────────────────────────
async function getServerContext() {
  const cookieStore = await cookies()
  const supabase = createServerSupabaseClient(cookieStore)

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Não autenticado')

  // Admin client bypasses RLS — seguro pois rodamos em Server Action
  const admin = createAdminSupabaseClient()
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('company_id, role, full_name')
    .eq('id', user.id)
    .single()

  if (profileErr || !profile?.company_id) throw new Error('Empresa não encontrada')

  return { supabase, userId: user.id, companyId: profile.company_id, fullName: profile.full_name }
}

// ── Tipos ──────────────────────────────────────────────────────
export interface DashboardKPIs {
  // ── Vendas ──────────────────────────────────────────
  salesRevenue: number          // receita do mês atual
  salesRevenuePrev: number      // receita do mês anterior
  salesCount: number            // nº de vendas do mês
  avgTicket: number             // ticket médio do mês
  avgTicketPrev: number         // ticket médio mês anterior
  // ── Margem ──────────────────────────────────────────
  grossMargin: number           // margem bruta % (0-100)
  grossMarginPrev: number       // margem mês anterior
  // ── Estoque ─────────────────────────────────────────
  stockValue: number            // valor total do estoque
  totalProducts: number         // produtos ativos
  lowStockCount: number
  outOfStockCount: number
  noImageCount: number
  noCostCount: number
}

export interface AttentionItem {
  id: string
  priority: 'high' | 'medium' | 'opportunity' | 'info'
  title: string
  description: string
  count?: number
  action?: string
  href?: string
}

export interface RecommendationItem {
  id: string
  type: string
  title: string
  description: string
  impact: string
  status: 'PENDING' | 'VIEWED' | 'APPROVED' | 'DISMISSED' | 'EXECUTED'
  confidence: number
  created_at: string
}

export interface RecentActivityItem {
  id: string
  type: 'product_created' | 'product_updated' | 'stock_movement' | 'sale'
  description: string
  timestamp: string
  meta?: string
}

export interface DashboardData {
  kpis: DashboardKPIs
  attentionItems: AttentionItem[]
  recommendations: RecommendationItem[]
  recentActivity: RecentActivityItem[]
  operationsHealth: {
    activeProducts: number
    attentionProducts: number
    categories: number
  }
}

// ── getDashboardData ───────────────────────────────────────────
export async function getDashboardData(): Promise<{ data: DashboardData | null; error: string | null }> {
  try {
    const { supabase, companyId } = await getServerContext()

    // ── Produtos ──────────────────────────────────────────────────────
    const { data: products, error: productsErr } = await supabase
      .from('products')
      .select('id, name, cost_price, sale_price, stock_quantity, min_stock, image_url, is_active, category_id')
      .eq('company_id', companyId)

    if (productsErr) throw new Error(productsErr.message)

    const activeProducts = (products ?? []).filter(p => p.is_active)
    const stockValue = activeProducts.reduce((sum, p) => sum + ((p.cost_price ?? 0) * (p.stock_quantity ?? 0)), 0)
    const lowStockCount = activeProducts.filter(p => (p.stock_quantity ?? 0) > 0 && (p.stock_quantity ?? 0) <= (p.min_stock ?? 0)).length
    const outOfStockCount = activeProducts.filter(p => (p.stock_quantity ?? 0) <= 0).length
    const noImageCount = activeProducts.filter(p => !p.image_url).length
    const noCostCount = activeProducts.filter(p => !p.cost_price || p.cost_price <= 0).length

    // ── Datas de período ───────────────────────────────────────────────
    const now = new Date()
    const startCurrent = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const startPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
    const endPrev = startCurrent

    // ── Vendas do mês atual ────────────────────────────────────────────
    const { data: salesCurrent } = await supabase
      .from('sales')
      .select('id, total_amount')
      .eq('company_id', companyId)
      .eq('status', 'COMPLETED')
      .gte('created_at', startCurrent)

    const salesRevenue = (salesCurrent ?? []).reduce((s, r) => s + (r.total_amount ?? 0), 0)
    const salesCount = (salesCurrent ?? []).length
    const avgTicket = salesCount > 0 ? salesRevenue / salesCount : 0

    // ── Vendas do mês anterior ─────────────────────────────────────────
    const { data: salesPrev } = await supabase
      .from('sales')
      .select('id, total_amount')
      .eq('company_id', companyId)
      .eq('status', 'COMPLETED')
      .gte('created_at', startPrev)
      .lt('created_at', endPrev)

    const salesRevenuePrev = (salesPrev ?? []).reduce((s, r) => s + (r.total_amount ?? 0), 0)
    const salesCountPrev = (salesPrev ?? []).length
    const avgTicketPrev = salesCountPrev > 0 ? salesRevenuePrev / salesCountPrev : 0

    // ── Margem bruta do mês atual ──────────────────────────────────────
    let grossMargin = 0
    let grossMarginPrev = 0

    if (salesCount > 0) {
      const saleIds = (salesCurrent ?? []).map(s => s.id)
      const { data: itemsCurrent } = await supabase
        .from('sale_items')
        .select('quantity, unit_price, unit_cost, discount_amount')
        .in('sale_id', saleIds)

      const totalRevCurrent = (itemsCurrent ?? []).reduce(
        (s, i) => s + ((i.unit_price ?? 0) * (i.quantity ?? 0)) - (i.discount_amount ?? 0), 0
      )
      const totalCostCurrent = (itemsCurrent ?? []).reduce(
        (s, i) => s + ((i.unit_cost ?? 0) * (i.quantity ?? 0)), 0
      )
      grossMargin = totalRevCurrent > 0 ? ((totalRevCurrent - totalCostCurrent) / totalRevCurrent) * 100 : 0
    }

    if (salesCountPrev > 0) {
      const saleIdsPrev = (salesPrev ?? []).map(s => s.id)
      const { data: itemsPrev } = await supabase
        .from('sale_items')
        .select('quantity, unit_price, unit_cost, discount_amount')
        .in('sale_id', saleIdsPrev)

      const totalRevPrev = (itemsPrev ?? []).reduce(
        (s, i) => s + ((i.unit_price ?? 0) * (i.quantity ?? 0)) - (i.discount_amount ?? 0), 0
      )
      const totalCostPrev = (itemsPrev ?? []).reduce(
        (s, i) => s + ((i.unit_cost ?? 0) * (i.quantity ?? 0)), 0
      )
      grossMarginPrev = totalRevPrev > 0 ? ((totalRevPrev - totalCostPrev) / totalRevPrev) * 100 : 0
    }

    // ── KPIs finais ────────────────────────────────────────────────────
    const kpis: DashboardKPIs = {
      salesRevenue,
      salesRevenuePrev,
      salesCount,
      avgTicket,
      avgTicketPrev,
      grossMargin,
      grossMarginPrev,
      stockValue,
      totalProducts: activeProducts.length,
      lowStockCount,
      outOfStockCount,
      noImageCount,
      noCostCount,
    }

    // Attention items built from real data
    const attentionItems: AttentionItem[] = []

    if (outOfStockCount > 0) {
      attentionItems.push({
        id: 'out-of-stock',
        priority: 'high',
        title: `${outOfStockCount} produto${outOfStockCount > 1 ? 's' : ''} sem estoque`,
        description: 'Ruptura de estoque impacta vendas diretamente. Acione reposição agora.',
        count: outOfStockCount,
        action: 'Ver produtos',
        href: '/stock?filter=out',
      })
    }

    if (lowStockCount > 0) {
      attentionItems.push({
        id: 'low-stock',
        priority: 'medium',
        title: `${lowStockCount} produto${lowStockCount > 1 ? 's' : ''} abaixo do mínimo`,
        description: 'Estoque crítico. Considere fazer pedidos de compra em breve.',
        count: lowStockCount,
        action: 'Ver estoque',
        href: '/stock?filter=low',
      })
    }

    if (noImageCount > 0) {
      attentionItems.push({
        id: 'no-image',
        priority: 'opportunity',
        title: `${noImageCount} produto${noImageCount > 1 ? 's' : ''} sem imagem`,
        description: 'Produtos com foto vendem até 3x mais. Adicione imagens para aumentar conversão.',
        count: noImageCount,
        action: 'Completar cadastros',
        href: '/products?filter=no_image',
      })
    }

    if (noCostCount > 0) {
      attentionItems.push({
        id: 'no-cost',
        priority: 'medium',
        title: `${noCostCount} produto${noCostCount > 1 ? 's' : ''} sem preço de custo`,
        description: 'Sem custo definido, não é possível calcular margem nem alertas de preço.',
        count: noCostCount,
        action: 'Atualizar produtos',
        href: '/products?filter=no_cost',
      })
    }

    // Recommendations from AI table (if exists)
    let recommendations: RecommendationItem[] = []
    const { data: aiRecs } = await supabase
      .from('ai_recommendations')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false })
      .limit(5)

    if (aiRecs && aiRecs.length > 0) {
      recommendations = aiRecs.map(r => ({
        id: r.id,
        type: r.type,
        title: r.title,
        description: r.description,
        impact: r.suggested_action ?? "",
        status: r.status,
        confidence: r.confidence ?? 0.8,
        created_at: r.created_at,
      }))
    } else {
      // Default recommendations based on real data
      if (lowStockCount + outOfStockCount > 0) {
        recommendations.push({
          id: 'rec-stock',
          type: 'LOW_STOCK',
          title: 'Gerar lista de reposição',
          description: `Há ${lowStockCount + outOfStockCount} itens que precisam de reposição. Posso gerar uma lista de compras priorizada.`,
          impact: 'Evitar ruptura de estoque',
          status: 'PENDING',
          confidence: 0.95,
          created_at: new Date().toISOString(),
        })
      }

      if (noCostCount > 0) {
        recommendations.push({
          id: 'rec-cost',
          type: 'MARGIN_ALERT',
          title: 'Completar preços de custo',
          description: `${noCostCount} produtos sem custo impedem o cálculo de margem. Posso sugerir valores com base no preço de venda.`,
          impact: 'Visibilidade de margem',
          status: 'PENDING',
          confidence: 0.85,
          created_at: new Date().toISOString(),
        })
      }

      if (noImageCount > 0) {
        recommendations.push({
          id: 'rec-image',
          type: 'PROMOTION_OPPORTUNITY',
          title: 'Adicionar imagens aos produtos',
          description: `Completar o catálogo visual pode aumentar significativamente a taxa de conversão nos canais de venda.`,
          impact: '+30% conversão estimada',
          status: 'PENDING',
          confidence: 0.78,
          created_at: new Date().toISOString(),
        })
      }
    }

    // Recent activity from stock movements
    const { data: movements } = await supabase
      .from('stock_movements')
      .select('id, type, quantity, notes, created_at, product_id, products(name)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(8)

    const recentActivity: RecentActivityItem[] = (movements ?? []).map(m => {
      const product = Array.isArray(m.products) ? m.products[0] : m.products
      const productName = product?.name ?? 'Produto'
      const typeLabel: Record<string, string> = {
        ENTRADA: 'Entrada',
        SAIDA: 'Saída',
        AJUSTE: 'Ajuste',
        TRANSFERENCIA: 'Transferência',
        DEVOLUCAO: 'Devolução',
        INVENTARIO: 'Inventário',
      }
      return {
        id: m.id,
        type: 'stock_movement' as const,
        description: `${typeLabel[m.type] ?? m.type} de ${Math.abs(m.quantity)} un. — ${productName}`,
        timestamp: m.created_at,
        meta: m.notes ?? undefined,
      }
    })

    // Categories count
    const { count: categoriesCount } = await supabase
      .from('categories')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('is_active', true)

    return {
      data: {
        kpis,
        attentionItems,
        recommendations,
        recentActivity,
        operationsHealth: {
          activeProducts: activeProducts.length,
          attentionProducts: lowStockCount + outOfStockCount,
          categories: categoriesCount ?? 0,
        },
      },
      error: null,
    }
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Erro ao carregar dados',
    }
  }
}
