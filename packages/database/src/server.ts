import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

type CookieStore = {
  getAll(): { name: string; value: string }[]
  /** set() individual — disponível em Route Handlers do Next.js */
  set?(name: string, value: string, options?: Record<string, unknown>): void
  /** setAll() — disponível em implementações customizadas / middleware */
  setAll?(cookies: { name: string; value: string; options?: Record<string, unknown> }[]): void
}

/**
 * Server-side Supabase client para uso em Server Components e Route Handlers.
 * Usa anon key + cookies do usuário — respeita RLS.
 *
 * IMPORTANTE: o Next.js cookies() expõe set() individual, não setAll().
 * A implementação abaixo tenta setAll() e cai em set() individual para
 * garantir que os cookies de sessão sejam gravados corretamente em Route Handlers
 * (ex: /auth/callback — sem isso, verifyOtp() e exchangeCodeForSession() funcionam
 * mas os Set-Cookie headers não chegam ao browser).
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
      setAll: (cookiesToSet: { name: string; value: string; options: any }[]) => {
        try {
          if (typeof cookieStore.setAll === 'function') {
            // Middleware / implementações customizadas que expõem setAll()
            cookieStore.setAll(cookiesToSet)
          } else if (typeof cookieStore.set === 'function') {
            // Next.js cookies() em Route Handlers — só tem set() individual
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set!(name, value, options)
            })
          }
        } catch {
          // Server Component (read-only) — ignorado graciosamente
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
