'use server'
// apps/web/src/lib/actions/notifications.ts
// Notificações in-app — leitura (client) e criação (server actions internos)

import { createAdminSupabaseClient, getServerContext } from '@/lib/supabase/server'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'stock_alert'
  | 'order_received'
  | 'automation_triggered'
  | 'kyra_recommendation'
  | 'payment_event'
  | 'system'

export interface Notification {
  id: string
  company_id: string
  user_id: string | null
  type: NotificationType
  title: string
  body: string | null
  action_url: string | null
  metadata: Record<string, unknown> | null
  read: boolean
  read_at: string | null
  created_at: string
}

// ── Leitura ───────────────────────────────────────────────────────────────────

/**
 * Retorna as últimas `limit` notificações da empresa do usuário autenticado.
 */
export async function getNotifications(limit = 20): Promise<Notification[]> {
  try {
    const { companyId } = await getServerContext()
    const admin = createAdminSupabaseClient()

    const { data, error } = await (admin as any)
      .from('notifications')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[notifications] getNotifications error:', error.message)
      return []
    }
    return (data ?? []) as Notification[]
  } catch {
    return []
  }
}

/**
 * Contagem de notificações não lidas para o badge do sino.
 */
export async function getUnreadCount(): Promise<number> {
  try {
    const { companyId } = await getServerContext()
    const admin = createAdminSupabaseClient()

    const { count, error } = await (admin as any)
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('read', false)

    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

// ── Escrita ───────────────────────────────────────────────────────────────────

interface CreateNotificationInput {
  companyId: string
  type: NotificationType
  title: string
  body?: string
  actionUrl?: string
  metadata?: Record<string, unknown>
  /** Destinatário específico (null = para todos da empresa) */
  userId?: string | null
}

/**
 * Cria uma notificação in-app. Chamado internamente por outras server actions
 * (sales, stock, etc.) de forma fire-and-forget (.catch(() => {})).
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    const admin = createAdminSupabaseClient()

    const { error } = await (admin as any)
      .from('notifications')
      .insert({
        company_id: input.companyId,
        user_id:    input.userId ?? null,
        type:       input.type,
        title:      input.title,
        body:       input.body ?? null,
        action_url: input.actionUrl ?? null,
        metadata:   input.metadata ?? null,
      })

    if (error) {
      console.error('[notifications] createNotification error:', error.message)
    }
  } catch (e) {
    console.error('[notifications] createNotification exception:', e)
  }
}

// ── Marcar como lida ──────────────────────────────────────────────────────────

export async function markNotificationRead(id: string): Promise<void> {
  try {
    const { companyId } = await getServerContext()
    const admin = createAdminSupabaseClient()

    await (admin as any)
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
  } catch {
    // silencioso — não bloquear UX
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  try {
    const { companyId } = await getServerContext()
    const admin = createAdminSupabaseClient()

    await (admin as any)
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('company_id', companyId)
      .eq('read', false)
  } catch {
    // silencioso
  }
}
