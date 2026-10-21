import { Sparkles, MessageSquare, Clock, Trash2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { getConversations } from '@/lib/actions/kyra-history'
import { PageHeader } from '@/components/layout/page-header'
import { KyraHistoryClient } from './kyra-history-client'

export default async function KyraHistoryPage() {
  const conversations = await getConversations(50)

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Histórico da Kyra"
        description="Retome ou consulte conversas anteriores com a Kyra."
        icon={Clock}
        actions={
          <Link
            href="/kyra"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Nova conversa
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto p-5">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <Sparkles className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">Nenhuma conversa ainda</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Suas conversas com a Kyra aparecem aqui para que você possa retomá-las a qualquer momento.
            </p>
            <Link
              href="/kyra"
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              Conversar com a Kyra
            </Link>
          </div>
        ) : (
          <KyraHistoryClient conversations={conversations} />
        )}
      </div>
    </div>
  )
}
