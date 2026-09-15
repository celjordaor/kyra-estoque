-- =============================================================
-- Migration: Fix recursive RLS on profiles table
-- Problem: The "profiles: member can read same company" policy
--          uses a subquery on profiles itself → infinite recursion
--          → auth users can't read their own profile via anon key
--          → getServerContext() always throws "Empresa não encontrada"
-- =============================================================

-- 1. Drop the broken recursive policy
drop policy if exists "profiles: member can read same company" on public.profiles;

-- 2. Allow users to always read their OWN row (non-recursive)
drop policy if exists "profiles: user can read own" on public.profiles;
create policy "profiles: user can read own"
  on public.profiles for select
  using (id = auth.uid());

-- 3. Security-definer helper to fetch the caller's company_id
--    Runs as the function owner (superuser), bypasses RLS → no recursion
create or replace function public.my_company_id()
  returns uuid
  language sql
  security definer
  stable
  set search_path = public
as $$
  select company_id
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

-- Grant execute to anon + authenticated so the policy can call it
grant execute on function public.my_company_id() to anon, authenticated;

-- 4. Allow members to read colleagues in the same company
--    Uses the helper above — no subquery on profiles, no recursion
drop policy if exists "profiles: member can read same company (v2)" on public.profiles;
create policy "profiles: member can read same company (v2)"
  on public.profiles for select
  using (
    is_active = true
    and company_id = public.my_company_id()
  );

-- (Optional) Verify: these are the only SELECT policies now
-- select policyname, cmd, qual from pg_policies
-- where tablename = 'profiles' and cmd = 'SELECT';
