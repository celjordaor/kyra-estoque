-- Migration 0046 — onboarding: complete_onboarding_checkpoint RPC
-- Sprint 22b — 17/09/2026
--
-- Permite que server actions de tenant completem checkpoints via RPC
-- com SECURITY DEFINER (bypassa a RLS de write-only service_role).
-- A função valida que o auth.uid() pertence à empresa antes de atualizar.

CREATE OR REPLACE FUNCTION complete_onboarding_checkpoint(
  p_company_id    uuid,
  p_checkpoint_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Garante que o usuário logado pertence à empresa informada
  IF auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND company_id = p_company_id
    ) THEN
      RAISE EXCEPTION 'Unauthorized: user does not belong to company';
    END IF;
  END IF;
  -- Atualiza apenas se ainda não foi concluído (idempotente)
  UPDATE public.onboarding_checkpoints
  SET
    completed    = true,
    completed_at = now()
  WHERE company_id     = p_company_id
    AND checkpoint_key = p_checkpoint_key
    AND completed      = false;
END;
$$;

-- Permite que qualquer role autenticada (e service_role) execute a função
GRANT EXECUTE ON FUNCTION complete_onboarding_checkpoint(uuid, text) TO authenticated, service_role;
