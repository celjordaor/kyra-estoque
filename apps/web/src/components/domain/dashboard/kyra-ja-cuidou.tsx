'use client'

import { CheckCircle2, Shield, FileText, RefreshCw } from 'lucide-react'

const ITEMS = [
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
]

export function KyraJaCuidou() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2 mb-4">
        <CheckCircle2 className="h-4 w-4 text-teal-600" />
        <h3 className="text-sm font-semibold text-slate-700">Kyra já cuidou</h3>
      </div>
      <div className="flex flex-col gap-3">
        {ITEMS.map(item => (
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
    </div>
  )
}
