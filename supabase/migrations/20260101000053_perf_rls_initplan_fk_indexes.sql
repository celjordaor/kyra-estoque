-- Migration 0053 — performance: índices de FK e RLS com (select auth.uid())
create index if not exists company_automations_created_by_idx on public.company_automations (created_by);
create index if not exists whatsapp_inbound_company_idx on public.whatsapp_inbound (company_id);
create index if not exists whatsapp_inbound_profile_idx on public.whatsapp_inbound (profile_id);
create index if not exists whatsapp_outbox_profile_idx on public.whatsapp_outbox (profile_id);
create index if not exists whatsapp_outbox_automation_idx on public.whatsapp_outbox (automation_id);

alter policy "user_own_prefs" on public.notification_preferences
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "tenant_read_own" on public.notifications
  using (company_id = (select p.company_id from public.profiles p where p.id = (select auth.uid()) limit 1)
         and (user_id is null or user_id = (select auth.uid())));
alter policy "tenant_update_own" on public.notifications
  using (company_id = (select p.company_id from public.profiles p where p.id = (select auth.uid()) limit 1)
         and (user_id is null or user_id = (select auth.uid())));
alter policy "tenant_read_own" on public.onboarding_checkpoints
  using (company_id = (select p.company_id from public.profiles p where p.id = (select auth.uid()) limit 1));
alter policy "profiles: admin can manage" on public.profiles
  using (company_id in (select p1.company_id from public.profiles p1
         where p1.id = (select auth.uid()) and p1.role = any (array['owner','admin']) and p1.is_active = true));
alter policy "profiles: user can read own" on public.profiles using (id = (select auth.uid()));
alter policy "profiles: user can update own" on public.profiles using (id = (select auth.uid()));
alter policy "sales: member can update own or manager+" on public.sales
  using (company_id = my_company_id() and (created_by = (select auth.uid()) or my_role() = any (array['owner','admin','manager'])));
alter policy "support_tickets_user_insert" on public.support_tickets
  with check (user_id = (select auth.uid()) and company_id = my_company_id());
