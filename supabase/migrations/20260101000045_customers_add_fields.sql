-- Migration 0045: Add state_registration and whatsapp to customers
-- Formaliza hotfix aplicado diretamente no banco de produção.
-- Usa IF NOT EXISTS para ser idempotente.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS state_registration text,
  ADD COLUMN IF NOT EXISTS whatsapp            text;

COMMENT ON COLUMN public.customers.state_registration IS 'Inscrição estadual do cliente (pessoa jurídica)';
COMMENT ON COLUMN public.customers.whatsapp            IS 'WhatsApp do cliente para contato';
