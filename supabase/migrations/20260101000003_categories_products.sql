-- ═══════════════════════════════════════════════════════════════
-- Migration: 003 — categories + products
-- ═══════════════════════════════════════════════════════════════

-- ── categories ────────────────────────────────────────────────
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  name        text not null,
  slug        text not null,
  description text,
  color       text,                         -- ex: "#16a34a"
  icon        text,                         -- lucide icon name
  parent_id   uuid references public.categories(id) on delete set null,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (company_id, slug)
);

create index categories_company_id_idx on public.categories(company_id);

create trigger categories_updated_at
  before update on public.categories
  for each row execute function public.handle_updated_at();

-- ── products ──────────────────────────────────────────────────
create table public.products (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  category_id      uuid references public.categories(id) on delete set null,

  -- Identification
  name             text not null,
  description      text,
  sku              text,                    -- Stock Keeping Unit
  barcode          text,                   -- EAN / QR

  -- Pricing
  cost_price       numeric(12,2) not null default 0 check (cost_price >= 0),
  sale_price       numeric(12,2) not null default 0 check (sale_price >= 0),
  min_price        numeric(12,2) check (min_price >= 0),

  -- Stock control
  -- IMPORTANT: stock_quantity is a denormalized cache.
  -- The authoritative balance ALWAYS comes from stock_movements.
  -- This column is updated via trigger on every movement insert.
  stock_quantity   numeric(12,3) not null default 0,
  min_stock        numeric(12,3) not null default 0 check (min_stock >= 0),
  max_stock        numeric(12,3) check (max_stock >= 0),
  unit             text not null default 'un',   -- un, kg, lt, cx, m, etc.

  -- Media
  image_url        text,
  images           jsonb not null default '[]',

  -- AI metadata
  ai_reorder_point numeric(12,3),          -- AI-calculated reorder point
  ai_avg_daily_sales numeric(12,3),        -- AI-calculated average daily sales

  -- Status
  is_active        boolean not null default true,
  is_featured      boolean not null default false,

  -- Audit
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (company_id, sku),
  constraint stock_max_gte_min check (max_stock is null or max_stock >= min_stock)
);

create index products_company_id_idx        on public.products(company_id);
create index products_category_id_idx       on public.products(category_id);
create index products_sku_idx               on public.products(company_id, sku);
create index products_barcode_idx           on public.products(company_id, barcode);
create index products_stock_quantity_idx    on public.products(company_id, stock_quantity);
create index products_is_active_idx         on public.products(company_id, is_active);

-- Full-text search index
create index products_name_search_idx on public.products
  using gin (to_tsvector('portuguese', coalesce(name,'') || ' ' || coalesce(description,'') || ' ' || coalesce(sku,'')));

create trigger products_updated_at
  before update on public.products
  for each row execute function public.handle_updated_at();

-- ── RLS: categories ───────────────────────────────────────────
alter table public.categories enable row level security;

create policy "categories: company member can read"
  on public.categories for select
  using (company_id in (
    select company_id from public.profiles where id = auth.uid() and is_active = true
  ));

create policy "categories: manager+ can write"
  on public.categories for all
  using (company_id in (
    select company_id from public.profiles
    where id = auth.uid() and role in ('owner','admin','manager') and is_active = true
  ));

-- ── RLS: products ─────────────────────────────────────────────
alter table public.products enable row level security;

create policy "products: company member can read"
  on public.products for select
  using (company_id in (
    select company_id from public.profiles where id = auth.uid() and is_active = true
  ));

create policy "products: manager+ can write"
  on public.products for all
  using (company_id in (
    select company_id from public.profiles
    where id = auth.uid() and role in ('owner','admin','manager') and is_active = true
  ));
