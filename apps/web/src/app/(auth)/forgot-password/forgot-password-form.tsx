'use client'

import * as React from 'react'
import Link from 'next/link'
import { createClient } from '@kyra/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ForgotPasswordForm() {
  const [email, setEmail] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [sent, setSent] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
      })

      if (resetError) {
        setError('Não foi possível enviar o e-mail. Verifique o endereço e tente novamente.')
        return
      }

      // Sempre mostramos confirmação — não revelamos se o e-mail existe (segurança)
      setSent(true)
    } catch {
      setError('Ocorreu um erro inesperado. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-teal-50 border border-teal-200 px-4 py-3 text-sm text-teal-800">
          Se esse e-mail estiver cadastrado, você receberá as instruções em instantes.
          Verifique sua caixa de entrada (e a pasta de spam).
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          placeholder="voce@empresa.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          autoFocus
          disabled={loading}
        />
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Enviando…' : 'Enviar link de recuperação'}
      </Button>

      <Link
        href="/login"
        className="block text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Voltar para o login
      </Link>
    </form>
  )
}
