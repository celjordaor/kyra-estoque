-- ═══════════════════════════════════════════════════════════════
-- Migration 0050 — fiscal_config (certificado A1 + numeração)
-- Integração direta SEFAZ — sem intermediário terceiro por CNPJ.
-- ═══════════════════════════════════════════════════════════════

-- ── fiscal_config ─────────────────────────────────────────────
create table public.fiscal_config (
  id                    uuid        primary key default gen_random_uuid(),
  company_id            uuid        not null unique references public.companies(id) on delete cascade,

  -- Ambiente SEFAZ: 1=produção 2=homologação
  ambiente              smallint    not null default 2 check (ambiente in (1, 2)),

  -- CRT (Código de Regime Tributário): 1=Simples Nacional 3=Regime Normal
  crt                   smallint    not null default 1 check (crt in (1, 2, 3)),

  -- Dados do emitente (complementam companies.document/name/phone)
  ie                    text,        -- Inscrição Estadual
  im                    text,        -- Inscrição Municipal
  cnae                  text,
  nome_fantasia         text,
  logradouro            text,
  numero                text,
  complemento           text,
  bairro                text,
  municipio             text,
  uf                    char(2),
  cep                   text,
  cod_municipio         text,        -- IBGE code
  telefone              text,

  -- Dados tributários padrão
  nat_op_venda          text        not null default 'Venda de mercadoria',
  csosn                 text        not null default '102',  -- Simples sem crédito
  cfop_dentro_estado    text        not null default '5102',
  cfop_fora_estado      text        not null default '6102',
  ncm_padrao            text,
  cest_padrao           text,

  -- Certificado A1 — secrets: nunca expostos no SELECT authenticated
  certificado_pfx       text,        -- PFX em base64
  certificado_senha     text,        -- senha do PFX

  -- NFC-e (modelo 65) — CSC para QR Code
  csc_id                text,
  csc_token             text,        -- secret

  -- Numeração NF-e (série + último emitido — incrementado atomicamente)
  serie_nfe             text        not null default '1',
  ultimo_numero_nfe     integer     not null default 0 check (ultimo_numero_nfe >= 0),

  -- Numeração NFC-e
  serie_nfce            text        not null default '1',
  ultimo_numero_nfce    integer     not null default 0 check (ultimo_numero_nfce >= 0),

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger fiscal_config_updated_at
  before update on public.fiscal_config
  for each row execute function public.handle_updated_at();

alter table public.fiscal_config enable row level security;

-- Qualquer membro ativo pode ler (empresa_id via my_company_id())
-- Secrets (pfx, senha, csc_token) ficam acessíveis apenas via service_role
create policy "fiscal_config: member lê própria"
  on public.fiscal_config for select
  using (company_id = public.my_company_id());

-- Só admin+ altera
create policy "fiscal_config: admin altera"
  on public.fiscal_config for all
  using (
    company_id = public.my_company_id()
    and public.my_role() in ('owner', 'admin')
  );

-- service_role: acesso total (assinatura + emissão no server)
-- (o service_role bypasseia RLS por padrão no Supabase)

comment on table public.fiscal_config is
  'Configuração fiscal por empresa: certificado A1, ambiente SEFAZ, dados do emitente e numeração NF-e/NFC-e.';
comment on column public.fiscal_config.certificado_pfx is
  'Certificado A1 em base64 (PKCS#12). Secret — nunca retornado ao cliente.';
comment on column public.fiscal_config.csc_token is
  'CSC (Código de Segurança do Contribuinte) para QRCode NFC-e. Secret.';
