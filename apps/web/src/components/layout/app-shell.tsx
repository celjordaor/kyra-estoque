'use client'

import * as React from 'react'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { cn } from '@/lib/utils'

export interface AppShellProps {
  children: React.ReactNode
  user?: {
    name: string
    email: string
    role?: string
    avatarUrl?: string
  }
  notificationCount?: number
  className?: string
}

export function AppShell({ children, user, notificationCount, className }: AppShellProps) {
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false)

  const sidebarUser = user
    ? { name: user.name, role: user.role, avatarUrl: user.avatarUrl }
    : undefined

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Topbar — full width */}
      <Topbar
        onMenuClick={() => setMobileSidebarOpen(true)}
        user={user}
        notificationCount={notificationCount}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden md:flex">
          <Sidebar
            collapsed={collapsed}
            onCollapsedChange={setCollapsed}
            user={sidebarUser}
          />
        </div>

        {/* Mobile sidebar overlay */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setMobileSidebarOpen(false)}
              aria-hidden="true"
            />
            <div className="relative z-50 flex h-full">
              <Sidebar
                collapsed={false}
                onCollapsedChange={() => setMobileSidebarOpen(false)}
                user={sidebarUser}
              />
            </div>
          </div>
        )}

        {/* Main area */}
        <main className={cn('flex-1 overflow-y-auto p-4 md:p-6 lg:p-8', className)}>
          {children}
        </main>
      </div>
    </div>
  )
}
