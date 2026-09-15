import { Metadata } from 'next'
import { FiscalPage } from '@/components/domain/fiscal/fiscal-page'

export const metadata: Metadata = {
  title: 'Fiscal | Kyra Estoque',
  description: 'Gestão de NF-e emitidas e importadas',
}

export default function Page() {
  return <FiscalPage />
}
