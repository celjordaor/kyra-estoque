import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

/**
 * Client-side Supabase client (componentes React / Client Components).
 * Nunca expor a service role key aqui.
 */
export function createClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']

  if (!url || !key) {
    throw new Error(
      'Variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY não configuradas.'
    )
  }

  return createBrowserClient<Database>(url, key)
}
