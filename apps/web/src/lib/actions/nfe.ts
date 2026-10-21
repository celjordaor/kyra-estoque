'use server'
// apps/web/src/lib/actions/nfe.ts
// NF-e server actions — integração direta SEFAZ (sem intermediário por CNPJ).
// Emissão: certificado A1 + xml-crypto + mTLS.
// Import: XML livre (sem provider externo).

import { cookies } from 'next/headers'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'
import { hasFeature } from '@kyra/business-rules'
import { revalidatePath } from 'next/cache'
import { parseNfeXml } from '@/lib/nfe/xml-parser'
import { lerCertificadoPFX, CertificadoError } from '@/lib/fiscal/certificado'
import { assinarNFe, AssinaturaError } from '@/lib/fiscal/assinatura'
import { enviarNFeParaSefaz } from '@/lib/fiscal/sefaz'
import { reservarNumeroNfe } from '@/lib/fiscal/numeracao'

// ── Context ───────────────────────────────────────────────────────────────────

async function getServerContext() {
  const cookieStore = await cookies()
  const supabase = createServerSupabaseClient(cookieStore)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Não autenticado')
  const admin = createAdminSupabaseClient()
  const { data: profileData } = await (admin as any)
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()
  const profile = profileData as { company_id: string | null } | null
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
  modelo: string | null
  pdfUrl: string | null
  saleId: string | null
  purchaseId: string | null
  createdAt: string
}

export interface EmitNfeInput {
  saleId: string
}

// ── getNfeDocuments ───────────────────────────────────────────────────────────

export async function getNfeDocuments(filter?: {
  docType?: 'import' | 'emission'
  status?: string
  modelo?: '55' | '65'
  limit?: number
}): Promise<{ docs: NfeDocument[]; hasFeatureImport: boolean; hasFeatureEmission: boolean }> {
  const { admin, companyId } = await getServerContext()

  const [hasImport, hasEmission] = await Promise.all([
    hasFeature(companyId, 'nfe.import.enabled'),
    hasFeature(companyId, 'nfe.emission.enabled'),
  ])

  let query = (admin as any)
    .from('nfe_documents')
    .select(`
      id, doc_type, modelo, chave_acesso, numero, serie, data_emissao,
      emitente_cnpj, emitente_nome, destinatario_cnpj, destinatario_nome,
      valor_total_cents, status, pdf_url, sale_id, purchase_id, created_at
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (filter?.docType) query = query.eq('doc_type', filter.docType)
  if (filter?.status)  query = query.eq('status', filter.status)
  if (filter?.modelo)  query = query.eq('modelo', filter.modelo)
  query = query.limit(filter?.limit ?? 100)

  const { data } = await query

  const docs: NfeDocument[] = (data ?? []).map((d: any) => ({
    id:               d.id,
    docType:          d.doc_type as 'import'|'emission',
    modelo:           d.modelo ?? null,
    chaveAcesso:      d.chave_acesso,
    numero:           d.numero,
    serie:            d.serie,
    dataEmissao:      d.data_emissao,
    emitenteCnpj:     d.emitente_cnpj,
    emitenteNome:     d.emitente_nome,
    destinatarioCnpj: d.destinatario_cnpj,
    destinatarioNome: d.destinatario_nome,
    valorTotalCents:  d.valor_total_cents,
    status:           d.status,
    pdfUrl:           d.pdf_url,
    saleId:           d.sale_id,
    purchaseId:       d.purchase_id,
    createdAt:        d.created_at,
  }))

  return { docs, hasFeatureImport: hasImport, hasFeatureEmission: hasEmission }
}

// ── importXml ─────────────────────────────────────────────────────────────────

export async function importXml(
  xmlContent: string,
): Promise<{ ok: boolean; error?: string; docId?: string }> {
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

  if (parsed.chaveAcesso) {
    const { data: existing } = await (admin as any)
      .from('nfe_documents')
      .select('id')
      .eq('chave_acesso', parsed.chaveAcesso)
      .single()
    if (existing) return { ok: false, error: 'Esta NF-e já foi importada anteriormente.' }
  }

  const { data, error } = await (admin as any)
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
  return { ok: true, docId: data.id }
}

// ── emitNfe — integração direta SEFAZ ────────────────────────────────────────

export async function emitNfe(input: EmitNfeInput): Promise<{ ok: boolean; error?: string; docId?: string }> {
  const { admin, companyId } = await getServerContext()

  if (!(await hasFeature(companyId, 'nfe.emission.enabled'))) {
    return { ok: false, error: 'Seu plano não permite emitir NF-e. Faça upgrade para Impulsiona ou Escala.' }
  }

  // ── 1. Carregar configuração fiscal ────────────────────────────────────────
  const { data: cfg, error: cfgErr } = await (admin as any)
    .from('fiscal_config')
    .select('*')
    .eq('company_id', companyId)
    .single()

  if (cfgErr || !cfg) {
    return { ok: false, error: 'Configuração fiscal não encontrada. Configure em Fiscal → Configurações antes de emitir.' }
  }

  // ── 2. Validar pré-requisitos ───────────────────────────────────────────────
  const erros: string[] = []
  if (!cfg.certificado_pfx) erros.push('Certificado A1 não configurado')
  if (!cfg.certificado_senha) erros.push('Senha do certificado não configurada')
  if (!cfg.ie) erros.push('Inscrição Estadual (IE) não configurada')
  if (!cfg.uf) erros.push('UF do emitente não configurada')
  if (!cfg.municipio) erros.push('Município do emitente não configurado')
  if (!cfg.cod_municipio) erros.push('Código IBGE do município não configurado')
  if (erros.length > 0) {
    return { ok: false, error: `Configure em Fiscal → Configurações: ${erros.join(', ')}.` }
  }

  // ── 3. Verificar nota duplicada ─────────────────────────────────────────────
  const { data: existingNfe } = await (admin as any)
    .from('nfe_documents')
    .select('id, status')
    .eq('sale_id', input.saleId)
    .eq('company_id', companyId)
    .eq('doc_type', 'emission')
    .in('status', ['authorized', 'processing', 'pending'])
    .single()

  if (existingNfe) {
    return { ok: false, error: `Já existe uma NF-e ${existingNfe.status} para esta venda (id: ${existingNfe.id}).` }
  }

  // ── 4. Carregar certificado ─────────────────────────────────────────────────
  let certPem: string
  let keyPem: string
  try {
    const info = lerCertificadoPFX(cfg.certificado_pfx, cfg.certificado_senha)
    certPem = info.certPem
    keyPem  = info.privateKeyPem
  } catch (e) {
    return { ok: false, error: e instanceof CertificadoError ? e.message : 'Erro ao carregar certificado.' }
  }

  // ── 5. Carregar dados da venda e empresa ────────────────────────────────────
  const [saleRes, companyRes] = await Promise.all([
    (admin as any).from('sales').select(`
      id, total_amount, customer_name, customer_email,
      sale_items (
        product_id, product_name, quantity, unit_price, total_price,
        products!sale_items_product_id_fkey ( ncm, cfop )
      )
    `).eq('id', input.saleId).eq('company_id', companyId).single(),
    (admin as any).from('companies').select('name, document, phone').eq('id', companyId).single(),
  ])

  if (saleRes.error || !saleRes.data) {
    return { ok: false, error: `Venda não encontrada: ${saleRes.error?.message ?? ''}` }
  }
  if (!companyRes.data?.document) {
    return { ok: false, error: 'CNPJ da empresa não cadastrado. Configure em Configurações → Empresa.' }
  }

  const sale = saleRes.data as Record<string, any>
  const company = companyRes.data as Record<string, any>
  const items = (sale.sale_items ?? []) as Array<Record<string, any>>

  // ── 6. Reservar número ─────────────────────────────────────────────────────
  let numReservado: Awaited<ReturnType<typeof reservarNumeroNfe>>
  try {
    numReservado = await reservarNumeroNfe(admin as any, companyId)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao reservar número da nota.' }
  }

  // ── 7. Montar emissor ──────────────────────────────────────────────────────
  const emissor = {
    cnpj:           String(company.document),
    razao_social:   company.name,
    nome_fantasia:  cfg.nome_fantasia || company.name,
    ie:             cfg.ie,
    crt:            Number(cfg.crt ?? 1),
    logradouro:     cfg.logradouro ?? '',
    numero:         cfg.numero ?? 'SN',
    bairro:         cfg.bairro ?? '',
    municipio:      cfg.municipio,
    cod_municipio:  cfg.cod_municipio,
    uf:             cfg.uf,
    cep:            cfg.cep ?? '',
    telefone:       cfg.telefone ?? company.phone ?? '',
    nat_op:         cfg.nat_op_venda ?? 'Venda de mercadoria',
    csosn:          cfg.csosn ?? '102',
    cfop_dentro:    cfg.cfop_dentro_estado ?? '5102',
    cfop_fora:      cfg.cfop_fora_estado ?? '6102',
    csc_id:         cfg.csc_id ?? '',
    csc_token:      cfg.csc_token ?? '',
    serie:          Number(numReservado.serie),
    numero_nf:      numReservado.numero,
    ambiente:       Number(cfg.ambiente ?? 2) as 1|2,
  }

  // ── 8. Montar itens NF-e ──────────────────────────────────────────────────
  const { gerarXMLNFCe, mapFormaParaTpPag } = await import('@/lib/fiscal/nfce')
  const itens = items.map((item) => {
    const prod = item.products as any
    return {
      codigo:      String(item.product_id ?? 'ITEM').slice(0, 60),
      descricao:   String(item.product_name ?? 'Produto').slice(0, 120),
      ncm:         String(prod?.ncm ?? cfg.ncm_padrao ?? '00000000').replace(/\D/g, '').slice(0, 8).padEnd(8, '0'),
      cfop:        String(prod?.cfop ?? cfg.cfop_dentro_estado ?? '5102'),
      unidade:     'UN',
      quantidade:  Number(item.quantity ?? 1),
      valor_unit:  Number(item.unit_price ?? 0),
      valor_total: Number(item.total_price ?? (Number(item.quantity ?? 1) * Number(item.unit_price ?? 0))),
    }
  })

  const pagamentos = [{ tipo: mapFormaParaTpPag('dinheiro'), valor: Number(sale.total_amount ?? 0) }]
  const destinatario = sale.customer_name ? { nome: sale.customer_name, email: sale.customer_email ?? undefined } : undefined

  const data = new Date()
  const { xml, chave } = gerarXMLNFCe({ emissor, destinatario, itens, pagamentos, data })

  // ── 9. Assinar XML ────────────────────────────────────────────────────────
  let xmlAssinado: string
  try {
    xmlAssinado = assinarNFe(xml, keyPem, certPem)
  } catch (e) {
    return { ok: false, error: e instanceof AssinaturaError ? e.message : 'Erro ao assinar NF-e.' }
  }

  // ── 10. Registrar como 'pending' ANTES de enviar ─────────────────────────
  const { data: docInserted, error: insertErr } = await (admin as any)
    .from('nfe_documents')
    .insert({
      company_id:        companyId,
      doc_type:          'emission',
      status:            'pending',
      modelo:            '55',
      chave_acesso:      chave,
      numero:            String(numReservado.numero),
      serie:             numReservado.serie,
      data_emissao:      (data.toISOString().split('T')[0] ?? data.toISOString().slice(0, 10)),
      emitente_cnpj:     String(company.document),
      emitente_nome:     company.name,
      emitente_uf:       cfg.uf,
      destinatario_nome: sale.customer_name ?? null,
      valor_total_cents: Math.round(Number(sale.total_amount ?? 0) * 100),
      sale_id:           input.saleId,
      xml_content:       xmlAssinado,
      items:             JSON.stringify(itens),
    })
    .select('id')
    .single()

  if (insertErr || !docInserted) {
    return { ok: false, error: `Falha ao registrar nota (antes de enviar): ${insertErr?.message}` }
  }

  const docId = docInserted.id

  // ── 11. Enviar para SEFAZ ─────────────────────────────────────────────────
  let resultado: Awaited<ReturnType<typeof enviarNFeParaSefaz>>
  try {
    resultado = await enviarNFeParaSefaz({
      nfeXmlAssinado: xmlAssinado,
      uf: emissor.uf,
      ambiente: emissor.ambiente,
      certPem,
      keyPem,
    })
  } catch (e) {
    // Falha de rede: nota ficou 'pending', pode ser consultada/reenvida
    await (admin as any)
      .from('nfe_documents')
      .update({ provider_msg: e instanceof Error ? e.message : String(e) })
      .eq('id', docId)
    return { ok: false, error: `Falha de comunicação com a SEFAZ: ${e instanceof Error ? e.message : e}`, docId }
  }

  // ── 12. Atualizar nota com resultado ──────────────────────────────────────
  const novoStatus = resultado.autorizada ? 'authorized'
    : resultado.emProcessamento ? 'processing'
    : 'rejected'

  await (admin as any)
    .from('nfe_documents')
    .update({
      status:           novoStatus,
      provider_protocol: resultado.protocolo ?? null,
      provider_msg:     resultado.xMotivo,
      xml_content:      resultado.nfeProc ?? xmlAssinado,
    })
    .eq('id', docId)

  revalidatePath('/fiscal')
  revalidatePath('/sales')

  if (!resultado.autorizada) {
    return {
      ok: false,
      error: `SEFAZ rejeitou a nota (${resultado.cStat}): ${resultado.xMotivo}`,
      docId,
    }
  }

  return { ok: true, docId }
}

// ── syncNfeStatus ─────────────────────────────────────────────────────────────
// Notas 'pending'/'processing' sem protocolo: tenta consultar de novo.
// Sem provider externo — apenas verifica no DB se foi atualizada.

export async function syncNfeStatus(docId: string): Promise<{ ok: boolean; status?: string; error?: string }> {
  const { admin, companyId } = await getServerContext()

  const { data: doc } = await (admin as any)
    .from('nfe_documents')
    .select('status, provider_protocol, chave_acesso')
    .eq('id', docId)
    .eq('company_id', companyId)
    .single()

  if (!doc) return { ok: false, error: 'Documento não encontrado.' }
  if (doc.status === 'authorized' || doc.status === 'canceled' || doc.status === 'import') {
    return { ok: true, status: doc.status }
  }

  // Na integração direta não há polling externo — o status 'processing' deve ser
  // resolvido no momento do envio (loop de recibo em sefaz.ts). Retorna status atual.
  return { ok: true, status: doc.status }
}

// ── cancelNfeDoc ──────────────────────────────────────────────────────────────
// Cancelamento de NF-e: exige integração SEFAZ separada (NFeStatusServico4/NFeRecepcaoEvento4).
// Por ora marca como cancelada localmente — implementar webservice de cancelamento em seguida.

export async function cancelNfeDoc(
  docId: string,
  justificativa: string,
): Promise<{ ok: boolean; error?: string }> {
  const { admin, companyId } = await getServerContext()

  if (justificativa.trim().length < 15) {
    return { ok: false, error: 'Justificativa deve ter pelo menos 15 caracteres.' }
  }

  const { data: doc } = await (admin as any)
    .from('nfe_documents')
    .select('status, chave_acesso, xml_content')
    .eq('id', docId)
    .eq('company_id', companyId)
    .single()

  if (!doc) return { ok: false, error: 'Documento não encontrado.' }
  if (doc.status !== 'authorized') return { ok: false, error: 'Apenas NF-e autorizadas podem ser canceladas.' }

  // TODO: implementar evento de cancelamento via SEFAZ (NFeRecepcaoEvento4)
  // Por enquanto, marca cancelada localmente para não bloquear o fluxo.
  await (admin as any)
    .from('nfe_documents')
    .update({ status: 'canceled', provider_msg: `Cancelamento solicitado: ${justificativa}` })
    .eq('id', docId)

  revalidatePath('/fiscal')
  return { ok: true }
}

// ── deleteNfeDoc ───────────────────────────────────────────────────────────────

export async function deleteNfeDoc(docId: string): Promise<{ ok: boolean; error?: string }> {
  const { admin, companyId } = await getServerContext()

  const { data: doc } = await (admin as any)
    .from('nfe_documents')
    .select('doc_type, status')
    .eq('id', docId)
    .eq('company_id', companyId)
    .single()

  if (!doc) return { ok: false, error: 'Documento não encontrado.' }
  if (doc.status === 'authorized' || doc.status === 'processing') {
    return { ok: false, error: 'Não é possível excluir uma NF-e autorizada ou em processamento.' }
  }

  const { error } = await (admin as any)
    .from('nfe_documents')
    .delete()
    .eq('id', docId)
    .eq('company_id', companyId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/fiscal')
  return { ok: true }
}

export async function checkNfeEmissionFeature(): Promise<boolean> {
  const { companyId } = await getServerContext()
  return hasFeature(companyId, 'nfe.emission.enabled')
}
