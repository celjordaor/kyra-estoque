-- ============================================================
-- Migration 0032 — Fix: renomear subscriptions.trial_end → trial_ends_at
-- ============================================================
-- Problema:
--   A coluna foi criada como 'trial_end' na migration 0022, mas o
--   types.ts, entitlement-service.ts e billing.ts consultam 'trial_ends_at'.
--   O PostgREST retornava erro silencioso → fetchActiveSubscription()
--   retornava null → hasFeature() sempre false → /financial locked e
--   Settings → Assinatura mostrava "Nenhuma assinatura ativa encontrada".
-- ============================================================

alter table public.subscriptions
  rename column trial_end to trial_ends_at;

-- Renomear trial_start → trial_starts_at por simetria (sem uso no código ainda,
-- mas evita confusão futura)
alter table public.subscriptions
  rename column trial_start to trial_starts_at;

comment on column public.subscriptions.trial_ends_at is
  'Data de término do período de trial. NULL se não for trial.';

comment on column public.subscriptions.trial_starts_at is
  'Data de início do período de trial. NULL se não for trial.';

-- ── Atualizar create_company_trial para usar novos nomes de colunas ──────────
-- A função criada em 0022 ainda referencia trial_start e trial_end.
-- Após o rename, ela quebraria. Recriamos com os nomes corretos.

create or replace function public.create_company_trial(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id   uuid;
  v_price_id  uuid;
  v_now       timestamptz := now();
  v_trial_end timestamptz := now() + interval '14 days';
begin
  -- Idempotente: se já existe subscription, não cria outra
  if exists (
    select 1 from public.subscriptions where company_id = p_company_id
  ) then
    return;
  end if;

  select id into v_plan_id
    from public.plans
   where slug = 'kyra-impulsiona' and active = true
   limit 1;

  if v_plan_id is null then
    raise exception 'Plano kyra-impulsiona não encontrado. Execute a migration 0021 primeiro.';
  end if;

  select id into v_price_id
    from public.plan_prices
   where plan_id = v_plan_id
     and billing_interval = 'month'
     and active = true
   limit 1;

  insert into public.subscriptions (
    company_id,
    plan_id,
    price_id,
    status,
    billing_interval,
    trial_starts_at,
    trial_ends_at,
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
  'Cria trial de 14 dias no Kyra Impulsiona para uma empresa. Idempotente. (Atualizado em 0032 para usar trial_starts_at/trial_ends_at.)';

-- ── Corrigir usage_counters.quantity → current_value ─────────────────────────
-- A coluna foi criada como 'quantity' na migration 0022, mas o
-- entitlement-service.ts e UsageCounterRow usam 'current_value'.
-- Mesmo padrão: erro silencioso do PostgREST → canUse() sempre retorna 0.

alter table public.usage_counters
  rename column quantity to current_value;

-- Atualizar increment_usage_counter para usar novo nome
create or replace function public.increment_usage_counter(
  p_company_id   uuid,
  p_metric_key   text,
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
    (company_id, metric_key, period_start, period_end, current_value)
  values
    (p_company_id, p_metric_key, p_period_start, p_period_end, p_amount)
  on conflict (company_id, metric_key, period_start)
  do update set
    current_value = usage_counters.current_value + p_amount,
    updated_at    = now();
end;
$$;

comment on function public.increment_usage_counter is
  'Upsert atômico do contador de uso mensal. (Atualizado em 0032 para usar current_value.)';
