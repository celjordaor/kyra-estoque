'use server'

import { createHash, randomInt } from 'crypto'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'
import { normalizeBrPhone, maskPhone } from '@/lib/whatsapp/phone'
import { enqueueWhatsApp, processOutbox } from '@/lib/whatsapp/outbox'

const CODE_TTL_MIN = 10
const MAX_ATTEMPTS = 5
const MAX_CODES_PER_HOUR = 5

const hashCode = (profileId: string, phone: string, code: string) =>
  createHash('sha256').update(`${profileId}:${phone}:${code}:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`).digest('hex')

async function ctx() {
  const supabase = createServerSupabaseClient(await cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  const admin = createAdminSupabaseClient() as any
  const { data: profile } = await admin.from('profiles').select('id, company_id').eq('id', user.id).single()
  if (!profile) throw new Error('Perfil não encontrado')
  return { admin, profileId: profile.id as string, companyId: profile.company_id as string | null }
}

export interface WhatsappPhoneState {
  phone: string | null
  maskedPhone: string | null
  verified: boolean
}

export async function getWhatsappPhone(): Promise<WhatsappPhoneState> {
  try {
    const { admin, profileId } = await ctx()
    const { data } = await admin.from('profiles').select('phone, phone_verified_at').eq('id', profileId).single()
    return { phone: data?.phone ?? null, maskedPhone: data?.phone ? maskPhone(data.phone) : null, verified: !!data?.phone_verified_at }
  } catch { return { phone: null, maskedPhone: null, verified: false } }
}

/** Passo 1: grava o número (ainda não verificado) e envia o código por WhatsApp. */
export async function requestPhoneCode(rawPhone: string): Promise<{ success: boolean; error?: string; maskedPhone?: string }> {
  try {
    const { admin, profileId, companyId } = await ctx()
    const phone = normalizeBrPhone(rawPhone)
    if (!phone) return { success: false, error: 'Informe um celular válido com DDD, ex.: (11) 99999-8888.' }

    const { data: taken } = await admin.from('profiles').select('id').eq('phone', phone)
      .not('phone_verified_at', 'is', null).neq('id', profileId).maybeSingle()
    if (taken) return { success: false, error: 'Este número já está vinculado a outro usuário.' }

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await admin.from('whatsapp_verifications').select('id', { count: 'exact', head: true })
      .eq('profile_id', profileId).gte('created_at', since)
    if ((count ?? 0) >= MAX_CODES_PER_HOUR) return { success: false, error: 'Muitos códigos solicitados. Tente novamente em 1 hora.' }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    await admin.from('profiles').update({ phone, phone_verified_at: null }).eq('id', profileId)
    await admin.from('whatsapp_verifications').insert({
      profile_id: profileId, phone, code_hash: hashCode(profileId, phone, code),
      expires_at: new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString(),
    })
    await enqueueWhatsApp(admin, {
      companyId, profileId, toPhone: phone, kind: 'verification',
      title: 'Código de verificação Kyra', detail: `Seu código de verificação Kyra é ${code}`, code,
    })
    await processOutbox(admin, 5).catch(() => {})
    revalidatePath('/profile')
    return { success: true, maskedPhone: maskPhone(phone) }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Passo 2: confere o código. */
export async function confirmPhoneCode(code: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { admin, profileId } = await ctx()
    const clean = (code ?? '').replace(/\D/g, '')
    if (clean.length !== 6) return { success: false, error: 'Digite o código de 6 dígitos.' }

    const { data: prof } = await admin.from('profiles').select('phone').eq('id', profileId).single()
    if (!prof?.phone) return { success: false, error: 'Informe o número primeiro.' }

    const { data: v } = await admin.from('whatsapp_verifications').select('*')
      .eq('profile_id', profileId).eq('phone', prof.phone)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (!v) return { success: false, error: 'Solicite um novo código.' }
    if (new Date(v.expires_at).getTime() < Date.now()) return { success: false, error: 'Código expirado. Solicite um novo.' }
    if (v.attempts >= MAX_ATTEMPTS) return { success: false, error: 'Tentativas esgotadas. Solicite um novo código.' }

    if (hashCode(profileId, prof.phone, clean) !== v.code_hash) {
      await admin.from('whatsapp_verifications').update({ attempts: v.attempts + 1 }).eq('id', v.id)
      return { success: false, error: 'Código incorreto.' }
    }
    const { error } = await admin.from('profiles').update({ phone_verified_at: new Date().toISOString() }).eq('id', profileId)
    if (error) return { success: false, error: 'Não foi possível vincular este número.' }
    await admin.from('whatsapp_verifications').delete().eq('profile_id', profileId)
    revalidatePath('/profile')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function removeWhatsappPhone(): Promise<{ success: boolean; error?: string }> {
  try {
    const { admin, profileId } = await ctx()
    await admin.from('profiles').update({ phone: null, phone_verified_at: null }).eq('id', profileId)
    await admin.from('whatsapp_verifications').delete().eq('profile_id', profileId)
    revalidatePath('/profile')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) }
  }
}
