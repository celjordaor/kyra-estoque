'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, Trash2, Clock, Coins } from 'lucide-react'
import { cn } from '@/lib/utils'
import { deleteConversation } from '@/lib/actions/kyra-history'
import type { ConversationSummary } from '@/lib/actions/kyra-history'

function fmtDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Ontem'
  if (diffDays < 7) return `${diffDays} dias atrás`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

interface Props {
  conversations: ConversationSummary[]
}

export function KyraHistoryClient({ conversations: initial }: Props) {
  const router = useRouter()
  const [conversations, setConversations] = React.useState(initial)
  const [deleting, setDeleting] = React.useState<string | null>(null)

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!confirm('Apagar esta conversa?')) return
    setDeleting(id)
    await deleteConversation(id)
    setConversations(prev => prev.filter(c => c.id !== id))
    setDeleting(null)
  }

  function handleOpen(id: string) {
    router.push(`/kyra?conversation_id=${id}`)
  }

  // Group by day
  const groups: { label: string; items: ConversationSummary[] }[] = []
  let lastLabel = ''
  for (const conv of conversations) {
    const d = new Date(conv.updatedAt)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    const label = diffDays === 0 ? 'Hoje'
      : diffDays === 1 ? 'Ontem'
      : diffDays < 7 ? 'Esta semana'
      : diffDays < 30 ? 'Este mês'
      : 'Mais antigo'
    if (label !== lastLabel) {
      groups.push({ label, items: [] })
      lastLabel = label
    }
    groups[groups.length - 1]!.items.push(conv)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {groups.map(group => (
        <div key={group.label}>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">
            {group.label}
          </p>
          <div className="space-y-1">
            {group.items.map(conv => (
              <button
                key={conv.id}
                type="button"
                onClick={() => handleOpen(conv.id)}
                className={cn(
                  'w-full text-left rounded-xl border border-border bg-card px-4 py-3.5 hover:border-primary/30 hover:bg-muted/50 transition-all group relative',
                  deleting === conv.id && 'opacity-50 pointer-events-none'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate leading-snug">
                        {conv.title}
                      </p>
                      {conv.preview && (
                        <p className="mt-0.5 text-xs text-muted-foreground truncate">
                          {conv.preview}
                        </p>
                      )}
                      <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground/70">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {fmtDate(conv.updatedAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {Math.floor(conv.messageCount / 2)} trocas
                        </span>
                        <span className="flex items-center gap-1">
                          <Coins className="h-3 w-3" />
                          {conv.tokenCount.toLocaleString('pt-BR')} tokens
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={e => handleDelete(e, conv.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-danger/10 hover:text-danger text-muted-foreground transition-all"
                    title="Apagar conversa"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
