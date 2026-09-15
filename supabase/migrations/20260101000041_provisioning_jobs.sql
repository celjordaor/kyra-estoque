-- Migration 0041 — provisioning_jobs
-- Log atômico do pipeline de provisionamento de tenants
-- Sprint 22a — 09/09/2026

CREATE TYPE provisioning_status AS ENUM (
  'pending', 'running', 'completed', 'failed', 'rolled_back'
);

CREATE TABLE provisioning_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Tenant provisionado (pode ser null se falhou antes de criar)
  company_id      uuid REFERENCES companies(id) ON DELETE SET NULL,
  -- Input original do job
  input           jsonb NOT NULL DEFAULT '{}',
  -- Status atual
  status          provisioning_status NOT NULL DEFAULT 'pending',
  -- Etapa atual (para retry/rollback parcial)
  current_step    text,
  -- Log de cada etapa: [{step, status, ts, error?}]
  steps_log       jsonb NOT NULL DEFAULT '[]',
  -- Erro final (se failed)
  error_message   text,
  -- Quem disparou (super admin ou webhook externo)
  triggered_by    uuid REFERENCES auth.users(id),
  trigger_source  text NOT NULL DEFAULT 'admin_manual', -- 'admin_manual' | 'webhook_crm' | 'auto'
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);

-- RLS: somente service role
ALTER TABLE provisioning_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "no_tenant_access" ON provisioning_jobs
  AS RESTRICTIVE FOR ALL USING (false);

-- Trigger: updated_at
CREATE OR REPLACE FUNCTION update_provisioning_jobs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.status IN ('completed', 'failed', 'rolled_back') AND OLD.completed_at IS NULL THEN
    NEW.completed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pj_updated_at
  BEFORE UPDATE ON provisioning_jobs
  FOR EACH ROW EXECUTE FUNCTION update_provisioning_jobs_updated_at();

-- Índices
CREATE INDEX idx_pj_company ON provisioning_jobs (company_id);
CREATE INDEX idx_pj_status  ON provisioning_jobs (status);
CREATE INDEX idx_pj_created ON provisioning_jobs (created_at DESC);
