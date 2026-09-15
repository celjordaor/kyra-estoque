'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Sparkles, Send, Clock, Package, TrendingDown, ShoppingCart,
  TrendingUp, History, ArrowRight, CheckCircle2, Loader2, BarChart2,
  Users, Zap, Calendar
} from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { KyraCard } from '@/components/ai/kyra-card'
import { UpgradePrompt } from '@/components/ui/upgrade-prompt'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ── Helpers ──────────────────────────────────────────────────────
function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

// ── Suggestion pills (quick questions) ───────────────────────────
const SUGGESTIONS = [
  'Quais produtos precisam de reposição?',
  'Como estão minhas vendas esta semana?',
  'Qual produto tem maior margem?',
  'Tenho produtos parados há mais de 30 dias?',
  'Quando devo fazer a próxima compra?',
  'Qual fornecedor devo priorizar?',
]

// ── Action buttons (Kyra capabilities) ───────────────────────────
interface KyraAction {
  id: string
  label: string
  query: string
  icon: React.ElementType
}

const KYRA_ACTIONS: KyraAction[] = [
  { id: 'vendas',      label: 'Analisar vendas',    query: 'Analise minhas vendas do período',           icon: TrendingUp },
  { id: 'estoque',     label: 'Analisar estoque',   query: 'Faça uma análise completa do meu estoque',   icon: Package },
  { id: 'compras',     label: 'Sugerir compras',    query: 'Quais produtos devo repor agora?',           icon: ShoppingCart },
  { id: 'margem',      label: 'Analisar margem',    query: 'Analise a margem dos meus produtos',         icon: BarChart2 },
  { id: 'clientes',    label: 'Analisar clientes',  query: 'Quem são meus melhores clientes?',           icon: Users },
  { id: 'oportunidades', label: 'Ver oportunidades', query: 'Quais oportunidades de crescimento existem?', icon: Zap },
  { id: 'automacoes',  label: 'Ver automações',     query: 'Quais automações posso ativar hoje?',        icon: Calendar },
  { id: 'resumo',      label: 'Resumo do dia',      query: 'Me dê um resumo completo da operação de hoje', icon: Sparkles },
]

// ── Analysis checklist steps ──────────────────────────────────────
const ANALYSIS_STEPS = [
  'Carregando histórico de vendas',
  'Verificando níveis de estoque',
  'Calculando métricas de desempenho',
  'Gerando recomendações',
]

// ── Compact insight card (chip-style label) ───────────────────────
interface InsightCardProps {
  chipLabel: string
  chipColor: string  // text + bg colors
  chipBg: string
  value: string | number
  sub: string
  icon: React.ElementType
  iconColor: string
}

function InsightCard({ chipLabel, chipColor, chipBg, value, sub, icon: Icon, iconColor }: InsightCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2 hover:border-primary/30 transition-colors">
      <div className="flex items-center justify-between">
        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', chipBg, chipColor)}>
          {chipLabel}
        </span>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
      <div>
        <p className="text-xl font-bold leading-tight">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{sub}</p>
      </div>
    </div>
  )
}

// ── Recommendation card (right panel) ────────────────────────────
interface RecommendationProps {
  type: 'danger' | 'warning' | 'info' | 'success'
  title: string
  sub: string
  action?: string
}

const REC_COLORS: Record<RecommendationProps['type'], string> = {
  danger:  'border-l-red-500 bg-red-500/5',
  warning: 'border-l-amber-500 bg-amber-500/5',
  info:    'border-l-blue-500 bg-blue-500/5',
  success: 'border-l-green-600 bg-green-600/5',
}

function RecommendationCard({ type, title, sub, action }: RecommendationProps) {
  return (
    <div className={cn('rounded-xl border-l-4 p-3', REC_COLORS[type])}>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
      {action && (
        <button type="button" className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          {action} <ArrowRight className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

// ── Chat message ─────────────────────────────────────────────────
interface Message {
  id: string
  role: 'user' | 'kyra'
  text: string
  ts: Date
  rich?: boolean
}

// Rich response (table + highlights) shown for action-triggered queries
function RichResponse() {
  return (
    <div className="space-y-3">
      <p className="text-sm">Aqui está um resumo da sua operação:</p>

      {/* Highlight boxes */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-green-600 dark:text-green-400">Vendas hoje</p>
          <p className="text-lg font-bold text-green-700 dark:text-green-300">R$ 4.280</p>
          <p className="text-[10px] text-muted-foreground">+18% vs. ontem</p>
        </div>
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Alertas</p>
          <p className="text-lg font-bold text-amber-700 dark:text-amber-300">7 produtos</p>
          <p className="text-[10px] text-muted-foreground">em risco de ruptura</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden text-xs">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Produto</th>
              <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Estoque</th>
              <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Vendas/sem</th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: 'Café Gourmet 500g', stock: 3, sales: 12 },
              { name: 'Tênis Runner X2', stock: 1, sales: 8 },
              { name: 'Whey Protein 1kg', stock: 5, sales: 15 },
            ].map(r => (
              <tr key={r.name} className="border-t border-border">
                <td className="px-3 py-2">{r.name}</td>
                <td className={cn('px-3 py-2 text-right font-semibold', r.stock <= 3 ? 'text-red-500' : '')}>
                  {r.stock} un
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">{r.sales} un</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">Quer que eu crie pedidos de reposição para esses produtos?</p>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <button type="button" className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors">
          Criar pedidos de compra
        </button>
        <button type="button" className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          Ver relatório completo
        </button>
      </div>
    </div>
  )
}

function ChatMessage({ msg }: { msg: Message }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          {msg.text}
        </div>
      </div>
    )
  }
  return (
    <div className="flex gap-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="max-w-[90%] rounded-2xl rounded-tl-sm border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
        {msg.rich ? <RichResponse /> : msg.text}
      </div>
    </div>
  )
}

// ── Recent conversation row ───────────────────────────────────────
interface ConvRow { id: string; preview: string; ts: string }

const RECENT_CONVS: ConvRow[] = [
  { id: '1', preview: 'Quais produtos precisam de reposição?', ts: 'Hoje, 09:14' },
  { id: '2', preview: 'Como estão minhas vendas esta semana?', ts: 'Ontem, 17:32' },
  { id: '3', preview: 'Tenho produtos parados há mais de 30 dias?', ts: '05/09, 11:08' },
]

// ── Main page ─────────────────────────────────────────────────────
export function KyraPage() {
  const [input, setInput] = React.useState('')
  const [messages, setMessages] = React.useState<Message[]>([])
  const [thinking, setThinking] = React.useState(false)
  const [analysisStep, setAnalysisStep] = React.useState(-1) // -1 = not analyzing
  const [upgradePrompt, setUpgradePrompt] = React.useState<{ open: boolean; limit?: number | null }>({ open: false })
  const inputRef = React.useRef<HTMLInputElement>(null)
  const chatEndRef = React.useRef<HTMLDivElement>(null)
  const searchParams = useSearchParams()
  const autoSentRef = React.useRef(false)

  // Auto-send query vindo do dashboard via ?q=
  React.useEffect(() => {
    const q = searchParams?.get('q')
    if (q && !autoSentRef.current) {
      autoSentRef.current = true
      sendMessage(decodeURIComponent(q))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text: string, isAction = false) {
    if (!text.trim()) return
    const userText = text.trim()
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', text: userText, ts: new Date() }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setThinking(true)

    // Animate analysis steps for action-button queries
    if (isAction) {
      for (let i = 0; i < ANALYSIS_STEPS.length; i++) {
        setAnalysisStep(i)
        await new Promise(r => setTimeout(r, 500))
      }
    }

    try {
      // Build conversation history for API (map 'kyra' → 'assistant')
      const apiMessages = [
        ...messages.map(m => ({
          role: m.role === 'user' ? 'user' as const : 'assistant' as const,
          content: m.text,
        })),
        { role: 'user' as const, content: userText },
      ]

      const res = await fetch('/api/kyra/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      })

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}))
        setUpgradePrompt({ open: true, limit: data.limit })
        setMessages(prev => prev.filter(m => m.id !== userMsg.id))
        return
      }

      const data = await res.json()

      if (!res.ok || data.error) {
        const kyraErr: Message = {
          id: crypto.randomUUID(),
          role: 'kyra',
          text: 'Desculpe, ocorreu um erro ao processar sua pergunta. Tente novamente.',
          ts: new Date(),
        }
        setMessages(prev => [...prev, kyraErr])
        return
      }

      const kyraMsg: Message = {
        id: crypto.randomUUID(),
        role: 'kyra',
        text: data.content,
        ts: new Date(),
      }
      setMessages(prev => [...prev, kyraMsg])

    } catch (err) {
      const kyraErr: Message = {
        id: crypto.randomUUID(),
        role: 'kyra',
        text: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
        ts: new Date(),
      }
      setMessages(prev => [...prev, kyraErr])
    } finally {
      setThinking(false)
      setAnalysisStep(-1)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  const hasChat = messages.length > 0
  const isAnalyzing = analysisStep >= 0

  return (
    <>
      <UpgradePrompt
        open={upgradePrompt.open}
        onClose={() => setUpgradePrompt({ open: false })}
        resource="consultas à Kyra"
        limit={upgradePrompt.limit}
      />
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <PageHeader
        title="Assistente"
        description="Converse com a Kyra sobre sua operação."
        icon={Sparkles}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5">
            <History className="h-4 w-4" />
            Histórico
          </Button>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Center area (60%) ──────────────────────────────── */}
        <div className="flex flex-[3] flex-col overflow-hidden min-w-0">

          {/* Overview (no chat) */}
          {!hasChat && (
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Greeting */}
              <KyraCard
                label="Kyra"
                description={`${greeting()}, Celso. Analisei sua operação e encontrei alguns pontos que merecem atenção hoje.`}
              />

              {/* Compact insight grid 2×2 */}
              <div className="grid grid-cols-2 gap-3">
                <InsightCard
                  chipLabel="Estoque"
                  chipBg="bg-red-500/10"
                  chipColor="text-red-600 dark:text-red-400"
                  value="7 produtos"
                  sub="podem acabar nos próximos 6 dias"
                  icon={Package}
                  iconColor="text-red-400"
                />
                <InsightCard
                  chipLabel="Estoque parado"
                  chipBg="bg-amber-500/10"
                  chipColor="text-amber-600 dark:text-amber-400"
                  value={fmtCurrency(8430)}
                  sub="sem giro há mais de 30 dias"
                  icon={TrendingDown}
                  iconColor="text-amber-400"
                />
                <InsightCard
                  chipLabel="Compras"
                  chipBg="bg-blue-500/10"
                  chipColor="text-blue-600 dark:text-blue-400"
                  value="3 pedidos"
                  sub="no momento ideal para comprar"
                  icon={ShoppingCart}
                  iconColor="text-blue-400"
                />
                <InsightCard
                  chipLabel="Vendas"
                  chipBg="bg-green-500/10"
                  chipColor="text-green-600 dark:text-green-400"
                  value="+14%"
                  sub="acima da média dos últimos 30 dias"
                  icon={TrendingUp}
                  iconColor="text-green-500"
                />
              </div>

              {/* Input area – what do you want to know */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  O que você quer saber?
                </p>
                <div className="flex items-center gap-2 mb-3">
                  <div className="relative flex-1">
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder="Pergunte algo sobre sua operação…"
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className={cn(
                        'w-full rounded-xl border border-border bg-background px-4 py-2.5 pr-11 text-sm',
                        'placeholder:text-muted-foreground outline-none',
                        'focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all',
                      )}
                    />
                    <button
                      type="button"
                      disabled={!input.trim()}
                      onClick={() => sendMessage(input)}
                      className={cn(
                        'absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
                        input.trim() ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => sendMessage(s)}
                      className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Kyra action grid */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  O que você pode pedir à Kyra
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {KYRA_ACTIONS.map(a => {
                    const Icon = a.icon
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => sendMessage(a.query, true)}
                        className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-2 py-3 text-center hover:border-primary/40 hover:bg-primary/5 transition-colors group"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground leading-tight transition-colors">
                          {a.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Chat messages */}
          {hasChat && (
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.map(msg => <ChatMessage key={msg.id} msg={msg} />)}
              {thinking && (
                <div className="flex gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-primary/20 bg-primary/5 px-4 py-3">
                    {[0, 1, 2].map(i => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          {/* Persistent input bar (chat mode) */}
          {hasChat && (
            <div className="border-t border-border bg-card px-4 py-3">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {SUGGESTIONS.slice(0, 3).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => sendMessage(s)}
                    className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="O que você quer saber?"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={thinking}
                    className={cn(
                      'w-full rounded-xl border border-border bg-background px-4 py-2.5 pr-11 text-sm',
                      'placeholder:text-muted-foreground outline-none',
                      'focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all',
                      thinking && 'opacity-60'
                    )}
                  />
                  <button
                    type="button"
                    disabled={!input.trim() || thinking}
                    onClick={() => sendMessage(input)}
                    className={cn(
                      'absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
                      input.trim() ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right panel (40%) ──────────────────────────────── */}
        <div className="hidden lg:flex flex-[2] flex-col border-l border-border bg-card overflow-y-auto">

          {/* Analyzing state → checklist */}
          {isAnalyzing && (
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
                <p className="text-sm font-semibold text-primary">Kyra está analisando sua operação</p>
              </div>
              <div className="space-y-3">
                {ANALYSIS_STEPS.map((step, i) => (
                  <div key={step} className="flex items-center gap-3">
                    {i < analysisStep ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    ) : i === analysisStep ? (
                      <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-border shrink-0" />
                    )}
                    <span className={cn(
                      'text-sm',
                      i < analysisStep ? 'text-muted-foreground line-through' :
                      i === analysisStep ? 'text-foreground font-medium' :
                      'text-muted-foreground'
                    )}>
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Normal state → Kyra recomenda + recentes */}
          {!isAnalyzing && (
            <>
              {/* Kyra recomenda */}
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">Kyra recomenda</p>
                </div>
                <div className="space-y-2">
                  <RecommendationCard
                    type="danger"
                    title="7 produtos em risco de ruptura"
                    sub="Café Gourmet 500g acaba em 2 dias"
                    action="Criar pedido de compra"
                  />
                  <RecommendationCard
                    type="warning"
                    title="Estoque parado: R$ 8.430"
                    sub="Tênis Runner X2 sem giro há 45 dias"
                    action="Ver produtos parados"
                  />
                  <RecommendationCard
                    type="info"
                    title="3 compras no momento ideal"
                    sub="Preços favoráveis nos últimos 7 dias"
                    action="Ver sugestões"
                  />
                  <RecommendationCard
                    type="success"
                    title="Vendas +14% vs. mês anterior"
                    sub="Tênis e acessórios liderando crescimento"
                  />
                </div>
              </div>

              {/* Conversas recentes */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Conversas recentes</p>
                </div>
                <div className="space-y-1">
                  {RECENT_CONVS.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => sendMessage(c.preview)}
                      className="w-full text-left rounded-lg px-3 py-2.5 hover:bg-muted transition-colors group"
                    >
                      <p className="text-sm truncate text-foreground group-hover:text-primary transition-colors">{c.preview}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{c.ts}</p>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
    </>
  )
}
