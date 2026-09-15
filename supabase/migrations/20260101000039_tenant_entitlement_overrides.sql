-- Migration 0039 — tenant_entitlement_overrides
-- Override de entitlements por tenant (sem alterar o plano)
-- Sprint 22a — 09/09/2026

CREATE TABLE tenant_entitlement_overrides (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  feature_key     text NOT NULL,
  -- int_value NULL = ilimitado, 0 = bloqueado, N = limite
  int_value       integer,
  bool_value      boolean,
  str_value       text,
  reason          text NOT NULL,       -- Justificativa comercial
  granted_by      uuid REFERENCES auth.users(id),
  expires_at      timestamptz,         -- NULL = sem expiração
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_company_feature UNIQUE (company_id, feature_key)
);

-- RLS: somente service role (admin) pode ler/escrever
ALTER TABLE tenant_entitlement_overrides ENABLE ROW LEVEL SECURITY;

-- Tenants não veem seus próprios overrides (transparente para eles)
-- Super admins acessam via service role (bypassRLS)
CREATE POLICY "no_tenant_access" ON tenant_entitlement_overrides
  AS RESTRICTIVE
  FOR ALL
  USING (false);

-- Trigger: updated_at
CREATE OR REPLACE FUNCTION update_tenant_entitlement_overrides_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_teo_updated_at
  BEFORE UPDATE ON tenant_entitlement_overrides
  FOR EACH ROW EXECUTE FUNCTION update_tenant_entitlement_overrides_updated_at();

-- Index: busca por company_id + feature_key (usado em todo canUse())
CREATE INDEX idx_teo_company_feature ON tenant_entitlement_overrides (company_id, feature_key);
-- Index: expirados (cleanup job futuro)
CREATE INDEX idx_teo_expires ON tenant_entitlement_overrides (expires_at) WHERE expires_at IS NOT NULL;
