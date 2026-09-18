-- ═══════════════════════════════════════════════════════════════
-- Migration: 0048 — Fix security definer functions
-- Auditoria de segurança — 2026-09-17
--
-- Problemas identificados:
--   1. increment_usage_counter e create_company_trial têm GRANT
--      desnecessário para 'authenticated'. Essas funções só devem
--      ser chamadas server-side (admin client / trigger). O grant
--      permite que qualquer usuário autenticado manipule contadores
--      ou assinaturas de qualquer empresa via RPC direto.
--
--   2. Quatro funções SECURITY DEFINER sem 'set search_path = public',
--      violando o benchmark de segurança do PostgreSQL.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Revogar grants desnecessários ──────────────────────────

-- increment_usage_counter: chamado somente pelo admin client server-side.
-- Um usuário autenticado poderia chamar o RPC diretamente e manipular
-- contadores de qualquer empresa (p_company_id sem validação).
revoke execute on function public.increment_usage_counter(uuid, text, date, date, int)
  from authenticated;

-- create_company_trial: chamado somente pelo trigger on_company_created.
-- Um usuário autenticado poderia criar trial para qualquer empresa
-- (mitigado pelo check de idempotência, mas grant é desnecessário).
revoke execute on function public.create_company_trial(uuid)
  from authenticated;

-- ── 2. Adicionar set search_path nas funções SECURITY DEFINER ─
-- Mitigação contra search_path injection (PostgreSQL Security Best Practices).
-- Nota: as funções já usam prefixo public. explícito nos SQL internos,
--       então o risco real é baixo, mas o search_path explicita a intenção.

create or replace function public.update_product_stock()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_delta      numeric;
  v_new_stock  numeric;
begin
  if NEW.type = 'SAIDA' then
    v_delta := -NEW.quantity;
  else
    v_delta := NEW.quantity;
  end if;

  update public.products
  set stock_quantity = stock_quantity + v_delta
  where id = NEW.product_id
  returning stock_quantity into v_new_stock;

  update public.stock_movements
  set balance_after = v_new_stock
  where id = NEW.id;

  return NEW;
end;
$$;

create or replace function public.handle_sale_completed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
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

    update public.sales
    set
      cost_total = (
        select coalesce(sum(si.quantity * si.unit_cost), 0)
        from public.sale_items si
        where si.sale_id = NEW.id
      )
    where id = NEW.id;
  end if;

  return NEW;
end;
$$;

create or replace function public.handle_sale_item_inserted()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_sale_number    text;
  v_sale_created_by uuid;
  v_sale_status    text;
begin
  select sale_number, created_by, status
    into v_sale_number, v_sale_created_by, v_sale_status
    from public.sales
    where id = NEW.sale_id;

  if v_sale_status = 'COMPLETED' then
    insert into public.stock_movements (
      company_id, product_id, type, quantity, unit_cost,
      reference_type, reference_id, notes, created_by
    ) values (
      NEW.company_id,
      NEW.product_id,
      'SAIDA',
      NEW.quantity,
      NEW.unit_cost,
      'sale',
      NEW.sale_id,
      'Venda ' || v_sale_number,
      v_sale_created_by
    );
  end if;

  return NEW;
end;
$$;

create or replace function public.mark_overdue_transactions()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.financial_transactions
  set status = 'overdue', updated_at = now()
  where status = 'pending'
    and due_date < current_date;
end;
$$;
