-- ═══════════════════════════════════════════════════════════════
-- Migration: 0049 — Adiciona indexes faltantes em purchase_orders
-- Auditoria de performance — 2026-09-17
--
-- purchase_orders e purchase_order_items não tinham index em
-- company_id / purchase_order_id, causando table scans ao
-- listar pedidos de uma empresa.
--
-- Nota: company_integrations tem unique(company_id, type) que
-- já cria índice implícito. notification_preferences tem
-- unique(user_id, company_id) idem. Apenas purchase_orders
-- precisava de índice explícito.
-- ═══════════════════════════════════════════════════════════════

create index if not exists purchase_orders_company_id_idx
  on public.purchase_orders(company_id);

create index if not exists purchase_orders_company_status_idx
  on public.purchase_orders(company_id, status);

create index if not exists purchase_orders_company_created_at_idx
  on public.purchase_orders(company_id, created_at desc);

create index if not exists purchase_order_items_order_id_idx
  on public.purchase_order_items(purchase_order_id);
