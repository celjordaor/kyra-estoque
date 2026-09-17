'use server'

/**
 * onboarding.ts — Sprint 22b
 *
 * Funções para leitura e auto-completar de checkpoints D0–D21.
 *
 * Regra: completeCheckpoint é silencioso (void) — nunca bloqueia o fluxo
 * da ação principal. Erros são apenas logados.
 */

import { cookies } from 'next/headers'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'

// ── Tipos ──────────────────────────────────────────────────────
export interface OnboardingCheckpoint {
  day: number
  checkpoint_key: string
  display_name: string
  completed: boolean
  completed_at: string | null
}

// ── Contexto de tenant ─────────────────────────────────────────
async function getTenantContext() {
  const cookieStore = await cookies()
  const supabase = createServerSupabaseClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminSupabaseClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()
  const companyId = (profile as any)?.company_id as string | null
  if (!companyId) return null
  return { supabase, companyId }
}

// ── Ler progresso do tenant ────────────────────────────────────
export async function getOnboardingProgress(): Promise<OnboardingCheckpoint[]> {
  try {
    const ctx = await getTenantContext()
    if (!ctx) return []
    const { supabase } = ctx
    const { data } = await (supabase as any)
      .from('onboarding_checkpoints')
      .select('day, checkpoint_key, display_name, completed, completed_at')
      .order('day', { ascending: true })
    return (data ?? []) as OnboardingCheckpoint[]
  } catch {
    return []
  }
}

// ── Completar checkpoint (silencioso — nunca quebra o fluxo) ───
export async function completeCheckpoint(
  companyId: string,
  checkpointKey: string,
  supabaseClient?: ReturnType<typeof createServerSupabaseClient>,
): Promise<void> {
  try {
    const client = supabaseClient ?? (await (async () => {
      const cookieStore = await cookies()
      return createServerSupabaseClient(cookieStore)
    })())
    await (client as any).rpc('complete_onboarding_checkpoint', {
      p_company_id: companyId,
      p_checkpoint_key: checkpointKey,
    })
  } catch (err) {
    // Nunca propaga — onboarding é auxiliar, não crítico
    console.warn(`[onboarding] Failed to complete ${checkpointKey}:`, err)
  }
}

// ── Completar via service role (para provisioning) ─────────────
export async function completeCheckpointAdmin(
  companyId: string,
  checkpointKey: string,
): Promise<void> {
  try {
    const admin = createAdminSupabaseClient()
    await (admin as any)
      .from('onboarding_checkpoints')
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq('company_id', companyId)
      .eq('checkpoint_key', checkpointKey)
      .eq('completed', false)
  } catch (err) {
    console.warn(`[onboarding-admin] Failed to complete ${checkpointKey}:`, err)
  }
}
