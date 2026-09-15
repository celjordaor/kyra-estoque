-- Migration 0011: Add state_registration and whatsapp to suppliers

alter table public.suppliers
  add column if not exists state_registration text,
  add column if not exists whatsapp text;

comment on column public.suppliers.state_registration is 'Inscrição estadual do fornecedor (pessoa jurídica)';
comment on column public.suppliers.whatsapp is 'WhatsApp do fornecedor para contato';
