-- =============================================================
-- Migration 020: Fix companies RLS — remove recursive subquery,
-- use my_company_id() + my_role() security-definer functions.
-- =============================================================

-- Drop old recursive policies
drop policy if exists "companies: member can read own"  on public.companies;
drop policy if exists "companies: admin can update"     on public.companies;

-- Read: any active member of the company
create policy "companies: member can read own"
  on public.companies for select
  using (id = public.my_company_id());

-- Update: owner or admin only
create policy "companies: admin can update"
  on public.companies for update
  using (
    id = public.my_company_id()
    and public.my_role() in ('owner', 'admin')
  );
