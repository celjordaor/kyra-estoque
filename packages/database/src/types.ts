// ═══════════════════════════════════════════════════════════════
// Database Types — gerado manualmente do schema Supabase.
// Em produção: substituir por `supabase gen types typescript`
// ═══════════════════════════════════════════════════════════════

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ── Enums ─────────────────────────────────────────────────────
export type StockMovementType =
  | 'ENTRADA'
  | 'SAIDA'
  | 'AJUSTE'
  | 'TRANSFERENCIA'
  | 'DEVOLUCAO'
  | 'INVENTARIO'

export type RecommendationType =
  | 'LOW_STOCK'
  | 'STOCKOUT_RISK'
  | 'SLOW_MOVING'
  | 'OVERSTOCK'
  | 'PURCHASE_RECOMMENDATION'
  | 'SALES_ANOMALY'
  | 'MARGIN_ALERT'
  | 'PROMOTION_OPPORTUNITY'

export type RecommendationStatus =
  | 'PENDING'
  | 'VIEWED'
  | 'APPROVED'
  | 'DISMISSED'
  | 'EXECUTED'

export type SaleStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED'

export type PaymentMethod =
  | 'CASH'
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'PIX'
  | 'BOLETO'
  | 'TRANSFER'
  | 'OTHER'

export type UserRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer'
export type CompanyPlan = 'free' | 'pro' | 'enterprise'

// ── Row types (SELECT) ────────────────────────────────────────

export interface CompanyRow {
  id: string
  name: string
  slug: string
  document: string | null
  email: string | null
  phone: string | null
  logo_url: string | null
  plan: CompanyPlan
  timezone: string
  currency: string
  locale: string
  is_active: boolean
  trial_ends_at: string | null
  created_at: string
  updated_at: string
}

export interface ProfileRow {
  id: string
  company_id: string | null
  email: string
  full_name: string
  avatar_url: string | null
  role: UserRole
  is_active: boolean
  last_seen_at: string | null
  created_at: string
  updated_at: string
}

export interface CategoryRow {
  id: string
  company_id: string
  name: string
  slug: string
  description: string | null
  color: string | null
  icon: string | null
  parent_id: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ProductRow {
  id: string
  company_id: string
  category_id: string | null
  brand_id: string | null
  name: string
  description: string | null
  sku: string | null
  barcode: string | null
  cost_price: number
  sale_price: number
  min_price: number | null
  stock_quantity: number
  min_stock: number
  max_stock: number | null
  unit: string
  image_url: string | null
  images: Json
  ai_reorder_point: number | null
  ai_avg_daily_sales: number | null
  is_active: boolean
  is_featured: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface StockMovementRow {
  id: string
  company_id: string
  product_id: string
  type: StockMovementType
  quantity: number
  unit_cost: number | null
  total_cost: number | null      // generated
  balance_after: number | null
  reference_type: string | null
  reference_id: string | null
  state_registration: string | null
  whatsapp: string | null
  notes: string | null
  location: string | null
  created_by: string | null
  ai_generated: boolean
  ai_context: Json | null
  created_at: string
}

export interface SaleRow {
  id: string
  company_id: string
  sale_number: string
  status: SaleStatus
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  customer_doc: string | null
  subtotal: number
  discount_amount: number
  discount_pct: number
  total_amount: number
  cost_total: number
  margin: number | null
  payment_method: PaymentMethod | null
  paid_at: string | null
  payment_ref: string | null
  state_registration: string | null
  whatsapp: string | null
  notes: string | null
  internal_notes: string | null
  ai_assisted: boolean
  ai_context: Json | null
  created_by: string | null
  cancelled_by: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  created_at: string
  updated_at: string
}

export interface SaleItemRow {
  id: string
  sale_id: string
  company_id: string
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
  stock_movement_id: string | null
  created_at: string
}

export interface AIRecommendationRow {
  id: string
  company_id: string
  product_id: string | null
  type: RecommendationType
  status: RecommendationStatus
  priority: number
  title: string
  description: string
  suggested_action: string | null
  suggested_value: number | null
  context: Json
  confidence: number | null
  ai_provider: string | null
  ai_model: string | null
  expires_at: string | null
  viewed_at: string | null
  acted_at: string | null
  acted_by: string | null
  created_at: string
  updated_at: string
}

export interface AutomationLogRow {
  id: string
  company_id: string
  workflow_name: string
  trigger_type: string
  status: 'running' | 'success' | 'failed' | 'partial'
  input_data: Json | null
  output_data: Json | null
  error_message: string | null
  started_at: string
  finished_at: string | null
  duration_ms: number | null    // generated
  n8n_execution_id: string | null
  triggered_by: string | null
  created_at: string
}

export interface CompanyAutomationRow {
  id: string
  company_id: string
  automation_type: 'low_stock' | 'slow_moving' | 'weekly_report'
  enabled: boolean
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ── Insert types (INSERT) ─────────────────────────────────────

export type CompanyInsert = Omit<CompanyRow, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
}

export type ProfileInsert = Omit<ProfileRow, 'created_at' | 'updated_at'>

export type CategoryInsert = Omit<CategoryRow, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
}

export type ProductInsert = Omit<ProductRow, 'id' | 'created_at' | 'updated_at' | 'stock_quantity'> & {
  id?: string
  stock_quantity?: number
}

export type StockMovementInsert = Omit<StockMovementRow,
  'id' | 'total_cost' | 'balance_after' | 'created_at'
> & { id?: string }

export type SaleInsert = Omit<SaleRow,
  'id' | 'created_at' | 'updated_at'
> & { id?: string; sale_number?: string }

export type SaleItemInsert = Omit<SaleItemRow, 'id' | 'created_at'> & { id?: string }

export type AIRecommendationInsert = Omit<AIRecommendationRow,
  'id' | 'created_at' | 'updated_at'
> & { id?: string }

// ── Update types (UPDATE) ─────────────────────────────────────

export type ProductUpdate = Partial<Omit<ProductInsert, 'company_id'>>
export type SaleUpdate = Partial<Omit<SaleInsert, 'company_id'>>
export type AIRecommendationUpdate = Partial<Pick<AIRecommendationRow,
  'status' | 'viewed_at' | 'acted_at' | 'acted_by'
>>

// ── Supabase Database interface ───────────────────────────────
// Usado em createClient<Database>()

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: CompanyRow
        Insert: CompanyInsert
        Update: Partial<CompanyInsert>
      }
      profiles: {
        Row: ProfileRow
        Insert: ProfileInsert
        Update: Partial<ProfileInsert>
      }
      categories: {
        Row: CategoryRow
        Insert: CategoryInsert
        Update: Partial<CategoryInsert>
      }
      products: {
        Row: ProductRow
        Insert: ProductInsert
        Update: ProductUpdate
      }
      stock_movements: {
        Row: StockMovementRow
        Insert: StockMovementInsert
        Update: never   // imutável
      }
      sales: {
        Row: SaleRow
        Insert: SaleInsert
        Update: SaleUpdate
      }
      sale_items: {
        Row: SaleItemRow
        Insert: SaleItemInsert
        Update: never   // imutável após inserção
      }
      ai_recommendations: {
        Row: AIRecommendationRow
        Insert: AIRecommendationInsert
        Update: AIRecommendationUpdate
      }
      company_automations: {
        Row: CompanyAutomationRow
        Insert: Omit<CompanyAutomationRow, 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Pick<CompanyAutomationRow, 'enabled' | 'config' | 'updated_at'>>
      }
      discount_coupons: {
        Row: DiscountCouponRow
        Insert: Omit<DiscountCouponRow, 'id' | 'created_at' | 'uses_count'> & { id?: string }
        Update: Partial<Omit<DiscountCouponRow, 'id' | 'company_id' | 'created_at'>>
      }
      automation_logs: {
        Row: AutomationLogRow
        Insert: Omit<AutomationLogRow, 'id' | 'duration_ms' | 'created_at'> & { id?: string }
        Update: Partial<Pick<AutomationLogRow, 'status' | 'output_data' | 'error_message' | 'finished_at'>>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      stock_movement_type: StockMovementType
      recommendation_type: RecommendationType
      recommendation_status: RecommendationStatus
      sale_status: SaleStatus
      payment_method: PaymentMethod
    }
  }
}

// ── Convenience type helpers ──────────────────────────────────

/** Extrai Row de qualquer tabela */
export type TableRow<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

/** Extrai Insert de qualquer tabela */
export type TableInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

// ── BrandRow ──────────────────────────────────────────────────
export interface BrandRow {
  id: string
  company_id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type BrandInsert = Omit<BrandRow, 'id' | 'created_at' | 'updated_at'> & { id?: string }
export type BrandUpdate = Partial<Omit<BrandInsert, 'company_id'>>

// ── CustomerRow ───────────────────────────────────────────────
export interface CustomerRow {
  id: string
  company_id: string
  person_type: 'individual' | 'company'
  name: string
  document: string | null
  email: string | null
  phone: string | null
  zipcode: string | null
  address: string | null
  address_number: string | null
  complement: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  state_registration: string | null
  whatsapp: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CustomerInsert = Omit<CustomerRow, 'id' | 'created_at' | 'updated_at'> & { id?: string }
export type CustomerUpdate = Partial<Omit<CustomerInsert, 'company_id'>>

// ── SupplierRow ───────────────────────────────────────────────
export interface SupplierRow {
  id: string
  company_id: string
  person_type: 'individual' | 'company'
  name: string
  trade_name: string | null
  document: string | null
  email: string | null
  phone: string | null
  contact_name: string | null
  zipcode: string | null
  address: string | null
  address_number: string | null
  complement: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  state_registration: string | null
  whatsapp: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type SupplierInsert = Omit<SupplierRow, 'id' | 'created_at' | 'updated_at'> & { id?: string }
export type SupplierUpdate = Partial<Omit<SupplierInsert, 'company_id'>>

// ── PurchaseOrderRow ──────────────────────────────────────────
export type PurchaseOrderStatus = 'draft' | 'sent' | 'confirmed' | 'received' | 'cancelled'

export interface PurchaseOrderRow {
  id: string
  company_id: string
  supplier_id: string | null
  status: PurchaseOrderStatus
  expected_delivery_date: string | null
  freight: number
  notes: string | null
  subtotal: number
  total: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PurchaseOrderItemRow {
  id: string
  purchase_order_id: string
  product_id: string
  quantity: number
  unit_cost: number
  total: number
}

export type PurchaseOrderInsert = Omit<PurchaseOrderRow, 'id' | 'created_at' | 'updated_at'>
export type PurchaseOrderUpdate = Partial<Omit<PurchaseOrderInsert, 'company_id'>>

// ── DiscountCouponRow ─────────────────────────────────────────
export interface DiscountCouponRow {
  id: string
  company_id: string
  code: string
  description: string | null
  discount_type: 'percent' | 'fixed'
  discount_value: number
  min_order_value: number
  max_uses: number | null
  uses_count: number
  expires_at: string | null
  is_active: boolean
  created_at: string
}

export type DiscountCouponInsert = Omit<DiscountCouponRow, 'id' | 'created_at' | 'uses_count'> & { id?: string }
export type DiscountCouponUpdate = Partial<Omit<DiscountCouponInsert, 'company_id'>>

// ── Sprint 10a: Planos, Assinaturas, Entitlements ─────────────

export type PlanInterval = 'monthly' | 'annual'
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused'

export interface PlanRow {
  id: string
  name: string
  slug: string
  description: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface PlanPriceRow {
  id: string
  plan_id: string
  interval: PlanInterval
  amount_cents: number
  currency: string
  provider_price_id: string | null
  is_active: boolean
  created_at: string
}

export interface PlanEntitlementRow {
  id: string
  plan_id: string
  feature_key: string
  /** NULL = ilimitado; 0 = bloqueado */
  int_value: number | null
  bool_value: boolean | null
  str_value: string | null
  created_at: string
}

export interface SubscriptionRow {
  id: string
  company_id: string
  plan_id: string
  status: SubscriptionStatus
  trial_ends_at: string | null
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  provider: string | null
  provider_subscription_id: string | null
  provider_customer_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface UsageCounterRow {
  id: string
  company_id: string
  metric_key: string
  period_start: string
  period_end: string
  current_value: number
  created_at: string
  updated_at: string
}

export interface BillingEventRow {
  id: string
  company_id: string | null
  provider: string
  event_id: string
  event_type: string
  payload: Record<string, unknown>
  processed_at: string
}

export interface RoleRow {
  id: string
  company_id: string
  name: string
  description: string | null
  permissions: string[]
  is_system: boolean
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface UserRoleRow {
  id: string
  company_id: string
  user_id: string
  role_id: string
  assigned_by: string | null
  created_at: string
}
