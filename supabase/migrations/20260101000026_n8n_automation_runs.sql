-- Sprint 14: n8n integration columns + automation_runs table
-- ────────────────────────────────────────────────────────────

-- ── 1. Extend company_automations with n8n fields ────────────

alter table public.company_automations
  add column if not exists n8n_workflow_id  text,
  add column if not exists n8n_webhook_url  text,
  add column if not exists last_run_at      timestamptz,
  add column if not exists run_count        integer not null default 0;

comment on column public.company_automations.n8n_workflow_id is 'ID do workflow no n8n (usado para gerenciar via API)';
comment on column public.company_automations.n8n_webhook_url is 'URL do webhook no n8n para disparo desta automação';
comment on column public.company_automations.last_run_at     is 'Última execução registrada (manual ou agendada)';
comment on column public.company_automations.run_count       is 'Total de execuções realizadas';

-- ── 2. automation_runs: log de cada execução ─────────────────

create table if not exists public.automation_runs (
  id              uuid        primary key default gen_random_uuid(),
  company_id      uuid        not null references public.companies(id) on delete cascade,
  automation_type text        not null,
  status          text        not null default 'running'
                              check (status in ('running','success','failed','partial')),
  triggered_by    text        not null default 'schedule'
                              check (triggered_by in ('schedule','manual')),
  payload         jsonb       not null default '{}',
  result          jsonb,
  error_message   text,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  duration_ms     integer generated always as (
    case when finished_at is not null
      then extract(epoch from (finished_at - started_at))::integer * 1000
      else null
    end
  ) stored
);

-- RLS: companies see only their own runs
alter table public.automation_runs enable row level security;

create policy "automation_runs: company members can read own"
  on public.automation_runs
  for select
  using (company_id = my_company_id());

create policy "automation_runs: service role inserts"
  on public.automation_runs
  for insert
  with check (company_id = my_company_id());

-- Index for dashboard queries
create index if not exists automation_runs_company_started
  on public.automation_runs (company_id, started_at desc);

-- ── 3. RPC: n8n callback to update run status ─────────────────
-- n8n calls this webhook after finishing to mark the run done.
-- Uses service role (no auth check — caller must know the run ID).
create or replace function public.complete_automation_run(
  p_run_id      uuid,
  p_status      text,
  p_result      jsonb    default null,
  p_error       text     default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.automation_runs
  set
    status        = p_status,
    result        = coalesce(p_result, result),
    error_message = p_error,
    finished_at   = now()
  where id = p_run_id;
end;
$$;

-- Revoke public execute; only service role (n8n server action) calls this
revoke execute on function public.complete_automation_run from public;
grant  execute on function public.complete_automation_run to service_role;
