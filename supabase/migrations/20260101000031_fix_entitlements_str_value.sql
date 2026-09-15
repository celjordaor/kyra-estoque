-- ============================================================
-- Migration 0031 — Fix: plan_entitlements.str_value + re-seed subscriptions
-- ============================================================
-- Problemas corrigidos:
--   1. entitlement-service.ts seleciona str_value, mas a coluna não existia
--      → Supabase retornava erro silencioso → hasFeature() sempre false
--   2. Re-seed de assinaturas mais robusto para ambiente de dev
-- ============================================================

-- ── 1. Adicionar str_value em plan_entitlements ──────────────
alter table public.plan_entitlements
  add column if not exists str_value text;

-- ── 2. Atualizar check constraint para aceitar 'string' ──────
alter table public.plan_entitlements
  drop constraint if exists plan_entitlements_value_type_check;

alter table public.plan_entitlements
  add constraint plan_entitlements_value_type_check
  check (value_type in ('integer', 'boolean', 'string'));

-- ── 3. Re-seed de assinatura ativa para todas as empresas ────
-- Garante que toda empresa tenha ao menos uma assinatura Escala ativa.
-- Idempotente: só insere se não existir active/trialing.
-- Seguro para dev — em produção, cada empresa terá sua própria assinatura
-- gerenciada pelo BillingProvider.

do $$
declare
  v_plan_id  uuid;
  v_price_id uuid;
  v_company  record;
  v_count    int := 0;
begin
  -- Buscar plano Escala
  select id into v_plan_id
    from public.plans
    where slug = 'kyra-escala'
    limit 1;

  if v_plan_id is null then
    raise warning '[0031] Plano kyra-escala não encontrado. Execute migration 0021 primeiro.';
    return;
  end if;

  -- Buscar price mensal (nullable — ok se não existir)
  select id into v_price_id
    from public.plan_prices
    where plan_id = v_plan_id
      and billing_interval = 'month'
    limit 1;

  -- Para cada empresa sem assinatura ativa ou trialing
  for v_company in
    select c.id, c.name
      from public.companies c
     where not exists (
       select 1
         from public.subscriptions s
        where s.company_id = c.id
          and s.status in ('active', 'trialing')
     )
  loop
    insert into public.subscriptions (
      company_id,
      plan_id,
      price_id,
      status,
      billing_interval,
      current_period_start,
      current_period_end,
      provider
    ) values (
      v_company.id,
      v_plan_id,
      v_price_id,          -- pode ser NULL (coluna nullable)
      'active',
      'month',
      now(),
      now() + interval '1 year',
      'mock'
    );

    v_count := v_count + 1;
    raise notice '[0031] Assinatura Escala criada para empresa: % (%)', v_company.name, v_company.id;
  end loop;

  if v_count = 0 then
    raise notice '[0031] Todas as empresas já possuem assinatura ativa — nenhuma criada.';
  else
    raise notice '[0031] Total de assinaturas criadas: %', v_count;
  end if;
end;
$$;
