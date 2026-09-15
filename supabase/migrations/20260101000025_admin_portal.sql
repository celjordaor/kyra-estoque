-- Sprint 13: Admin Portal
-- ─────────────────────────────────────────────────────────────

-- 1. Super admin flag em profiles
alter table public.profiles
  add column if not exists is_super_admin boolean not null default false;

comment on column public.profiles.is_super_admin is
  'Flag de acesso ao portal administrativo interno da Kyra. Setado manualmente via service role.';

-- 2. Leads do site (formulário de contato / interesse)
create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  phone       text,
  company     text,
  employees   text,                           -- '1-5' | '6-20' | '21-100' | '100+'
  message     text,
  source      text not null default 'site',   -- 'site' | 'demo' | 'referral'
  status      text not null default 'new'     -- 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
    check (status in ('new', 'contacted', 'qualified', 'converted', 'lost')),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger leads_updated_at
  before update on public.leads
  for each row execute function public.handle_updated_at();

-- 3. Tickets de suporte
create table if not exists public.support_tickets (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references public.companies(id) on delete set null,
  user_id     uuid references auth.users(id) on delete set null,
  subject     text not null,
  description text not null,
  category    text not null default 'other'   -- 'billing' | 'bug' | 'feature' | 'other'
    check (category in ('billing', 'bug', 'feature', 'other')),
  priority    text not null default 'medium'  -- 'low' | 'medium' | 'high' | 'critical'
    check (priority in ('low', 'medium', 'high', 'critical')),
  status      text not null default 'open'    -- 'open' | 'in_progress' | 'resolved' | 'closed'
    check (status in ('open', 'in_progress', 'resolved', 'closed')),
  admin_notes text,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger support_tickets_updated_at
  before update on public.support_tickets
  for each row execute function public.handle_updated_at();

-- 4. RLS — leads e tickets são admin-only
alter table public.leads enable row level security;
alter table public.support_tickets enable row level security;

-- Usuários normais podem criar tickets (para si mesmos)
create policy "support_tickets_user_insert" on public.support_tickets
  for insert with check (user_id = auth.uid() and company_id = my_company_id());

create policy "support_tickets_user_select" on public.support_tickets
  for select using (company_id = my_company_id());

-- Índices
create index if not exists leads_status_idx on public.leads(status);
create index if not exists leads_created_at_idx on public.leads(created_at desc);
create index if not exists support_tickets_company_idx on public.support_tickets(company_id);
create index if not exists support_tickets_status_idx on public.support_tickets(status);
