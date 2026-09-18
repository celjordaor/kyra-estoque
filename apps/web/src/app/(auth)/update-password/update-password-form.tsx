'use client'

import * as React from 'react'
import Link from 'next/link'
import { createClient } from '@kyra/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Fluxo de primeiro acesso e recuperação de senha.
 *
 * Esta página pode ser atingida de duas formas:
 * 1. Via /auth/callback (server-side verifyOtp ou exchangeCodeForSession) — sessão já estabelecida
 * 2. Via link direto com ?code= (PKCE, browser-initiated forgot-password) ou #access_token= (implicit)
 *
 * A ordem de detecção é crítica:
 * - onAuthStateChange é subscrito ANTES de qualquer await para não perder eventos de detectSessionInUrl
 * - Depois verificamos getSession() (sessão já estabelecida pelo callback)
 * - Por fim, tentamos trocar ?code= manualmente como fallback
 */
export function UpdatePasswordForm() {
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [done, setDone] = React.useState(false)
  const [sessionReady, setSessionReady] = React.useState(false)
  const [sessionExpired, setSessionExpired] = React.useState(false)

  React.useEffect(() => {
    let resolved = false
    let timeoutId: ReturnType<typeof setTimeout>

    function resolve(hasSession: boolean) {
      if (resolved) return
      resolved = true
      clearTimeout(timeoutId)
      if (hasSession) {
        window.history.replaceState({}, '', window.location.pathname)
        setSessionReady(true)
      } else {
        setSessionExpired(true)
      }
    }

    async function setupSession() {
      const supabase = createClient()

      // ① Subscrever ANTES de qualquer await para capturar eventos de detectSessionInUrl
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (session && (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY' || event === 'USER_UPDATED')) {
          subscription.unsubscribe()
          resolve(true)
        }
      })

      // ② Verificar sessão já estabelecida (veio via /auth/callback server-side)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        subscription.unsubscribe()
        resolve(true)
        return
      }

      // ③ Tentar trocar ?code= manualmente (forgot-password PKCE com verifier no browser)
      const code = new URLSearchParams(window.location.search).get('code')
      if (code) {
        const { data, error: exchErr } = await supabase.auth.exchangeCodeForSession(code)
        if (!exchErr && data?.session) {
          subscription.unsubscribe()
          resolve(true)
          return
        }
        // Limpar code da URL independente do resultado
        window.history.replaceState({}, '', window.location.pathname)
      }

      // ④ Timeout: se em 8s não tiver sessão, considerar link expirado
      timeoutId = setTimeout(() => {
        subscription.unsubscribe()
        resolve(false)
      }, 8000)
    }

    setupSession()

    return () => {
      resolved = true
      clearTimeout(timeoutId)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error: updateErr } = await supabase.auth.updateUser({ password })

      if (updateErr) {
        if (updateErr.message.toLowerCase().includes('session') || updateErr.status === 401) {
          setError('Sessão inválida. Solicite um novo link de acesso.')
        } else {
          setError(updateErr.message)
        }
        return
      }

      setDone(true)
      setTimeout(() => { window.location.href = '/dashboard' }, 1500)
    } catch {
      setError('Ocorreu um erro inesperado. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-lg bg-primary/10 border border-primary/20 px-4 py-3 text-sm text-primary">
        Senha criada com sucesso! Redirecionando para o painel…
      </div>
    )
  }

  if (sessionExpired) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          Este link expirou ou já foi utilizado. Solicite um novo acesso ao administrador ou use
          &quot;Esqueceu sua senha?&quot; na tela de login.
        </div>
        <Link
          href="/login"
          className="block text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Voltar para o login
        </Link>
      </div>
    )
  }

  if (!sessionReady) {
    return (
      <div className="text-center text-sm text-muted-foreground py-4">
        Verificando acesso…
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Nova senha</Label>
        <Input
          id="password"
          type="password"
          placeholder="Mínimo 8 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm">Confirmar senha</Label>
        <Input
          id="confirm"
          type="password"
          placeholder="Repita a senha"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
          disabled={loading}
        />
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Salvando…' : 'Criar senha e entrar'}
      </Button>
    </form>
  )
}
