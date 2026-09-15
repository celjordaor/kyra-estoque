-- Sprint 20: Automation Wizard — add wizard fields to company_automations
-- Adds title, action_type, recipient_type to support the 4-step wizard UI.
-- Execution is now done directly via Resend (no n8n dependency).

-- ── 1. New columns ─────────────────────────────────────────────
alter table public.company_automations
  add column if not exists title          text,
  add column if not exists action_type    text not null default 'email',
  add column if not exists recipient_type text not null default 'self';

comment on column public.company_automations.title          is 'Nome legível da automação (gerado pelo wizard)';
comment on column public.company_automations.action_type    is 'O que a automação faz: email | notification | whatsapp | create_task | generate_analysis | suggest_purchase | register_occurrence';
comment on column public.company_automations.recipient_type is 'Quem recebe: self | stock_manager | sales_team';

-- ── 2. Backfill titles for existing automations ────────────────
update public.company_automations
set title = case automation_type
  when 'low_stock'     then 'Alerta de estoque baixo'
  when 'slow_moving'   then 'Produto parado'
  when 'weekly_report' then 'Relatório semanal'
  else automation_type
end
where title is null;

-- ── 3. RPC: get company email for automation sending ──────────
-- Returns the primary contact email for the company (profile owner)
create or replace function public.get_company_contact_email(p_company_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select p.email
  from public.profiles p
  where p.company_id = p_company_id
  order by p.created_at asc
  limit 1;
$$;

grant execute on function public.get_company_contact_email to authenticated, service_role;
