'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { User, Lock, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateProfile, changePassword } from '@/lib/actions/security'

const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  seller: 'Vendedor',
  stock: 'Estoquista',
  finance: 'Financeiro',
}

export function ProfileClient({
  email,
  fullName: initialName,
  role,
}: {
  email: string
  fullName: string
  role: string | null
}) {
  // ── Nome ─────────────────────────────────────────────────────
  const [name, setName] = React.useState(initialName)
  const [savingName, setSavingName] = React.useState(false)

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSavingName(true)
    const result = await updateProfile(name.trim())
    setSavingName(false)
    if (result.success) {
      toast.success('Nome atualizado com sucesso.')
    } else {
      toast.error(result.error ?? 'Erro ao atualizar nome.')
    }
  }

  // ── Senha ─────────────────────────────────────────────────────
  const [currentPw, setCurrentPw] = React.useState('')
  const [newPw, setNewPw] = React.useState('')
  const [confirmPw, setConfirmPw] = React.useState('')
  const [savingPw, setSavingPw] = React.useState(false)
  const [pwError, setPwError] = React.useState<string | null>(null)

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError(null)
    if (newPw.length < 8) { setPwError('A nova senha deve ter pelo menos 8 caracteres.'); return }
    if (newPw !== confirmPw) { setPwError('As senhas não coincidem.'); return }
    setSavingPw(true)
    const result = await changePassword(currentPw, newPw)
    setSavingPw(false)
    if (result.success) {
      toast.success('Senha alterada com sucesso.')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } else {
      setPwError(result.error ?? 'Erro ao alterar senha.')
    }
  }

  return (
    <div className="max-w-xl space-y-8">
      <PageHeader title="Meu perfil" subtitle="Gerencie seus dados pessoais e segurança da conta." />

      {/* ── Informações pessoais ───────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border bg-muted/30">
          <User className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Informações pessoais</h2>
        </div>
        <form onSubmit={handleSaveName} className="p-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nome completo</Label>
            <Input
              id="fullName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              disabled={savingName}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input value={email} disabled className="text-muted-foreground" />
            <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado por aqui. Fale com o administrador.</p>
          </div>
          {role && (
            <div className="space-y-2">
              <Label>Função</Label>
              <Input value={ROLE_LABELS[role] ?? role} disabled className="text-muted-foreground" />
            </div>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={savingName || !name.trim() || name.trim() === initialName}>
              {savingName ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </form>
      </section>

      {/* ── Alterar senha ──────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border bg-muted/30">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Alterar senha</h2>
        </div>
        <form onSubmit={handleSavePassword} className="p-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPw">Senha atual</Label>
            <Input
              id="currentPw"
              type="password"
              placeholder="••••••••"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              autoComplete="current-password"
              disabled={savingPw}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPw">Nova senha</Label>
            <Input
              id="newPw"
              type="password"
              placeholder="Mínimo 8 caracteres"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
              disabled={savingPw}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPw">Confirmar nova senha</Label>
            <Input
              id="confirmPw"
              type="password"
              placeholder="Repita a nova senha"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              autoComplete="new-password"
              disabled={savingPw}
              required
            />
          </div>
          {pwError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{pwError}</p>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={savingPw || !currentPw || !newPw || !confirmPw}>
              {savingPw ? 'Salvando…' : 'Alterar senha'}
            </Button>
          </div>
        </form>
      </section>

      {/* ── Atalho para configurações ──────────────────────────── */}
      <a
        href="/settings"
        className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 hover:bg-muted/30 transition-colors group"
      >
        <div>
          <p className="text-sm font-medium text-foreground">Configurações da empresa</p>
          <p className="text-xs text-muted-foreground mt-0.5">Usuários, plano, integrações e mais</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </a>
    </div>
  )
}
