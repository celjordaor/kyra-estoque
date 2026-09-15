-- Sprint 15: ai_conversations — histórico de conversa com a Kyra
-- ────────────────────────────────────────────────────────────────

create table if not exists public.ai_conversations (
  id          uuid        primary key default gen_random_uuid(),
  company_id  uuid        not null references public.companies(id) on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  title       text,                          -- gerado da primeira mensagem
  messages    jsonb       not null default '[]',  -- array de {role, content, ts}
  model       text        not null default 'claude-opus-4-5',
  token_count integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.ai_conversations enable row level security;

-- Usuário vê apenas conversas da sua empresa
create policy "ai_conversations: empresa vê próprias"
  on public.ai_conversations
  for all
  using (company_id = my_company_id());

-- Índice para histórico recente por usuário
create index if not exists ai_conversations_user_updated
  on public.ai_conversations (company_id, user_id, updated_at desc);

-- Auto-update updated_at
create or replace function public.touch_ai_conversation()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger ai_conversations_touch
  before update on public.ai_conversations
  for each row execute function public.touch_ai_conversation();

-- ── Seed: ai.queries.monthly nos planos (se não existir) ─────
-- Organiza: 100/mês · Impulsiona: 1000/mês · Escala: ilimitado (NULL)
do $$
declare
  v_organiza   uuid;
  v_impulsiona uuid;
  v_escala     uuid;
begin
  select id into v_organiza   from public.plans where slug = 'organiza'   limit 1;
  select id into v_impulsiona from public.plans where slug = 'impulsiona' limit 1;
  select id into v_escala     from public.plans where slug = 'escala'     limit 1;

  if v_organiza is not null then
    insert into public.plan_entitlements (plan_id, feature_key, value_type, int_value)
    values
      (v_organiza,   'ai.queries.monthly', 'integer', 100),
      (v_impulsiona, 'ai.queries.monthly', 'integer', 1000),
      (v_escala,     'ai.queries.monthly', 'integer', null)
    on conflict (plan_id, feature_key) do nothing;
  end if;
end;
$$;
