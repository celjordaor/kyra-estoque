-- ═══════════════════════════════════════════════════════════════
-- Migration: 015 — discount_coupons (cupons de desconto PDV)
-- ═══════════════════════════════════════════════════════════════

create table public.discount_coupons (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  code            text not null,
  description     text,
  -- 'percent' = % do total  |  'fixed' = valor fixo em R$
  discount_type   text not null check (discount_type in ('percent', 'fixed')),
  discount_value  numeric(10,2) not null check (discount_value > 0),
  -- valor mínimo do pedido para aplicar o cupom
  min_order_value numeric(10,2) not null default 0,
  -- null = ilimitado
  max_uses        integer,
  uses_count      integer not null default 0,
  expires_at      timestamptz,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),

  unique (company_id, code)
);

create index discount_coupons_company_idx
  on public.discount_coupons(company_id, code);

-- ── RLS ──────────────────────────────────────────────────────
alter table public.discount_coupons enable row level security;

create policy "discount_coupons: member can select"
  on public.discount_coupons for select
  using (company_id in (
    select company_id from public.profiles
    where id = auth.uid() and is_active = true
  ));

create policy "discount_coupons: member can insert"
  on public.discount_coupons for insert
  with check (company_id in (
    select company_id from public.profiles
    where id = auth.uid() and is_active = true
  ));

create policy "discount_coupons: member can update"
  on public.discount_coupons for update
  using (company_id in (
    select company_id from public.profiles
    where id = auth.uid() and is_active = true
  ));
