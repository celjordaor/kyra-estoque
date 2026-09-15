-- Migration 018: Add received_at timestamp to purchase_orders
alter table public.purchase_orders add column if not exists received_at timestamptz;
