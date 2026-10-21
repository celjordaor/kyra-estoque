'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Bell, Search, Menu, Package, ShoppingBag, Zap, Sparkles, CreditCard, Info, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@kyra/database'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  getNotifications, markNotificationRead, markAllNotificationsRead,
} from '@/lib/actions/notifications'
import type { Notification, NotificationType } from '@/lib/actions/notifications'

// ── Notification helpers ──────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d`
}

const NOTIF_ICON: Record<NotificationType, React.ElementType> = {
  stock_alert:           Package,
  order_received:        ShoppingBag,
  automation_triggered:  Zap,
  kyra_recommendation:   Sparkles,
  payment_event:         CreditCard,
  system:                Info,
}

const NOTIF_COLOR: Record<NotificationType, string> = {
  stock_alert:           'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  order_received:        'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  automation_triggered:  'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  kyra_recommendation:   'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  payment_event:         'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
  system:                'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

// ── NotificationBell ──────────────────────────────────────────────────────────

function NotificationBell({ initialCount }: { initialCount: number }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [notifications, setNotifications] = React.useState<Notification[]>([])
  const [count, setCount] = React.useState(initialCount)
  const [loading, setLoading] = React.useState(false)
  const [markingAll, setMarkingAll] = React.useState(false)

  const loadNotifications = React.useCallback(async () => {
    setLoading(true)
    const data = await getNotifications(15)
    setNotifications(data)
    setCount(data.filter(n => !n.read).length)
    setLoading(false)
  }, [])

  React.useEffect(() => {
    if (open) loadNotifications()
  }, [open, loadNotifications])

  const handleClick = async (notif: Notification) => {
    if (!notif.read) {
      await markNotificationRead(notif.id)
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n))
      setCount(prev => Math.max(0, prev - 1))
    }
    if (notif.actionUrl) {
      router.push(notif.actionUrl)
      setOpen(false)
    }
  }

  const handleMarkAll = async () => {
    setMarkingAll(true)
    await markAllNotificationsRead()
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setCount(0)
    setMarkingAll(false)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <div className="relative">
          <Button variant="ghost" size="icon" aria-label="Notificações">
            <Bell className="h-5 w-5" />
          </Button>
          {count > 0 && (
            <span
              aria-label={`${count} notificações`}
              className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white pointer-events-none"
            >
              {count > 9 ? '9+' : count}
            </span>
          )}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="text-sm font-semibold">Notificações</p>
          {count > 0 && (
            <button
              onClick={handleMarkAll}
              disabled={markingAll}
              className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {markingAll ? 'Marcando…' : 'Marcar tudo como lido'}
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col gap-2 p-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="h-8 w-8 rounded-full bg-muted animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-muted animate-pulse rounded w-4/5" />
                    <div className="h-3 bg-muted animate-pulse rounded w-3/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
            </div>
          ) : (
            <div>
              {notifications.map(notif => {
                const Icon = NOTIF_ICON[notif.type] ?? Info
                const colorCls = NOTIF_COLOR[notif.type] ?? 'bg-gray-100 text-gray-600'
                return (
                  <button
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    className={cn(
                      'flex w-full gap-3 items-start px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b last:border-0',
                      !notif.read && 'bg-primary/5'
                    )}
                  >
                    <div className={cn('flex h-8 w-8 items-center justify-center rounded-full shrink-0', colorCls)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn('text-xs leading-snug', !notif.read ? 'font-semibold' : 'font-medium')}>
                          {notif.title}
                        </p>
                        <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                          {relativeTime(notif.createdAt)}
                        </span>
                      </div>
                      {notif.body && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.body}</p>
                      )}
                    </div>
                    {!notif.read && (
                      <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Topbar ────────────────────────────────────────────────────────────────────

export interface TopbarProps {
  onMenuClick?: () => void
  showSearch?: boolean
  companyName?: string
  user?: {
    name: string
    email: string
    avatarUrl?: string
  }
  notificationCount?: number
  className?: string
}

export function Topbar({
  onMenuClick,
  showSearch = false,
  companyName,
  user,
  notificationCount = 0,
  className,
}: TopbarProps) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U'

  return (
    <header
      className={cn(
        'flex h-16 shrink-0 items-center gap-4 border-b-2 border-sidebar bg-card px-4',
        className
      )}
    >
      {/* Mobile menu toggle */}
      {onMenuClick && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          aria-label="Abrir menu"
          className="md:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}

      {/* Logo — desktop, left side */}
      <Link href="/dashboard" className="hidden md:flex items-center shrink-0">
        <Image src="/kyra-logo.png" alt="Kyra Estoque" height={52} width={156} priority style={{ objectFit: "contain" }} />
      </Link>

      {/* Company name (mobile) */}
      {companyName && (
        <span className="text-sm font-semibold text-foreground md:hidden">{companyName}</span>
      )}

      {/* Search */}
      {showSearch && (
        <div className="hidden flex-1 max-w-md md:block">
          <Input
            placeholder="Buscar produto, código, categoria…"
            leftIcon={<Search className="h-4 w-4" />}
            inputSize="sm"
          />
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* Notifications */}
        <NotificationBell initialCount={notificationCount} />

        {/* User menu */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <Avatar size="sm">
                  {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile">Meu perfil</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">Configurações</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-danger focus:text-danger cursor-pointer"
                onClick={handleLogout}
              >
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}
