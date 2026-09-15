-- ============================================================
-- Migration 0034 — Sprint 19b: NF-e (Import + Emissão)
-- nfe_documents + seed entitlements nfe.import / nfe.emission
-- ============================================================

-- ── 1. nfe_documents ─────────────────────────────────────────────────────────
create table public.nfe_documents (
  id                  uuid        primary key default gen_random_uuid(),
  company_id          uuid        not null references public.companies(id) on delete cascade,

  -- Tipo: 'import' (XML recebido/compra) | 'emission' (nota emitida/venda)
  doc_type            text        not null check (doc_type in ('import', 'emission')),

  -- Chave de acesso NF-e (44 dígitos)
  chave_acesso        text        unique,

  -- Dados da nota
  numero              text,
  serie               text,
  modelo              text        default '55',   -- 55=NF-e | 65=NFC-e
  data_emissao        date,

  -- Emitente
  emitente_cnpj       text,
  emitente_nome       text,
  emitente_uf         text,

  -- Destinatário
  destinatario_cnpj   text,
  destinatario_nome   text,

  -- Valores (em centavos)
  valor_produtos_cents int,
  valor_frete_cents   int,
  valor_desconto_cents int,
  valor_ipi_cents     int,
  valor_icms_cents    int,
  valor_pis_cents     int,
  valor_cofins_cents  int,
  valor_total_cents   int,

  -- Status de emissão (para doc_type='emission')
  status              text        not null default 'pending'
                        check (status in ('pending','processing','authorized','rejected','canceled','import')),

  -- Provider de emissão (Focus NFe, etc.)
  provider_ref        text,       -- referência única no provider
  provider_protocol   text,       -- protocolo SEFAZ de autorização
  provider_msg        text,       -- mensagem de retorno do SEFAZ

  -- Conteúdo
  xml_content         text,       -- XML completo da NF-e
  pdf_url             text,       -- URL do DANFE gerado pelo provider

  -- Vínculos
  sale_id             uuid        references public.sales(id),
  purchase_id         uuid        references public.purchase_orders(id),

  -- Itens (jsonb para evitar tabela extra)
  items               jsonb       default '[]'::jsonb,
  -- Formato: [{ descricao, ncm, cfop, quantidade, unidade, valor_unitario_cents, valor_total_cents, cst_icms, aliquota_icms }]

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index nfe_documents_company_idx    on public.nfe_documents(company_id);
create index nfe_documents_type_idx       on public.nfe_documents(company_id, doc_type);
create index nfe_documents_status_idx     on public.nfe_documents(company_id, status);
create index nfe_documents_emissao_idx    on public.nfe_documents(company_id, data_emissao desc);
create index nfe_documents_sale_idx       on public.nfe_documents(sale_id) where sale_id is not null;
create index nfe_documents_purchase_idx   on public.nfe_documents(purchase_id) where purchase_id is not null;

create trigger nfe_documents_updated_at
  before update on public.nfe_documents
  for each row execute function public.handle_updated_at();

alter table public.nfe_documents enable row level security;

create policy "nfe_documents: empresa lê próprios"
  on public.nfe_documents for select
  using (company_id = public.my_company_id());

create policy "nfe_documents: owner/admin/manager gerencia"
  on public.nfe_documents for all
  using (
    company_id = public.my_company_id()
    and public.my_role() in ('owner', 'admin', 'manager')
  );

comment on table public.nfe_documents is
  'Documentos fiscais NF-e: importados (compras recebidas) e emitidos (vendas). Imutáveis após status=authorized ou import.';

-- ── 2. Seed entitlements NF-e ────────────────────────────────────────────────
do $$
declare
  v_organiza    uuid;
  v_impulsiona  uuid;
  v_escala      uuid;
begin
  select id into v_organiza   from public.plans where slug = 'kyra-organiza'   limit 1;
  select id into v_impulsiona from public.plans where slug = 'kyra-impulsiona' limit 1;
  select id into v_escala     from public.plans where slug = 'kyra-escala'     limit 1;

  -- nfe.import.enabled: Impulsiona e Escala
  if v_impulsiona is not null then
    insert into public.plan_entitlements (plan_id, feature_key, value_type, bool_value)
    values (v_impulsiona, 'nfe.import.enabled', 'boolean', true)
    on conflict (plan_id, feature_key) do update set bool_value = true, value_type = 'boolean';
  end if;

  if v_escala is not null then
    insert into public.plan_entitlements (plan_id, feature_key, value_type, bool_value)
    values (v_escala, 'nfe.import.enabled', 'boolean', true)
    on conflict (plan_id, feature_key) do update set bool_value = true, value_type = 'boolean';
  end if;

  -- nfe.emission.enabled: Impulsiona e Escala
  if v_impulsiona is not null then
    insert into public.plan_entitlements (plan_id, feature_key, value_type, bool_value)
    values (v_impulsiona, 'nfe.emission.enabled', 'boolean', true)
    on conflict (plan_id, feature_key) do update set bool_value = true, value_type = 'boolean';
  end if;

  if v_escala is not null then
    insert into public.plan_entitlements (plan_id, feature_key, value_type, bool_value)
    values (v_escala, 'nfe.emission.enabled', 'boolean', true)
    on conflict (plan_id, feature_key) do update set bool_value = true, value_type = 'boolean';
  end if;

  -- fiscal.enabled: Impulsiona e Escala
  if v_impulsiona is not null then
    insert into public.plan_entitlements (plan_id, feature_key, value_type, bool_value)
    values (v_impulsiona, 'fiscal.enabled', 'boolean', true)
    on conflict (plan_id, feature_key) do update set bool_value = true, value_type = 'boolean';
  end if;

  if v_escala is not null then
    insert into public.plan_entitlements (plan_id, feature_key, value_type, bool_value)
    values (v_escala, 'fiscal.enabled', 'boolean', true)
    on conflict (plan_id, feature_key) do update set bool_value = true, value_type = 'boolean';
  end if;

  raise notice '[0034] Seed de entitlements NF-e concluído';
end;
$$;
