'use client'

import { useState, useTransition } from 'react'
import type { DashboardData } from '@/lib/actions/dashboard'
import { getDashboardData } from '@/lib/actions/dashboard'
import { KPIRow } from './kpi-row'
import { AttentionSection } from './attention-section'
import { RecommendationsPanel } from './recommendations-panel'
import { CopilotStrip } from './copilot-strip'
import { OperationsOverview } from './operations-overview'
import { KyraJaCuidou } from './kyra-ja-cuidou'
import { RecentActivity } from './recent-activity'
import { DashboardEmptyState, DashboardErrorState } from './dashboard-states'
import { RefreshCw } from 'lucide-react'
import { KyraCard } from '@/components/ai/kyra-card'
import { OnboardingChecklist } from './onboarding-checklist'

interface DashboardClientProps {
  initialData: DashboardData | null
  initialError: string | null
  userName: string
  companyId?: string | null
}

function greeting(name: string) {
  const hour = new Date().getHours()
  const part = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const first = name.split(' ')[0]
  return `${part}, ${first} 👋`
}

function buildKyraSummary(kpis: DashboardData['kpis']): string {
  const parts: string[] = []
  const salesChange = kpis.salesRevenuePrev > 0
    ? ((kpis.salesRevenue - kpis.salesRevenuePrev) / kpis.salesRevenuePrev) * 100
    : null
  if (salesChange !== null) {
    parts.push(salesChange >= 0
      ? `Vendas cresceram ${salesChange.toFixed(0)}% este mês`
      : `Vendas caíram ${Math.abs(salesChange).toFixed(0)}% este mês`)
  }
  if (kpis.grossMargin > 0) {
    parts.push(`margem em ${kpis.grossMargin.toFixed(1)}%`)
  }
  const criticalCount = kpis.lowStockCount + kpis.outOfStockCount
  if (criticalCount > 0) {
    parts.push(`${criticalCount} produto${criticalCount > 1 ? 's' : ''} com estoque crítico`)
  }
  if (parts.length === 0) return 'Analisei sua operação e tudo parece em ordem.'
  return parts.join('. ') + '.'
}

export function DashboardClient({ initialData, initialError, userName, companyId }: DashboardClientProps) {
  const [data, setData] = useState<DashboardData | null>(initialData)
  const [error, setError] = useState<string | null>(initialError)
  const [isPending, startTransition] = useTransition()

  function handleRetry() {
    startTransition(async () => {
      setError(null)
      const result = await getDashboardData()
      setData(result.data)
      setError(result.error)
    })
  }

  const isEmpty = !error && data?.kpis.totalProducts === 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 font-display">{greeting(userName)}</h1>
          <p className="text-sm text-slate-500">Aqui está o resumo da sua operação hoje.</p>
        </div>
        <button
          onClick={handleRetry}
          disabled={isPending}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-teal-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Error */}
      {error && !data && (
        <DashboardErrorState message={error} onRetry={handleRetry} />
      )}

      {/* Empty */}
      {isEmpty && !error && <DashboardEmptyState />}

      {/* Normal state */}
      {data && !isEmpty && (
        <>
          {/* Onboarding */}
          {companyId && <OnboardingChecklist companyId={companyId} />}

          {/* KPIs */}
          <KPIRow kpis={data.kpis} />

          {/* Kyra greeting card */}
          <KyraCard
            label="Kyra analisou sua operação"
            summary={buildKyraSummary(data.kpis)}
            description={
              (data.kpis.lowStockCount + data.kpis.outOfStockCount) > 0
                ? `${data.kpis.lowStockCount + data.kpis.outOfStockCount} item(s) pedem atenção imediata.`
                : 'Operação saudável. Veja os destaques abaixo.'
            }
            className="border-primary/10 bg-primary/[0.03]"
          />

          {/* Copilot */}
          <CopilotStrip />

          {/* Main 65/35 grid */}
          <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-5 items-start">
            {/* Left column */}
            <div className="flex flex-col gap-5">
              <AttentionSection items={data.attentionItems} />
              <OperationsOverview
                activeProducts={data.operationsHealth.activeProducts}
                attentionProducts={data.operationsHealth.attentionProducts}
                categories={data.operationsHealth.categories}
              />
              <KyraJaCuidou />
              <RecentActivity items={data.recentActivity} />
            </div>

            {/* Right column */}
            <div className="flex flex-col gap-5">
              <RecommendationsPanel recommendations={data.recommendations} />
            </div>
          </div>

          {/* Partial error banner */}
          {error && data && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between">
              <p className="text-xs text-amber-700">Alguns dados podem estar desatualizados.</p>
              <button onClick={handleRetry} className="text-xs font-semibold text-amber-700 hover:underline">
                Tentar novamente
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
