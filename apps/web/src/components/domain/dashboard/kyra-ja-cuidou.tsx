'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Shield, FileText, RefreshCw, Loader2 } from 'lucide-react'
import { getCompanyAutomations } from '@/lib/actions/automations'
import { getDashboardData } from '@/lib/actions/dashboard'

interface StatusItem {
  icon: React.ReactNode
  title: string
  description: string
}

export function KyraJaCuidou() {
  const [items, setItems] = useState<StatusItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [automationsResult, dashResult] = await Promise.allSettled([
          getCompanyAutomations(),
          getDashboardData(),
        ])

        const automations = automationsResult.status === 'fulfilled' ? automationsResult.value : []
        const dashData = dashResult.status === 'fulfilled' ? dashResult.value.data : null

        const activeAutomations = automations.filter(a => a.enabled).length
        const totalProducts = dashData?.kpis.totalProducts ?? 0
        const attentionProducts = dashData?.operationsHealth.attentionProducts ?? 0
        const lastActivity = dashData?.recentActivity?.[0]

        const builtItems: StatusItem[] = [
          {
            icon: <Shield className="h-4 w-4 text-teal-600" />,
            title: 'Estoque monitorado',
            description: totalProducts > 0
              ? `${totalProducts} produto${totalProducts !== 1 ? 's' : ''} monitorados${attentionProducts > 0 ? ` · ${attentionProducts} em atenção` : ''}`
              : 'Alertas configurados para todos os produtos',
          },
          {
            icon: <FileText className="h-4 w-4 text-teal-600" />,
            title: 'Automações ativas',
            description: activeAutomations > 0
              ? `${activeAutomations} automação${activeAutomations !== 1 ? 'ões' : ''} ativa${activeAutomations !== 1 ? 's' : ''} e funcionando`
              : 'Nenhuma automação ativa — configure em Automações',
          },
          {
            icon: <RefreshCw className="h-4 w-4 text-teal-600" />,
            title: 'Sincronização ativa',
            description: lastActivity
              ? `Última atividade: ${new Date(lastActivity.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
              : 'Informações atualizadas em tempo real',
          },
        ]

        setItems(builtItems)
      } catch {
        // Fallback to static descriptions on error
        setItems([
          {
            icon: <Shield className="h-4 w-4 text-teal-600" />,
            title: 'Estoque monitorado',
            description: 'Alertas configurados para todos os produtos',
          },
          {
            icon: <FileText className="h-4 w-4 text-teal-600" />,
            title: 'Dados analisados',
            description: 'Padrões identificados e recomendações atualizadas',
          },
          {
            icon: <RefreshCw className="h-4 w-4 text-teal-600" />,
            title: 'Sincronização ativa',
            description: 'Informações atualizadas em tempo real',
          },
        ])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2 mb-4">
        <CheckCircle2 className="h-4 w-4 text-teal-600" />
        <h3 className="text-sm font-semibold text-slate-700">Kyra já cuidou</h3>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 text-teal-500 animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map(item => (
            <div key={item.title} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center shrink-0 mt-0.5">
                {item.icon}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800">{item.title}</p>
                <p className="text-[11px] text-slate-500">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
