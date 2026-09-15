-- ═══════════════════════════════════════════════════════════════
-- Migration: 0023 — Roles e Permissões (RBAC por empresa)
-- Sprint 10a — Fundação de Assinaturas
-- ═══════════════════════════════════════════════════════════════
--
-- Tabelas:
--   roles       → perfis de permissão por empresa (com RLS)
--   user_roles  → vínculo usuário ↔ role por empresa (com RLS)
--
-- Funções:
--   seed_default_roles(p_company_id) → cria 4 roles padrão
--   handle_new_company_roles()       → wrapper para trigger
--
-- Trigger:
--   on_company_created_roles → seed automático ao criar empresa
--
-- Nota: este trigger coexiste com on_company_created (0022) —
-- ambos disparam AFTER INSERT ON companies de forma independente.
--
-- Permissões disponíveis no sistema (registradas como referência):
--   products.view  | products.create  | products.edit   | products.delete
--   sales.view     | sales.create     | sales.cancel
--   purchases.view | purchases.create | purchases.approve
--   stock.view     | stock.adjust
--   customers.view | customers.create | customers.edit
--   suppliers.view | suppliers.create | suppliers.edit
--   reports.view
--   financial.view | financial.create | financial.approve
--   settings.view  | settings.edit
--   automations.view | automations.create | automations.edit
-- ═══════════════════════════════════════════════════════════════

-- ── 1. roles ──────────────────────────────────────────────────
create table public.roles (
  id          uuid    primary key default gen_random_uuid(),
  company_id  uuid    not null references public.companies(id) on delete cascade,
  name        text    not null,
  description text,
  permissions jsonb   not null default '[]'::jsonb,  -- array de permission strings
  is_default  boolean not null default false,         -- role aplicado a novos membros
  is_system   boolean not null default false,         -- roles criados pelo seed (não deletáveis)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(company_id, name)
);

create index roles_company_id_idx on public.roles(company_id);

create trigger roles_updated_at
  before update on public.roles
  for each row execute function public.handle_updated_at();

comment on table public.roles is
  'Perfis de permissão por empresa. permissions é um array JSON de strings como "products.view".';
comment on column public.roles.permissions is
  'Ex: ["products.view","products.create","sales.view","sales.create"]';
comment on column public.roles.is_system is
  'true = criado pelo seed; não pode ser deletado pela UI. Só admins podem alterar.';
comment on column public.roles.is_default is
  'true = role aplicado automaticamente a novos usuários convidados para a empresa.';

alter table public.roles enable row level security;

-- Qualquer membro da empresa pode ver os roles
create policy "roles: membro pode ler"
  on public.roles for select
  using (company_id = public.my_company_id());

-- Owner/admin gerencia roles da empresa
create policy "roles: owner/admin gerencia"
  on public.roles for all
  using (
    company_id = public.my_company_id()
    and public.my_role() in ('owner', 'admin')
  );

-- ── 2. user_roles ─────────────────────────────────────────────
create table public.user_roles (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role_id     uuid not null references public.roles(id) on delete cascade,
  assigned_by uuid references auth.users(id),        -- quem atribuiu o role
  created_at  timestamptz not null default now(),
  unique(company_id, user_id, role_id)
);

create index user_roles_company_user_idx on public.user_roles(company_id, user_id);
create index user_roles_role_id_idx      on public.user_roles(role_id);

comment on table public.user_roles is
  'Vínculo N:N entre usuários e roles dentro de uma empresa. Um usuário pode ter múltiplos roles.';

alter table public.user_roles enable row level security;

-- Membro vê vínculos da própria empresa
create policy "user_roles: membro pode ler"
  on public.user_roles for select
  using (company_id = public.my_company_id());

-- Owner/admin gerencia vínculos da empresa
create policy "user_roles: owner/admin gerencia"
  on public.user_roles for all
  using (
    company_id = public.my_company_id()
    and public.my_role() in ('owner', 'admin')
  );

-- ── 3. Função: seed_default_roles ─────────────────────────────
-- Cria os 4 roles padrão para uma empresa recém-criada.
-- Idempotente: usa ON CONFLICT DO NOTHING.
create or replace function public.seed_default_roles(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Administrador — acesso total
  insert into public.roles (company_id, name, description, permissions, is_system, is_default)
  values (
    p_company_id,
    'Administrador',
    'Acesso completo a todos os módulos e configurações.',
    '["products.view","products.create","products.edit","products.delete",
      "sales.view","sales.create","sales.cancel",
      "purchases.view","purchases.create","purchases.approve",
      "stock.view","stock.adjust",
      "customers.view","customers.create","customers.edit",
      "suppliers.view","suppliers.create","suppliers.edit",
      "reports.view",
      "financial.view","financial.create","financial.approve",
      "settings.view","settings.edit",
      "automations.view","automations.create","automations.edit"]'::jsonb,
    true,
    false
  )
  on conflict (company_id, name) do nothing;

  -- Vendedor — foco em vendas e clientes
  insert into public.roles (company_id, name, description, permissions, is_system, is_default)
  values (
    p_company_id,
    'Vendedor',
    'Acesso a produtos, vendas e clientes. Sem acesso a configurações ou financeiro.',
    '["products.view",
      "sales.view","sales.create",
      "customers.view","customers.create","customers.edit",
      "stock.view"]'::jsonb,
    true,
    true   -- role padrão para novos convidados
  )
  on conflict (company_id, name) do nothing;

  -- Estoquista — foco em produtos e estoque
  insert into public.roles (company_id, name, description, permissions, is_system, is_default)
  values (
    p_company_id,
    'Estoquista',
    'Acesso a produtos e movimentações de estoque. Sem acesso a vendas ou financeiro.',
    '["products.view","products.edit",
      "stock.view","stock.adjust",
      "purchases.view",
      "suppliers.view"]'::jsonb,
    true,
    false
  )
  on conflict (company_id, name) do nothing;

  -- Financeiro — foco em relatórios e financeiro
  insert into public.roles (company_id, name, description, permissions, is_system, is_default)
  values (
    p_company_id,
    'Financeiro',
    'Acesso a relatórios e módulo financeiro. Sem acesso a configurações operacionais.',
    '["financial.view","financial.create",
      "reports.view",
      "sales.view",
      "purchases.view"]'::jsonb,
    true,
    false
  )
  on conflict (company_id, name) do nothing;
end;
$$;

comment on function public.seed_default_roles is
  'Cria os 4 roles padrão (Administrador, Vendedor, Estoquista, Financeiro) para uma empresa. Idempotente.';

-- ── 4. Trigger: on_company_created_roles ──────────────────────
create or replace function public.handle_new_company_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_roles(new.id);
  return new;
end;
$$;

create trigger on_company_created_roles
  after insert on public.companies
  for each row
  execute function public.handle_new_company_roles();

comment on trigger on_company_created_roles on public.companies is
  'Dispara seed_default_roles após inserção de qualquer empresa. Garante que toda empresa tem os 4 roles padrão disponíveis.';
