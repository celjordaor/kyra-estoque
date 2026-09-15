import * as React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BreadcrumbItem {
  label: string
  href?: string
}

export interface PageHeaderProps {
  title: string
  description?: string
  icon?: React.ElementType
  breadcrumbs?: BreadcrumbItem[]
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ title, description, icon: Icon, breadcrumbs, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        // Full-bleed: escape the main padding so the border spans edge-to-edge
        '-mx-4 -mt-4 mb-6',
        'md:-mx-6 md:-mt-6',
        'lg:-mx-8 lg:-mt-8',
        // Surface + visual separator
        'bg-card border-b border-border',
        // Internal padding matching the escaped margins
        'px-4 pt-5 pb-0',
        'md:px-6 md:pt-6',
        'lg:px-8 lg:pt-6',
        className
      )}
    >
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Caminho da página" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {breadcrumbs.map((crumb, i) => (
              <li key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
                {crumb.href ? (
                  <Link href={crumb.href as any} className="hover:text-foreground transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-foreground font-medium">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* Title row */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </span>
          )}
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
            {description && (
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  )
}
