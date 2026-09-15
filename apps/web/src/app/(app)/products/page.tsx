import { Suspense } from 'react'
import { ProductsPage } from '@/components/domain/product'

export const metadata = { title: 'Produtos | Kyra Estoque' }

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ProductsPage />
    </Suspense>
  )
}
