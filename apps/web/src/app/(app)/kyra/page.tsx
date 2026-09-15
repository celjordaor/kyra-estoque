import { Suspense } from 'react'
import { KyraPage } from '@/components/domain/kyra/kyra-page'

export const metadata = { title: 'Assistente | Kyra Estoque' }

export default function Page() {
  return (
    <Suspense fallback={null}>
      <KyraPage />
    </Suspense>
  )
}
