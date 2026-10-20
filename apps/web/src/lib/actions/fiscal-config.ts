'use server'
// apps/web/src/lib/actions/fiscal-config.ts
// Ações server: ler e salvar fiscal_config de um tenant.

import { cookies } from 'next/headers'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'
import { revalidatePath } from 'next/cache'
import {
  maskFiscalConfig, buildFiscalConfigUpdate,
  FISCAL_CONFIG_SECRET_FIELDS,
} from '@/lib/fiscal/config-dto'
import { lerCertificadoPFX, CertificadoError } from '@/lib/fiscal/certificado'

// ── Context ───────────────────────────────────────────────────────────────────

async function getAdminContext() {
  const cookieStore = await cookies()
  const supabase = createServerSupabaseClient(cookieStore)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Não autenticado')
  const admin = createAdminSupabaseClient()
  const { data: profileData } = await (admin as any)
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single()
  if (!profileData?.company_id) throw new Error('Empresa não encontrada')
  return { admin, companyId: profileData.company_id as string, role: profileData.role as string }
}

// ── Tipos públicos ────────────────────────────────────────────────────────────

export interface FiscalConfigDTO {
  id: string | null
  ambiente: 1 | 2
  crt: 1 | 3
  ie: string | null
  im: string | null
  cnae: string | null
  nome_fantasia: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  municipio: string | null
  uf: string | null
  cep: string | null
  cod_municipio: string | null
  telefone: string | null
  nat_op_venda: string
  csosn: string
  cfop_dentro_estado: string
  cfop_fora_estado: string
  ncm_padrao: string | null
  cest_padrao: string | null
  csc_id: string | null
  // secrets — nunca retornados, apenas indicadores:
  certificado_pfx: string | null         // '***CONFIGURADO***' | null
  certificado_senha: string | null
  csc_token: string | null
  certificado_configurado: boolean
  certificado_senha_configurada: boolean
  csc_token_configurado: boolean
  // numeração
  serie_nfe: string
  ultimo_numero_nfe: number
  serie_nfce: string
  ultimo_numero_nfce: number
}

// ── getFiscalConfig ───────────────────────────────────────────────────────────

export async function getFiscalConfig(): Promise<{ ok: boolean; config?: FiscalConfigDTO; error?: string }> {
  try {
    const { admin, companyId } = await getAdminContext()
    const { data, error } = await (admin as any)
      .from('fiscal_config')
      .select('*')
      .eq('company_id', companyId)
      .single()

    if (error && error.code !== 'PGRST116') return { ok: false, error: error.message }
    if (!data) {
      // Retorna defaults quando não existe ainda
      return {
        ok: true,
        config: {
          id: null, ambiente: 2, crt: 1,
          ie: null, im: null, cnae: null, nome_fantasia: null,
          logradouro: null, numero: null, complemento: null, bairro: null,
          municipio: null, uf: null, cep: null, cod_municipio: null, telefone: null,
          nat_op_venda: 'Venda de mercadoria', csosn: '102',
          cfop_dentro_estado: '5102', cfop_fora_estado: '6102',
          ncm_padrao: null, cest_padrao: null, csc_id: null,
          certificado_pfx: null, certificado_senha: null, csc_token: null,
          certificado_configurado: false, certificado_senha_configurada: false, csc_token_configurado: false,
          serie_nfe: '1', ultimo_numero_nfe: 0,
          serie_nfce: '1', ultimo_numero_nfce: 0,
        },
      }
    }

    const masked = maskFiscalConfig(data)
    return { ok: true, config: masked as unknown as FiscalConfigDTO }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── saveFiscalConfig ──────────────────────────────────────────────────────────

export async function saveFiscalConfig(body: unknown): Promise<{ ok: boolean; error?: string; certInfo?: { cnpj: string | null; nomeTitular: string | null; validoAte: string } }> {
  try {
    const { admin, companyId, role } = await getAdminContext()
    if (!['owner', 'admin'].includes(role)) return { ok: false, error: 'Apenas owner ou admin podem alterar configurações fiscais.' }

    const result = buildFiscalConfigUpdate(body)
    if (!result.ok) return { ok: false, error: result.error }
    const update = result.update

    // Validar certificado imediatamente ao receber
    let certInfo: { cnpj: string | null; nomeTitular: string | null; validoAte: string } | undefined
    if (update.certificado_pfx && update.certificado_senha) {
      try {
        const info = lerCertificadoPFX(
          String(update.certificado_pfx),
          String(update.certificado_senha)
        )
        certInfo = {
          cnpj: info.cnpj,
          nomeTitular: info.nomeTitular,
          validoAte: info.validoAte.toISOString(),
        }
      } catch (e) {
        return { ok: false, error: e instanceof CertificadoError ? e.message : 'Certificado inválido.' }
      }
    }

    // Upsert (cria se não existe, atualiza se existe)
    const { data: existing } = await (admin as any)
      .from('fiscal_config')
      .select('id')
      .eq('company_id', companyId)
      .single()

    if (existing) {
      const { error } = await (admin as any)
        .from('fiscal_config')
        .update(update)
        .eq('id', existing.id)
        .eq('company_id', companyId)
      if (error) return { ok: false, error: error.message }
    } else {
      const { error } = await (admin as any)
        .from('fiscal_config')
        .insert({ company_id: companyId, ...update })
      if (error) return { ok: false, error: error.message }
    }

    revalidatePath('/fiscal')
    return { ok: true, certInfo }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
