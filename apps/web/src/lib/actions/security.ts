'use server'

import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@kyra/database'

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const cookieStore = await cookies()
    const supabase = createServerSupabaseClient(cookieStore)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { success: false, error: 'Não autenticado' }

    // Re-authenticate with current password to verify it
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    })
    if (signInError) return { success: false, error: 'Senha atual incorreta' }

    // Update to new password
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) return { success: false, error: updateError.message }

    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message ?? String(e) }
  }
}

export async function getActiveSessions(): Promise<{ success: boolean; count?: number }> {
  // Supabase doesn't expose session list via client SDK — placeholder for future
  return { success: true, count: 1 }
}

export async function updateProfile(
  fullName: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const cookieStore = await cookies()
    const supabase = createServerSupabaseClient(cookieStore)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { success: false, error: 'Não autenticado' }

    const { createAdminSupabaseClient } = await import('@kyra/database')
    const admin = createAdminSupabaseClient()
    const { error } = await (admin as any)
      .from('profiles')
      .update({ full_name: fullName.trim() })
      .eq('id', user.id)

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message ?? String(e) }
  }
}
