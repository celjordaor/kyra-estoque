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
  return { supabase, companyId: profile.company_id as string, userId: user.id }
}

// ── Types ──────────────────────────────────────────────────────
export interface CompanyProfile {
  id: string
  name: string
  fantasy_name: string | null
  document: string | null
  email: string | null
  phone: string | null
  website: string | null
  logo_url: string | null
  address_cep: string | null
  address_street: string | null
  address_number: string | null
  address_complement: string | null
  address_neighborhood: string | null
  address_city: string | null
  address_state: string | null
}

export interface OperationSettings {
  allow_negative_stock: boolean
  track_by_movement: boolean
  allow_discount: boolean
  require_customer: boolean
}

export interface CompanySettings extends CompanyProfile, OperationSettings {}

export interface UpdateCompanyProfileInput {
  name: string
  fantasy_name?: string | null
  document?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  address_cep?: string | null
  address_street?: string | null
  address_number?: string | null
  address_complement?: string | null
  address_neighborhood?: string | null
  address_city?: string | null
  address_state?: string | null
}

// ── Get full company settings ──────────────────────────────────
export async function getCompanySettings(): Promise<CompanySettings | null> {
  const { companyId } = await getServerContext()
  const admin = createAdminSupabaseClient()

  const { data: rawData, error } = await (admin as any)
    .from('companies')
    .select(`
      id, name, fantasy_name, document, email, phone, website, logo_url,
      address_cep, address_street, address_number, address_complement,
      address_neighborhood, address_city, address_state,
      allow_negative_stock, track_by_movement, allow_discount, require_customer
    `)
    .eq('id', companyId)
    .single()

  if (error || !rawData) return null

  const data = rawData as {
    id: string; name: string; fantasy_name: string | null; document: string | null
    email: string | null; phone: string | null; website: string | null; logo_url: string | null
    address_cep: string | null; address_street: string | null; address_number: string | null
    address_complement: string | null; address_neighborhood: string | null
    address_city: string | null; address_state: string | null
    allow_negative_stock: boolean; track_by_movement: boolean
    allow_discount: boolean; require_customer: boolean
  }

  return {
    id: data.id,
    name: data.name,
    fantasy_name: data.fantasy_name ?? null,
    document: data.document ?? null,
    email: data.email ?? null,
    phone: data.phone ?? null,
    website: data.website ?? null,
    logo_url: data.logo_url ?? null,
    address_cep: data.address_cep ?? null,
    address_street: data.address_street ?? null,
    address_number: data.address_number ?? null,
    address_complement: data.address_complement ?? null,
    address_neighborhood: data.address_neighborhood ?? null,
    address_city: data.address_city ?? null,
    address_state: data.address_state ?? null,
    allow_negative_stock: data.allow_negative_stock ?? false,
    track_by_movement: data.track_by_movement ?? true,
    allow_discount: data.allow_discount ?? true,
    require_customer: data.require_customer ?? false,
  }
}

// ── Update company profile ─────────────────────────────────────
export async function updateCompanyProfile(
  values: UpdateCompanyProfileInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const { companyId } = await getServerContext()
    const admin = createAdminSupabaseClient()

    const { error } = await (admin as any)
      .from('companies')
      .update({
        name: values.name,
        fantasy_name: values.fantasy_name ?? null,
        document: values.document ?? null,
        email: values.email ?? null,
        phone: values.phone ?? null,
        website: values.website ?? null,
        address_cep: values.address_cep ?? null,
        address_street: values.address_street ?? null,
        address_number: values.address_number ?? null,
        address_complement: values.address_complement ?? null,
        address_neighborhood: values.address_neighborhood ?? null,
        address_city: values.address_city ?? null,
        address_state: values.address_state ?? null,
      })
      .eq('id', companyId)

    if (error) return { success: false, error: (error as any).message }

    revalidatePath('/settings')
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ── Upload company logo ────────────────────────────────────────
export async function uploadCompanyLogo(
  formData: FormData
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const { companyId } = await getServerContext()
    const admin = createAdminSupabaseClient()

    const file = formData.get('logo') as File | null
    if (!file || file.size === 0) return { success: false, error: 'Arquivo não encontrado' }

    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
    const path = `${companyId}/logo.${ext}`
    const bytes = await file.arrayBuffer()

    const { error: uploadError } = await admin.storage
      .from('company-logos')
      .upload(path, bytes, { contentType: file.type, upsert: true })

    if (uploadError) return { success: false, error: uploadError.message }

    const { data: urlData } = admin.storage.from('company-logos').getPublicUrl(path)

    const { error: dbError } = await (admin as any)
      .from('companies')
      .update({ logo_url: urlData.publicUrl })
      .eq('id', companyId)

    if (dbError) return { success: false, error: (dbError as any).message }

    revalidatePath('/settings')
    return { success: true, url: urlData.publicUrl }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ── Update operation settings ──────────────────────────────────
export async function updateOperationSettings(
  values: OperationSettings
): Promise<{ success: boolean; error?: string }> {
  try {
    const { companyId } = await getServerContext()
    const admin = createAdminSupabaseClient()

    const { error } = await (admin as any)
      .from('companies')
      .update({
        allow_negative_stock: values.allow_negative_stock,
        track_by_movement: values.track_by_movement,
        allow_discount: values.allow_discount,
        require_customer: values.require_customer,
      })
      .eq('id', companyId)

    if (error) return { success: false, error: (error as any).message }

    revalidatePath('/settings')
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ── Fiscal config (kyra_config.fiscal) ────────────────────────

export interface FiscalConfig {
  ie?: string              // Inscrição Estadual
  im?: string              // Inscrição Municipal (opcional)
  regime_tributario?: number // 1=Simples Nacional, 2=SN excesso, 3=Regime Normal
  nome_fantasia?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  uf?: string
  cep?: string
  cnae?: string            // CNAE principal (opcional)
  cfop?: string            // CFOP padrão de venda (ex: 5102 = venda interna)
}

export async function getFiscalConfig(): Promise<FiscalConfig> {
  try {
    const { companyId } = await getServerContext()
    const admin = createAdminSupabaseClient()
    const { data: rawFiscal } = await (admin as any)
      .from('companies')
      .select('kyra_config')
      .eq('id', companyId)
      .single()
    const data = rawFiscal as { kyra_config: Record<string, unknown> | null } | null
    return ((data?.kyra_config as Record<string, unknown>)?.fiscal ?? {}) as FiscalConfig
  } catch {
    return {}
  }
}

export async function updateFiscalConfig(
  fiscal: FiscalConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    const { companyId } = await getServerContext()
    const admin = createAdminSupabaseClient()

    // Busca config atual para fazer merge sem perder outros campos do kyra_config
    const { data: rawCurrent } = await (admin as any)
      .from('companies')
      .select('kyra_config')
      .eq('id', companyId)
      .single()
    const current = rawCurrent as { kyra_config: Record<string, unknown> | null } | null

    const merged = {
      ...((current?.kyra_config as Record<string, unknown>) ?? {}),
      fiscal,
    }

    const { error } = await (admin as any)
      .from('companies')
      .update({ kyra_config: merged })
      .eq('id', companyId)

    if (error) return { success: false, error: (error as any).message }
    revalidatePath('/settings')
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}
