'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Bell, Search, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@kyra/database'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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
        <Image src="/kyra-logo.png" alt="Kyra Estoque" height={44} width={132} priority style={{ objectFit: "contain" }} />
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
        <div className="relative">
          <Button variant="ghost" size="icon" aria-label="Notificações">
            <Bell className="h-5 w-5" />
          </Button>
          {notificationCount > 0 && (
            <span
              aria-label={`${notificationCount} notificações`}
              className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white"
            >
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </div>

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
