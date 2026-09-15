-- Migration 0040 — feature_flags
-- Dupla camada: commercial_enabled (plano) + technical_status (deploy)
-- Sprint 22a — 09/09/2026

CREATE TYPE feature_technical_status AS ENUM ('available', 'in_homologation', 'disabled');

CREATE TABLE feature_flags (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key         text NOT NULL UNIQUE,
  display_name        text NOT NULL,
  description         text,
  -- Camada comercial: o plano prevê esta feature?
  -- Se false, nenhum tenant vê mesmo que o plano tenha o entitlement
  commercial_enabled  boolean NOT NULL DEFAULT true,
  -- Camada técnica: o código está pronto para produção?
  -- 'available' = libera; 'in_homologation' = bloqueado; 'disabled' = bloqueado
  technical_status    feature_technical_status NOT NULL DEFAULT 'available',
  -- Metadados
  notes               text,
  last_changed_by     uuid REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- RLS: somente service role (admin portal)
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "no_tenant_access" ON feature_flags
  AS RESTRICTIVE
  FOR ALL
  USING (false);

-- Trigger: updated_at
CREATE OR REPLACE FUNCTION update_feature_flags_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_ff_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION update_feature_flags_updated_at();

-- Seed: features conhecidas do sistema
INSERT INTO feature_flags (feature_key, display_name, description, commercial_enabled, technical_status) VALUES
  ('ai.advanced.enabled',        'Kyra IA Avançada',        'Tools avançadas de IA (análise, compras, automações)',      true,  'available'),
  ('ai.queries.monthly',         'Consultas mensais à Kyra', 'Quota de consultas mensais ao assistente',                  true,  'available'),
  ('reports.abc',                'Relatório Curva ABC',      'Análise ABC de produtos por receita',                       true,  'available'),
  ('reports.slow_moving',        'Produtos Parados',         'Relatório de produtos sem giro',                            true,  'available'),
  ('reports.margin',             'Relatório de Margem',      'Análise de margem por produto',                             true,  'available'),
  ('channels.max',               'Canais de venda',          'Número máximo de canais conectados',                        true,  'available'),
  ('automations.max',            'Automações',               'Número máximo de automações ativas',                        true,  'available'),
  ('fiscal.nfe',                 'Emissão NF-e',             'Emissão de Nota Fiscal Eletrônica',                         false, 'in_homologation'),
  ('fiscal.nfce',                'Emissão NFC-e',            'Nota Fiscal de Consumidor Eletrônico',                      false, 'in_homologation'),
  ('multiwarehouse',             'Multi-estoque',            'Múltiplos depósitos e transferências',                      false, 'disabled'),
  ('crm.advanced',               'CRM Avançado',             'Gestão avançada de clientes (Fase 2)',                      false, 'disabled')
ON CONFLICT (feature_key) DO NOTHING;
