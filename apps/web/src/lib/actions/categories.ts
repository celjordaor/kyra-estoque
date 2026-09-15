'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'
import type { CategoryRow } from '@kyra/database'

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

export async function getCategoriesAdmin(filters: { search?: string; status?: 'active' | 'inactive' | 'all' } = {}) {
  const { supabase, companyId } = await getServerContext()
  const { search, status = 'all' } = filters

  let query = (supabase as any).from('categories').select('*', { count: 'exact' }).eq('company_id', companyId)
  if (status !== 'all') query = query.eq('is_active', status === 'active')
  if (search) query = query.ilike('name', `%${search}%`)
  query = query.order('name')

  const { data, error, count } = await query
  if (error) throw error
  return { data: (data ?? []) as CategoryRow[], total: count ?? 0 }
}

export async function createCategory(values: { name: string; description?: string; color?: string; ncm?: string }): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, companyId } = await getServerContext()
    const slug = values.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const { error } = await (supabase as any).from('categories').insert({
      ...values,
      slug,
      company_id: companyId,
      sort_order: 0,
      is_active: true,
    })
    if (error) return { success: false, error: error.message }
    revalidatePath('/settings')
    revalidatePath('/products')
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function updateCategory(id: string, values: { name?: string; description?: string; color?: string; is_active?: boolean; ncm?: string }): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, companyId } = await getServerContext()
    const update: Record<string, unknown> = { ...values }
    if (values.name) update.slug = values.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const { error } = await (supabase as any).from('categories').update(update).eq('id', id).eq('company_id', companyId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/settings')
    revalidatePath('/products')
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function deleteCategory(id: string): Promise<{ success: boolean; error?: string }> {
  return updateCategory(id, { is_active: false })
}

// ── Search + create-and-return (para EntitySelect) ─────────────

export async function searchCategories(q: string): Promise<{ id: string; name: string }[]> {
  try {
    const { supabase, companyId } = await getServerContext()
    const { data } = await (supabase as any)
      .from('categories')
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

export async function createCategoryAndReturn(
  name: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { supabase, companyId } = await getServerContext()
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const { data, error } = await (supabase as any)
      .from('categories')
      .insert({ name, slug, company_id: companyId, sort_order: 0, is_active: true })
      .select('id')
      .single()
    if (error) return { success: false, error: error.message }
    revalidatePath('/settings')
    revalidatePath('/products')
    return { success: true, id: data.id }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ── getCategoryNcm — busca o NCM de uma categoria específica ──────────────────
export async function getCategoryNcm(categoryId: string): Promise<string | null> {
  try {
    const { supabase, companyId } = await getServerContext()
    const { data } = await (supabase as any)
      .from('categories')
      .select('ncm')
      .eq('id', categoryId)
      .eq('company_id', companyId)
      .single()
    return (data as any)?.ncm ?? null
  } catch {
    return null
  }
}
