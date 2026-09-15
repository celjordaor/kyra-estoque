import { Metadata } from 'next'
import { FinancialPage } from '@/components/domain/financial/financial-page'

export const metadata: Metadata = {
  title: 'Financeiro | Kyra Estoque',
  description: 'Gestão de contas a pagar e receber',
}

export default function Page() {
  return <FinancialPage />
}
