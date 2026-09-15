-- ═══════════════════════════════════════════════════════════════
-- Migration: 002 — companies + profiles (multi-tenant root)
-- ═══════════════════════════════════════════════════════════════

-- ── companies ─────────────────────────────────────────────────
create table public.companies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,       -- URL-safe identifier
  document      text,                       -- CNPJ / CPF
  email         text,
  phone         text,
  logo_url      text,
  plan          text not null default 'free' check (plan in ('free', 'pro', 'enterprise')),
  timezone      text not null default 'America/Sao_Paulo',
  currency      text not null default 'BRL',
  locale        text not null default 'pt-BR',
  is_active     boolean not null default true,
  trial_ends_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger companies_updated_at
  before update on public.companies
  for each row execute function public.handle_updated_at();

-- ── profiles ──────────────────────────────────────────────────
-- One profile per Supabase Auth user. Links user to a company.
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  company_id    uuid references public.companies(id) on delete set null,
  email         text not null,
  full_name     text not null default '',
  avatar_url    text,
  role          text not null default 'member' check (role in ('owner', 'admin', 'manager', 'member', 'viewer')),
  is_active     boolean not null default true,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index profiles_company_id_idx on public.profiles(company_id);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- Wire up auth trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── RLS: companies ────────────────────────────────────────────
alter table public.companies enable row level security;

-- Users can only read their own company
create policy "companies: member can read own"
  on public.companies for select
  using (
    id in (
      select company_id from public.profiles
      where id = auth.uid() and is_active = true
    )
  );

-- Owners/admins can update their company
create policy "companies: admin can update"
  on public.companies for update
  using (
    id in (
      select company_id from public.profiles
      where id = auth.uid() and role in ('owner', 'admin') and is_active = true
    )
  );

-- ── RLS: profiles ─────────────────────────────────────────────
alter table public.profiles enable row level security;

-- Read all profiles in same company
create policy "profiles: member can read same company"
  on public.profiles for select
  using (
    company_id in (
      select company_id from public.profiles
      where id = auth.uid() and is_active = true
    )
  );

-- Users can update their own profile
create policy "profiles: user can update own"
  on public.profiles for update
  using (id = auth.uid());

-- Admins can manage profiles in their company
create policy "profiles: admin can manage"
  on public.profiles for all
  using (
    company_id in (
      select company_id from public.profiles
      where id = auth.uid() and role in ('owner', 'admin') and is_active = true
    )
  );
