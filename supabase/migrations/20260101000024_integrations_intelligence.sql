-- Sprint 12: Integrações + Inteligência
-- ─────────────────────────────────────────────────────────────

-- 1. kyra_config: configurações de IA/persona por empresa
alter table public.companies
  add column if not exists kyra_config jsonb not null default '{}';

comment on column public.companies.kyra_config is
  'Configurações de comportamento da Kyra IA. Ex: { "persona_name": "Kyra", "tone": "friendly", "enabled_modules": ["stock","sales"] }';

-- 2. company_integrations: tokens e configs de integrações externas
create table if not exists public.company_integrations (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  type        text not null,   -- 'asaas' | 'whatsapp' | 'shopify' | 'mercadolivre' | 'woocommerce'
  is_active   boolean not null default false,
  config      jsonb not null default '{}',  -- API keys, tokens (encrypted at application layer)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, type)
);

create trigger company_integrations_updated_at
  before update on public.company_integrations
  for each row execute function public.handle_updated_at();

comment on table public.company_integrations is
  'Configurações de integrações externas por empresa. Chaves sensíveis devem ser criptografadas na camada da aplicação.';

-- 3. RLS
alter table public.company_integrations enable row level security;

create policy "company_integrations_select" on public.company_integrations
  for select using (company_id = my_company_id());

create policy "company_integrations_insert" on public.company_integrations
  for insert with check (company_id = my_company_id());

create policy "company_integrations_update" on public.company_integrations
  for update using (company_id = my_company_id());

create policy "company_integrations_delete" on public.company_integrations
  for delete using (company_id = my_company_id());
