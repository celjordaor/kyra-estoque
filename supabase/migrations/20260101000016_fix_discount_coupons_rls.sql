-- ═══════════════════════════════════════════════════════════════
-- Migration: 016 — Corrige RLS de discount_coupons
-- Substitui subquery direta em profiles pela função security
-- definer my_company_id() para evitar recursão infinita.
-- ═══════════════════════════════════════════════════════════════

drop policy if exists "discount_coupons: member can select" on public.discount_coupons;
drop policy if exists "discount_coupons: member can insert" on public.discount_coupons;
drop policy if exists "discount_coupons: member can update" on public.discount_coupons;
drop policy if exists "discount_coupons: manager+ can delete" on public.discount_coupons;

create policy "discount_coupons: member can select"
  on public.discount_coupons for select
  using (company_id = public.my_company_id());

create policy "discount_coupons: manager+ can insert"
  on public.discount_coupons for insert
  with check (
    company_id = public.my_company_id()
    and public.my_role() in ('owner', 'admin', 'manager')
  );

create policy "discount_coupons: manager+ can update"
  on public.discount_coupons for update
  using (
    company_id = public.my_company_id()
    and public.my_role() in ('owner', 'admin', 'manager')
  );

create policy "discount_coupons: manager+ can delete"
  on public.discount_coupons for delete
  using (
    company_id = public.my_company_id()
    and public.my_role() in ('owner', 'admin', 'manager')
  );
