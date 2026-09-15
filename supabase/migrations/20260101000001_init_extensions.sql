-- ═══════════════════════════════════════════════════════════════
-- Migration: 001 — Extensions & helpers
-- ═══════════════════════════════════════════════════════════════

-- UUID generation

-- pg_crypto for hashing (future use)
create extension if not exists "pgcrypto";

-- unaccent for search normalization
create extension if not exists "unaccent";

-- Full-text search with Portuguese stemming
create extension if not exists "pg_trgm";

-- ── Helper: updated_at trigger ────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Helper: new user → profile ────────────────────────────────
-- Called by Supabase Auth trigger when a new user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  );
  return new;
end;
$$;
