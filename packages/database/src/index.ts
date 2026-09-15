// ── Types ─────────────────────────────────────────────────────
export type {
  Database,
  Json,
  // Enums
  StockMovementType,
  RecommendationType,
  RecommendationStatus,
  SaleStatus,
  PaymentMethod,
  UserRole,
  CompanyPlan,
  // Row types
  CompanyRow,
  ProfileRow,
  CategoryRow,
  ProductRow,
  StockMovementRow,
  SaleRow,
  SaleItemRow,
  AIRecommendationRow,
  AutomationLogRow,
  BrandRow,
  CustomerRow,
  SupplierRow,
  // Insert types
  CompanyInsert,
  ProfileInsert,
  CategoryInsert,
  ProductInsert,
  StockMovementInsert,
  SaleInsert,
  SaleItemInsert,
  AIRecommendationInsert,
  BrandInsert,
  BrandUpdate,
  CustomerInsert,
  CustomerUpdate,
  SupplierInsert,
  SupplierUpdate,
  PurchaseOrderInsert,
  PurchaseOrderUpdate,
  DiscountCouponInsert,
  DiscountCouponUpdate,
  // Sprint 10a
  PlanInterval,
  SubscriptionStatus,
  PlanRow,
  PlanPriceRow,
  PlanEntitlementRow,
  SubscriptionRow,
  UsageCounterRow,
  BillingEventRow,
  RoleRow,
  UserRoleRow,
  // Update types
  ProductUpdate,
  SaleUpdate,
  AIRecommendationUpdate,
  // Helpers
  TableRow,
  TableInsert,
} from './types'

// ── Clients ───────────────────────────────────────────────────
export { createClient } from './client'
export { createServerSupabaseClient, createAdminSupabaseClient } from './server'
