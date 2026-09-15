/**
 * Kyra IA Tools — Sprint 15
 *
 * Definições de tools para Anthropic + implementações server-side.
 * IA nunca acessa o banco diretamente: ela chama estas funções
 * que rodam com admin client + filtro explícito de company_id.
 */
import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import { createAdminSupabaseClient } from '@kyra/database'

// ── Tool Definitions ─────────────────────────────────────────

export const BASIC_TOOLS: Tool[] = [
  {
    name: 'get_low_stock_alerts',
    description: 'Retorna produtos com estoque abaixo do mínimo ou zerado. Use para responder perguntas sobre reposição, ruptura ou risco de falta de estoque.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'Máximo de produtos a retornar (padrão: 15)' },
      },
    },
  },
  {
    name: 'get_product_info',
    description: 'Busca informações detalhadas de produto(s) por nome, SKU ou categoria. Use quando o usuário perguntar sobre um produto específico.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Nome, SKU ou parte do nome do produto' },
        limit: { type: 'number', description: 'Máximo de resultados (padrão: 10)' },
      },
      required: ['query'],
    },
  },
]

export const ADVANCED_TOOLS: Tool[] = [
  ...BASIC_TOOLS,
  {
    name: 'get_sales_analysis',
    description: 'Analisa vendas por período: totais de receita, produtos mais vendidos, ticket médio, comparação com período anterior.',
    input_schema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'week', 'month', 'last_month', 'last_30_days'],
          description: 'Período de análise',
        },
      },
      required: ['period'],
    },
  },
  {
    name: 'get_purchase_suggestions',
    description: 'Calcula sugestões de reposição baseadas em velocidade de venda (últimos 30 dias) e estoque atual. Retorna produto, quantidade sugerida e fornecedor.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'Máximo de sugestões (padrão: 10)' },
      },
    },
  },
  {
    name: 'create_purchase_order',
    description: 'Cria um pedido de compra (rascunho) no sistema para os produtos indicados. Confirme com o usuário antes de chamar esta tool.',
    input_schema: {
      type: 'object' as const,
      properties: {
        items: {
          type: 'array',
          description: 'Itens do pedido',
          items: {
            type: 'object',
            properties: {
              product_id: { type: 'string', description: 'UUID do produto' },
              product_name: { type: 'string', description: 'Nome do produto (para exibição)' },
              quantity: { type: 'number', description: 'Quantidade a pedir' },
              unit_cost: { type: 'number', description: 'Custo unitário esperado' },
            },
            required: ['product_id', 'quantity'],
          },
        },
        notes: { type: 'string', description: 'Observações para o pedido (opcional)' },
      },
      required: ['items'],
    },
  },
  {
    name: 'get_demand_forecast',
    description: 'Projeta demanda dos próximos 30 dias com base no histórico de movimentações de estoque.',
    input_schema: {
      type: 'object' as const,
      properties: {
        product_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'UUIDs dos produtos a projetar (vazio = todos os ativos)',
        },
      },
    },
  },
]

// ── Tool Executor ─────────────────────────────────────────────

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  companyId: string,
): Promise<unknown> {
  const admin = createAdminSupabaseClient()

  switch (toolName) {
    case 'get_low_stock_alerts': {
      const limit = (input.limit as number) ?? 15
      const { data } = await (admin as any)
        .from('products')
        .select('id, name, sku, stock_quantity, min_stock, unit, sale_price, cost_price')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .or('stock_quantity.lte.0,and(min_stock.gt.0,stock_quantity.lte.min_stock)')
        .order('stock_quantity', { ascending: true })
        .limit(limit)

      return {
        count: data?.length ?? 0,
        products: (data ?? []).map((p: any) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          stock: p.stock_quantity,
          min_stock: p.min_stock,
          unit: p.unit,
          status: p.stock_quantity <= 0 ? 'ZERADO' : 'ABAIXO_DO_MINIMO',
        })),
      }
    }

    case 'get_product_info': {
      const query = input.query as string
      const limit = (input.limit as number) ?? 10
      const { data } = await (admin as any)
        .from('products')
        .select('id, name, sku, stock_quantity, min_stock, sale_price, cost_price, unit, is_active, category:categories(name)')
        .eq('company_id', companyId)
        .or(`name.ilike.%${query}%,sku.ilike.%${query}%`)
        .limit(limit)

      return {
        count: data?.length ?? 0,
        products: (data ?? []).map((p: any) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          stock: p.stock_quantity,
          min_stock: p.min_stock,
          sale_price: p.sale_price,
          cost_price: p.cost_price,
          unit: p.unit,
          active: p.is_active,
          category: (p.category as { name: string } | null)?.name,
          margin_pct: p.sale_price > 0
            ? (((p.sale_price - p.cost_price) / p.sale_price) * 100).toFixed(1) + '%'
            : 'N/A',
        })),
      }
    }

    case 'get_sales_analysis': {
      const period = (input.period as string) ?? 'month'
      const now = new Date()
      let start: Date, prevStart: Date, prevEnd: Date

      if (period === 'today') {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 1)
        prevEnd = new Date(start)
      } else if (period === 'week') {
        const day = now.getDay()
        start = new Date(now); start.setDate(now.getDate() - day)
        prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 7)
        prevEnd = new Date(start)
      } else if (period === 'last_month') {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const end = new Date(now.getFullYear(), now.getMonth(), 0)
        prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1)
        prevEnd = new Date(start)
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const { data: salesData } = await (admin as any)
          .from('sales')
          .select('total_amount, created_at, sale_items(product_id, quantity, unit_price, products(name))')
          .eq('company_id', companyId)
          .eq('status', 'completed')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
        return buildSalesResult(salesData ?? [], prevStart, prevEnd, companyId, admin)
      } else {
        // month or last_30_days
        start = new Date(now); start.setDate(now.getDate() - 30)
        prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 30)
        prevEnd = new Date(start)
      }

      const { data: salesData } = await (admin as any)
        .from('sales')
        .select('id, total_amount, discount_amount, created_at, sale_items(product_id, quantity, unit_price, products(name))')
        .eq('company_id', companyId)
        .eq('status', 'completed')
        .gte('created_at', start.toISOString())
        .order('created_at', { ascending: false })

      const { data: prevData } = await (admin as any)
        .from('sales')
        .select('total_amount')
        .eq('company_id', companyId)
        .eq('status', 'completed')
        .gte('created_at', prevStart.toISOString())
        .lt('created_at', prevEnd.toISOString())

      const revenue = (salesData ?? []).reduce((s: number, x: any) => s + (x.total_amount ?? 0), 0)
      const prevRevenue = (prevData ?? []).reduce((s: number, x: any) => s + (x.total_amount ?? 0), 0)
      const growth = prevRevenue > 0 ? (((revenue - prevRevenue) / prevRevenue) * 100).toFixed(1) : null

      // Top products
      const prodMap: Record<string, { name: string; qty: number; revenue: number }> = {}
      for (const sale of salesData ?? []) {
        for (const item of (sale as any).sale_items ?? []) {
          const name = item.products?.name ?? 'Desconhecido'
          if (!prodMap[item.product_id]) prodMap[item.product_id] = { name, qty: 0, revenue: 0 }
          prodMap[item.product_id]!.qty += item.quantity
          prodMap[item.product_id]!.revenue += item.quantity * item.unit_price
        }
      }
      const topProducts = Object.values(prodMap)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)

      return {
        period,
        total_sales: salesData?.length ?? 0,
        total_revenue: revenue,
        avg_ticket: salesData?.length ? (revenue / salesData.length).toFixed(2) : 0,
        previous_revenue: prevRevenue,
        growth_pct: growth ? `${growth}%` : 'N/A',
        top_products: topProducts,
      }
    }

    case 'get_purchase_suggestions': {
      const limit = (input.limit as number) ?? 10
      const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      // Products below min_stock (informational query — actual filtering done below)
      const { data: lowStock } = await (admin as any)
        .from('products')
        .select('id, name, sku, stock_quantity, min_stock, cost_price, unit')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .gt('min_stock', 0)
        .limit(limit)

      void lowStock // unused — actual query follows

      // Sales velocity (last 30 days)
      const { data: movements } = await (admin as any)
        .from('stock_movements')
        .select('product_id, quantity')
        .eq('company_id', companyId)
        .eq('movement_type', 'SAIDA')
        .gte('created_at', thirtyDaysAgo.toISOString())

      const velocityMap: Record<string, number> = {}
      for (const m of (movements ?? []) as any[]) {
        velocityMap[m.product_id] = (velocityMap[m.product_id] ?? 0) + Math.abs(m.quantity)
      }

      // Re-query with proper filter
      const { data: products } = await (admin as any)
        .from('products')
        .select('id, name, sku, stock_quantity, min_stock, cost_price, unit')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .or('stock_quantity.lte.0,and(min_stock.gt.0,stock_quantity.lte.min_stock)')
        .limit(limit)

      const suggestions = ((products ?? []) as any[]).map(p => {
        const dailyVelocity = (velocityMap[p.id] ?? 0) / 30
        const daysLeft = dailyVelocity > 0 ? Math.floor(p.stock_quantity / dailyVelocity) : null
        const suggestedQty = Math.max(
          p.min_stock - p.stock_quantity,
          Math.ceil(dailyVelocity * 30) // 30-day supply
        )
        return {
          product_id: p.id,
          name: p.name,
          sku: p.sku,
          current_stock: p.stock_quantity,
          min_stock: p.min_stock,
          suggested_quantity: Math.max(1, suggestedQty),
          unit: p.unit,
          estimated_cost: p.cost_price * Math.max(1, suggestedQty),
          days_left: daysLeft,
          urgency: p.stock_quantity <= 0 ? 'CRÍTICO' : 'ALTO',
        }
      })

      return {
        count: suggestions.length,
        total_estimated_cost: suggestions.reduce((s, x) => s + x.estimated_cost, 0),
        suggestions,
      }
    }

    case 'create_purchase_order': {
      const items = input.items as Array<{ product_id: string; product_name?: string; quantity: number; unit_cost?: number }>
      const notes = input.notes as string | undefined

      if (!items?.length) return { success: false, error: 'Nenhum item fornecido' }

      // Get user_id from profiles (use first user of company as created_by)
      const { data: profile } = await (admin as any)
        .from('profiles')
        .select('id')
        .eq('company_id', companyId)
        .limit(1)
        .single()

      const { data: order, error } = await (admin as any)
        .from('purchase_orders')
        .insert({
          company_id: companyId,
          created_by: profile?.id,
          status: 'draft',
          notes: notes ?? 'Criado pela Kyra IA',
          total_amount: 0,
        })
        .select('id, order_number')
        .single()

      if (error || !order) return { success: false, error: error?.message ?? 'Erro ao criar pedido' }

      // Insert items
      const orderItems = items.map(item => ({
        purchase_order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost ?? 0,
        total_cost: (item.unit_cost ?? 0) * item.quantity,
      }))

      await (admin as any).from('purchase_order_items').insert(orderItems)

      // Update total
      const total = orderItems.reduce((s, x) => s + x.total_cost, 0)
      await (admin as any).from('purchase_orders').update({ total_amount: total }).eq('id', order.id)

      return {
        success: true,
        order_id: order.id,
        order_number: order.order_number,
        items_count: items.length,
        total_amount: total,
        message: `Pedido de compra criado com ${items.length} item(s). Acesse Compras para aprovar.`,
      }
    }

    case 'get_demand_forecast': {
      const productIds = (input.product_ids as string[]) ?? []
      const sixtyDaysAgo = new Date(); sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

      let movQuery = (admin as any)
        .from('stock_movements')
        .select('product_id, quantity, created_at, products(name, unit)')
        .eq('company_id', companyId)
        .eq('movement_type', 'SAIDA')
        .gte('created_at', sixtyDaysAgo.toISOString())

      if (productIds.length > 0) {
        movQuery = movQuery.in('product_id', productIds)
      } else {
        movQuery = movQuery.limit(500)
      }

      const { data: movements } = await movQuery

      // Aggregate by product
      const aggMap: Record<string, { name: string; unit: string; total_60d: number }> = {}
      for (const m of (movements ?? []) as any[]) {
        if (!aggMap[m.product_id]) {
          aggMap[m.product_id] = {
            name: (m.products as any)?.name ?? 'Desconhecido',
            unit: (m.products as any)?.unit ?? 'un',
            total_60d: 0,
          }
        }
        aggMap[m.product_id]!.total_60d += Math.abs(m.quantity)
      }

      const forecasts = Object.entries(aggMap).map(([id, d]) => ({
        product_id: id,
        name: d.name,
        unit: d.unit,
        avg_daily: (d.total_60d / 60).toFixed(2),
        forecast_30d: Math.ceil(d.total_60d / 2),
        forecast_90d: Math.ceil(d.total_60d * 1.5),
      }))

      return {
        count: forecasts.length,
        period_analyzed: '60 dias',
        forecasts: forecasts.sort((a, b) => b.forecast_30d - a.forecast_30d).slice(0, 20),
      }
    }

    default:
      return { error: `Tool desconhecida: ${toolName}` }
  }
}

// ── Helper ────────────────────────────────────────────────────

async function buildSalesResult(
  salesData: any[],
  _prevStart: Date,
  _prevEnd: Date,
  _companyId: string,
  _admin: ReturnType<typeof createAdminSupabaseClient>
) {
  const revenue = salesData.reduce((s: number, x: any) => s + (x.total_amount ?? 0), 0)
  return {
    total_sales: salesData.length,
    total_revenue: revenue,
    avg_ticket: salesData.length ? (revenue / salesData.length).toFixed(2) : 0,
  }
}
