-- Migration 0054 — ciclo de cobrança da assinatura (Asaas da Kyra)
alter table public.subscriptions
  add column if not exists provider_billing_type text,
  add column if not exists past_due_since timestamptz,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspend_reason text;

create unique index if not exists billing_events_provider_event_uidx on public.billing_events (provider, event_id);
create index if not exists subscriptions_provider_sub_idx on public.subscriptions (provider_subscription_id) where provider_subscription_id is not null;
create index if not exists subscriptions_status_idx on public.subscriptions (status);
