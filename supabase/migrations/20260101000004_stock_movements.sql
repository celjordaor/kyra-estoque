-- ═══════════════════════════════════════════════════════════════
-- Migration: 004 — stock_movements (source of truth)
-- ═══════════════════════════════════════════════════════════════
-- REGRA DE NEGÓCIO CRÍTICA:
-- O saldo de estoque é SEMPRE calculado a partir dos movimentos.
-- Nunca confie apenas em products.stock_quantity sem verificar os movimentos.
-- products.stock_quantity é um cache desnormalizado para performance.

-- ── Tipos de movimento ────────────────────────────────────────
create type public.stock_movement_type as enum (
  'ENTRADA',        -- Compra / recebimento
  'SAIDA',          -- Venda / baixa
  'AJUSTE',         -- Inventário / correção manual
  'TRANSFERENCIA',  -- Transferência entre locais (futuro)
  'DEVOLUCAO',      -- Devolução de cliente ou fornecedor
  'INVENTARIO'      -- Contagem física / balanço
);

-- ── stock_movements ───────────────────────────────────────────
create table public.stock_movements (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete restrict,

  type          public.stock_movement_type not null,
  quantity      numeric(12,3) not null,     -- sempre positivo; tipo define crédito/débito
  unit_cost     numeric(12,2),              -- custo unitário no momento do movimento
  total_cost    numeric(14,2)               -- quantity * unit_cost (denormalizado)
    generated always as (
      case when unit_cost is not null then quantity * unit_cost else null end
    ) stored,

  -- Saldo calculado após este movimento (snapshot para auditoria)
  balance_after numeric(12,3),

  -- Rastreabilidade
  reference_type  text,                    -- 'sale', 'purchase_order', 'adjustment', etc.
  reference_id    uuid,                    -- ID do documento de origem
  notes           text,
  location        text,                    -- Almoxarifado / prateleira (futuro)

  -- Quem fez
  created_by    uuid references public.profiles(id) on delete set null,
  -- AI-generated movements
  ai_generated  boolean not null default false,
  ai_context    jsonb,

  created_at    timestamptz not null default now(),

  -- Movimentos não podem ser atualizados — somente inseridos ou estornados
  -- (imutabilidade garante rastreabilidade)
  constraint quantity_positive check (quantity > 0)
);

create index stock_movements_company_id_idx   on public.stock_movements(company_id);
create index stock_movements_product_id_idx   on public.stock_movements(product_id);
create index stock_movements_created_at_idx   on public.stock_movements(company_id, created_at desc);
create index stock_movements_reference_idx    on public.stock_movements(company_id, reference_type, reference_id);
create index stock_movements_type_idx         on public.stock_movements(company_id, type);

-- ── Trigger: atualiza products.stock_quantity após cada movimento ─
create or replace function public.update_product_stock()
returns trigger language plpgsql security definer as $$
declare
  v_delta      numeric;
  v_new_stock  numeric;
begin
  -- SAIDA debita; todos os outros tipos creditam
  if NEW.type = 'SAIDA' then
    v_delta := -NEW.quantity;
  else
    v_delta := NEW.quantity;
  end if;

  update public.products
  set stock_quantity = stock_quantity + v_delta
  where id = NEW.product_id
  returning stock_quantity into v_new_stock;

  -- Guarda snapshot do saldo pós-movimento para auditoria
  update public.stock_movements
  set balance_after = v_new_stock
  where id = NEW.id;

  return NEW;
end;
$$;

create trigger stock_movement_inserted
  after insert on public.stock_movements
  for each row execute function public.update_product_stock();

-- ── Impede UPDATE e DELETE em movimentos (imutabilidade) ──────
create or replace function public.prevent_movement_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'stock_movements são imutáveis. Crie um movimento de estorno em vez de editar.';
end;
$$;

create trigger no_update_stock_movements
  before update on public.stock_movements
  for each row execute function public.prevent_movement_mutation();

create trigger no_delete_stock_movements
  before delete on public.stock_movements
  for each row execute function public.prevent_movement_mutation();

-- ── RLS: stock_movements ──────────────────────────────────────
alter table public.stock_movements enable row level security;

create policy "stock_movements: member can read"
  on public.stock_movements for select
  using (company_id in (
    select company_id from public.profiles where id = auth.uid() and is_active = true
  ));

create policy "stock_movements: member can insert"
  on public.stock_movements for insert
  with check (company_id in (
    select company_id from public.profiles where id = auth.uid() and is_active = true
  ));

-- Nenhuma policy de UPDATE ou DELETE — triggers bloqueiam no nível do BD.
