-- Migration 0042 — onboarding_checkpoints
-- Tracker de jornada D0–D21 por tenant
-- Sprint 22a — 09/09/2026

CREATE TABLE onboarding_checkpoints (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- Dia da jornada: 0, 1, 3, 5, 7, 14, 21
  day             integer NOT NULL,
  -- Slug do checkpoint: 'conta_pronta', 'primeiro_produto', etc.
  checkpoint_key  text NOT NULL,
  display_name    text NOT NULL,
  -- Estado
  completed       boolean NOT NULL DEFAULT false,
  completed_at    timestamptz,
  -- Metadados opcionais (ex: id do primeiro produto criado)
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_company_checkpoint UNIQUE (company_id, checkpoint_key)
);

-- RLS: tenant pode ler seus próprios checkpoints
ALTER TABLE onboarding_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_read_own" ON onboarding_checkpoints
  FOR SELECT
  USING (
    company_id = (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
      LIMIT 1
    )
  );

-- Somente service role escreve (server actions)
CREATE POLICY "service_role_write" ON onboarding_checkpoints
  FOR ALL
  USING (false)  -- bloqueia para anon/authenticated
  WITH CHECK (false);

-- Índices
CREATE INDEX idx_oc_company     ON onboarding_checkpoints (company_id);
CREATE INDEX idx_oc_incomplete  ON onboarding_checkpoints (company_id, completed)
  WHERE completed = false;

-- Seed function: popula checkpoints padrão D0–D21 para uma empresa nova
CREATE OR REPLACE FUNCTION seed_onboarding_checkpoints(p_company_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO onboarding_checkpoints (company_id, day, checkpoint_key, display_name)
  VALUES
    (p_company_id, 0,  'conta_pronta',       'Conta criada e acesso enviado'),
    (p_company_id, 1,  'primeiro_produto',    'Primeiro produto cadastrado'),
    (p_company_id, 3,  'estoque_configurado', 'Estoque configurado'),
    (p_company_id, 5,  'primeira_venda',      'Primeira venda registrada'),
    (p_company_id, 7,  'kyra_consultada',     'Consultou a Kyra pela primeira vez'),
    (p_company_id, 14, 'insights_vistos',     'Visualizou insights da operação'),
    (p_company_id, 21, 'explorar_mais',       'Explorou funcionalidades avançadas')
  ON CONFLICT (company_id, checkpoint_key) DO NOTHING;
END;
$$;
