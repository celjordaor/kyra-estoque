-- Sprint 16: Relatórios — view materializada + seed feature flag
-- ────────────────────────────────────────────────────────────────

-- ── 1. Materialized view: resumo de vendas por produto ────────
-- Usada para ABC Curve, Margem, Produtos Parados (Impulsiona+)
create materialized view if not exists public.mv_product_sales_summary as
  select
    p.id                                                          as product_id,
    p.company_id,
    p.name,
    p.sku,
    p.cost_price,
    p.sale_price,
    p.stock_quantity,
    p.min_stock,
    p.is_active,
    coalesce(cat.name, 'Sem categoria')                           as category_name,
    coalesce(sum(si.quantity), 0)::integer                        as total_sold_qty,
    coalesce(sum(si.quantity * si.unit_price), 0)::numeric(12,2)  as total_revenue,
    coalesce(sum(si.quantity * si.unit_price)
           - sum(si.quantity * p.cost_price), 0)::numeric(12,2)  as total_gross_profit,
    max(s.created_at)                                             as last_sale_date
  from public.products p
  left join public.categories cat on cat.id = p.category_id
  left join public.sale_items si  on si.product_id = p.id
  left join public.sales s        on s.id = si.sale_id
                                  and s.status = 'COMPLETED'
  group by p.id, p.company_id, p.name, p.sku,
           p.cost_price, p.sale_price, p.stock_quantity,
           p.min_stock, p.is_active, cat.name;

-- Índice para filtro por empresa (service role filtra company_id)
create unique index if not exists mv_product_sales_summary_pk
  on public.mv_product_sales_summary (product_id);

create index if not exists mv_product_sales_summary_company
  on public.mv_product_sales_summary (company_id, total_revenue desc);

-- ── 2. Função para refresh (chamada por cron / on-demand) ─────
create or replace function public.refresh_sales_summary()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.mv_product_sales_summary;
end;
$$;

-- Apenas service role pode fazer refresh
revoke execute on function public.refresh_sales_summary from public;
grant  execute on function public.refresh_sales_summary to service_role;

-- ── 3. Seed: reports.advanced.enabled nos planos ─────────────
do $$
declare
  v_organiza   uuid;
  v_impulsiona uuid;
  v_escala     uuid;
begin
  select id into v_organiza   from public.plans where slug = 'organiza'   limit 1;
  select id into v_impulsiona from public.plans where slug = 'impulsiona' limit 1;
  select id into v_escala     from public.plans where slug = 'escala'     limit 1;

  if v_organiza is not null then
    insert into public.plan_entitlements (plan_id, feature_key, value_type, bool_value)
    values
      (v_organiza,   'reports.advanced.enabled', 'boolean', false),
      (v_impulsiona, 'reports.advanced.enabled', 'boolean', true),
      (v_escala,     'reports.advanced.enabled', 'boolean', true)
    on conflict (plan_id, feature_key) do nothing;
  end if;
end;
$$;
