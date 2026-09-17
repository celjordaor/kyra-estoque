import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/dashboard'

  const cookieStore = await cookies()
  const supabase = createServerSupabaseClient(cookieStore)

  // Fluxo PKCE (resetPasswordForEmail — browser-initiated forgot-password)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('[auth/callback] exchangeCodeForSession error:', error.message)
  }

  // Fluxo OTP / token_hash (generateLink admin — provisioning e convite de membro)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      // Para convites de membros: ativar o perfil assim que o link é confirmado.
      // O inviteMember cria o perfil com is_active=false; aqui o usuário provou
      // que é dono do e-mail, então ativamos imediatamente (antes da criação de senha).
      if (type === 'invite') {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const admin = createAdminSupabaseClient()
            await (admin as any)
              .from('profiles')
              .update({ is_active: true })
              .eq('id', user.id)
          }
        } catch (e) {
          // Não bloquear o fluxo se a ativação falhar — o usuário ainda tem sessão
          console.error('[auth/callback] activate profile error:', e)
        }
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('[auth/callback] verifyOtp error:', error.message)
  }

  // Sem code nem token_hash válido → link expirado ou inválido
  return NextResponse.redirect(`${origin}/login?error=auth`)
}
