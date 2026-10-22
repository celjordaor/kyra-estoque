-- ═══════════════════════════════════════════════════════════════
-- Migration: 0052 — WhatsApp do gestor (número da Kyra)
-- Telefone verificado no perfil, fila de envio (outbox), log de
-- mensagens recebidas (idempotência) e autor das automações.
-- Tudo acessado somente via service_role (RLS ativo, sem policy).
-- ═══════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists phone text,
  add column if not exists phone_verified_at timestamptz;

-- Um número verificado pertence a um único perfil
create unique index if not exists profiles_phone_verified_uidx
  on public.profiles (phone) where phone_verified_at is not null;

alter table public.company_automations
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

create table if not exists public.whatsapp_verifications (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  phone       text not null,
  code_hash   text not null,
  expires_at  timestamptz not null,
  attempts    int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists whatsapp_verifications_profile_idx on public.whatsapp_verifications (profile_id, created_at desc);
alter table public.whatsapp_verifications enable row level security;

create table if not exists public.whatsapp_outbox (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid references public.companies(id) on delete cascade,
  profile_id           uuid references public.profiles(id) on delete set null,
  to_phone             text not null,
  kind                 text not null default 'alert',   -- alert | report | answer | verification
  template_name        text,
  template_vars        jsonb not null default '[]',
  body                 text not null,                    -- texto livre (janela aberta) / fallback
  status               text not null default 'pending'
                         check (status in ('pending','sent','failed','simulated')),
  attempts             int not null default 0,
  last_error           text,
  provider_message_id  text,
  automation_id        uuid references public.company_automations(id) on delete set null,
  scheduled_at         timestamptz not null default now(),
  sent_at              timestamptz,
  created_at           timestamptz not null default now()
);
create index if not exists whatsapp_outbox_pending_idx on public.whatsapp_outbox (status, scheduled_at) where status = 'pending';
create index if not exists whatsapp_outbox_company_idx on public.whatsapp_outbox (company_id, created_at desc);
alter table public.whatsapp_outbox enable row level security;

create table if not exists public.whatsapp_inbound (
  wa_message_id  text primary key,         -- idempotência (Meta reenvia webhooks)
  from_phone     text not null,
  company_id     uuid references public.companies(id) on delete set null,
  profile_id     uuid references public.profiles(id) on delete set null,
  body           text,
  received_at    timestamptz not null default now()
);
create index if not exists whatsapp_inbound_phone_idx on public.whatsapp_inbound (from_phone, received_at desc);
alter table public.whatsapp_inbound enable row level security;

-- Aviso de que a automação de estoque baixo não repete alerta do mesmo produto
create table if not exists public.automation_dedupe (
  company_id   uuid not null references public.companies(id) on delete cascade,
  dedupe_key   text not null,
  last_sent_at timestamptz not null default now(),
  primary key (company_id, dedupe_key)
);
alter table public.automation_dedupe enable row level security;
