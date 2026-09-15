-- Sprint 17: Módulo Financeiro + Asaas
-- ────────────────────────────────────────────────────────────────

-- ── 1. financial_accounts ─────────────────────────────────────
create table if not exists financial_accounts (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid references companies(id) not null,
  name          text not null,
  type          text not null check (type in ('checking', 'cash', 'savings')),
  balance_cents int  not null default 0,
  is_default    boolean not null default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table financial_accounts enable row level security;

create policy "company gerencia próprias contas" on financial_accounts
  for all using (company_id = my_company_id());

create index on financial_accounts(company_id);

-- ── 2. financial_transactions ─────────────────────────────────
create table if not exists financial_transactions (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid references companies(id) not null,
  account_id        uuid references financial_accounts(id),
  type              text not null check (type in ('receivable', 'payable')),
  description       text not null,
  amount_cents      int  not null check (amount_cents > 0),
  due_date          date not null,
  paid_at           timestamptz,
  status            text not null default 'pending'
                    check (status in ('pending', 'paid', 'overdue', 'canceled')),
  category          text,
  reference_id      uuid,
  reference_type    text check (reference_type in ('sale', 'purchase', 'manual') or reference_type is null),
  provider_charge_id text,         -- Asaas payment ID
  metadata          jsonb,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

alter table financial_transactions enable row level security;

create policy "company gerencia próprias transações" on financial_transactions
  for all using (company_id = my_company_id());

create index on financial_transactions(company_id);
create index on financial_transactions(company_id, status);
create index on financial_transactions(company_id, due_date);
create index on financial_transactions(company_id, type);

-- ── 3. Trigger: updated_at automático ─────────────────────────
create or replace function update_financial_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_financial_accounts_updated_at
  before update on financial_accounts
  for each row execute function update_financial_updated_at();

create trigger trg_financial_transactions_updated_at
  before update on financial_transactions
  for each row execute function update_financial_updated_at();

-- ── 4. Trigger: marcar overdue automaticamente ─────────────────
-- (opcional: rodado via cron ou manualmente)
create or replace function mark_overdue_transactions()
returns void language plpgsql security definer as $$
begin
  update financial_transactions
  set status = 'overdue', updated_at = now()
  where status = 'pending'
    and due_date < current_date;
end;
$$;

-- ── 5. Seed: feature flag financial.enabled ───────────────────
-- Impulsiona+ e Escala = true | Organiza = false
do $$
declare
  v_organiza   uuid;
  v_impulsiona uuid;
  v_escala     uuid;
begin
  select id into v_organiza   from plans where slug = 'kyra-organiza'   limit 1;
  select id into v_impulsiona from plans where slug = 'kyra-impulsiona' limit 1;
  select id into v_escala     from plans where slug = 'kyra-escala'     limit 1;

  if v_organiza is not null then
    insert into plan_entitlements (plan_id, feature_key, value_type, bool_value)
    values (v_organiza, 'financial.enabled', 'boolean', false)
    on conflict (plan_id, feature_key) do update set bool_value = false;
  end if;

  if v_impulsiona is not null then
    insert into plan_entitlements (plan_id, feature_key, value_type, bool_value)
    values (v_impulsiona, 'financial.enabled', 'boolean', true)
    on conflict (plan_id, feature_key) do update set bool_value = true;
  end if;

  if v_escala is not null then
    insert into plan_entitlements (plan_id, feature_key, value_type, bool_value)
    values (v_escala, 'financial.enabled', 'boolean', true)
    on conflict (plan_id, feature_key) do update set bool_value = true;
  end if;
end;
$$;
