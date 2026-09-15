-- ============================================================
-- Migration 0033 — Sprint 18: Canais Reais
-- channel_listings + channel_orders + seed channels.advanced.enabled
-- ============================================================

-- ── 1. channel_listings: produtos publicados em canais externos ──────────────
create table public.channel_listings (
  id                    uuid        primary key default gen_random_uuid(),
  company_id            uuid        not null references public.companies(id) on delete cascade,
  integration_id        uuid        not null references public.company_integrations(id) on delete cascade,
  product_id            uuid        not null references public.products(id) on delete cascade,
  external_id           text        not null,   -- ID do produto no canal externo
  external_sku          text,
  external_url          text,
  status                text        not null default 'active'
                          check (status in ('active','paused','error','deleted')),
  sync_stock            boolean     not null default true,
  sync_prices           boolean     not null default true,
  last_synced_at        timestamptz,
  sync_error            text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (integration_id, product_id)
);

create index channel_listings_company_idx    on public.channel_listings(company_id);
create index channel_listings_integration_idx on public.channel_listings(integration_id);
create index channel_listings_product_idx    on public.channel_listings(product_id);

create trigger channel_listings_updated_at
  before update on public.channel_listings
  for each row execute function public.handle_updated_at();

alter table public.channel_listings enable row level security;

create policy "channel_listings: empresa lê próprios"
  on public.channel_listings for select
  using (company_id = public.my_company_id());

create policy "channel_listings: owner/admin gerencia"
  on public.channel_listings for all
  using (
    company_id = public.my_company_id()
    and public.my_role() in ('owner', 'admin', 'manager')
  );

comment on table public.channel_listings is
  'Produtos publicados em canais externos (Shopify, Mercado Livre, WooCommerce). Um produto pode estar em múltiplos canais.';

-- ── 2. channel_orders: pedidos recebidos dos canais ──────────────────────────
create table public.channel_orders (
  id                    uuid        primary key default gen_random_uuid(),
  company_id            uuid        not null references public.companies(id) on delete cascade,
  integration_id        uuid        not null references public.company_integrations(id) on delete cascade,
  external_order_id     text        not null,   -- ID do pedido no canal externo
  sale_id               uuid        references public.sales(id),  -- vínculo com venda Kyra
  status                text        not null default 'pending'
                          check (status in ('pending','confirmed','shipped','delivered','canceled','refunded')),
  external_status       text,       -- status original do canal
  customer_name         text,
  customer_email        text,
  total_cents           int,
  items_count           int,
  raw_payload           jsonb,      -- payload original do webhook
  processed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (integration_id, external_order_id)
);

create index channel_orders_company_idx    on public.channel_orders(company_id);
create index channel_orders_integration_idx on public.channel_orders(integration_id);
create index channel_orders_status_idx     on public.channel_orders(status);

create trigger channel_orders_updated_at
  before update on public.channel_orders
  for each row execute function public.handle_updated_at();

alter table public.channel_orders enable row level security;

create policy "channel_orders: empresa lê próprios"
  on public.channel_orders for select
  using (company_id = public.my_company_id());

create policy "channel_orders: owner/admin gerencia"
  on public.channel_orders for all
  using (
    company_id = public.my_company_id()
    and public.my_role() in ('owner', 'admin', 'manager')
  );

comment on table public.channel_orders is
  'Pedidos recebidos de canais externos. Vinculados a sales após processamento. Imutáveis: status atualizado via campo, nunca delete.';

-- ── 3. Seed entitlement channels.advanced.enabled ────────────────────────────
-- Garante que os planos Impulsiona e Escala têm o entitlement de canais avançados.

do $$
declare
  v_impulsiona uuid;
  v_escala     uuid;
begin
  select id into v_impulsiona from public.plans where slug = 'kyra-impulsiona' limit 1;
  select id into v_escala     from public.plans where slug = 'kyra-escala'     limit 1;

  -- channels.advanced.enabled
  if v_impulsiona is not null then
    insert into public.plan_entitlements (plan_id, feature_key, value_type, bool_value)
    values (v_impulsiona, 'channels.advanced.enabled', 'boolean', true)
    on conflict (plan_id, feature_key) do update
      set bool_value = true, value_type = 'boolean';
  end if;

  if v_escala is not null then
    insert into public.plan_entitlements (plan_id, feature_key, value_type, bool_value)
    values (v_escala, 'channels.advanced.enabled', 'boolean', true)
    on conflict (plan_id, feature_key) do update
      set bool_value = true, value_type = 'boolean';
  end if;

  -- channels.max (garantir que existe nos 3 planos)
  -- Organiza: 1, Impulsiona: 3, Escala: 10
  if v_impulsiona is not null then
    insert into public.plan_entitlements (plan_id, feature_key, value_type, int_value)
    values (v_impulsiona, 'channels.max', 'integer', 3)
    on conflict (plan_id, feature_key) do update
      set int_value = 3, value_type = 'integer';
  end if;

  if v_escala is not null then
    insert into public.plan_entitlements (plan_id, feature_key, value_type, int_value)
    values (v_escala, 'channels.max', 'integer', 10)
    on conflict (plan_id, feature_key) do update
      set int_value = 10, value_type = 'integer';
  end if;

  raise notice '[0033] Seed de channel entitlements concluído';
end;
$$;

-- ── 4. Adicionar sync_config em company_integrations ─────────────────────────
-- Guarda configurações de sincronização (sync_stock, sync_prices, auto_publish)
-- como parte do jsonb config já existente (sem nova coluna necessária).
-- Campo config já existe: { api_key, token, store_url, sync_stock, sync_prices, auto_publish, ... }

comment on column public.company_integrations.config is
  'Configurações da integração. Campos: api_key/token (criptografados na app layer), sync_stock, sync_prices, auto_publish, store_url, last_sync_at, products_published, orders_today, account_name.';
