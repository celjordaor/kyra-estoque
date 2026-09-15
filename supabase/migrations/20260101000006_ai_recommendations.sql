-- ═══════════════════════════════════════════════════════════════
-- Migration: 006 — ai_recommendations + automation_logs
-- ═══════════════════════════════════════════════════════════════

create type public.recommendation_type as enum (
  'LOW_STOCK',              -- Estoque abaixo do ponto de reposição
  'STOCKOUT_RISK',          -- Risco de ruptura em X dias
  'SLOW_MOVING',            -- Produto parado há muito tempo
  'OVERSTOCK',              -- Estoque excessivo / capital imobilizado
  'PURCHASE_RECOMMENDATION',-- Sugestão de compra com quantidade e timing
  'SALES_ANOMALY',          -- Anomalia nas vendas (queda ou pico)
  'MARGIN_ALERT',           -- Margem abaixo do mínimo configurado
  'PROMOTION_OPPORTUNITY'   -- Oportunidade de promoção detectada
);

create type public.recommendation_status as enum (
  'PENDING',    -- Gerada, aguarda ação
  'VIEWED',     -- Usuário visualizou
  'APPROVED',   -- Usuário aprovou a ação sugerida
  'DISMISSED',  -- Usuário descartou
  'EXECUTED'    -- Ação executada (pelo usuário ou automação)
);

-- ── ai_recommendations ────────────────────────────────────────
create table public.ai_recommendations (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  product_id      uuid references public.products(id) on delete cascade,

  type            public.recommendation_type not null,
  status          public.recommendation_status not null default 'PENDING',
  priority        integer not null default 50 check (priority between 1 and 100),
                  -- 1=crítico, 100=baixíssima prioridade

  -- Conteúdo gerado pela IA
  title           text not null,
  description     text not null,
  suggested_action text,                    -- Texto da ação sugerida
  suggested_value  numeric(14,2),           -- Valor sugerido (ex: quantidade a comprar)

  -- Contexto que gerou a recomendação
  context         jsonb not null default '{}',
  confidence      numeric(4,3) check (confidence between 0 and 1),
                  -- 0.0–1.0 (confiança do modelo)

  -- Qual modelo gerou
  ai_provider     text,                     -- 'groq', 'anthropic', 'openai'
  ai_model        text,

  -- Lifecycle
  expires_at      timestamptz,              -- Recomendações têm validade
  viewed_at       timestamptz,
  acted_at        timestamptz,
  acted_by        uuid references public.profiles(id) on delete set null,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index ai_rec_company_id_idx   on public.ai_recommendations(company_id);
create index ai_rec_product_id_idx   on public.ai_recommendations(product_id);
create index ai_rec_status_idx       on public.ai_recommendations(company_id, status);
create index ai_rec_type_idx         on public.ai_recommendations(company_id, type);
create index ai_rec_priority_idx     on public.ai_recommendations(company_id, priority asc);

create trigger ai_rec_updated_at
  before update on public.ai_recommendations
  for each row execute function public.handle_updated_at();

-- ── automation_logs ───────────────────────────────────────────
-- Rastreia execuções de workflows n8n e ações automatizadas.
create table public.automation_logs (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,

  workflow_name   text not null,            -- Nome do workflow n8n
  trigger_type    text not null,            -- 'webhook', 'schedule', 'manual', 'ai'
  status          text not null default 'running'
                  check (status in ('running', 'success', 'failed', 'partial')),

  -- Contexto
  input_data      jsonb,
  output_data     jsonb,
  error_message   text,

  -- Timing
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  duration_ms     integer
    generated always as (
      case when finished_at is not null
        then extract(epoch from (finished_at - started_at))::integer * 1000
        else null
      end
    ) stored,

  -- Rastreabilidade
  n8n_execution_id text,
  triggered_by    uuid references public.profiles(id) on delete set null,

  created_at      timestamptz not null default now()
);

create index automation_logs_company_idx  on public.automation_logs(company_id);
create index automation_logs_created_idx  on public.automation_logs(company_id, created_at desc);
create index automation_logs_status_idx   on public.automation_logs(company_id, status);

-- ── RLS: ai_recommendations ───────────────────────────────────
alter table public.ai_recommendations enable row level security;

create policy "ai_rec: member can read"
  on public.ai_recommendations for select
  using (company_id in (
    select company_id from public.profiles where id = auth.uid() and is_active = true
  ));

create policy "ai_rec: member can update status"
  on public.ai_recommendations for update
  using (company_id in (
    select company_id from public.profiles where id = auth.uid() and is_active = true
  ));

-- Inserção feita via service role (backend/n8n), não pelo frontend
create policy "ai_rec: service role can insert"
  on public.ai_recommendations for insert
  with check (true);  -- limitado por service_role no backend

-- ── RLS: automation_logs ──────────────────────────────────────
alter table public.automation_logs enable row level security;

create policy "automation_logs: admin+ can read"
  on public.automation_logs for select
  using (company_id in (
    select company_id from public.profiles
    where id = auth.uid() and role in ('owner','admin') and is_active = true
  ));

create policy "automation_logs: service role can write"
  on public.automation_logs for insert
  with check (true);
