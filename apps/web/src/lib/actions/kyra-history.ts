'use server'

import { cookies } from 'next/headers'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'

export interface ConversationSummary {
  id: string
  title: string
  messageCount: number
  tokenCount: number
  createdAt: string
  updatedAt: string
  preview: string // first user message truncated
}

export interface ConversationDetail {
  id: string
  title: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  tokenCount: number
  createdAt: string
  updatedAt: string
}

/** Lista conversas do usuário autenticado, mais recentes primeiro */
export async function getConversations(limit = 30): Promise<ConversationSummary[]> {
  const cookieStore = await cookies()
  const supabase = createServerSupabaseClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const admin = createAdminSupabaseClient()
  const { data } = await admin
    .from('ai_conversations')
    .select('id, title, messages, token_count, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (!data) return []

  return data.map(row => {
    const msgs = (row.messages as { role: string; content: string }[]) ?? []
    const userMsgs = msgs.filter(m => m.role === 'user')
    const preview = userMsgs[0]?.content?.slice(0, 120) ?? ''
    return {
      id: row.id,
      title: row.title ?? 'Conversa',
      messageCount: msgs.length,
      tokenCount: row.token_count ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      preview,
    }
  })
}

/** Busca uma conversa completa por ID para retomada */
export async function getConversation(conversationId: string): Promise<ConversationDetail | null> {
  const cookieStore = await cookies()
  const supabase = createServerSupabaseClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminSupabaseClient()
  const { data } = await admin
    .from('ai_conversations')
    .select('id, title, messages, token_count, created_at, updated_at')
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (!data) return null

  return {
    id: data.id,
    title: data.title ?? 'Conversa',
    messages: (data.messages as { role: 'user' | 'assistant'; content: string }[]) ?? [],
    tokenCount: data.token_count ?? 0,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

/** Deleta uma conversa do usuário */
export async function deleteConversation(conversationId: string): Promise<{ ok: boolean }> {
  const cookieStore = await cookies()
  const supabase = createServerSupabaseClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false }

  const admin = createAdminSupabaseClient()
  const { error } = await admin
    .from('ai_conversations')
    .delete()
    .eq('id', conversationId)
    .eq('user_id', user.id)

  return { ok: !error }
}
