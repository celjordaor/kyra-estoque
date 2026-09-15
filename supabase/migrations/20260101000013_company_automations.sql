-- ═══════════════════════════════════════════════════════════════
-- Migration: 013 — company_automations
-- Habilitar/desabilitar automações por empresa
-- ═══════════════════════════════════════════════════════════════

create table public.company_automations (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,

  -- Type identifier (matches n8n workflow name)
  automation_type text not null, -- 'low_stock' | 'slow_moving' | 'weekly_report'

  -- State
  enabled         boolean not null default false,

  -- Flexible config per automation
  config          jsonb not null default '{}',

  -- Audit
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique(company_id, automation_type)
);

-- Updated_at trigger
create trigger handle_updated_at
  before update on public.company_automations
  for each row execute function public.handle_updated_at();

-- RLS
alter table public.company_automations enable row level security;

create policy "tenant_isolation" on public.company_automations
  using (company_id = my_company_id())
  with check (company_id = my_company_id());

-- Index
create index on public.company_automations(company_id);
