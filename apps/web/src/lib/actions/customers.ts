'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'
import type { CustomerRow, CustomerInsert, CustomerUpdate } from '@kyra/database'

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

export async function getCustomers(filters: { search?: string; status?: 'active' | 'inactive' | 'all'; page?: number; per_page?: number } = {}) {
  const { supabase, companyId } = await getServerContext()
  const { search, status = 'active', page = 1, per_page = 50 } = filters
  const from = (page - 1) * per_page
  const to = from + per_page - 1

  let query = supabase.from('customers').select('*', { count: 'exact' }).eq('company_id', companyId)
  if (status !== 'all') query = query.eq('is_active', status === 'active')
  if (search) query = query.ilike('name', `%${search}%`)
  query = query.order('name').range(from, to)

  const { data, error, count } = await query
  if (error) throw error
  return { data: (data ?? []) as CustomerRow[], total: count ?? 0 }
}

export async function createCustomer(values: Omit<CustomerInsert, 'company_id'>): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, companyId } = await getServerContext()
    const { error } = await supabase.from('customers').insert({ ...values, company_id: companyId })
    if (error) return { success: false, error: error.message }
    revalidatePath('/customers')
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function updateCustomer(id: string, values: CustomerUpdate): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, companyId } = await getServerContext()
    const { error } = await supabase.from('customers').update(values).eq('id', id).eq('company_id', companyId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/customers')
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function deleteCustomer(id: string): Promise<{ success: boolean; error?: string }> {
  return updateCustomer(id, { is_active: false })
}
