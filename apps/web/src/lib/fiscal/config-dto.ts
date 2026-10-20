// apps/web/src/lib/fiscal/config-dto.ts
// DTO helpers para fiscal_config — secrets mascarados, campos editáveis,
// aliases e derivações. Adaptado de Kyra Lovi para Kyra Estoque (company_id).

export const SECRET_PLACEHOLDER = '***CONFIGURADO***'

export const FISCAL_CONFIG_SECRET_FIELDS = [
  'certificado_pfx',
  'certificado_senha',
  'csc_token',
] as const
type SecretField = (typeof FISCAL_CONFIG_SECRET_FIELDS)[number]

const TEXT_FIELDS = [
  'ie','im','cnae','nome_fantasia','logradouro','numero','complemento','bairro',
  'municipio','uf','cep','cod_municipio','telefone','nat_op_venda','csosn',
  'cfop_dentro_estado','cfop_fora_estado','ncm_padrao','cest_padrao','csc_id',
] as const

const SERIE_FIELDS = ['serie_nfe','serie_nfce'] as const

const COUNTER_FIELDS: Record<string, string> = {
  ultimo_numero_nfe:  'ultimo_numero_nfe',
  ultimo_numero_nfce: 'ultimo_numero_nfce',
}

type Row = Record<string, unknown>

export function isSecretPlaceholder(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value !== 'string') return false
  const v = value.trim()
  return v === '' || v === SECRET_PLACEHOLDER || /^\*+$/.test(v)
}

export function maskFiscalConfig(row: Row): Row {
  const out: Row = { ...row }
  const configured: Record<SecretField, boolean> = {
    certificado_pfx:   !!row.certificado_pfx,
    certificado_senha: !!row.certificado_senha,
    csc_token:         !!row.csc_token,
  }
  for (const f of FISCAL_CONFIG_SECRET_FIELDS) {
    out[f] = configured[f] ? SECRET_PLACEHOLDER : null
  }
  out.certificado_configurado       = configured.certificado_pfx
  out.certificado_senha_configurada = configured.certificado_senha
  out.csc_token_configurado         = configured.csc_token
  return out
}

export type FiscalConfigUpdate =
  | { ok: true; update: Record<string, unknown> }
  | { ok: false; error: string }

export function buildFiscalConfigUpdate(body: unknown): FiscalConfigUpdate {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Corpo inválido.' }
  const b = body as Row
  const update: Record<string, unknown> = {}

  // ambiente + crt: direto (são colunas reais na Estoque)
  if (b.ambiente !== undefined && b.ambiente !== null) {
    const a = Number(b.ambiente)
    if (a !== 1 && a !== 2) return { ok: false, error: 'Ambiente inválido (1=produção, 2=homologação).' }
    update.ambiente = a
  }
  if (b.crt !== undefined && b.crt !== null) {
    const c = Number(b.crt)
    if (c !== 1 && c !== 3) return { ok: false, error: 'CRT inválido (1=Simples, 3=Normal).' }
    update.crt = c
  }

  for (const f of TEXT_FIELDS) {
    const v = b[f]
    if (v === undefined || v === null) continue
    if (typeof v !== 'string') return { ok: false, error: `Valor inválido para ${f}.` }
    update[f] = v.trim()
  }

  for (const f of SERIE_FIELDS) {
    const v = b[f]
    if (v === undefined || v === null) continue
    const s = String(v).trim()
    if (!/^\d{1,3}$/.test(s) || Number(s) < 1) return { ok: false, error: `Série inválida (${f}).` }
    update[f] = String(Number(s))
  }

  for (const [dto, column] of Object.entries(COUNTER_FIELDS)) {
    const v = b[dto]
    if (v === undefined || v === null) continue
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 999_999_999) {
      return { ok: false, error: `Numeração inválida (${dto}).` }
    }
    update[column] = v
  }

  for (const f of FISCAL_CONFIG_SECRET_FIELDS) {
    if (!isSecretPlaceholder(b[f])) {
      if (typeof b[f] !== 'string') return { ok: false, error: `Valor inválido para ${f}.` }
      update[f] = b[f]
    }
  }
  if (update.certificado_pfx !== undefined && update.certificado_senha === undefined) {
    return { ok: false, error: 'Informe a senha do certificado ao importar um novo PFX.' }
  }

  return { ok: true, update }
}
