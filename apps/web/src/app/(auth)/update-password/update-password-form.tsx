'use client'

import * as React from 'react'
import { createClient } from '@kyra/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Fluxo de primeiro acesso e recuperação de senha.
 *
 * Esta página pode ser atingida de duas formas:
 * 1. Via /auth/callback (forgot-password, PKCE) — sessão já estabelecida pelo servidor
 * 2. Via generateLink admin (provisioning) — Supabase redireciona aqui com ?code= ou #access_token=
 *    O @supabase/ssr com detectSessionInUrl:true cuida automaticamente do hash.
 *    Para ?code= sem verifier (link admin), trocamos o code client-side.
 */
export function UpdatePasswordForm() {
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [done, setDone] = React.useState(false)
  const [sessionReady, setSessionReady] = React.useState(false)

  // Estabelece sessão a partir de ?code= ou #access_token= na URL (link admin)
  React.useEffect(() => {
    async function setupSession() {
      const supabase = createClient()

      // Verificar se já tem sessão ativa (veio via /auth/callback)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setSessionReady(true)
        return
      }

      // Tentar trocar ?code= (link admin PKCE sem verifier — Supabase trata server-side)
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      if (code) {
        const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code)
        if (!exchErr) {
          // Limpar o code da URL sem reload
          window.history.replaceState({}, '', window.location.pathname)
          setSessionReady(true)
          return
        }
      }

      // Verificar hash (implicit flow — #access_token=...)
      if (window.location.hash.includes('access_token')) {
        // @supabase/ssr detecta automaticamente via onAuthStateChange
        const { data: { session: hashSession } } = await supabase.auth.getSession()
        if (hashSession) {
          window.history.replaceState({}, '', window.location.pathname)
          setSessionReady(true)
          return
        }
      }

      // Aguardar onAuthStateChange para detectSessionInUrl (hash)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (session && (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY')) {
          subscription.unsubscribe()
          window.history.replaceState({}, '', window.location.pathname)
          setSessionReady(true)
        }
      })

      // Timeout: se em 5s não tiver sessão, mostrar erro
      setTimeout(() => {
        subscription.unsubscribe()
        setSessionReady(true) // mostra o form — o submit vai indicar se tem sessão ou não
      }, 5000)
    }

    setupSession()
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
          setError('Este link já expirou ou foi utilizado. Solicite um novo acesso ao administrador.')
        } else {
          setError(updateErr.message)
        }
        return
      }

      setDone(true)
      setTimeout(() => {
        window.location.href = '/dashboard'
      }, 1500)
    } catch {
      setError('Ocorreu um erro inesperado. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-lg bg-teal-50 border border-teal-200 px-4 py-3 text-sm text-teal-800">
        Senha criada com sucesso! Redirecionando para o painel…
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
