'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'
import type { ProductInsert, ProductUpdate, ProductRow, CategoryRow } from '@kyra/database'
import type { ProductFormValues, ProductFilterValues } from '@/lib/validations/product'
import { productSchema } from '@/lib/validations/product'
import { getStockStatus } from '@kyra/business-rules'
import { getLimit } from '@kyra/business-rules'

// ── Helper: server client + company_id ────────────────────────
async function getServerContext() {
  const cookieStore = await cookies()
  const supabase = createServerSupabaseClient(cookieStore)

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Não autenticado')

  // Admin client bypasses RLS — seguro pois rodamos em Server Action
  const admin = createAdminSupabaseClient()
  const { data: profileData, error: profileErr } = await (admin as any)
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  const profile = profileData as { company_id: string | null; role: string | null } | null

  if (profileErr || !profile?.company_id) throw new Error('Empresa não encontrada')

  return { supabase, userId: user.id, companyId: profile.company_id as string, role: profile.role }
}

// ── Tipos de retorno ──────────────────────────────────────────
export type ProductWithCategory = ProductRow & {
  category: Pick<CategoryRow, 'id' | 'name' | 'color'> | null
  stock_status: 'ok' | 'low' | 'out'
  margin: number
}

export interface GetProductsResult {
  data: ProductWithCategory[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

// ── getProducts ───────────────────────────────────────────────
export async function getProducts(filters: Partial<ProductFilterValues> = {}): Promise<GetProductsResult> {
  const { supabase, companyId } = await getServerContext()

  const {
    search,
    category_id,
    status = 'active',
    stock_status = 'all',
    page = 1,
    per_page = 20,
    no_image,
    no_cost,
  } = filters

  let query = (supabase as any)
    .from('products')
    .select(`
      *,
      category:categories(id, name, color)
    `, { count: 'exact' })
    .eq('company_id', companyId)
    .order('name', { ascending: true })

  if (status === 'active')   query = query.eq('is_active', true)
  if (status === 'inactive') query = query.eq('is_active', false)

  if (search) {
    query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`)
  }

  if (category_id) query = query.eq('category_id', category_id)

  if (stock_status === 'out') query = query.lte('stock_quantity', 0)
  // low/ok stock filtering done in-memory since it depends on per-product min_stock

  // Filtros de qualidade de cadastro
  if (no_image) query = query.or('image_url.is.null,image_url.eq.')
  if (no_cost)  query = query.lte('cost_price', 0)

  // Pagination
  const from = (page - 1) * per_page
  query = query.range(from, from + per_page - 1)

  const { data, error, count } = await query

  if (error) throw new Error(`Erro ao buscar produtos: ${error.message}`)

  const products: ProductWithCategory[] = (data ?? []).map((p: any) => ({
    ...(p as ProductRow),
    category: (p as { category: CategoryRow | null }).category,
    stock_status: getStockStatus(p.stock_quantity, p.min_stock, p.ai_reorder_point),
    margin: p.sale_price > 0 ? ((p.sale_price - p.cost_price) / p.sale_price) * 100 : 0,
  }))

  // Filter by stock_status in memory (simpler than complex SQL for low stock)
  const filtered = stock_status === 'all'
    ? products
    : products.filter(p => p.stock_status === stock_status)

  const total = stock_status === 'all' ? (count ?? 0) : filtered.length

  return {
    data: filtered,
    total,
    page,
    per_page,
    total_pages: Math.ceil(total / per_page),
  }
}

// ── getProduct (single) ───────────────────────────────────────
export async function getProduct(id: string): Promise<ProductWithCategory | null> {
  const { supabase, companyId } = await getServerContext()

  const { data, error } = await (supabase as any)
    .from('products')
    .select('*, category:categories(id, name, color)')
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (error || !data) return null

  const p = data as ProductRow & { category: CategoryRow | null }
  return {
    ...p,
    stock_status: getStockStatus(p.stock_quantity, p.min_stock, p.ai_reorder_point),
    margin: p.sale_price > 0 ? ((p.sale_price - p.cost_price) / p.sale_price) * 100 : 0,
  }
}

// ── createProduct ─────────────────────────────────────────────
export async function createProduct(
  values: ProductFormValues
): Promise<{ success: boolean; id?: string; error?: string; upgradeRequired?: boolean; limit?: number | null }> {
  try {
    const { supabase, companyId, userId } = await getServerContext()
    // ── Enforcement: products.max ────────────────────────────────
    const { count: productCount } = await (supabase as any)
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)

    const productLimit = await getLimit(companyId, 'products.max')
    if (productLimit !== null && (productCount ?? 0) >= productLimit) {
      return { success: false, error: 'LIMIT_REACHED', upgradeRequired: true, limit: productLimit }
    }

    const parsed = productSchema.parse(values)

    const insert: ProductInsert = {
      company_id: companyId,
      created_by: userId,
      name: parsed.name,
      description: parsed.description || null,
      sku: parsed.sku || null,
      barcode: parsed.barcode || null,
      category_id: parsed.category_id || null,
      brand_id: parsed.brand_id || null,
      cost_price: parsed.cost_price,
      sale_price: parsed.sale_price,
      min_price: parsed.min_price ?? null,
      min_stock: parsed.min_stock,
      max_stock: parsed.max_stock ?? null,
      unit: parsed.unit,
      is_active: parsed.is_active,
      is_featured: parsed.is_featured,
      image_url: parsed.image_url || null,
    }

    const { data, error } = await (supabase as any)
      .from('products')
      .insert({ ...insert, ncm: parsed.ncm || null } as any)
      .select('id')
      .single()

    if (error) return { success: false, error: error.message }

    revalidatePath('/products')
    return { success: true, id: data.id }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro desconhecido' }
  }
}

// ── updateProduct ─────────────────────────────────────────────
export async function updateProduct(
  id: string,
  values: Partial<ProductFormValues>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, companyId } = await getServerContext()

    const update: ProductUpdate = {
      ...(values.name !== undefined && { name: values.name }),
      ...(values.description !== undefined && { description: values.description || null }),
      ...(values.sku !== undefined && { sku: values.sku || null }),
      ...(values.barcode !== undefined && { barcode: values.barcode || null }),
      ...(values.category_id !== undefined && { category_id: values.category_id || null }),
      ...(values.brand_id !== undefined && { brand_id: values.brand_id || null }),
      ...(values.cost_price !== undefined && { cost_price: values.cost_price }),
      ...(values.sale_price !== undefined && { sale_price: values.sale_price }),
      ...(values.min_price !== undefined && { min_price: values.min_price ?? null }),
      ...(values.min_stock !== undefined && { min_stock: values.min_stock }),
      ...(values.max_stock !== undefined && { max_stock: values.max_stock ?? null }),
      ...(values.unit !== undefined && { unit: values.unit }),
      ...(values.is_active !== undefined && { is_active: values.is_active }),
      ...(values.is_featured !== undefined && { is_featured: values.is_featured }),
      ...(values.image_url !== undefined && { image_url: values.image_url || null }),
    }

    const finalUpdate = {
      ...update,
      ...(values.ncm !== undefined && { ncm: values.ncm || null }),
    }

    const { error } = await (supabase as any)
      .from('products')
      .update(finalUpdate as any)
      .eq('id', id)
      .eq('company_id', companyId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/products')
    revalidatePath(`/products/${id}`)
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro desconhecido' }
  }
}

// ── deleteProduct (soft delete) ───────────────────────────────
export async function deleteProduct(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, companyId } = await getServerContext()

    const { error } = await (supabase as any)
      .from('products')
      .update({ is_active: false })
      .eq('id', id)
      .eq('company_id', companyId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/products')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro desconhecido' }
  }
}

// ── getCategories (for selects) ───────────────────────────────
export async function getCategories() {
  const { supabase, companyId } = await getServerContext()

  const { data } = await (supabase as any)
    .from('categories')
    .select('id, name, color, icon, ncm')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name')

  return data ?? []
}

// ── uploadProductImage ────────────────────────────────────────
export async function uploadProductImage(
  formData: FormData
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const { companyId } = await getServerContext()
    const admin = createAdminSupabaseClient()

    const file = formData.get('file') as File | null
    if (!file || file.size === 0) return { success: false, error: 'Nenhum arquivo enviado' }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${companyId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error } = await admin.storage
      .from('product-images')
      .upload(path, buffer, { contentType: file.type, upsert: false })

    if (error) return { success: false, error: error.message }

    const { data } = admin.storage.from('product-images').getPublicUrl(path)
    return { success: true, url: data.publicUrl }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro desconhecido' }
  }
}
