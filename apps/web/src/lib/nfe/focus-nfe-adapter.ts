// ── Focus NFe Adapter — Sprint 19b ───────────────────────────────────────────
// Provider: Focus NFe (https://focusnfe.com.br)
// Docs: https://focusnfe.com.br/doc/
// Auth: HTTP Basic Auth com token no username (senha vazia)

const FOCUS_BASE_URL = process.env.FOCUS_NFE_BASE_URL
  ?? 'https://homologacao.focusnfe.com.br'   // Homologação (dev)
  // 'https://api.focusnfe.com.br'           // Produção

const FOCUS_TOKEN = process.env.FOCUS_NFE_TOKEN ?? ''

// ── Tipos Focus NFe ───────────────────────────────────────────────────────────

export interface FocusNfeItem {
  numero_item: number
  codigo_produto: string
  descricao: string
  cfop: string
  unidade_comercial: string
  quantidade_comercial: number
  valor_unitario_comercial: number
  valor_bruto: number
  codigo_ncm: string
  /** CST ou CSOSN conforme regime tributário */
  icms_situacao_tributaria: string
  icms_aliquota?: number
  icms_base_calculo?: number
  icms_valor?: number
  pis_situacao_tributaria: string
  cofins_situacao_tributaria: string
}

export interface FocusNfePayload {
  /** Referência única da nota (ex: venda-{id}) */
  ref: string
  natureza_operacao: string
  /** 1=NF-e 65=NFC-e */
  tipo_documento?: number
  /** 1=Saída 0=Entrada */
  tipo_operacao?: number
  data_emissao: string          // ISO 8601
  data_saida_entrada: string    // ISO 8601
  /** 1=Normal 2=Complementar 3=Ajuste 4=Devolução */
  finalidade_emissao?: number
  /** 1=à vista 2=a prazo 3=outros */
  forma_pagamento?: number
  /** 0=à vista 1=a prazo 2=outros */
  indicador_pagamento?: number

  // Emitente (da empresa, vem do kyra_config)
  cnpj_emitente: string
  nome_emitente: string
  nome_fantasia_emitente?: string
  logradouro_emitente: string
  numero_emitente: string
  bairro_emitente: string
  municipio_emitente: string
  uf_emitente: string
  cep_emitente: string
  ie_emitente: string
  /** 1=Simples Nacional 2=Simples Nacional Excesso 3=Regime Normal */
  regime_tributario_emitente: number

  // Destinatário
  nome_destinatario: string
  cnpj_destinatario?: string
  cpf_destinatario?: string
  email_destinatario?: string
  logradouro_destinatario?: string
  numero_destinatario?: string
  bairro_destinatario?: string
  municipio_destinatario?: string
  uf_destinatario?: string
  cep_destinatario?: string
  ie_destinatario?: string
  /** 9=Não contribuinte 1=Contribuinte */
  indicador_ie_destinatario?: number

  items: FocusNfeItem[]

  // Pagamento
  formas_pagamento?: Array<{
    forma_pagamento: string  // '01'=Dinheiro '03'=Cartão Crédito '04'=Cartão Débito '99'=Outros
    valor_pagamento: number
  }>
}

export interface FocusNfeResponse {
  ref?: string
  status?: string         // 'processando_autorizacao' | 'autorizado' | 'erro_autorizacao' | 'cancelado'
  status_sefaz?: string
  mensagem_sefaz?: string
  chave_nfe?: string
  numero?: string
  serie?: string
  caminho_danfe?: string  // URL do DANFE
  caminho_xml?: string    // URL do XML autorizado
  protocolo?: string
  erros?: Array<{ codigo: string; mensagem: string; campo?: string }>
}

// ── Funções públicas ──────────────────────────────────────────────────────────

function focusAuth(): string {
  return `Basic ${Buffer.from(`${FOCUS_TOKEN}:`).toString('base64')}`
}

async function focusFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${FOCUS_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: focusAuth(),
      ...options.headers,
    },
  })
  const data = await res.json()
  if (!res.ok) {
    const msgs = (data as FocusNfeResponse).erros?.map(e => e.mensagem).join('; ')
    throw new Error(msgs ?? `Focus NFe API ${res.status}`)
  }
  return data as T
}

/** Emite uma NF-e. Retorna ref e status inicial. */
export async function emitirNfe(payload: FocusNfePayload): Promise<FocusNfeResponse> {
  if (!FOCUS_TOKEN) {
    throw new Error('Token Focus NFe não configurado. Adicione FOCUS_NFE_TOKEN no .env.local e reinicie o servidor.')
  }
  return focusFetch<FocusNfeResponse>('/v2/nfe', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** Consulta o status de uma NF-e pela ref. */
export async function consultarNfe(ref: string): Promise<FocusNfeResponse> {
  return focusFetch<FocusNfeResponse>(`/v2/nfe/${encodeURIComponent(ref)}`)
}

/** Cancela uma NF-e autorizada. */
export async function cancelarNfe(ref: string, justificativa: string): Promise<FocusNfeResponse> {
  return focusFetch<FocusNfeResponse>(`/v2/nfe/${encodeURIComponent(ref)}`, {
    method: 'DELETE',
    body: JSON.stringify({ justificativa }),
  })
}

/** Retorna URL do DANFE (PDF) para download. */
export function getDanfeUrl(ref: string): string {
  return `${FOCUS_BASE_URL}/v2/nfe/${encodeURIComponent(ref)}/danfe?token=${FOCUS_TOKEN}`
}

/** Retorna URL do XML autorizado para download. */
export function getXmlUrl(ref: string): string {
  return `${FOCUS_BASE_URL}/v2/nfe/${encodeURIComponent(ref)}/xml?token=${FOCUS_TOKEN}`
}

// ── Mapeamento de status Focus → Kyra ────────────────────────────────────────

export function mapFocusStatus(
  focusStatus: string,
): 'pending' | 'processing' | 'authorized' | 'rejected' | 'canceled' {
  switch (focusStatus) {
    case 'autorizado':                  return 'authorized'
    case 'cancelado':                   return 'canceled'
    case 'erro_autorizacao':
    case 'denegado':                    return 'rejected'
    case 'processando_autorizacao':
    default:                            return 'processing'
  }
}
