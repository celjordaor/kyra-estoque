-- Migration 0043 — notifications + notification_preferences
-- Notificações in-app por tenant
-- Sprint 22a — 09/09/2026

CREATE TYPE notification_type AS ENUM (
  'stock_alert',         -- Estoque baixo / zerado
  'order_received',      -- Pedido recebido via canal
  'automation_triggered',-- Automação disparada
  'kyra_recommendation', -- Nova recomendação da Kyra
  'payment_event',       -- Evento de cobrança (billing)
  'system'               -- Mensagem do sistema / admin
);

CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- Destinatário específico (null = para todos da empresa)
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type        notification_type NOT NULL,
  title       text NOT NULL,
  body        text,
  -- Link interno para navegação (ex: '/products/123')
  action_url  text,
  -- Payload extra (ex: product_id, order_id)
  metadata    jsonb,
  read        boolean NOT NULL DEFAULT false,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS: tenant vê apenas suas próprias notificações
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_read_own" ON notifications
  FOR SELECT
  USING (
    company_id = (
      SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1
    )
    AND (user_id IS NULL OR user_id = auth.uid())
  );

-- Marcar como lida (somente o próprio usuário)
CREATE POLICY "tenant_update_own" ON notifications
  FOR UPDATE
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1)
    AND (user_id IS NULL OR user_id = auth.uid())
  )
  WITH CHECK (true);

-- Índices
CREATE INDEX idx_notif_company_unread ON notifications (company_id, read, created_at DESC)
  WHERE read = false;
CREATE INDEX idx_notif_user ON notifications (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- Preferências de notificação por usuário
CREATE TABLE notification_preferences (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- Habilitar/desabilitar por tipo
  stock_alert           boolean NOT NULL DEFAULT true,
  order_received        boolean NOT NULL DEFAULT true,
  automation_triggered  boolean NOT NULL DEFAULT true,
  kyra_recommendation   boolean NOT NULL DEFAULT true,
  payment_event         boolean NOT NULL DEFAULT true,
  system                boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_user_company_prefs UNIQUE (user_id, company_id)
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_own_prefs" ON notification_preferences
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Trigger updated_at sem depender da extensão moddatetime
CREATE OR REPLACE FUNCTION set_notification_preferences_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notif_pref_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION set_notification_preferences_updated_at();
