-- ═══════════════════════════════════════════════════════════════
-- Migration: 005 — sales + sale_items
-- ═══════════════════════════════════════════════════════════════

create type public.sale_status as enum (
  'PENDING',    -- Em aberto / aguardando pagamento
  'COMPLETED',  -- Concluída e paga
  'CANCELLED',  -- Cancelada (sem baixa de estoque)
  'REFUNDED'    -- Devolvida (estorno de estoque criado)
);

create type public.payment_method as enum (
  'CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'PIX', 'BOLETO', 'TRANSFER', 'OTHER'
);

-- ── sales ─────────────────────────────────────────────────────
create table public.sales (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,

  -- Identification
  sale_number     text not null,            -- Número legível: "VND-2026-0001"
  status          public.sale_status not null default 'PENDING',

  -- Customer (desnormalizado — CRM será Etapa futura)
  customer_name   text,
  customer_email  text,
  customer_phone  text,
  customer_doc    text,                     -- CPF / CNPJ

  -- Financial
  subtotal        numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  discount_pct    numeric(5,2)  not null default 0 check (discount_pct between 0 and 100),
  total_amount    numeric(14,2) not null default 0,
  cost_total      numeric(14,2) not null default 0,  -- custo total dos itens
  margin          numeric(5,2),                       -- margem em % (calculada)

  -- Payment
  payment_method  public.payment_method,
  paid_at         timestamptz,
  payment_ref     text,                     -- Código PIX, NSU cartão, etc.

  -- Notes
  notes           text,
  internal_notes  text,

  -- AI
  ai_assisted     boolean not null default false,
  ai_context      jsonb,

  -- Audit
  created_by      uuid references public.profiles(id) on delete set null,
  cancelled_by    uuid references public.profiles(id) on delete set null,
  cancelled_at    timestamptz,
  cancel_reason   text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (company_id, sale_number)
);

create index sales_company_id_idx    on public.sales(company_id);
create index sales_status_idx        on public.sales(company_id, status);
create index sales_created_at_idx    on public.sales(company_id, created_at desc);
create index sales_customer_idx      on public.sales(company_id, customer_email);

create trigger sales_updated_at
  before update on public.sales
  for each row execute function public.handle_updated_at();

-- ── sale_items ────────────────────────────────────────────────
create table public.sale_items (
  id              uuid primary key default gen_random_uuid(),
  sale_id         uuid not null references public.sales(id) on delete cascade,
  company_id      uuid not null references public.companies(id) on delete cascade,
  product_id      uuid not null references public.products(id) on delete restrict,

  -- Snapshot dos dados do produto no momento da venda
  product_name    text not null,
  product_sku     text,
  unit            text not null default 'un',

  quantity        numeric(12,3) not null check (quantity > 0),
  unit_price      numeric(12,2) not null check (unit_price >= 0),
  unit_cost       numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  total_price     numeric(14,2) not null,   -- (unit_price - discount) * quantity
  total_cost      numeric(14,2) not null,   -- unit_cost * quantity
  margin          numeric(5,2),             -- margem do item em %

  -- Referência ao movimento de estoque criado para este item
  stock_movement_id uuid references public.stock_movements(id) on delete set null,

  created_at      timestamptz not null default now()
);

create index sale_items_sale_id_idx     on public.sale_items(sale_id);
create index sale_items_product_id_idx  on public.sale_items(product_id);
create index sale_items_company_id_idx  on public.sale_items(company_id);

-- ── Trigger: ao completar venda, gera movimentos de estoque ──
create or replace function public.handle_sale_completed()
returns trigger language plpgsql security definer as $$
begin
  -- Só executa quando status muda para COMPLETED
  if NEW.status = 'COMPLETED' and (OLD.status is null or OLD.status <> 'COMPLETED') then
    insert into public.stock_movements (
      company_id, product_id, type, quantity, unit_cost,
      reference_type, reference_id, notes, created_by
    )
    select
      si.company_id,
      si.product_id,
      'SAIDA',
      si.quantity,
      si.unit_cost,
      'sale',
      NEW.id,
      'Venda ' || NEW.sale_number,
      NEW.created_by
    from public.sale_items si
    where si.sale_id = NEW.id;

    -- Atualiza totais financeiros da venda
    update public.sales
    set
      cost_total = (select sum(total_cost) from public.sale_items where sale_id = NEW.id),
      margin = case
        when NEW.total_amount > 0 then
          round(((NEW.total_amount - (select sum(total_cost) from public.sale_items where sale_id = NEW.id))
          / NEW.total_amount) * 100, 2)
        else 0
      end,
      paid_at = coalesce(NEW.paid_at, now())
    where id = NEW.id;
  end if;

  -- Ao cancelar, cria movimentos de devolução
  if NEW.status = 'REFUNDED' and OLD.status = 'COMPLETED' then
    insert into public.stock_movements (
      company_id, product_id, type, quantity, unit_cost,
      reference_type, reference_id, notes, created_by
    )
    select
      si.company_id,
      si.product_id,
      'DEVOLUCAO',
      si.quantity,
      si.unit_cost,
      'sale_refund',
      NEW.id,
      'Estorno venda ' || NEW.sale_number,
      NEW.cancelled_by
    from public.sale_items si
    where si.sale_id = NEW.id;
  end if;

  return NEW;
end;
$$;

create trigger sale_status_changed
  after update of status on public.sales
  for each row execute function public.handle_sale_completed();

-- ── Sequence para sale_number ──────────────────────────────────
create sequence if not exists public.sale_number_seq;

create or replace function public.generate_sale_number(p_company_id uuid)
returns text language plpgsql as $$
declare
  v_year  text := to_char(now(), 'YYYY');
  v_seq   bigint;
begin
  v_seq := nextval('public.sale_number_seq');
  return 'VND-' || v_year || '-' || lpad(v_seq::text, 5, '0');
end;
$$;

-- ── RLS: sales ────────────────────────────────────────────────
alter table public.sales enable row level security;

create policy "sales: member can read"
  on public.sales for select
  using (company_id in (
    select company_id from public.profiles where id = auth.uid() and is_active = true
  ));

create policy "sales: member can insert"
  on public.sales for insert
  with check (company_id in (
    select company_id from public.profiles where id = auth.uid() and is_active = true
  ));

create policy "sales: member can update own or manager+"
  on public.sales for update
  using (company_id in (
    select company_id from public.profiles where id = auth.uid() and is_active = true
  ));

-- ── RLS: sale_items ───────────────────────────────────────────
alter table public.sale_items enable row level security;

create policy "sale_items: member can read"
  on public.sale_items for select
  using (company_id in (
    select company_id from public.profiles where id = auth.uid() and is_active = true
  ));

create policy "sale_items: member can insert"
  on public.sale_items for insert
  with check (company_id in (
    select company_id from public.profiles where id = auth.uid() and is_active = true
  ));
