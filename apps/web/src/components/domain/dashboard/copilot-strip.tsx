'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Send, Loader2, ArrowRight, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const QUICK_PROMPTS = [
  'O que devo comprar?',
  'O que está encalhado?',
  'Como foram minhas vendas?',
  'Quais produtos estão dando prejuízo?',
  'Quanto tenho em estoque?',
  'Onde estou perdendo margem?',
]

// Mapa de prompt rápido → rota de ação primária
const PROMPT_ACTION_MAP: Record<string, { action: string; href: string }> = {
  'O que devo comprar?':            { action: 'Ver análise', href: '/stock?filter=low' },
  'O que está encalhado?':          { action: 'Ver produtos', href: '/stock?filter=slow' },
  'Como foram minhas vendas?':      { action: 'Ver vendas', href: '/sales' },
  'Quais produtos estão dando prejuízo?': { action: 'Analisar margem', href: '/stock' },
  'Quanto tenho em estoque?':       { action: 'Ver estoque', href: '/stock' },
  'Onde estou perdendo margem?':    { action: 'Ver detalhes', href: '/sales' },
}

const DEFAULT_ACTION = { action: 'Ver dashboard', href: '/dashboard' }

interface InlineResponse {
  question: string
  summary: string
  primaryAction: string
  primaryHref: string
}

export function CopilotStrip() {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<InlineResponse | null>(null)
  const [activePrompt, setActivePrompt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSend(text: string) {
    const q = text.trim()
    if (!q || loading) return
    setActivePrompt(q)
    setResponse(null)
    setError(null)
    setLoading(true)
    setInput('')

    try {
      const res = await fetch('/api/kyra/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: q }],
        }),
      })

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}))
        const limit = data?.limit ?? 'seu limite'
        setError(`Limite de ${limit} mensagens atingido. Tente novamente mais tarde.`)
        setLoading(false)
        return
      }

      if (!res.ok) {
        throw new Error(`Erro ${res.status}`)
      }

      const data = await res.json()
      // A API retorna { content: string } ou { message: { content: string } }
      const summary: string =
        data?.content ??
        data?.message?.content ??
        'Não consegui obter uma resposta. Tente novamente.'

      const mapped = PROMPT_ACTION_MAP[q] ?? DEFAULT_ACTION

      setResponse({
        question: q,
        summary,
        primaryAction: mapped.action,
        primaryHref: mapped.href,
      })
    } catch {
      setError('Não foi possível conectar ao Kyra. Verifique sua conexão e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setResponse(null)
    setActivePrompt(null)
    setInput('')
    setError(null)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-card p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
        <p className="text-sm font-semibold text-foreground">Pergunte sobre sua operação</p>
      </div>
      <p className="text-xs text-muted-foreground mb-4 ml-9">Você não precisa procurar a informação. Pergunte ao Kyra.</p>

      {/* Input */}
      <div className="flex gap-2 mb-3">
        <Input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend(input)}
          placeholder="Ex: Quais produtos preciso repor essa semana?"
          className="flex-1"
        />
        <Button
          onClick={() => handleSend(input)}
          disabled={loading || !input.trim()}
          loading={loading}
          className="shrink-0 gap-1.5"
        >
          {!loading && <><Send className="h-4 w-4" /><span>Enviar</span></>}
        </Button>
      </div>

      {/* Quick prompts */}
      <div className="flex flex-wrap gap-2">
        {QUICK_PROMPTS.map(prompt => (
          <button
            key={prompt}
            onClick={() => handleSend(prompt)}
            disabled={loading}
            className={[
              'text-xs font-medium border rounded-full px-3 py-1.5 transition-colors disabled:opacity-50',
              activePrompt === prompt && response
                ? 'bg-primary text-white border-primary'
                : 'text-primary bg-primary/10 hover:bg-primary/20 border-primary/20',
            ].join(' ')}
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          O Kyra está analisando sua operação…
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3">
          <p className="text-xs text-red-600">{error}</p>
          <button
            onClick={handleReset}
            className="mt-2 text-xs font-semibold text-red-500 hover:text-red-700 flex items-center gap-1"
          >
            <RotateCcw className="h-3 w-3" />
            Tentar novamente
          </button>
        </div>
      )}

      {/* Inline response */}
      {response && !loading && !error && (
        <div className="mt-4">
          <p className="text-xs text-muted-foreground mb-2">
            Você perguntou: <span className="font-semibold text-muted-foreground">{response.question}</span>
          </p>
          <div className="rounded-xl border border-primary/10 bg-primary/10/60 p-4">
            <p className="text-sm font-semibold text-foreground mb-3 leading-snug whitespace-pre-line">
              {response.summary}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={response.primaryHref}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold transition-colors"
              >
                {response.primaryAction}
                <ArrowRight className="h-3 w-3" />
              </a>
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted/50 text-muted-foreground text-xs font-semibold transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                Nova pergunta
              </button>
              <button
                onClick={() => router.push(`/kyra?q=${encodeURIComponent(response.question)}` as never)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-primary/20 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors"
              >
                Continuar no Kyra
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground/60 text-right">
            O Kyra analisa seus dados e ajuda você a tomar decisões.
          </p>
        </div>
      )}
    </div>
  )
}
