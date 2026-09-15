-- Migration 0012: Purchase orders and items

create type public.purchase_order_status as enum (
  'draft', 'sent', 'confirmed', 'received', 'cancelled'
);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  status public.purchase_order_status not null default 'draft',
  expected_delivery_date date,
  freight numeric(12, 2) not null default 0,
  notes text,
  subtotal numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric(12, 3) not null,
  unit_cost numeric(12, 2) not null,
  total numeric(12, 2) generated always as (quantity * unit_cost) stored
);

-- RLS
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;

create policy "tenant_isolation" on public.purchase_orders
  using (company_id = my_company_id());

create policy "tenant_isolation" on public.purchase_order_items
  using (purchase_order_id in (
    select id from public.purchase_orders where company_id = my_company_id()
  ));

-- Updated at trigger
create trigger set_updated_at
  before update on public.purchase_orders
  for each row execute function public.handle_updated_at();
