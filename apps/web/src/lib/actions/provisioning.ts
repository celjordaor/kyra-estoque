'use server'

/**
 * provisionTenant — Sprint 22a
 *
 * Pipeline atômico e idempotente para provisionamento de novos tenants.
 * Cada etapa é registrada em `provisioning_jobs`.
 *
 * Ordem:
 *  1. company (+ kyra_config padrão)
 *  2. plan lookup
 *  3. subscription
 *  4. admin user (auth)
 *  5. profile
 *  6. onboarding D0 (seed_onboarding_checkpoints)
 *  7. send_access (email Resend)
 *
 * Regras:
 *  - company_id nunca vem do body; aqui é gerado internamente
 *  - Nunca if plan === '...' — plano apenas para criar a subscription
 *  - kyra_config: coluna JSONB em companies
 */

import { completeCheckpointAdmin } from '@/lib/actions/onboarding'
import { cookies } from 'next/headers'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'

// ── Auth guard ─────────────────────────────────────────────────
async function requireSuperAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerSupabaseClient(cookieStore)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Não autenticado')
  const admin = createAdminSupabaseClient()
  const { data: profileData } = await (admin as any)
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()
  const profile = profileData as { is_super_admin: boolean | null } | null
  if (!profile?.is_super_admin) throw new Error('Acesso restrito')
  return { admin, userId: user.id }
}

// ── Types ──────────────────────────────────────────────────────
export interface ProvisionTenantInput {
  company_name: string
  company_slug: string
  admin_email: string
  admin_name: string
  plan_slug: string
  /** 0 = ativa imediatamente sem trial */
  trial_days?: number
  notes?: string
}

export interface ProvisionTenantResult {
  success: boolean
  job_id?: string
  company_id?: string
  error?: string
  step?: string
}

type StepStatus = 'ok' | 'failed' | 'skipped'

interface StepLog {
  step: string
  status: StepStatus
  ts: string
  error?: string
}

// ── Helper: append step log ────────────────────────────────────
async function logStep(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  jobId: string,
  stepLog: StepLog,
  currentStep?: string,
) {
  // Fetch existing log array then append (JSONB array concat)
  const { data: job } = await (admin as any)
    .from('provisioning_jobs')
    .select('steps_log')
    .eq('id', jobId)
    .single()

  const existing: StepLog[] = Array.isArray(job?.steps_log) ? (job.steps_log as StepLog[]) : []
  existing.push(stepLog)

  await (admin as any)
    .from('provisioning_jobs')
    .update({
      steps_log: existing as unknown as any,
      ...(currentStep ? { current_step: currentStep } : {}),
    })
    .eq('id', jobId)
}

// ── Main action ────────────────────────────────────────────────
export async function provisionTenant(
  input: ProvisionTenantInput,
): Promise<ProvisionTenantResult> {
  const { admin, userId } = await requireSuperAdmin()

  // ── Idempotência: verificar slug já existente ─────────────────
  const { data: existing } = await (admin as any)
    .from('companies')
    .select('id')
    .eq('slug', input.company_slug)
    .maybeSingle()

  if (existing) {
    return {
      success: false,
      error: `Empresa com slug "${input.company_slug}" já existe.`,
    }
  }

  // ── Criar job de provisionamento ──────────────────────────────
  const { data: job, error: jobErr } = await (admin as any)
    .from('provisioning_jobs')
    .insert({
      input: input as unknown as any,
      status: 'running',
      current_step: 'company',
      triggered_by: userId,
      trigger_source: 'admin_manual',
    })
    .select('id')
    .single()

  if (jobErr || !job) {
    return { success: false, error: 'Falha ao criar registro de provisionamento.' }
  }

  const jobId = job.id
  let companyId: string | undefined

  // ── Utilitário de falha ───────────────────────────────────────
  async function fail(step: string, error: string): Promise<ProvisionTenantResult> {
    await logStep(admin, jobId, { step, status: 'failed', ts: new Date().toISOString(), error })
    await (admin as any)
      .from('provisioning_jobs')
      .update({ status: 'failed', error_message: error, current_step: step, company_id: companyId ?? null })
      .eq('id', jobId)
    return { success: false, job_id: jobId, company_id: companyId, error, step }
  }

  // ══════════════════════════════════════════════════════════════
  // STEP 1 — Criar empresa
  // ══════════════════════════════════════════════════════════════
  const defaultKyraConfig = {
    persona_name: 'Kyra',
    tone: 'professional',
    focus_areas: ['estoque', 'vendas'],
    language: 'pt-BR',
    advanced_mode: false,
  }

  const { data: company, error: companyErr } = await (admin as any)
    .from('companies')
    .insert({
      name: input.company_name,
      slug: input.company_slug,
      is_active: true,
      kyra_config: defaultKyraConfig as unknown as any,
      ...(input.notes ? { notes: input.notes } : {}),
    })
    .select('id')
    .single()

  if (companyErr || !company) {
    return await fail('company', companyErr?.message ?? 'Erro ao criar empresa')
  }

  companyId = company.id
  await logStep(admin, jobId, { step: 'company', status: 'ok', ts: new Date().toISOString() }, 'plan')

  // ══════════════════════════════════════════════════════════════
  // STEP 2 — Buscar plano
  // FIX: coluna chama-se "active" (não "is_active"), e "price_cents" não existe em plans
  // ══════════════════════════════════════════════════════════════
  const { data: plan, error: planErr } = await (admin as any)
    .from('plans')
    .select('id, name')
    .eq('slug', input.plan_slug)
    .eq('active', true)
    .maybeSingle()

  if (planErr || !plan) {
    return await fail('plan', `Plano "${input.plan_slug}" não encontrado ou inativo`)
  }

  await logStep(admin, jobId, { step: 'plan', status: 'ok', ts: new Date().toISOString() }, 'subscription')

  // ══════════════════════════════════════════════════════════════
  // STEP 3 — Criar assinatura
  // ══════════════════════════════════════════════════════════════
  const now = new Date()
  const trialDays = input.trial_days ?? 0
  const trialEndsAt = trialDays > 0
    ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000).toISOString()
    : null
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString()

  const { error: subErr } = await (admin as any)
    .from('subscriptions')
    .insert({
      company_id: companyId,
      plan_id: plan.id,
      status: trialDays > 0 ? 'trialing' : 'active',
      trial_ends_at: trialEndsAt,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd,
    })

  if (subErr) {
    return await fail('subscription', subErr.message)
  }

  await logStep(admin, jobId, { step: 'subscription', status: 'ok', ts: new Date().toISOString() }, 'admin_user')

  // ══════════════════════════════════════════════════════════════
  // STEP 4 — Criar usuário admin (auth)
  // ══════════════════════════════════════════════════════════════
  const tempPassword = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6).toUpperCase() + '!'

  const { data: newUser, error: userErr } = await admin.auth.admin.createUser({
    email: input.admin_email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name: input.admin_name },
  })

  if (userErr || !newUser?.user) {
    return await fail('admin_user', userErr?.message ?? 'Erro ao criar usuário')
  }

  const newUserId = newUser.user.id
  await logStep(admin, jobId, { step: 'admin_user', status: 'ok', ts: new Date().toISOString() }, 'profile')

  // ══════════════════════════════════════════════════════════════
  // STEP 5 — Criar perfil
  // ══════════════════════════════════════════════════════════════
  // Upsert: o trigger handle_new_user pode ter criado o profile automaticamente
  // ao inserir em auth.users. Upsert garante idempotência sem duplicate key error.
  const { error: profileErr } = await (admin as any)
    .from('profiles')
    .upsert({
      id: newUserId,
      company_id: companyId,
      full_name: input.admin_name,
      email: input.admin_email,
      role: 'owner',
      is_active: true,
      is_super_admin: false,
    }, { onConflict: 'id' })

  if (profileErr) {
    return await fail('profile', profileErr.message)
  }

  await logStep(admin, jobId, { step: 'profile', status: 'ok', ts: new Date().toISOString() }, 'onboarding')

  // ══════════════════════════════════════════════════════════════
  // STEP 6 — Seed onboarding checkpoints (D0-D21)
  // ══════════════════════════════════════════════════════════════
  const { error: onboardErr } = await (admin as any).rpc('seed_onboarding_checkpoints' as any, { p_company_id: companyId } as any)

  if (onboardErr) {
    // Não fatal — loga e continua
    await logStep(admin, jobId, {
      step: 'onboarding',
      status: 'skipped',
      ts: new Date().toISOString(),
      error: onboardErr.message,
    }, 'send_access')
  } else {
    await logStep(admin, jobId, { step: 'onboarding', status: 'ok', ts: new Date().toISOString() }, 'send_access')
  }

  // ══════════════════════════════════════════════════════════════
  // STEP 7 — Enviar acesso por e-mail (Resend)
  // ══════════════════════════════════════════════════════════════
  const resendKey = process.env.RESEND_API_KEY
  let emailSent = false

  if (resendKey) {
    try {
      // Gerar link de reset de senha para o admin configurar a própria senha
      const { data: linkData } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email: input.admin_email,
        options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.kyraestoque.com.br'}/update-password` },
      })

      // Preferir hashed_token para construir link direto ao nosso /auth/callback
      // (server-side verifyOtp — não depende de PKCE verifier no browser nem de detectSessionInUrl)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.kyraestoque.com.br'
      const hashedToken = linkData?.properties?.hashed_token
      const accessLink = hashedToken
        ? `${appUrl}/auth/callback?token_hash=${encodeURIComponent(hashedToken)}&type=recovery&next=/update-password`
        : (linkData?.properties?.action_link ?? null)

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Kyra Estoque <admin@kyraestoque.com.br>',
          to: [input.admin_email],
          subject: `Sua conta Kyra Estoque está pronta — ${input.company_name}`,
          html: buildWelcomeEmail({
            name: input.admin_name,
            companyName: input.company_name,
            planName: plan.name,
            accessLink: accessLink ?? `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.kyraestoque.com.br'}/auth/login`,
            trialDays,
          }),
        }),
      })

      emailSent = emailRes.ok
      if (!emailRes.ok) {
        const err = await emailRes.json().catch(() => ({}))
        console.error('[provisionTenant] Resend error:', emailRes.status, err)
      }
    } catch (err) {
      console.error('[provisionTenant] Erro ao enviar e-mail:', err)
    }
  }

  await logStep(admin, jobId, {
    step: 'send_access',
    status: emailSent ? 'ok' : 'skipped',
    ts: new Date().toISOString(),
    ...(!emailSent ? { error: 'RESEND_API_KEY ausente ou envio falhou' } : {}),
  })

  // ══════════════════════════════════════════════════════════════
  // Finalizar job como completed
  // ══════════════════════════════════════════════════════════════
  await (admin as any)
    .from('provisioning_jobs')
    .update({
      status: 'completed',
      company_id: companyId,
      current_step: 'done',
    })
    .eq('id', jobId)

  // D0: conta_pronta — silencioso
  if (companyId) await completeCheckpointAdmin(companyId, 'conta_pronta').catch(() => {})
  return { success: true, job_id: jobId, company_id: companyId }
}

// ── E-mail HTML ────────────────────────────────────────────────
function buildWelcomeEmail(params: {
  name: string
  companyName: string
  planName: string
  accessLink: string
  trialDays: number
}): string {
  const { name, companyName, planName, accessLink, trialDays } = params
  const trialNote = trialDays > 0
    ? `<p style="color:#6b7280;margin:0 0 16px">Você tem <strong>${trialDays} dias de trial gratuito</strong> para explorar todas as funcionalidades.</p>`
    : ''

  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
      <img src="https://kyraestoque.com.br/logo.png" alt="Kyra Estoque" style="height:36px;margin-bottom:24px" />
      <h2 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#111827">Olá, ${name}!</h2>
      <p style="color:#6b7280;margin:0 0 16px">
        Sua conta <strong>${companyName}</strong> foi criada com o plano <strong>${planName}</strong>.
        Clique no botão abaixo para definir sua senha e começar.
      </p>
      ${trialNote}
      <a href="${accessLink}"
         style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px;margin-bottom:24px">
        Acessar minha conta
      </a>
      <p style="color:#9ca3af;font-size:12px;margin:0">
        Se você não solicitou este acesso, ignore este e-mail.
      </p>
    </div>
  `
}

// ── Listar jobs de provisionamento ─────────────────────────────
export interface ProvisioningJobRow {
  id: string
  company_id: string | null
  company_name: string | null
  status: string
  current_step: string | null
  error_message: string | null
  trigger_source: string
  triggered_by_email: string | null
  created_at: string
  completed_at: string | null
}

export async function getProvisioningJobs(): Promise<ProvisioningJobRow[]> {
  const { admin } = await requireSuperAdmin()

  const { data: jobs } = await (admin as any)
    .from('provisioning_jobs')
    .select('id, company_id, status, current_step, error_message, trigger_source, triggered_by, created_at, completed_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (!jobs?.length) return []

  const companyIds = [...new Set(jobs.map((j: any) => j.company_id).filter(Boolean))]
  const userIds = [...new Set(jobs.map((j: any) => j.triggered_by).filter(Boolean))]

  const [{ data: companies }, usersRes] = await Promise.all([
    companyIds.length
      ? (admin as any).from('companies').select('id, name').in('id', companyIds as string[])
      : Promise.resolve({ data: [] }),
    userIds.length
      ? admin.auth.admin.listUsers({ perPage: 1000 } as any)
      : Promise.resolve({ data: { users: [] } }),
  ])

  const companyMap = new Map((companies ?? []).map((c: any) => [c.id, c.name]))
  const userMap = new Map(((usersRes as any).data?.users ?? []).map((u: any) => [u.id, u.email]))

  return jobs.map((j: any) => ({
    id: j.id,
    company_id: j.company_id,
    company_name: j.company_id ? (companyMap.get(j.company_id) ?? null) : null,
    status: j.status,
    current_step: j.current_step,
    error_message: j.error_message,
    trigger_source: j.trigger_source,
    triggered_by_email: j.triggered_by ? (userMap.get(j.triggered_by) ?? null) : null,
    created_at: j.created_at,
    completed_at: j.completed_at,
  }))
}
