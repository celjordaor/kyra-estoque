import type { Metadata } from 'next'
import { getCheckoutState } from '@/lib/actions/subscription-checkout'
import { SubscribeClient } from './subscribe-client'

export const metadata: Metadata = { title: 'Assinatura | Kyra Estoque' }
export const dynamic = 'force-dynamic'

export default async function SubscribePage() {
  const state = await getCheckoutState()
  return <SubscribeClient state={state} />
}
