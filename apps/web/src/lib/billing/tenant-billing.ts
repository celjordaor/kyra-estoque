// Provedor de cobrança da empresa (tenant): usa a conta Asaas DO CLIENTE,
// cadastrada em Configurações → Integrações. Nunca cai na conta do Kyra.

import { AsaasAdapter, ASAAS_PRODUCTION_URL, ASAAS_SANDBOX_URL } from '@kyra/business-rules'
import type { BillingProvider } from '@kyra/business-rules'

export const ASAAS_NOT_CONNECTED =
  'Conecte a sua conta Asaas em Configurações → Integrações para gerar cobranças.'

/** Retorna o provedor da empresa ou null se o Asaas não estiver conectado/ativo. */
export async function getTenantBillingProvider(
  admin: any,
  companyId: string,
): Promise<BillingProvider | null> {
  const { data } = await admin
    .from('company_integrations')
    .select('config, is_active')
    .eq('company_id', companyId)
    .eq('type', 'asaas')
    .maybeSingle()

  const cfg = (data?.config ?? {}) as Record<string, string>
  if (!data?.is_active || !cfg.api_key) return null

  return new AsaasAdapter({
    apiKey: cfg.api_key,
    baseUrl: cfg.environment === 'production' ? ASAAS_PRODUCTION_URL : ASAAS_SANDBOX_URL,
  })
}
