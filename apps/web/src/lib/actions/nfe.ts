'use server'

import { cookies } from 'next/headers'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'
import { hasFeature } from '@kyra/business-rules'
import { revalidatePath } from 'next/cache'
import { parseNfeXml } from '@/lib/nfe/xml-parser'
import {
  emitirNfe, consultarNfe, cancelarNfe,
  mapFocusStatus, getDanfeUrl,
  type FocusNfePayload,
} from '@/lib/nfe/focus-nfe-adapter'

// ── Context ───────────────────────────────────────────────────────────────────

async function getServerContext() {
  const cookieStore = await cookies()
  const supabase = createServerSupabaseClient(cookieStore)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Não autenticado')
  const admin = createAdminSupabaseClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()
  if (!profile?.company_id) throw new Error('Empresa não encontrada')
  return { supabase, admin, companyId: profile.company_id as string }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NfeDocument {
  id: string
  docType: 'import' | 'emission'
  chaveAcesso: string | null
  numero: string | null
  serie: string | null
  dataEmissao: string | null
  emitenteCnpj: string | null
  emitenteNome: string | null
  destinatarioCnpj: string | null
  destinatarioNome: string | null
  valorTotalCents: number | null
  status: string
  pdfUrl: string | null
  saleId: string | null
  purchaseId: string | null
  createdAt: string
}

export interface EmitNfeInput {
  saleId: string
  /** Referência única para o provider (gerada automaticamente se omitida) */
  ref?: string
}

// ── getNfeDocuments ───────────────────────────────────────────────────────────

export async function getNfeDocuments(filter?: {
  docType?: 'import' | 'emission'
  status?: string
  limit?: number
}): Promise<{ docs: NfeDocument[]; hasFeatureImport: boolean; hasFeatureEmission: boolean }> {
  const { admin, companyId } = await getServerContext()

  const [hasImport, hasEmission] = await Promise.all([
    hasFeature(companyId, 'nfe.import.enabled'),
    hasFeature(companyId, 'nfe.emission.enabled'),
  ])

  let query = admin
    .from('nfe_documents')
    .select(`
      id, doc_type, chave_acesso, numero, serie, data_emissao,
      emitente_cnpj, emitente_nome, destinatario_cnpj, destinatario_nome,
      valor_total_cents, status, pdf_url, sale_id, purchase_id, created_at
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (filter?.docType) query = query.eq('doc_type', filter.docType)
  if (filter?.status)  query = query.eq('status', filter.status)
  query = query.limit(filter?.limit ?? 100)

  const { data } = await query

  const docs: NfeDocument[] = (data ?? []).map(d => ({
    id:                d.id,
    docType:           d.doc_type as 'import' | 'emission',
    chaveAcesso:       d.chave_acesso,
    numero:            d.numero,
    serie:             d.serie,
    dataEmissao:       d.data_emissao,
    emitenteCnpj:      d.emitente_cnpj,
    emitenteNome:      d.emitente_nome,
    destinatarioCnpj:  d.destinatario_cnpj,
    destinatarioNome:  d.destinatario_nome,
    valorTotalCents:   d.valor_total_cents,
    status:            d.status,
    pdfUrl:            d.pdf_url,
    saleId:            d.sale_id,
    purchaseId:        d.purchase_id,
    createdAt:         d.created_at,
  }))

  return { docs, hasFeatureImport: hasImport, hasFeatureEmission: hasEmission }
}

// ── importXml ─────────────────────────────────────────────────────────────────

export async function importXml(
  xmlContent: string,
): Promise<{ ok: boolean; error?: string; docId?: string; preview?: ReturnType<typeof parseNfeXml> }> {
  const { admin, companyId } = await getServerContext()

  if (!(await hasFeature(companyId, 'nfe.import.enabled'))) {
    return { ok: false, error: 'Seu plano não permite importar NF-e. Faça upgrade para Impulsiona ou Escala.' }
  }

  let parsed: ReturnType<typeof parseNfeXml>
  try {
    parsed = parseNfeXml(xmlContent)
  } catch (err) {
    return { ok: false, error: `XML inválido: ${err instanceof Error ? err.message : String(err)}` }
  }

  // Checa duplicidade pela chave de acesso
  if (parsed.chaveAcesso) {
    const { data: existing } = await admin
      .from('nfe_documents')
      .select('id')
      .eq('chave_acesso', parsed.chaveAcesso)
      .single()
    if (existing) return { ok: false, error: 'Esta NF-e já foi importada anteriormente.', preview: parsed }
  }

  const { data, error } = await admin
    .from('nfe_documents')
    .insert({
      company_id:             companyId,
      doc_type:               'import',
      chave_acesso:           parsed.chaveAcesso || null,
      numero:                 parsed.numero || null,
      serie:                  parsed.serie || null,
      modelo:                 parsed.modelo || '55',
      data_emissao:           parsed.dataEmissao || null,
      emitente_cnpj:          parsed.emitenteCnpj || null,
      emitente_nome:          parsed.emitenteNome || null,
      emitente_uf:            parsed.emitenteUf || null,
      destinatario_cnpj:      parsed.destinatarioCnpj || null,
      destinatario_nome:      parsed.destinatarioNome || null,
      valor_produtos_cents:   parsed.valorProdutosCents,
      valor_frete_cents:      parsed.valorFreteCents,
      valor_desconto_cents:   parsed.valorDescontoCents,
      valor_ipi_cents:        parsed.valorIpiCents,
      valor_icms_cents:       parsed.valorIcmsCents,
      valor_pis_cents:        parsed.valorPisCents,
      valor_cofins_cents:     parsed.valorCoffinsCents,
      valor_total_cents:      parsed.valorTotalCents,
      status:                 'import',
      xml_content:            xmlContent,
      items:                  JSON.stringify(parsed.items),
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }

  revalidatePath('/fiscal')
  return { ok: true, docId: data.id, preview: parsed }
}

// ── emitNfe ───────────────────────────────────────────────────────────────────

export async function emitNfe(input: EmitNfeInput): Promise<{ ok: boolean; error?: string; docId?: string }> {
  const { admin, companyId } = await getServerContext()

  if (!(await hasFeature(companyId, 'nfe.emission.enabled'))) {
    return { ok: false, error: 'Seu plano não permite emitir NF-e. Faça upgrade para Impulsiona ou Escala.' }
  }

  // Busca dados da venda e da empresa
  const [saleRes, companyRes] = await Promise.all([
    admin.from('sales').select(`
      id, total_amount,
      customer_name, customer_email, customer_phone,
      sale_items (
        product_id, product_name, quantity, unit_price, total_price,
        products!sale_items_product_id_fkey ( ncm, category_id, categories ( ncm ) )
      )
    `).eq('id', input.saleId).eq('company_id', companyId).single(),
    admin.from('companies').select('kyra_config, name, document').eq('id', companyId).single(),
  ])

  if (saleRes.error || !saleRes.data) return { ok: false, error: `Venda não encontrada${saleRes.error ? ': ' + saleRes.error.message : ''}` }
  if (companyRes.error || !companyRes.data) return { ok: false, error: 'Empresa não encontrada' }

  const sale = saleRes.data
  const config = (companyRes.data.kyra_config ?? {}) as Record<string, unknown>
  const fiscal = (config.fiscal ?? {}) as Record<string, unknown>

  // Valida configurações fiscais mínimas da empresa
  const missingFiscal: string[] = []
  if (!companyRes.data.document) missingFiscal.push('CNPJ')
  if (!fiscal.ie) missingFiscal.push('IE')
  if (!fiscal.regime_tributario) missingFiscal.push('Regime Tributário')
  if (missingFiscal.length > 0) {
    return {
      ok: false,
      error: `Configure os dados fiscais da empresa (${missingFiscal.join(', ')}) em Configurações → Empresa antes de emitir NF-e.`,
    }
  }

  const ref = input.ref ?? `kyra-venda-${input.saleId}`

  // Customer data is denormalized on the sale row
  const saleData = sale as Record<string, unknown>
  const items = (saleData.sale_items as Array<Record<string, unknown>> | null) ?? []

  const focusPayload: FocusNfePayload = {
    ref,
    natureza_operacao: 'Venda de mercadoria',
    tipo_documento: 1,
    tipo_operacao: 1,
    data_emissao: new Date().toISOString(),
    data_saida_entrada: new Date().toISOString(),
    finalidade_emissao: 1,
    forma_pagamento: 0,
    indicador_pagamento: 0,

    cnpj_emitente:           String(companyRes.data.document),
    nome_emitente:           companyRes.data.name,
    nome_fantasia_emitente:  String(fiscal.nome_fantasia ?? companyRes.data.name),
    logradouro_emitente:     String(fiscal.logradouro ?? ''),
    numero_emitente:         String(fiscal.numero ?? 'S/N'),
    bairro_emitente:         String(fiscal.bairro ?? ''),
    municipio_emitente:      String(fiscal.municipio ?? ''),
    uf_emitente:             String(fiscal.uf ?? ''),
    cep_emitente:            String(fiscal.cep ?? ''),
    ie_emitente:             String(fiscal.ie),
    regime_tributario_emitente: Number(fiscal.regime_tributario ?? 1),

    nome_destinatario:       String(saleData.customer_name ?? 'Consumidor Final'),
    email_destinatario:      saleData.customer_email ? String(saleData.customer_email) : undefined,
    indicador_ie_destinatario: 9,

    items: items.map((item, idx) => {
      const qty = Number(item.quantity ?? 1)
      const valorUnit = Number(item.unit_price ?? 0)
      const valorBruto = Number(item.total_price ?? (qty * valorUnit))
      return {
        numero_item:              idx + 1,
        codigo_produto:           String(item.product_id ?? `ITEM${idx + 1}`).slice(0, 60),
        descricao:                String(item.product_name ?? 'Produto').slice(0, 120),
        cfop:                     String(fiscal.cfop ?? '5102'),
        unidade_comercial:        'UN',
        quantidade_comercial:     qty,
        valor_unitario_comercial: valorUnit,
        valor_bruto:              valorBruto,
        codigo_ncm:               (() => {
          const prod = item.products as any
          const rawNcm = prod?.ncm ?? (prod?.categories as any)?.ncm ?? '00000000'
          return String(rawNcm).replace(/\D/g, '').slice(0, 8).padEnd(8, '0')
        })(),
        icms_situacao_tributaria: '102',   // Simples Nacional sem permissão de crédito
        pis_situacao_tributaria:  '07',    // Operação isenta
        cofins_situacao_tributaria: '07',
      }
    }),

    formas_pagamento: [{ forma_pagamento: '99', valor_pagamento: Number(saleData.total_amount ?? 0) }],
  }

  let focusResp: Awaited<ReturnType<typeof emitirNfe>>
  try {
    focusResp = await emitirNfe(focusPayload)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Erro ao comunicar com o emissor NF-e' }
  }

  const { data, error } = await admin
    .from('nfe_documents')
    .insert({
      company_id:       companyId,
      doc_type:         'emission',
      status:           mapFocusStatus(focusResp.status ?? 'processando_autorizacao'),
      chave_acesso:     focusResp.chave_nfe ?? null,
      numero:           focusResp.numero ?? null,
      serie:            focusResp.serie ?? null,
      data_emissao:     new Date().toISOString().split('T')[0],
      emitente_cnpj:    String(companyRes.data.document),
      emitente_nome:    companyRes.data.name,
      destinatario_nome: String(saleData.customer_name ?? 'Consumidor Final'),
      valor_total_cents: Math.round(Number(saleData.total_amount ?? 0) * 100),
      provider_ref:     ref,
      provider_protocol: focusResp.protocolo ?? null,
      provider_msg:     focusResp.mensagem_sefaz ?? null,
      pdf_url:          focusResp.caminho_danfe ?? getDanfeUrl(ref),
      sale_id:          input.saleId,
      items:            JSON.stringify(items),
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }

  revalidatePath('/fiscal')
  revalidatePath('/sales')
  return { ok: true, docId: data.id }
}

// ── syncNfeStatus ─────────────────────────────────────────────────────────────

export async function syncNfeStatus(docId: string): Promise<{ ok: boolean; status?: string; error?: string }> {
  const { admin, companyId } = await getServerContext()

  const { data: doc } = await admin
    .from('nfe_documents')
    .select('provider_ref, status')
    .eq('id', docId)
    .eq('company_id', companyId)
    .single()

  if (!doc?.provider_ref) return { ok: false, error: 'Documento sem referência no provider' }
  if (doc.status === 'authorized' || doc.status === 'canceled') {
    return { ok: true, status: doc.status }
  }

  let resp: Awaited<ReturnType<typeof consultarNfe>>
  try {
    resp = await consultarNfe(doc.provider_ref)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Erro ao consultar status' }
  }

  const newStatus = mapFocusStatus(resp.status ?? '')
  await admin
    .from('nfe_documents')
    .update({
      status:           newStatus,
      chave_acesso:     resp.chave_nfe ?? null,
      numero:           resp.numero ?? null,
      provider_protocol: resp.protocolo ?? null,
      provider_msg:     resp.mensagem_sefaz ?? null,
      pdf_url:          resp.caminho_danfe ?? null,
    })
    .eq('id', docId)

  revalidatePath('/fiscal')
  return { ok: true, status: newStatus }
}

// ── cancelNfeDoc ──────────────────────────────────────────────────────────────

export async function cancelNfeDoc(
  docId: string,
  justificativa: string,
): Promise<{ ok: boolean; error?: string }> {
  const { admin, companyId } = await getServerContext()

  if (justificativa.trim().length < 15) {
    return { ok: false, error: 'Justificativa deve ter pelo menos 15 caracteres.' }
  }

  const { data: doc } = await admin
    .from('nfe_documents')
    .select('provider_ref, status')
    .eq('id', docId)
    .eq('company_id', companyId)
    .single()

  if (!doc?.provider_ref) return { ok: false, error: 'Documento sem referência no provider' }
  if (doc.status !== 'authorized') return { ok: false, error: 'Apenas NF-e autorizadas podem ser canceladas.' }

  try {
    await cancelarNfe(doc.provider_ref, justificativa)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Erro ao cancelar NF-e' }
  }

  await admin
    .from('nfe_documents')
    .update({ status: 'canceled' })
    .eq('id', docId)

  revalidatePath('/fiscal')
  return { ok: true }
}

// ── deleteNfeDoc ───────────────────────────────────────────────────────────────

export async function deleteNfeDoc(docId: string): Promise<{ ok: boolean; error?: string }> {
  const { admin, companyId } = await getServerContext()

  const { data: doc } = await admin
    .from('nfe_documents')
    .select('doc_type, status')
    .eq('id', docId)
    .eq('company_id', companyId)
    .single()

  if (!doc) return { ok: false, error: 'Documento não encontrado' }

  // Só permite excluir notas importadas ou rejeitadas — nunca autorizadas/processando
  if (doc.status === 'authorized' || doc.status === 'processing') {
    return { ok: false, error: 'Não é possível excluir uma NF-e autorizada ou em processamento.' }
  }

  const { error } = await admin
    .from('nfe_documents')
    .delete()
    .eq('id', docId)
    .eq('company_id', companyId)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/fiscal')
  return { ok: true }
}

// ── checkNfeEmissionFeature ───────────────────────────────────────────────────
export async function checkNfeEmissionFeature(): Promise<boolean> {
  const { companyId } = await getServerContext()
  return hasFeature(companyId, 'nfe.emission.enabled')
}
