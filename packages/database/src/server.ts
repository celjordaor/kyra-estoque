import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

type CookieStore = {
  getAll(): { name: string; value: string }[]
  setAll?(cookies: { name: string; value: string; options?: Record<string, unknown> }[]): void
}

/**
 * Server-side Supabase client para uso em Server Components e Route Handlers.
 * Usa anon key + cookies do usuário — respeita RLS.
 *
 * setAll é opcional: ReadonlyRequestCookies (layouts/Server Components) não o implementa.
 * O try/catch interno já trata o caso sem setAll graciosamente.
 */
export function createServerSupabaseClient(cookieStore: CookieStore) {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']

  if (!url || !key) {
    throw new Error(
      'Variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY não configuradas.'
    )
  }

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookieStore.setAll?.(cookiesToSet)
        } catch {
          // Server Component sem capacidade de setar cookies — ignorado
        }
      },
    },
  })
}

/**
 * Admin client com service role key — bypassa RLS completamente.
 * Use APENAS em Server Actions / Route Handlers para operações que
 * não devem ser filtradas por RLS (ex: leitura de profile para obter company_id).
 * NUNCA exponha este client ou sua key no frontend.
 */
export function createAdminSupabaseClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']

  if (!url || !key) {
    throw new Error(
      'Variáveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não configuradas.'
    )
  }

  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
