'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, Package, Warehouse, ShoppingBag, Scan,
  ShoppingCart, Users, Truck, Globe, Zap,
  BarChart2, DollarSign, FileText, Sparkles, Settings, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  badge?: string
}

const NAV_TOP: NavItem[] = [
  { label: 'Início',       href: '/dashboard',   icon: Home },
  { label: 'Produtos',     href: '/products',    icon: Package },
  { label: 'Estoque',      href: '/stock',       icon: Warehouse },
]

const NAV_COMMERCIAL: NavItem[] = [
  { label: 'Clientes',     href: '/customers',   icon: Users },
  { label: 'Fornecedores', href: '/suppliers',   icon: Truck },
  { label: 'Compras',      href: '/purchases',   icon: ShoppingBag },
  { label: 'Vendas',       href: '/sales',       icon: ShoppingCart },
  { label: 'PDV',          href: '/pdv',         icon: Scan },
]

const NAV_DIGITAL: NavItem[] = [
  { label: 'Canais',       href: '/channels',    icon: Globe },
  { label: 'Automações',   href: '/automations', icon: Zap },
]

const NAV_REPORTS: NavItem = { label: 'Relatórios', href: '/reports', icon: BarChart2 }
const NAV_FINANCIAL: NavItem = { label: 'Financeiro', href: '/financial', icon: DollarSign }
const NAV_FISCAL: NavItem    = { label: 'Fiscal',      href: '/fiscal',    icon: FileText }

const NAV_KYRA: NavItem = { label: 'Kyra', href: '/kyra', icon: Sparkles }
const NAV_BOTTOM: NavItem = { label: 'Configurações', href: '/settings', icon: Settings }

interface SidebarProps {
  collapsed?: boolean
  onCollapsedChange?: (v: boolean) => void
  user?: {
    name: string
    role?: string
    avatarUrl?: string
  }
}

export function Sidebar({ collapsed = false, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname()
  const isActive = (href: string) => pathname.startsWith(href)

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          'flex h-full flex-col bg-sidebar transition-all duration-300',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        {/* Nav */}
        <nav className="flex flex-1 flex-col overflow-y-auto px-2 py-3 gap-0.5">
          {/* Grupo 1: Início, Produtos, Estoque */}
          {NAV_TOP.map((item) => (
            <NavLink key={item.href} item={item} collapsed={collapsed} active={isActive(item.href)} />
          ))}

          <div className="h-px mx-1 my-2 bg-sidebar-accent/11" />

          {/* Grupo 2: Clientes, Fornecedores, Compras, Vendas, PDV */}
          {NAV_COMMERCIAL.map((item) => (
            <NavLink key={item.href} item={item} collapsed={collapsed} active={isActive(item.href)} />
          ))}

          <div className="h-px mx-1 my-2 bg-sidebar-accent/11" />

          {/* Grupo 3: Canais, Automações, Relatórios */}
          {NAV_DIGITAL.map((item) => (
            <NavLink key={item.href} item={item} collapsed={collapsed} active={isActive(item.href)} />
          ))}
          <NavLink item={NAV_REPORTS} collapsed={collapsed} active={isActive(NAV_REPORTS.href)} />
          <NavLink item={NAV_FINANCIAL} collapsed={collapsed} active={isActive(NAV_FINANCIAL.href)} />
          <NavLink item={NAV_FISCAL}    collapsed={collapsed} active={isActive(NAV_FISCAL.href)}    />

          <div className="h-px mx-1 my-2 bg-sidebar-accent/11" />

          {/* Kyra — always teal highlight */}
          <NavLink item={NAV_KYRA} collapsed={collapsed} active={isActive(NAV_KYRA.href)} kyra />

          <div className="flex-1" />
        </nav>

        {/* Bottom */}
        <div className="h-px mx-3 bg-sidebar-accent/11" />
        <div className="flex flex-col gap-1 px-2 py-2">
          <NavLink item={NAV_BOTTOM} collapsed={collapsed} active={pathname === NAV_BOTTOM.href} />

          <button
            type="button"
            onClick={() => onCollapsedChange?.(!collapsed)}
            aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
            className={cn(
              'flex h-8 w-full items-center rounded-md px-2 text-xs font-medium transition-colors',
              'text-white/40 hover:text-white/70 hover:bg-white/5',
              collapsed ? 'justify-center' : 'gap-2'
            )}
          >
            {collapsed
              ? <ChevronRight className="h-3.5 w-3.5" />
              : (
                <>
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Recolher</span>
                </>
              )}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  )
}

function NavLink({
  item,
  collapsed,
  active,
  kyra = false,
}: {
  item: NavItem
  collapsed: boolean
  active: boolean
  kyra?: boolean
}) {
  const Icon = item.icon

  const iconCls = cn(
    'flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md border transition-colors',
    kyra
      ? 'bg-sidebar-accent/17 border-sidebar-accent/38'
      : active
        ? 'bg-sidebar-accent/13 border-sidebar-accent/42'
        : 'border-sidebar-accent/26'
  )

  const iconColor = (kyra || active) ? 'text-sidebar-accent' : 'text-white/50'

  const labelCls = cn(
    'flex-1 text-[13px]',
    kyra
      ? 'text-sidebar-accent font-semibold'
      : active
        ? 'text-white font-semibold'
        : 'text-white/50 font-medium'
  )

  const link = (
    <Link
      href={item.href as any}
      className={cn(
        'flex h-9 w-full items-center rounded-md transition-colors',
        collapsed ? 'justify-center px-1.5' : 'gap-2 px-1.5',
        active
          ? 'bg-sidebar-active border-l-[3px] border-sidebar-accent'
          : 'border-l-[3px] border-transparent hover:bg-white/5',
      )}
    >
      <span className={iconCls}>
        <Icon className={cn('h-[13px] w-[13px]', iconColor)} />
      </span>
      {!collapsed && <span className={labelCls}>{item.label}</span>}
      {!collapsed && item.badge && (
        <span className={cn(
          'ml-auto flex h-5 min-w-5 items-center justify-center rounded px-1.5',
          'text-[9.5px] font-semibold',
          active
            ? 'bg-sidebar-accent/20 text-sidebar-accent'
            : 'bg-white/10 text-white/45'
        )}>
          {item.badge}
        </span>
      )}
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">
          {item.label}{item.badge ? ` (${item.badge})` : ''}
        </TooltipContent>
      </Tooltip>
    )
  }

  return link
}
