-- ═══════════════════════════════════════════════════════════════
-- Migration: 017 — Corrige baixa de estoque ao inserir venda COMPLETED
-- ═══════════════════════════════════════════════════════════════
-- Problema: handle_sale_completed só disparava em UPDATE de status.
-- O PDV insere a venda já com COMPLETED, então o estoque não baixava.
--
-- Solução: criar trigger AFTER INSERT ON sale_items que, ao inserir
-- o item, cria o movimento SAIDA correspondente. Isso evita o problema
-- de race condition (sale_items não existirem quando sales é inserida).
-- ═══════════════════════════════════════════════════════════════

-- Função: ao inserir um sale_item cuja venda está COMPLETED,
-- cria o movimento SAIDA de estoque para aquele item.
create or replace function public.handle_sale_item_inserted()
returns trigger language plpgsql security definer as $$
declare
  v_sale_number text;
  v_sale_created_by uuid;
  v_sale_status text;
begin
  -- Busca dados da venda pai
  select sale_number, created_by, status
    into v_sale_number, v_sale_created_by, v_sale_status
    from public.sales
    where id = NEW.sale_id;

  -- Só cria movimento se a venda já está COMPLETED
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

-- Aplica o trigger em sale_items
drop trigger if exists sale_item_creates_stock_movement on public.sale_items;

create trigger sale_item_creates_stock_movement
  after insert on public.sale_items
  for each row
  execute function public.handle_sale_item_inserted();
