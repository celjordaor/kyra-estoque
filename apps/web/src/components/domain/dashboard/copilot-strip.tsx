'use client'

import { useState, useRef } from 'react'
import { Sparkles, Send, Loader2, ArrowRight, RotateCcw } from 'lucide-react'

const QUICK_PROMPTS = [
  'O que devo comprar?',
  'O que está encalhado?',
  'Como foram minhas vendas?',
  'Quais produtos estão dando prejuízo?',
  'Quanto tenho em estoque?',
  'Onde estou perdendo margem?',
]

// Respostas mock por pergunta — serão substituídas pela IA real
const MOCK_RESPONSES: Record<string, { summary: string; detail: string; primaryAction: string; primaryHref: string }> = {
  'O que devo comprar?': {
    summary: 'Encontrei <strong>3 produtos</strong> com necessidade de reposição imediata.',
    detail: 'Camiseta Básica, Calça Slim e Shorts Cargo precisam de pedido nos próximos 2 dias.',
    primaryAction: 'Ver análise',
    primaryHref: '/stock?filter=low',
  },
  'O que está encalhado?': {
    summary: 'Há <strong>R$ 8.430</strong> em estoque parado há mais de 30 dias.',
    detail: 'Produtos com zero saída: Blazer Xadrez, Vestido Longo e 4 outros itens.',
    primaryAction: 'Ver produtos',
    primaryHref: '/stock?filter=slow',
  },
  'Como foram minhas vendas?': {
    summary: 'Vendas cresceram <strong>14%</strong> em relação ao mês anterior.',
    detail: '68% do crescimento veio de calçados. Desconto médio subiu 3 pontos.',
    primaryAction: 'Ver vendas',
    primaryHref: '/sales',
  },
  'Quais produtos estão dando prejuízo?': {
    summary: '<strong>2 produtos</strong> estão sendo vendidos abaixo do custo.',
    detail: 'Margem negativa em Tênis Runner (-4%) e Bolsa Couro (-2,1%).',
    primaryAction: 'Analisar margem',
    primaryHref: '/stock',
  },
  'Quanto tenho em estoque?': {
    summary: 'Estoque atual vale <strong>R$ 84.230</strong> em 324 produtos.',
    detail: '12 itens sem estoque e 8 com estoque abaixo do mínimo.',
    primaryAction: 'Ver estoque',
    primaryHref: '/stock',
  },
  'Onde estou perdendo margem?': {
    summary: 'Margem caiu <strong>2,1 pontos</strong> neste mês.',
    detail: 'Principal causa: desconto médio aumentou em Calçados (+5%) e Acessórios (+3%).',
    primaryAction: 'Ver detalhes',
    primaryHref: '/sales',
  },
}

function getResponse(text: string) {
  const exact = MOCK_RESPONSES[text]
  if (exact) return exact
  return {
    summary: 'Analisei sua operação com base nos dados disponíveis.',
    detail: 'Integração completa com IA estará disponível em breve para respostas personalizadas.',
    primaryAction: 'Ver dashboard',
    primaryHref: '/dashboard',
  }
}

interface InlineResponse {
  question: string
  summary: string
  detail: string
  primaryAction: string
  primaryHref: string
}

export function CopilotStrip() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<InlineResponse | null>(null)
  const [activePrompt, setActivePrompt] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSend(text: string) {
    const q = text.trim()
    if (!q || loading) return
    setActivePrompt(q)
    setResponse(null)
    setLoading(true)
    setInput('')

    // Simula latência de IA — será substituído por chamada real
    await new Promise(r => setTimeout(r, 1100))

    const res = getResponse(q)
    setResponse({ question: q, ...res })
    setLoading(false)
  }

  function handleReset() {
    setResponse(null)
    setActivePrompt(null)
    setInput('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  return (
    <div className="rounded-2xl border border-teal-200 bg-white p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-lg bg-teal-600 flex items-center justify-center shrink-0">
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
        <p className="text-sm font-semibold text-slate-800">Pergunte sobre sua operação</p>
      </div>
      <p className="text-xs text-slate-400 mb-4 ml-9">Você não precisa procurar a informação. Pergunte ao Kyra.</p>

      {/* Input */}
      <div className="flex gap-2 mb-3">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend(input)}
          placeholder="Ex: Quais produtos preciso repor essa semana?"
          className="flex-1 text-sm border border-slate-200 rounded-xl px-4 py-2.5 bg-slate-50 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
        />
        <button
          onClick={() => handleSend(input)}
          disabled={loading || !input.trim()}
          className="px-4 h-10 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {!loading && <span>Enviar</span>}
        </button>
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
                ? 'bg-teal-600 text-white border-teal-600'
                : 'text-teal-700 bg-teal-50 hover:bg-teal-100 border-teal-200',
            ].join(' ')}
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-400 animate-pulse">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-500" />
          O Kyra está analisando sua operação…
        </div>
      )}

      {/* Inline response */}
      {response && !loading && (
        <div className="mt-4">
          <p className="text-xs text-slate-400 mb-2">
            Você perguntou: <span className="font-semibold text-slate-600">{response.question}</span>
          </p>
          <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-4">
            <p
              className="text-sm font-semibold text-slate-800 mb-1 leading-snug"
              dangerouslySetInnerHTML={{ __html: response.summary }}
            />
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">{response.detail}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={response.primaryHref}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors"
              >
                {response.primaryAction}
                <ArrowRight className="h-3 w-3" />
              </a>
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                Nova pergunta
              </button>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-slate-300 text-right">
            O Kyra analisa seus dados e ajuda você a tomar decisões.
          </p>
        </div>
      )}
    </div>
  )
}
