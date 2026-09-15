'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'
import type { BrandRow, BrandInsert, BrandUpdate } from '@kyra/database'

async function getServerContext() {
  const cookieStore = await cookies()
  const supabase = createServerSupabaseClient(cookieStore)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Não autenticado')
  const admin = createAdminSupabaseClient()
  const { data: profile } = await admin.from('profiles').select('company_id').eq('id', user.id).single()
  if (!profile?.company_id) throw new Error('Empresa não encontrada')
  return { supabase, companyId: profile.company_id }
}

export async function getBrands(filters: { search?: string; status?: 'active' | 'inactive' | 'all' } = {}) {
  const { supabase, companyId } = await getServerContext()
  const { search, status = 'active' } = filters

  let query = supabase.from('brands').select('*', { count: 'exact' }).eq('company_id', companyId)
  if (status !== 'all') query = query.eq('is_active', status === 'active')
  if (search) query = query.ilike('name', `%${search}%`)
  query = query.order('name')

  const { data, error, count } = await query
  if (error) throw error
  return { data: (data ?? []) as BrandRow[], total: count ?? 0 }
}

export async function createBrand(values: { name: string; description?: string }): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, companyId } = await getServerContext()
    const slug = values.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const { error } = await supabase.from('brands').insert({ ...values, slug, company_id: companyId, is_active: true })
    if (error) return { success: false, error: error.message }
    revalidatePath('/settings')
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function updateBrand(id: string, values: BrandUpdate): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, companyId } = await getServerContext()
    const update: BrandUpdate = { ...values }
    if (values.name) update.slug = values.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const { error } = await supabase.from('brands').update(update).eq('id', id).eq('company_id', companyId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/settings')
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function deleteBrand(id: string): Promise<{ success: boolean; error?: string }> {
  return updateBrand(id, { is_active: false })
}

// ── Search + create-and-return (para EntitySelect) ─────────────

export async function searchBrands(q: string): Promise<{ id: string; name: string }[]> {
  try {
    const { supabase, companyId } = await getServerContext()
    const { data } = await supabase
      .from('brands')
      .select('id, name')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .ilike('name', `%${q}%`)
      .order('name')
      .limit(8)
    return (data ?? []) as { id: string; name: string }[]
  } catch {
    return []
  }
}

export async function createBrandAndReturn(
  name: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { supabase, companyId } = await getServerContext()
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const { data, error } = await supabase
      .from('brands')
      .insert({ name, slug, company_id: companyId, is_active: true })
      .select('id')
      .single()
    if (error) return { success: false, error: error.message }
    revalidatePath('/settings')
    return { success: true, id: data.id }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}
