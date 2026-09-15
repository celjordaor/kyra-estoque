-- ═══════════════════════════════════════════════════════════════
-- Migration: 0021 — Planos, Preços e Entitlements (catálogo)
-- Sprint 10a — Fundação de Assinaturas
-- ═══════════════════════════════════════════════════════════════
--
-- Tabelas de catálogo (sem RLS — leitura pública para autenticados):
--   plans              → 3 planos do produto
--   plan_prices        → preço mensal e anual por plano
--   plan_entitlements  → features e limites por plano
--
-- Atenção: companies.plan (legado 'free'|'pro'|'enterprise') tem
-- o constraint dropado aqui. A coluna persiste por compatibilidade
-- mas a fonte de verdade passa a ser a tabela subscriptions (0022).
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Dropar constraint legado de companies.plan ─────────────
-- O constraint original: check (plan in ('free', 'pro', 'enterprise'))
-- não é compatível com os novos slugs. Mantemos a coluna para que
-- o código existente não quebre; será depreciada no Sprint 14.

alter table public.companies
  drop constraint if exists companies_plan_check;

-- ── 2. plans ─────────────────────────────────────────────────
create table public.plans (
  id          uuid    primary key default gen_random_uuid(),
  slug        text    unique not null,   -- 'kyra-organiza' | 'kyra-impulsiona' | 'kyra-escala'
  name        text    not null,
  description text,
  active      boolean not null default true,
  sort_order  int     not null default 0,
  created_at  timestamptz not null default now()
);

comment on table public.plans is
  'Catálogo de planos do produto. Leitura pública para qualquer usuário autenticado.';

-- Qualquer usuário autenticado pode ler (catálogo público)
alter table public.plans enable row level security;

create policy "plans: qualquer autenticado pode ler"
  on public.plans for select
  to authenticated
  using (active = true);

-- ── 3. plan_prices ────────────────────────────────────────────
create table public.plan_prices (
  id                uuid    primary key default gen_random_uuid(),
  plan_id           uuid    not null references public.plans(id) on delete cascade,
  billing_interval  text    not null check (billing_interval in ('month', 'year')),
  amount_cents      int     not null check (amount_cents > 0),
  currency          text    not null default 'BRL',
  active            boolean not null default true,
  provider_price_id text,               -- ex: Stripe price_xxx / Asaas (quando integrado)
  created_at        timestamptz not null default now(),
  unique(plan_id, billing_interval)
);

comment on table public.plan_prices is
  'Preços por plano e intervalo de cobrança. amount_cents em centavos de BRL.';
comment on column public.plan_prices.amount_cents is
  'Valor em centavos. Ex: 6690 = R$ 66,90. Para plano anual = valor total do ano.';

alter table public.plan_prices enable row level security;

create policy "plan_prices: qualquer autenticado pode ler"
  on public.plan_prices for select
  to authenticated
  using (active = true);

-- ── 4. plan_entitlements ──────────────────────────────────────
create table public.plan_entitlements (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.plans(id) on delete cascade,
  feature_key text not null,
  value_type  text not null check (value_type in ('integer', 'boolean')),
  int_value   int,       -- NULL = ilimitado quando value_type = 'integer'
  bool_value  boolean,   -- usado quando value_type = 'boolean'
  created_at  timestamptz not null default now(),
  unique(plan_id, feature_key)
);

comment on table public.plan_entitlements is
  'Limites e features por plano. int_value NULL = ilimitado. bool_value false = bloqueado.';
comment on column public.plan_entitlements.int_value is
  'NULL = sem limite. 0 = bloqueado. Nunca usar 0 para ilimitado.';

alter table public.plan_entitlements enable row level security;

create policy "plan_entitlements: qualquer autenticado pode ler"
  on public.plan_entitlements for select
  to authenticated
  using (true);

-- ── 5. Seed: 3 planos ─────────────────────────────────────────
insert into public.plans (slug, name, description, sort_order) values
  ('kyra-organiza',   'Kyra Organiza',   'Para colocar sua operação em ordem.',  1),
  ('kyra-impulsiona', 'Kyra Impulsiona', 'Para entender e decidir melhor.',      2),
  ('kyra-escala',     'Kyra Escala',     'Para automatizar e crescer.',          3)
on conflict (slug) do nothing;

-- ── 6. Seed: preços ───────────────────────────────────────────
-- Mensais (em centavos)
insert into public.plan_prices (plan_id, billing_interval, amount_cents)
  select id, 'month', 6690  from public.plans where slug = 'kyra-organiza'
on conflict (plan_id, billing_interval) do nothing;

insert into public.plan_prices (plan_id, billing_interval, amount_cents)
  select id, 'month', 12990 from public.plans where slug = 'kyra-impulsiona'
on conflict (plan_id, billing_interval) do nothing;

insert into public.plan_prices (plan_id, billing_interval, amount_cents)
  select id, 'month', 24990 from public.plans where slug = 'kyra-escala'
on conflict (plan_id, billing_interval) do nothing;

-- Anuais com ~20% de desconto (valor total do ano, cobrado de uma vez)
-- Organiza:   R$66,90 × 12 × 0,80 = R$642,24  → 64224 centavos
-- Impulsiona: R$129,90 × 12 × 0,80 = R$1.247,04 → 124704 centavos
-- Escala:     R$249,90 × 12 × 0,80 = R$2.399,04 → 239904 centavos
insert into public.plan_prices (plan_id, billing_interval, amount_cents)
  select id, 'year', 64224  from public.plans where slug = 'kyra-organiza'
on conflict (plan_id, billing_interval) do nothing;

insert into public.plan_prices (plan_id, billing_interval, amount_cents)
  select id, 'year', 124704 from public.plans where slug = 'kyra-impulsiona'
on conflict (plan_id, billing_interval) do nothing;

insert into public.plan_prices (plan_id, billing_interval, amount_cents)
  select id, 'year', 239904 from public.plans where slug = 'kyra-escala'
on conflict (plan_id, billing_interval) do nothing;

-- ── 7. Seed: entitlements ─────────────────────────────────────
-- Convenção:
--   value_type = 'integer', int_value = N   → limite N
--   value_type = 'integer', int_value = NULL → ilimitado
--   value_type = 'boolean', bool_value = true  → feature habilitada
--   value_type = 'boolean', bool_value = false → feature bloqueada

do $$
declare
  v_organiza   uuid;
  v_impulsiona uuid;
  v_escala     uuid;
begin
  select id into v_organiza   from public.plans where slug = 'kyra-organiza';
  select id into v_impulsiona from public.plans where slug = 'kyra-impulsiona';
  select id into v_escala     from public.plans where slug = 'kyra-escala';

  -- ── Limites de quantidade (integer) ────────────────────────
  -- products.max
  insert into public.plan_entitlements (plan_id, feature_key, value_type, int_value) values
    (v_organiza,   'products.max', 'integer', 1000),
    (v_impulsiona, 'products.max', 'integer', 5000),
    (v_escala,     'products.max', 'integer', null)   -- null = ilimitado
  on conflict (plan_id, feature_key) do nothing;

  -- customers.max — ilimitado em todos os planos
  insert into public.plan_entitlements (plan_id, feature_key, value_type, int_value) values
    (v_organiza,   'customers.max', 'integer', null),
    (v_impulsiona, 'customers.max', 'integer', null),
    (v_escala,     'customers.max', 'integer', null)
  on conflict (plan_id, feature_key) do nothing;

  -- suppliers.max — ilimitado em todos os planos
  insert into public.plan_entitlements (plan_id, feature_key, value_type, int_value) values
    (v_organiza,   'suppliers.max', 'integer', null),
    (v_impulsiona, 'suppliers.max', 'integer', null),
    (v_escala,     'suppliers.max', 'integer', null)
  on conflict (plan_id, feature_key) do nothing;

  -- users.max — ilimitado em todos os planos
  insert into public.plan_entitlements (plan_id, feature_key, value_type, int_value) values
    (v_organiza,   'users.max', 'integer', null),
    (v_impulsiona, 'users.max', 'integer', null),
    (v_escala,     'users.max', 'integer', null)
  on conflict (plan_id, feature_key) do nothing;

  -- channels.max — 1 / 3 / 10
  insert into public.plan_entitlements (plan_id, feature_key, value_type, int_value) values
    (v_organiza,   'channels.max', 'integer', 1),
    (v_impulsiona, 'channels.max', 'integer', 3),
    (v_escala,     'channels.max', 'integer', 10)
  on conflict (plan_id, feature_key) do nothing;

  -- automations.max — 2 / 10 / ilimitado
  insert into public.plan_entitlements (plan_id, feature_key, value_type, int_value) values
    (v_organiza,   'automations.max', 'integer', 2),
    (v_impulsiona, 'automations.max', 'integer', 10),
    (v_escala,     'automations.max', 'integer', null)
  on conflict (plan_id, feature_key) do nothing;

  -- image_product_ai.monthly — 50 / ilimitado / ilimitado
  insert into public.plan_entitlements (plan_id, feature_key, value_type, int_value) values
    (v_organiza,   'image_product_ai.monthly', 'integer', 50),
    (v_impulsiona, 'image_product_ai.monthly', 'integer', null),
    (v_escala,     'image_product_ai.monthly', 'integer', null)
  on conflict (plan_id, feature_key) do nothing;

  -- history.months — 6 / 24 / ilimitado
  insert into public.plan_entitlements (plan_id, feature_key, value_type, int_value) values
    (v_organiza,   'history.months', 'integer', 6),
    (v_impulsiona, 'history.months', 'integer', 24),
    (v_escala,     'history.months', 'integer', null)
  on conflict (plan_id, feature_key) do nothing;

  -- ── Features booleanas ──────────────────────────────────────
  -- nfe.import.enabled — false / true / true
  insert into public.plan_entitlements (plan_id, feature_key, value_type, bool_value) values
    (v_organiza,   'nfe.import.enabled', 'boolean', false),
    (v_impulsiona, 'nfe.import.enabled', 'boolean', true),
    (v_escala,     'nfe.import.enabled', 'boolean', true)
  on conflict (plan_id, feature_key) do nothing;

  -- fiscal.enabled — false / true / true
  insert into public.plan_entitlements (plan_id, feature_key, value_type, bool_value) values
    (v_organiza,   'fiscal.enabled', 'boolean', false),
    (v_impulsiona, 'fiscal.enabled', 'boolean', true),
    (v_escala,     'fiscal.enabled', 'boolean', true)
  on conflict (plan_id, feature_key) do nothing;

  -- nfe.emission.enabled — false / true / true
  insert into public.plan_entitlements (plan_id, feature_key, value_type, bool_value) values
    (v_organiza,   'nfe.emission.enabled', 'boolean', false),
    (v_impulsiona, 'nfe.emission.enabled', 'boolean', true),
    (v_escala,     'nfe.emission.enabled', 'boolean', true)
  on conflict (plan_id, feature_key) do nothing;

  -- pdv.advanced.enabled — false / true / true
  insert into public.plan_entitlements (plan_id, feature_key, value_type, bool_value) values
    (v_organiza,   'pdv.advanced.enabled', 'boolean', false),
    (v_impulsiona, 'pdv.advanced.enabled', 'boolean', true),
    (v_escala,     'pdv.advanced.enabled', 'boolean', true)
  on conflict (plan_id, feature_key) do nothing;

  -- channels.advanced.enabled — false / true / true
  insert into public.plan_entitlements (plan_id, feature_key, value_type, bool_value) values
    (v_organiza,   'channels.advanced.enabled', 'boolean', false),
    (v_impulsiona, 'channels.advanced.enabled', 'boolean', true),
    (v_escala,     'channels.advanced.enabled', 'boolean', true)
  on conflict (plan_id, feature_key) do nothing;

  -- automations.advanced.enabled — false / true / true
  insert into public.plan_entitlements (plan_id, feature_key, value_type, bool_value) values
    (v_organiza,   'automations.advanced.enabled', 'boolean', false),
    (v_impulsiona, 'automations.advanced.enabled', 'boolean', true),
    (v_escala,     'automations.advanced.enabled', 'boolean', true)
  on conflict (plan_id, feature_key) do nothing;

  -- purchasing.advanced.enabled — false / true / true
  insert into public.plan_entitlements (plan_id, feature_key, value_type, bool_value) values
    (v_organiza,   'purchasing.advanced.enabled', 'boolean', false),
    (v_impulsiona, 'purchasing.advanced.enabled', 'boolean', true),
    (v_escala,     'purchasing.advanced.enabled', 'boolean', true)
  on conflict (plan_id, feature_key) do nothing;

  -- whatsapp.operational.enabled — false / true / true
  insert into public.plan_entitlements (plan_id, feature_key, value_type, bool_value) values
    (v_organiza,   'whatsapp.operational.enabled', 'boolean', false),
    (v_impulsiona, 'whatsapp.operational.enabled', 'boolean', true),
    (v_escala,     'whatsapp.operational.enabled', 'boolean', true)
  on conflict (plan_id, feature_key) do nothing;

  -- ai.advanced.enabled — false / true / true
  insert into public.plan_entitlements (plan_id, feature_key, value_type, bool_value) values
    (v_organiza,   'ai.advanced.enabled', 'boolean', false),
    (v_impulsiona, 'ai.advanced.enabled', 'boolean', true),
    (v_escala,     'ai.advanced.enabled', 'boolean', true)
  on conflict (plan_id, feature_key) do nothing;

  -- multi_stock.enabled — false / false / true (Escala only)
  insert into public.plan_entitlements (plan_id, feature_key, value_type, bool_value) values
    (v_organiza,   'multi_stock.enabled', 'boolean', false),
    (v_impulsiona, 'multi_stock.enabled', 'boolean', false),
    (v_escala,     'multi_stock.enabled', 'boolean', true)
  on conflict (plan_id, feature_key) do nothing;

  -- bi.advanced.enabled — false / true / true
  insert into public.plan_entitlements (plan_id, feature_key, value_type, bool_value) values
    (v_organiza,   'bi.advanced.enabled', 'boolean', false),
    (v_impulsiona, 'bi.advanced.enabled', 'boolean', true),
    (v_escala,     'bi.advanced.enabled', 'boolean', true)
  on conflict (plan_id, feature_key) do nothing;

  -- reports.advanced.enabled — false / true / true
  insert into public.plan_entitlements (plan_id, feature_key, value_type, bool_value) values
    (v_organiza,   'reports.advanced.enabled', 'boolean', false),
    (v_impulsiona, 'reports.advanced.enabled', 'boolean', true),
    (v_escala,     'reports.advanced.enabled', 'boolean', true)
  on conflict (plan_id, feature_key) do nothing;

  -- financial.enabled — false / true / true
  insert into public.plan_entitlements (plan_id, feature_key, value_type, bool_value) values
    (v_organiza,   'financial.enabled', 'boolean', false),
    (v_impulsiona, 'financial.enabled', 'boolean', true),
    (v_escala,     'financial.enabled', 'boolean', true)
  on conflict (plan_id, feature_key) do nothing;

  -- support.priority — false / true / true
  insert into public.plan_entitlements (plan_id, feature_key, value_type, bool_value) values
    (v_organiza,   'support.priority', 'boolean', false),
    (v_impulsiona, 'support.priority', 'boolean', true),
    (v_escala,     'support.priority', 'boolean', true)
  on conflict (plan_id, feature_key) do nothing;

end;
$$;
