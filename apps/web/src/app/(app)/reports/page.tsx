import { Metadata } from 'next'
import { ReportsPage } from '@/components/domain/reports/reports-page'

export const metadata: Metadata = {
  title: 'Relatórios | Kyra Estoque',
  description: 'Análise detalhada do seu estoque, vendas, compras e margens',
}

export default function Page() {
  return <ReportsPage />
}
