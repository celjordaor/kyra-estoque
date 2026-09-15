-- ═══════════════════════════════════════════════════════════════
-- Migration: 014 — Fix stock_movement imutabilidade vs balance_after
-- ═══════════════════════════════════════════════════════════════
-- PROBLEMA:
--   O trigger update_product_stock (AFTER INSERT) faz um UPDATE em
--   stock_movements para gravar balance_after.
--   O trigger no_update_stock_movements (BEFORE UPDATE) bloqueia
--   QUALQUER update, inclusive esse interno — causando o erro
--   "stock_movements são imutáveis" ao tentar criar um movimento.
--
-- SOLUÇÃO:
--   prevent_movement_mutation verifica pg_trigger_depth().
--   Se depth > 1, estamos dentro de uma cadeia de triggers internos
--   (o UPDATE veio de outro trigger do banco) — permitimos.
--   Se depth = 1, é uma chamada direta de fora — bloqueamos.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.prevent_movement_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Permite UPDATEs internos disparados por outros triggers (ex: balance_after)
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'stock_movements são imutáveis. Crie um movimento de estorno em vez de editar.';
END;
$$;
