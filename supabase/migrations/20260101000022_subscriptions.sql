-- ═══════════════════════════════════════════════════════════════
-- Migration: 0022 — Assinaturas, Contadores de Uso e Billing
-- Sprint 10a — Fundação de Assinaturas
-- ═══════════════════════════════════════════════════════════════
--
-- Tabelas:
--   subscriptions   → assinatura ativa de cada empresa (com RLS)
--   usage_counters  → contadores mensais de consumo (com RLS)
--   billing_events  → log idempotente de webhooks de billing (sem RLS)
--
-- Funções:
--   increment_usage_counter  → upsert atômico de contador mensal
--   create_company_trial     → cria trial 14d Kyra Impulsiona
--
-- Trigger:
--   on_company_created → chama create_company_trial automaticamente
-- ═══════════════════════════════════════════════════════════════

-- ── 1. subscriptions ──────────────────────────────────────────
create table public.subscriptions (
  id                       uuid        primary key default gen_random_uuid(),
  company_id               uuid        not null references public.companies(id) on delete cascade,
  plan_id                  uuid        not null references public.plans(id),
  price_id                 uuid        references public.plan_prices(id),
  status                   text        not null default 'trialing'
                             check (status in ('trialing','active','past_due','canceled','expired','paused')),
  billing_interval         text        check (billing_interval in ('month','year')),
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  trial_start              timestamptz,
  trial_end                timestamptz,
  cancel_at_period_end     boolean     not null default false,
  canceled_at              timestamptz,
  provider                 text        not null default 'mock'
                             check (provider in ('stripe','asaas','mock')),
  provider_customer_id     text,
  provider_subscription_id text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index subscriptions_company_id_idx on public.subscriptions(company_id);
create index subscriptions_status_idx     on public.subscriptions(status);

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.handle_updated_at();

comment on table public.subscriptions is
  'Assinatura de cada empresa. Uma empresa ativa deve ter exatamente uma linha status != canceled/expired.';
comment on column public.subscriptions.status is
  'trialing=trial ativo | active=pago | past_due=pagamento atrasado | canceled=cancelado | expired=expirado | paused=pausado';
comment on column public.subscriptions.provider is
  'Provedor de billing. mock=dev/testes sem integração real.';

-- RLS: empresa vê apenas a própria assinatura
alter table public.subscriptions enable row level security;

create policy "subscriptions: empresa lê própria assinatura"
  on public.subscriptions for select
  using (company_id = public.my_company_id());

-- Owner/admin pode ver e atualizar — escritas reais via service role (Server Actions)
create policy "subscriptions: owner/admin pode atualizar"
  on public.subscriptions for update
  using (
    company_id = public.my_company_id()
    and public.my_role() in ('owner', 'admin')
  );

-- ── 2. usage_counters ─────────────────────────────────────────
create table public.usage_counters (
  id           uuid  primary key default gen_random_uuid(),
  company_id   uuid  not null references public.companies(id) on delete cascade,
  metric_key   text  not null,        -- ex: 'image_product_ai.monthly'
  period_start date  not null,        -- primeiro dia do mês de referência
  period_end   date  not null,        -- último dia do mês de referência
  quantity     int   not null default 0 check (quantity >= 0),
  updated_at   timestamptz not null default now(),
  unique(company_id, metric_key, period_start)
);

create index usage_counters_company_metric_idx
  on public.usage_counters(company_id, metric_key, period_start);

comment on table public.usage_counters is
  'Contadores mensais de consumo de features com limite. Incrementado atomicamente via função RPC.';
comment on column public.usage_counters.metric_key is
  'Corresponde ao feature_key em plan_entitlements. Ex: image_product_ai.monthly';

alter table public.usage_counters enable row level security;

create policy "usage_counters: empresa lê próprio uso"
  on public.usage_counters for select
  using (company_id = public.my_company_id());

-- ── 3. billing_events ─────────────────────────────────────────
-- Não tem RLS — escrito apenas por webhooks server-side (service role).
-- Usuários autenticados não têm acesso.
create table public.billing_events (
  id            uuid        primary key default gen_random_uuid(),
  provider      text        not null,           -- 'stripe' | 'asaas' | 'mock'
  event_id      text        not null,           -- ID único do evento no provedor
  event_type    text        not null,           -- ex: 'subscription.updated'
  payload       jsonb,
  processed_at  timestamptz,
  status        text        not null default 'pending'
                  check (status in ('pending','processed','failed','skipped')),
  error_message text,
  created_at    timestamptz not null default now(),
  unique(provider, event_id)                   -- idempotência: rejeita replay
);

create index billing_events_status_idx    on public.billing_events(status);
create index billing_events_provider_idx  on public.billing_events(provider, event_id);

comment on table public.billing_events is
  'Log idempotente de webhooks de billing. Escrito apenas via service role server-side. unique(provider, event_id) previne reprocessamento.';

alter table public.billing_events enable row level security;
-- Sem policies: nenhum usuário autenticado pode ler/escrever billing_events diretamente.

-- ── 4. Função: increment_usage_counter ────────────────────────
-- Upsert atômico — incrementa o contador ou cria a linha se não existir.
-- Chamada por Server Actions server-side (service role).
create or replace function public.increment_usage_counter(
  p_company_id  uuid,
  p_metric_key  text,
  p_period_start date,
  p_period_end   date,
  p_amount       int default 1
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usage_counters
    (company_id, metric_key, period_start, period_end, quantity)
  values
    (p_company_id, p_metric_key, p_period_start, p_period_end, p_amount)
  on conflict (company_id, metric_key, period_start)
  do update set
    quantity   = usage_counters.quantity + p_amount,
    updated_at = now();
end;
$$;

comment on function public.increment_usage_counter is
  'Upsert atômico do contador de uso mensal. p_amount pode ser negativo para decrementar (ex: rollback).';

grant execute on function public.increment_usage_counter to authenticated;

-- ── 5. Função: create_company_trial ───────────────────────────
-- Cria assinatura de trial de 14 dias no Kyra Impulsiona para uma empresa.
-- Idempotente: não cria se já existe subscription para a empresa.
-- Chamada pelo trigger on_company_created e por Server Actions de onboarding.
create or replace function public.create_company_trial(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id  uuid;
  v_price_id uuid;
  v_now      timestamptz := now();
  v_trial_end timestamptz := now() + interval '14 days';
begin
  -- Verificação idempotente: se já existe subscription, não faz nada
  if exists (
    select 1 from public.subscriptions where company_id = p_company_id
  ) then
    return;
  end if;

  -- Busca o plano Kyra Impulsiona
  select id into v_plan_id
    from public.plans
   where slug = 'kyra-impulsiona' and active = true
   limit 1;

  if v_plan_id is null then
    raise exception 'Plano kyra-impulsiona não encontrado. Execute a migration 0021 primeiro.';
  end if;

  -- Busca o preço mensal do Impulsiona (trial usa billing mensal por padrão)
  select id into v_price_id
    from public.plan_prices
   where plan_id = v_plan_id
     and billing_interval = 'month'
     and active = true
   limit 1;

  -- Cria a assinatura de trial
  insert into public.subscriptions (
    company_id,
    plan_id,
    price_id,
    status,
    billing_interval,
    trial_start,
    trial_end,
    provider
  ) values (
    p_company_id,
    v_plan_id,
    v_price_id,
    'trialing',
    'month',
    v_now,
    v_trial_end,
    'mock'
  );
end;
$$;

comment on function public.create_company_trial is
  'Cria trial de 14 dias no Kyra Impulsiona para uma empresa. Idempotente. Chamada pelo trigger on_company_created e por Server Actions de onboarding.';

-- Não expor para authenticated — só service role ou trigger chamam isso
-- grant execute on function public.create_company_trial to authenticated;

-- ── 6. Trigger: on_company_created ────────────────────────────
-- Executa automaticamente ao criar qualquer empresa nova.
-- Garante que toda empresa sai de fábrica com trial de 14d Impulsiona.
create or replace function public.handle_new_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Cria trial automaticamente (idempotente — seguro mesmo se chamado 2x)
  perform public.create_company_trial(new.id);
  return new;
end;
$$;

create trigger on_company_created
  after insert on public.companies
  for each row
  execute function public.handle_new_company();

comment on trigger on_company_created on public.companies is
  'Dispara create_company_trial após inserção de qualquer empresa. Garante trial 14d Kyra Impulsiona de fábrica.';
