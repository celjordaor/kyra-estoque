'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { requestPhoneCode, confirmPhoneCode, removeWhatsappPhone } from '@/lib/actions/whatsapp-phone'

export function WhatsappPhoneCard({ initialPhone, initialVerified }: { initialPhone: string | null; initialVerified: boolean }) {
  const [phone, setPhone] = React.useState(initialPhone ?? '')
  const [verified, setVerified] = React.useState(initialVerified)
  const [codeSent, setCodeSent] = React.useState(false)
  const [code, setCode] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  async function sendCode() {
    setBusy(true)
    const r = await requestPhoneCode(phone)
    setBusy(false)
    if (!r.success) return toast.error(r.error ?? 'Erro ao enviar o código')
    setCodeSent(true)
    setVerified(false)
    toast.success('Código enviado para o seu WhatsApp.')
  }
  async function confirm() {
    setBusy(true)
    const r = await confirmPhoneCode(code)
    setBusy(false)
    if (!r.success) return toast.error(r.error ?? 'Código inválido')
    setVerified(true); setCodeSent(false); setCode('')
    toast.success('WhatsApp vinculado!')
  }
  async function remove() {
    setBusy(true)
    const r = await removeWhatsappPhone()
    setBusy(false)
    if (!r.success) return toast.error(r.error ?? 'Erro ao remover')
    setPhone(''); setVerified(false); setCodeSent(false)
    toast.success('Número removido.')
  }

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border bg-muted/30">
        <MessageCircle className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">WhatsApp</h2>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-xs text-muted-foreground">
          Seu número para receber avisos e alertas da Kyra e conversar com ela pelo WhatsApp. Precisa ser confirmado com um código.
        </p>
        <div className="space-y-2">
          <Label htmlFor="waPhone">Celular com DDD</Label>
          <Input id="waPhone" inputMode="tel" placeholder="(11) 99999-8888" value={phone}
            onChange={(e) => { setPhone(e.target.value); if (verified) setVerified(false) }} disabled={busy} />
          {verified && <p className="text-xs text-emerald-600">Número confirmado.</p>}
        </div>
        {codeSent && (
          <div className="space-y-2">
            <Label htmlFor="waCode">Código recebido</Label>
            <Input id="waCode" inputMode="numeric" maxLength={6} placeholder="000000" value={code}
              onChange={(e) => setCode(e.target.value)} disabled={busy} />
          </div>
        )}
        <div className="flex justify-end gap-2">
          {(initialPhone || verified) && (
            <Button type="button" variant="outline" onClick={remove} disabled={busy}>Remover</Button>
          )}
          {codeSent ? (
            <Button type="button" onClick={confirm} disabled={busy || code.replace(/\D/g, '').length !== 6}>Confirmar</Button>
          ) : (
            <Button type="button" onClick={sendCode} disabled={busy || !phone.trim()}>
              {verified ? 'Trocar número' : 'Enviar código'}
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
