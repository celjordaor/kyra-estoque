-- Migration 0047: companies — adicionar coluna notes (observações internas do super admin)
-- A coluna já é usada em provisioning.ts ao criar tenant; estava faltando na tabela.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS notes text NULL;
