-- Sprint 17 fix: vincular empresa admin ao plano Escala + deprecar companies.plan
-- ────────────────────────────────────────────────────────────────────────────

-- ── 1. Seed de assinatura para dev/admin companies sem subscription ───────────
-- Insere plano Kyra Escala (ativo) para qualquer empresa sem assinatura ativa.
-- Em produção, remover este bloco ou torná-lo idempotente por company específica.

do $$
declare
  v_plan_id  uuid;
  v_price_id uuid;
  v_company  record;
begin
  select id into v_plan_id from plans where slug = 'kyra-escala' limit 1;

  if v_plan_id is null then
    raise notice 'Plano kyra-escala não encontrado. Execute migrations 10a primeiro.';
    return;
  end if;

  select id into v_price_id
    from plan_prices
    where plan_id = v_plan_id and billing_interval = 'month'
    limit 1;

  -- Para cada empresa sem assinatura ativa, criar uma no Escala (dev default)
  for v_company in
    select c.id from companies c
    where not exists (
      select 1 from subscriptions s
      where s.company_id = c.id
        and s.status in ('active', 'trialing')
    )
  loop
    insert into subscriptions (
      company_id, plan_id, price_id,
      status, billing_interval,
      current_period_start, current_period_end,
      provider
    ) values (
      v_company.id, v_plan_id, v_price_id,
      'active', 'month',
      now(), now() + interval '1 year',
      'mock'
    )
    on conflict do nothing;

    raise notice 'Assinatura Escala criada para company %', v_company.id;
  end loop;
end;
$$;

-- ── 2. Deprecar companies.plan ────────────────────────────────────────────────
-- A coluna era o modelo antigo (pré-Sprint 10). O entitlement service usa
-- subscriptions + plan_entitlements. Renomeamos para evitar confusão futura.
-- (Sem remover dados — regra: nunca deletar no downgrade)

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'companies' and column_name = 'plan'
  ) then
    alter table companies rename column plan to _plan_legacy;
    comment on column companies._plan_legacy
      is 'DEPRECATED (Sprint 17) — não usar. Assinatura real em subscriptions.';
    raise notice 'companies.plan renomeada para _plan_legacy';
  else
    raise notice 'companies.plan não existe ou já foi deprecada';
  end if;
end;
$$;
