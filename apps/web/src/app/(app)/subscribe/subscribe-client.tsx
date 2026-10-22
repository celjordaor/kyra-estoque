'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { AlertCircle, CheckCircle2, Clock, CreditCard, QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/layout/page-header'
import { startCheckout, cancelMySubscription, getPayNowUrl, type CheckoutState } from '@/lib/actions/subscription-checkout'

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : ''

function banner(s: CheckoutState): { tone: 'warn' | 'danger' | 'info'; title: string; text: string } | null {
  switch (s.status) {
    case 'expired':  return { tone: 'danger', title: 'Seu período de teste terminou', text: 'Escolha um plano para voltar a usar a Kyra. Seus dados estão preservados.' }
    case 'paused':   return s.suspendReason === 'inadimplencia'
      ? { tone: 'danger', title: 'Conta suspensa por falta de pagamento', text: 'Regularize o pagamento abaixo para reativar o acesso imediatamente. Seus dados estão preservados.' }
      : { tone: 'danger', title: 'Conta suspensa', text: 'Entre em contato com o suporte para reativar sua conta.' }
    case 'canceled': return { tone: 'danger', title: 'Assinatura cancelada', text: 'Escolha um plano para reativar sua conta.' }
    case 'past_due': return { tone: 'warn', title: 'Pagamento em atraso', text: 'Regularize para evitar a suspensão da conta.' }
    case 'trialing': return { tone: 'info', title: 'Você está no período de teste', text: `Termina em ${fmt(s.trialEndsAt)}. Ao assinar, o plano escolhido vale imediatamente.` }
    case 'active':   return s.cancelAtPeriodEnd
      ? { tone: 'warn', title: 'Assinatura cancelada', text: `O acesso segue até ${fmt(s.periodEnd)}.` } : null
    default: return null
  }
}

export function SubscribeClient({ state }: { state: CheckoutState }) {
  const [interval, setIntervalValue] = React.useState<'month' | 'year'>(state.interval ?? 'month')
  const [method, setMethod] = React.useState<'PIX' | 'CREDIT_CARD'>('PIX')
  const [doc, setDoc] = React.useState('')
  const [busy, setBusy] = React.useState<string | null>(null)
  const b = banner(state)

  async function choose(slug: string) {
    setBusy(slug)
    const r = await startCheckout({ planSlug: slug, interval, method, cpfCnpj: doc })
    setBusy(null)
    if (!r.success) return toast.error(r.error ?? 'Erro ao contratar')
    if (r.url) { window.location.href = r.url; return }
    toast.success(r.changed ? 'Plano alterado.' : 'Contratação iniciada. Conclua o pagamento pelo link enviado.')
    window.location.reload()
  }
  async function payNow() {
    setBusy('pay')
    const url = await getPayNowUrl()
    setBusy(null)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
    else toast.info('Não encontramos uma cobrança em aberto. Escolha um plano abaixo.')
  }
  async function cancel() {
    if (!window.confirm('Cancelar a assinatura? O acesso segue até o fim do período já pago.')) return
    setBusy('cancel')
    const r = await cancelMySubscription()
    setBusy(null)
    if (!r.success) return toast.error(r.error ?? 'Erro ao cancelar')
    toast.success('Cancelamento registrado.')
    window.location.reload()
  }

  const tone = b?.tone === 'danger' ? 'border-destructive/30 bg-destructive/5 text-destructive'
    : b?.tone === 'warn' ? 'border-warning/30 bg-warning/10 text-warning' : 'border-border bg-muted/40 text-foreground'
  const canPayOverdue = state.status === 'past_due' || state.status === 'paused'

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Assinatura" description="Escolha seu plano e a forma de pagamento." />

      {b && (
        <div className={`flex items-start gap-3 rounded-xl border px-5 py-4 ${tone}`}>
          {b.tone === 'info' ? <Clock className="h-5 w-5 shrink-0 mt-0.5" /> : <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />}
          <div className="flex-1">
            <p className="font-medium text-sm">{b.title}</p>
            <p className="text-xs mt-0.5 opacity-90">{b.text}</p>
          </div>
          {canPayOverdue && state.suspendReason !== 'chargeback' && state.suspendReason !== 'estorno' && (
            <Button size="sm" onClick={payNow} disabled={busy === 'pay'}>Pagar agora</Button>
          )}
        </div>
      )}

      {!state.billingReady && (
        <p className="text-sm text-muted-foreground">A cobrança online ainda não está habilitada neste ambiente. Fale com o suporte para contratar.</p>
      )}

      {state.canManage ? (
        <>
          <div className="flex flex-wrap items-center gap-6">
            <div className="inline-flex rounded-lg border border-border p-1 text-sm">
              {(['month', 'year'] as const).map(i => (
                <button key={i} onClick={() => setIntervalValue(i)}
                  className={`px-3 py-1.5 rounded-md ${interval === i ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                  {i === 'month' ? 'Mensal' : 'Anual (-20%)'}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-lg border border-border p-1 text-sm">
              <button onClick={() => setMethod('PIX')} className={`px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 ${method === 'PIX' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}><QrCode className="h-3.5 w-3.5" />Pix</button>
              <button onClick={() => setMethod('CREDIT_CARD')} className={`px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 ${method === 'CREDIT_CARD' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}><CreditCard className="h-3.5 w-3.5" />Cartão</button>
            </div>
          </div>

          {!state.hasDocument && (
            <div className="max-w-xs space-y-2">
              <Label htmlFor="doc">CPF ou CNPJ para a cobrança</Label>
              <Input id="doc" inputMode="numeric" placeholder="Somente números" value={doc} onChange={e => setDoc(e.target.value)} />
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            {state.plans.map(p => {
              const cents = p.prices[interval]
              const current = state.currentPlanSlug === p.slug && state.status === 'active' && state.interval === interval
              return (
                <div key={p.slug} className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
                  <div>
                    <p className="font-semibold">{p.name}</p>
                    {p.description && <p className="text-xs text-muted-foreground mt-1">{p.description}</p>}
                  </div>
                  <p className="text-2xl font-bold">
                    {cents != null ? brl(interval === 'year' ? Math.round(cents / 12) : cents) : '—'}
                    <span className="text-xs font-normal text-muted-foreground"> /mês</span>
                  </p>
                  {interval === 'year' && cents != null && <p className="text-xs text-muted-foreground">{brl(cents)} cobrados uma vez por ano</p>}
                  <Button className="mt-auto" disabled={!state.billingReady || cents == null || current || busy !== null}
                    onClick={() => choose(p.slug)}>
                    {current ? <><CheckCircle2 className="h-4 w-4 mr-1.5" />Plano atual</> : busy === p.slug ? 'Aguarde…' : state.status === 'active' ? 'Trocar para este plano' : 'Assinar'}
                  </Button>
                </div>
              )
            })}
          </div>

          {(state.status === 'active' || state.status === 'past_due') && !state.cancelAtPeriodEnd && (
            <div className="pt-2">
              <Button variant="outline" size="sm" onClick={cancel} disabled={busy !== null}>Cancelar assinatura</Button>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Somente o proprietário ou um administrador da conta pode contratar ou alterar o plano.</p>
      )}
    </div>
  )
}
