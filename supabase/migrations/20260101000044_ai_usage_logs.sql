-- Migration 0044 — ai_usage_logs
-- Rastreamento de uso de IA: tokens, custo, modelo, recurso
-- Sprint 22a — 09/09/2026

CREATE TABLE ai_usage_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Qual recurso chamou a IA
  resource        text NOT NULL, -- 'kyra.chat' | 'kyra.dashboard' | 'product.image' | etc.
  model           text NOT NULL, -- 'claude-opus-4-5' | 'claude-sonnet-4-5' | etc.
  -- Tokens
  input_tokens    integer NOT NULL DEFAULT 0,
  output_tokens   integer NOT NULL DEFAULT 0,
  total_tokens    integer GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  -- Custo estimado (em centavos de R$, calculado server-side)
  cost_brl_cents  integer NOT NULL DEFAULT 0,
  -- Período de faturamento do entitlement (para agregação)
  period_start    date NOT NULL,
  period_end      date NOT NULL,
  -- Metadados opcionais
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- RLS: somente service role (admin analisa, tenant não vê logs)
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "no_tenant_access" ON ai_usage_logs
  AS RESTRICTIVE FOR ALL USING (false);

-- Índices para agregações admin
CREATE INDEX idx_aul_company_period  ON ai_usage_logs (company_id, period_start, period_end);
CREATE INDEX idx_aul_resource        ON ai_usage_logs (resource, created_at DESC);
CREATE INDEX idx_aul_created         ON ai_usage_logs (created_at DESC);

-- View agregada por empresa + período (útil no painel admin)
CREATE VIEW ai_usage_by_company AS
SELECT
  company_id,
  period_start,
  period_end,
  COUNT(*)                     AS calls,
  SUM(input_tokens)            AS total_input_tokens,
  SUM(output_tokens)           AS total_output_tokens,
  SUM(total_tokens)            AS total_tokens,
  SUM(cost_brl_cents)          AS total_cost_brl_cents,
  MAX(created_at)              AS last_call_at
FROM ai_usage_logs
GROUP BY company_id, period_start, period_end;
