'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'

async function getServerContext() {
  const cookieStore = await cookies()
  const supabase = createServerSupabaseClient(cookieStore)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Não autenticado')
  const admin = createAdminSupabaseClient()
  const { data: profileData } = await (admin as any).from('profiles').select('company_id').eq('id', user.id).single()
  const profile = profileData as { company_id: string | null } | null
  if (!profile?.company_id) throw new Error('Empresa não encontrada')
  return { supabase, companyId: profile.company_id as string }
}

export interface CouponRow {
  id: string
  code: string
  description: string | null
  discount_type: 'percent' | 'fixed'
  discount_value: number
  min_order_value: number
  max_uses: number | null
  uses_count: number
  expires_at: string | null
  is_active: boolean
  created_at: string
}

export interface CouponInput {
  code: string
  description?: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
  min_order_value?: number
  max_uses?: number | null
  expires_at?: string | null
  is_active?: boolean
}

// ── List ──────────────────────────────────────────────────────
export async function getCoupons(): Promise<CouponRow[]> {
  const { supabase, companyId } = await getServerContext()
  const { data, error } = await (supabase as any)
    .from('discount_coupons')
    .select('id, code, description, discount_type, discount_value, min_order_value, max_uses, uses_count, expires_at, is_active, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as CouponRow[]
}

// ── Create ────────────────────────────────────────────────────
export async function createCoupon(input: CouponInput): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, companyId } = await getServerContext()
    const { error } = await (supabase as any).from('discount_coupons').insert({
      company_id: companyId,
      code: input.code.trim().toUpperCase(),
      description: input.description?.trim() || null,
      discount_type: input.discount_type,
      discount_value: input.discount_value,
      min_order_value: input.min_order_value ?? 0,
      max_uses: input.max_uses ?? null,
      expires_at: input.expires_at || null,
      is_active: input.is_active ?? true,
    })
    if (error) return { success: false, error: error.message }
    revalidatePath('/settings')
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ── Update ────────────────────────────────────────────────────
export async function updateCoupon(id: string, input: Partial<CouponInput>): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, companyId } = await getServerContext()
    const payload: Record<string, unknown> = {}
    if (input.code !== undefined) payload.code = input.code.trim().toUpperCase()
    if (input.description !== undefined) payload.description = input.description?.trim() || null
    if (input.discount_type !== undefined) payload.discount_type = input.discount_type
    if (input.discount_value !== undefined) payload.discount_value = input.discount_value
    if (input.min_order_value !== undefined) payload.min_order_value = input.min_order_value
    if (input.max_uses !== undefined) payload.max_uses = input.max_uses ?? null
    if (input.expires_at !== undefined) payload.expires_at = input.expires_at || null
    if (input.is_active !== undefined) payload.is_active = input.is_active

    const { error } = await (supabase as any).from('discount_coupons').update(payload).eq('id', id).eq('company_id', companyId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/settings')
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ── Delete ────────────────────────────────────────────────────
export async function deleteCoupon(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, companyId } = await getServerContext()
    const { error } = await (supabase as any).from('discount_coupons').delete().eq('id', id).eq('company_id', companyId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/settings')
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}
