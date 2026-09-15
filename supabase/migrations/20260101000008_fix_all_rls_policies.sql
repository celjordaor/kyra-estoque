-- =============================================================
-- Migration: Reescreve TODAS as policies RLS que usam subquery
-- em profiles, substituindo pela função security definer
-- my_company_id() que não dispara recursão.
-- =============================================================

-- Garantir que a função existe (criada na 000007, mas idempotente)
create or replace function public.my_company_id()
  returns uuid
  language sql
  security definer
  stable
  set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid() limit 1
$$;
grant execute on function public.my_company_id() to anon, authenticated;

-- Helper: true se o caller tem role >= manager na própria empresa
create or replace function public.my_role()
  returns text
  language sql
  security definer
  stable
  set search_path = public
as $$
  select role::text from public.profiles where id = auth.uid() limit 1
$$;
grant execute on function public.my_role() to anon, authenticated;

-- =============================================================
-- categories
-- =============================================================
drop policy if exists "categories: company member can read" on public.categories;
drop policy if exists "categories: manager+ can write"     on public.categories;

create policy "categories: company member can read"
  on public.categories for select
  using (company_id = public.my_company_id());

create policy "categories: manager+ can write"
  on public.categories for all
  using (
    company_id = public.my_company_id()
    and public.my_role() in ('owner','admin','manager')
  );

-- =============================================================
-- products
-- =============================================================
drop policy if exists "products: company member can read" on public.products;
drop policy if exists "products: manager+ can write"      on public.products;

create policy "products: company member can read"
  on public.products for select
  using (company_id = public.my_company_id());

create policy "products: manager+ can write"
  on public.products for all
  using (
    company_id = public.my_company_id()
    and public.my_role() in ('owner','admin','manager')
  );

-- =============================================================
-- stock_movements
-- =============================================================
drop policy if exists "stock_movements: member can read"   on public.stock_movements;
drop policy if exists "stock_movements: member can insert" on public.stock_movements;

create policy "stock_movements: member can read"
  on public.stock_movements for select
  using (company_id = public.my_company_id());

create policy "stock_movements: member can insert"
  on public.stock_movements for insert
  with check (company_id = public.my_company_id());

-- =============================================================
-- sales
-- =============================================================
drop policy if exists "sales: member can read"              on public.sales;
drop policy if exists "sales: member can insert"            on public.sales;
drop policy if exists "sales: member can update own or manager+" on public.sales;

create policy "sales: member can read"
  on public.sales for select
  using (company_id = public.my_company_id());

create policy "sales: member can insert"
  on public.sales for insert
  with check (company_id = public.my_company_id());

create policy "sales: member can update own or manager+"
  on public.sales for update
  using (
    company_id = public.my_company_id()
    and (
      created_by = auth.uid()
      or public.my_role() in ('owner','admin','manager')
    )
  );

-- =============================================================
-- sale_items
-- =============================================================
drop policy if exists "sale_items: member can read"   on public.sale_items;
drop policy if exists "sale_items: member can insert" on public.sale_items;

create policy "sale_items: member can read"
  on public.sale_items for select
  using (
    sale_id in (
      select id from public.sales where company_id = public.my_company_id()
    )
  );

create policy "sale_items: member can insert"
  on public.sale_items for insert
  with check (
    sale_id in (
      select id from public.sales where company_id = public.my_company_id()
    )
  );

-- =============================================================
-- ai_recommendations
-- =============================================================
drop policy if exists "ai_rec: member can read"          on public.ai_recommendations;
drop policy if exists "ai_rec: member can update status" on public.ai_recommendations;
drop policy if exists "ai_rec: service role can insert"  on public.ai_recommendations;

create policy "ai_rec: member can read"
  on public.ai_recommendations for select
  using (company_id = public.my_company_id());

create policy "ai_rec: member can update status"
  on public.ai_recommendations for update
  using (company_id = public.my_company_id());

create policy "ai_rec: service role can insert"
  on public.ai_recommendations for insert
  with check (true);

-- =============================================================
-- automation_logs
-- =============================================================
drop policy if exists "automation_logs: admin+ can read"   on public.automation_logs;
drop policy if exists "automation_logs: service role can write" on public.automation_logs;

create policy "automation_logs: admin+ can read"
  on public.automation_logs for select
  using (
    company_id = public.my_company_id()
    and public.my_role() in ('owner','admin')
  );

create policy "automation_logs: service role can write"
  on public.automation_logs for insert
  with check (true);
