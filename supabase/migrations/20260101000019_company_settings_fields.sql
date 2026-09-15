-- ═══════════════════════════════════════════════════════════════
-- Migration: 019 — Add extra fields to companies
-- ═══════════════════════════════════════════════════════════════

-- Fantasy name, website, address
alter table public.companies
  add column if not exists fantasy_name         text,
  add column if not exists website              text,
  add column if not exists address_cep          text,
  add column if not exists address_street       text,
  add column if not exists address_number       text,
  add column if not exists address_complement   text,
  add column if not exists address_neighborhood text,
  add column if not exists address_city         text,
  add column if not exists address_state        text;

-- Operation settings
alter table public.companies
  add column if not exists allow_negative_stock boolean not null default false,
  add column if not exists track_by_movement    boolean not null default true,
  add column if not exists allow_discount       boolean not null default true,
  add column if not exists require_customer     boolean not null default false;
