-- ═══════════════════════════════════════════════════════════════
-- Migration: 0051 — Hardening de segurança (advisors Supabase)
-- 2026-10-21
--
-- 1. Funções SECURITY DEFINER só de uso server-side (service_role) ou
--    de trigger perdem EXECUTE para PUBLIC/anon/authenticated.
--    Mantidos: my_company_id/my_role (usadas pelas policies RLS),
--    complete_onboarding_checkpoint (authenticated, valida auth.uid()).
-- 2. Views/MV expostas na API.
-- ═══════════════════════════════════════════════════════════════

-- Funções chamadas só por admin client / service_role / cron
revoke execute on function public.complete_automation_run(uuid, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.create_company_trial(uuid) from public, anon, authenticated;
revoke execute on function public.get_company_contact_email(uuid) from public, anon, authenticated;
revoke execute on function public.increment_usage_counter(uuid, text, date, date, integer) from public, anon, authenticated;
revoke execute on function public.mark_overdue_transactions() from public, anon, authenticated;
revoke execute on function public.refresh_sales_summary() from public, anon, authenticated;
revoke execute on function public.seed_default_roles(uuid) from public, anon, authenticated;

grant execute on function public.complete_automation_run(uuid, text, jsonb, text) to service_role;
grant execute on function public.create_company_trial(uuid) to service_role;
grant execute on function public.get_company_contact_email(uuid) to service_role;
grant execute on function public.increment_usage_counter(uuid, text, date, date, integer) to service_role;
grant execute on function public.mark_overdue_transactions() to service_role;
grant execute on function public.refresh_sales_summary() to service_role;
grant execute on function public.seed_default_roles(uuid) to service_role;

-- Funções de trigger: não precisam ser chamáveis via RPC
revoke execute on function public.handle_new_company() from public, anon, authenticated;
revoke execute on function public.handle_new_company_roles() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_sale_completed() from public, anon, authenticated;
revoke execute on function public.handle_sale_item_inserted() from public, anon, authenticated;
revoke execute on function public.update_product_stock() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- complete_onboarding_checkpoint: apenas authenticated + service_role
revoke execute on function public.complete_onboarding_checkpoint(uuid, text) from public, anon;

-- my_company_id / my_role: mantidas (policies RLS avaliadas para anon dependem delas; retornam NULL)

-- View respeita RLS do chamador
alter view if exists public.ai_usage_by_company set (security_invoker = true);

-- MV acessada somente via admin client (reports.ts)
revoke all on public.mv_product_sales_summary from anon, authenticated;

-- ── Índices em FKs sem cobertura (advisor de performance) ──────
create index if not exists ai_conversations_user_id_fkidx on public.ai_conversations (user_id);
create index if not exists ai_recommendations_acted_by_fkidx on public.ai_recommendations (acted_by);
create index if not exists ai_usage_logs_user_id_fkidx on public.ai_usage_logs (user_id);
create index if not exists automation_logs_triggered_by_fkidx on public.automation_logs (triggered_by);
create index if not exists categories_parent_id_fkidx on public.categories (parent_id);
create index if not exists channel_orders_sale_id_fkidx on public.channel_orders (sale_id);
create index if not exists feature_flags_last_changed_by_fkidx on public.feature_flags (last_changed_by);
create index if not exists financial_transactions_account_id_fkidx on public.financial_transactions (account_id);
create index if not exists notification_preferences_company_id_fkidx on public.notification_preferences (company_id);
create index if not exists products_brand_id_fkidx on public.products (brand_id);
create index if not exists products_created_by_fkidx on public.products (created_by);
create index if not exists provisioning_jobs_triggered_by_fkidx on public.provisioning_jobs (triggered_by);
create index if not exists purchase_order_items_product_id_fkidx on public.purchase_order_items (product_id);
create index if not exists purchase_orders_created_by_fkidx on public.purchase_orders (created_by);
create index if not exists purchase_orders_supplier_id_fkidx on public.purchase_orders (supplier_id);
create index if not exists sale_items_stock_movement_id_fkidx on public.sale_items (stock_movement_id);
create index if not exists sales_cancelled_by_fkidx on public.sales (cancelled_by);
create index if not exists sales_created_by_fkidx on public.sales (created_by);
create index if not exists stock_movements_created_by_fkidx on public.stock_movements (created_by);
create index if not exists subscriptions_plan_id_fkidx on public.subscriptions (plan_id);
create index if not exists subscriptions_price_id_fkidx on public.subscriptions (price_id);
create index if not exists support_tickets_user_id_fkidx on public.support_tickets (user_id);
create index if not exists tenant_entitlement_overrides_granted_by_fkidx on public.tenant_entitlement_overrides (granted_by);
create index if not exists user_roles_assigned_by_fkidx on public.user_roles (assigned_by);
create index if not exists user_roles_user_id_fkidx on public.user_roles (user_id);

-- ── search_path fixo nas funções restantes ─────────────────────
alter function public.handle_updated_at() set search_path = public;
alter function public.generate_sale_number(uuid) set search_path = public;
alter function public.prevent_movement_mutation() set search_path = public;
alter function public.touch_ai_conversation() set search_path = public;
alter function public.update_financial_updated_at() set search_path = public;
alter function public.update_tenant_entitlement_overrides_updated_at() set search_path = public;
alter function public.update_feature_flags_updated_at() set search_path = public;
alter function public.update_provisioning_jobs_updated_at() set search_path = public;
alter function public.seed_onboarding_checkpoints(uuid) set search_path = public;
alter function public.set_notification_preferences_updated_at() set search_path = public;
