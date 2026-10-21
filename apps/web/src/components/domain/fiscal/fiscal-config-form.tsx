'use client'
// apps/web/src/components/domain/fiscal/fiscal-config-form.tsx
// Configurações fiscais completas: certificado A1, dados do emitente, ambiente SEFAZ.

import * as React from 'react'
import { Upload, ShieldCheck, AlertTriangle, CheckCircle2, RefreshCw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { getFiscalConfig, saveFiscalConfig } from '@/lib/actions/fiscal-config'
import type { FiscalConfigDTO } from '@/lib/actions/fiscal-config'

// ── helpers ───────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-foreground border-b pb-2 mb-4">{children}</h3>
}

function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('grid gap-4', className)}>{children}</div>
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('pt-BR') } catch { return iso }
}

// ── Estado do form ────────────────────────────────────────────────────────────

type FormState = {
  // Dados do emitente
  ie: string
  im: string
  nome_fantasia: string
  crt: '1' | '3'
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  municipio: string
  uf: string
  cep: string
  cod_municipio: string
  telefone: string
  cnae: string
  cfop_dentro_estado: string
  cfop_fora_estado: string
  // Configurações de emissão
  ambiente: '1' | '2'
  nat_op_venda: string
  csosn: string
  ncm_padrao: string
  cest_padrao: string
  csc_id: string
  serie_nfe: string
  serie_nfce: string
  pfxBase64: string | null
  pfxSenha: string
  csc_token: string
}

function dtoToForm(dto: FiscalConfigDTO): FormState {
  return {
    // Emitente
    ie: dto.ie ?? '',
    im: dto.im ?? '',
    nome_fantasia: dto.nome_fantasia ?? '',
    crt: String(dto.crt ?? 1) as '1' | '3',
    logradouro: dto.logradouro ?? '',
    numero: dto.numero ?? '',
    complemento: dto.complemento ?? '',
    bairro: dto.bairro ?? '',
    municipio: dto.municipio ?? '',
    uf: dto.uf ?? '',
    cep: dto.cep ?? '',
    cod_municipio: dto.cod_municipio ?? '',
    telefone: dto.telefone ?? '',
    cnae: dto.cnae ?? '',
    cfop_dentro_estado: dto.cfop_dentro_estado ?? '5102',
    cfop_fora_estado: dto.cfop_fora_estado ?? '6102',
    // Emissão
    ambiente: String(dto.ambiente) as '1' | '2',
    nat_op_venda: dto.nat_op_venda,
    csosn: dto.csosn,
    ncm_padrao: dto.ncm_padrao ?? '',
    cest_padrao: dto.cest_padrao ?? '',
    csc_id: dto.csc_id ?? '',
    serie_nfe: dto.serie_nfe,
    serie_nfce: dto.serie_nfce,
    pfxBase64: null,
    pfxSenha: '',
    csc_token: '',
  }
}

// ── Props opcionais ───────────────────────────────────────────────────────────

interface FiscalConfigFormProps {
  onSaved?: () => void
}

// ── Componente ────────────────────────────────────────────────────────────────

export function FiscalConfigForm({ onSaved }: FiscalConfigFormProps) {
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [config, setConfig] = React.useState<FiscalConfigDTO | null>(null)
  const [form, setForm] = React.useState<FormState | null>(null)
  const [pfxFileName, setPfxFileName] = React.useState<string | null>(null)
  const [certInfo, setCertInfo] = React.useState<{
    cnpj: string | null; nomeTitular: string | null; validoAte: string
  } | null>(null)
  const pfxInputRef = React.useRef<HTMLInputElement>(null)

  const loadConfig = React.useCallback(async () => {
    setLoading(true)
    const res = await getFiscalConfig()
    if (res.ok && res.config) {
      setConfig(res.config)
      setForm(dtoToForm(res.config))
    } else {
      toast.error(res.error ?? 'Erro ao carregar configurações')
    }
    setLoading(false)
  }, [])

  React.useEffect(() => { loadConfig() }, [loadConfig])

  const set = (field: keyof FormState, value: string) =>
    setForm(prev => prev ? { ...prev, [field]: value } : prev)

  const handlePfxFile = (file: File) => {
    if (!file.name.endsWith('.pfx') && !file.name.endsWith('.p12')) {
      toast.error('Selecione um arquivo .pfx ou .p12'); return
    }
    const reader = new FileReader()
    reader.onload = e => {
      const result = e.target?.result as string
      const base64 = result.includes(',') ? (result.split(',')[1] ?? result) : result
      setForm(prev => prev ? { ...prev, pfxBase64: base64 } : prev)
      setPfxFileName(file.name)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    setSaving(true)

    const payload: Record<string, unknown> = {
      // Emitente
      ie: form.ie || null,
      im: form.im || null,
      nome_fantasia: form.nome_fantasia || null,
      crt: Number(form.crt),
      logradouro: form.logradouro || null,
      numero: form.numero || null,
      complemento: form.complemento || null,
      bairro: form.bairro || null,
      municipio: form.municipio || null,
      uf: form.uf || null,
      cep: form.cep || null,
      cod_municipio: form.cod_municipio || null,
      telefone: form.telefone || null,
      cnae: form.cnae || null,
      cfop_dentro_estado: form.cfop_dentro_estado || '5102',
      cfop_fora_estado: form.cfop_fora_estado || '6102',
      // Emissão
      ambiente: Number(form.ambiente),
      nat_op_venda: form.nat_op_venda,
      csosn: form.csosn,
      ncm_padrao: form.ncm_padrao || null,
      cest_padrao: form.cest_padrao || null,
      csc_id: form.csc_id || null,
      serie_nfe: form.serie_nfe,
      serie_nfce: form.serie_nfce,
    }
    if (form.pfxBase64) {
      payload.certificado_pfx = form.pfxBase64
      payload.certificado_senha = form.pfxSenha
    }
    if (form.csc_token) payload.csc_token = form.csc_token

    const res = await saveFiscalConfig(payload)
    setSaving(false)

    if (res.ok) {
      toast.success('Configurações salvas!')
      if (res.certInfo) setCertInfo(res.certInfo)
      setForm(prev => prev ? { ...prev, pfxBase64: null, pfxSenha: '', csc_token: '' } : prev)
      setPfxFileName(null)
      if (pfxInputRef.current) pfxInputRef.current.value = ''
      loadConfig()
      onSaved?.()
    } else {
      toast.error(res.error ?? 'Erro ao salvar')
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }
  if (!form || !config) return null

  const hasCert = config.certificado_configurado

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8 max-w-3xl">



      {/* ── Dados do Emitente ───────────────────────────────────────────── */}
      <section>
        <SectionTitle>Dados do Emitente (NF-e)</SectionTitle>
        <Row className="grid-cols-1 md:grid-cols-2">
          <FormField id="ie" label="Inscrição Estadual (IE) *" hint="Obrigatório para emitir NF-e. Use ISENTO se aplicável.">
            <Input id="ie" placeholder="Ex: 123456789012 ou ISENTO" value={form.ie} onChange={e => set('ie', e.target.value)} />
          </FormField>
          <FormField id="im" label="Inscrição Municipal (IM)" hint="Obrigatório para NFS-e (serviços)">
            <Input id="im" placeholder="Opcional" value={form.im} onChange={e => set('im', e.target.value)} />
          </FormField>
        </Row>
        <Row className="grid-cols-1 md:grid-cols-2 mt-4">
          <FormField id="nome_fantasia" label="Nome Fantasia">
            <Input id="nome_fantasia" placeholder="Nome fantasia (opcional)" value={form.nome_fantasia} onChange={e => set('nome_fantasia', e.target.value)} />
          </FormField>
          <FormField id="crt" label="Regime Tributário (CRT) *">
            <select
              id="crt"
              value={form.crt}
              onChange={e => set('crt', e.target.value as '1' | '3')}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="1">1 — Simples Nacional</option>
              <option value="3">3 — Lucro Real / Presumido</option>
            </select>
          </FormField>
        </Row>
        <Row className="grid-cols-1 md:grid-cols-3 mt-4">
          <FormField id="logradouro" label="Logradouro *" hint="Nome da rua / avenida">
            <Input id="logradouro" placeholder="Rua das Flores" value={form.logradouro} onChange={e => set('logradouro', e.target.value)} />
          </FormField>
          <FormField id="numero" label="Número *">
            <Input id="numero" placeholder="100" value={form.numero} onChange={e => set('numero', e.target.value)} />
          </FormField>
          <FormField id="complemento" label="Complemento">
            <Input id="complemento" placeholder="Sala 1 (opcional)" value={form.complemento} onChange={e => set('complemento', e.target.value)} />
          </FormField>
        </Row>
        <Row className="grid-cols-1 md:grid-cols-3 mt-4">
          <FormField id="bairro" label="Bairro *">
            <Input id="bairro" placeholder="Centro" value={form.bairro} onChange={e => set('bairro', e.target.value)} />
          </FormField>
          <FormField id="municipio" label="Município *">
            <Input id="municipio" placeholder="São Paulo" value={form.municipio} onChange={e => set('municipio', e.target.value)} />
          </FormField>
          <FormField id="uf" label="UF *">
            <select
              id="uf"
              value={form.uf}
              onChange={e => set('uf', e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Selecione…</option>
              {['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'].map(uf => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </FormField>
        </Row>
        <Row className="grid-cols-1 md:grid-cols-3 mt-4">
          <FormField id="cep" label="CEP *">
            <Input id="cep" placeholder="01310-100" value={form.cep} onChange={e => set('cep', e.target.value.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2'))} maxLength={9} />
          </FormField>
          <FormField id="cod_municipio" label="Código IBGE do Município *" hint="7 dígitos — consulte ibge.gov.br">
            <Input id="cod_municipio" placeholder="3550308" value={form.cod_municipio} onChange={e => set('cod_municipio', e.target.value.replace(/\D/g, '').slice(0, 7))} maxLength={7} />
          </FormField>
          <FormField id="telefone" label="Telefone">
            <Input id="telefone" placeholder="11999999999" value={form.telefone} onChange={e => set('telefone', e.target.value.replace(/\D/g, '').slice(0, 11))} maxLength={11} />
          </FormField>
        </Row>
        <Row className="grid-cols-1 md:grid-cols-3 mt-4">
          <FormField id="cfop_dentro_estado" label="CFOP dentro do estado" hint="Padrão: 5102">
            <Input id="cfop_dentro_estado" placeholder="5102" value={form.cfop_dentro_estado} onChange={e => set('cfop_dentro_estado', e.target.value)} />
          </FormField>
          <FormField id="cfop_fora_estado" label="CFOP fora do estado" hint="Padrão: 6102">
            <Input id="cfop_fora_estado" placeholder="6102" value={form.cfop_fora_estado} onChange={e => set('cfop_fora_estado', e.target.value)} />
          </FormField>
          <FormField id="cnae" label="CNAE" hint="Opcional">
            <Input id="cnae" placeholder="4751201" value={form.cnae} onChange={e => set('cnae', e.target.value.replace(/\D/g, '').slice(0, 7))} maxLength={7} />
          </FormField>
        </Row>
      </section>

      {/* ── Certificado Digital ─────────────────────────────────────────── */}
      <section>
        <SectionTitle>Certificado Digital A1</SectionTitle>

        {/* Status atual */}
        {hasCert && !certInfo && (
          <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-4 py-3 mb-4">
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-success">Certificado configurado</p>

            </div>
          </div>
        )}
        {certInfo && (
          <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-4 py-3 mb-4">
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-success">Certificado importado</p>
              {certInfo.nomeTitular && <p className="text-xs text-muted-foreground">{certInfo.nomeTitular}</p>}
              <p className="text-xs text-muted-foreground">Válido até {fmtDate(certInfo.validoAte)} · CNPJ {certInfo.cnpj ?? '—'}</p>
            </div>
          </div>
        )}
        {!hasCert && !certInfo && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/10 px-4 py-3 mb-4">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Nenhum certificado importado. Sem ele não é possível assinar e transmitir NF-e.
            </p>
          </div>
        )}

        {/* Upload */}
        <div
          onClick={() => pfxInputRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer py-8 px-6 text-center transition-colors',
            pfxFileName
              ? 'border-success/50 bg-success/5'
              : 'border-border hover:border-primary/50 hover:bg-muted/40'
          )}
        >
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', pfxFileName ? 'bg-success/10' : 'bg-muted')}>
            <Upload className={cn('h-4 w-4', pfxFileName ? 'text-success' : 'text-muted-foreground')} />
          </div>
          <div>
            <p className="text-sm font-medium">{pfxFileName ?? (hasCert ? 'Substituir certificado .pfx' : 'Carregar certificado .pfx')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Clique para selecionar — .pfx ou .p12</p>
          </div>
        </div>
        <input
          ref={pfxInputRef}
          type="file"
          accept=".pfx,.p12"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handlePfxFile(f) }}
        />

        {form.pfxBase64 && (
          <div className="mt-3">
            <FormField id="pfxSenha" label="Senha do certificado">
              <Input
                id="pfxSenha"
                type="password"
                placeholder="Senha do arquivo .pfx"
                value={form.pfxSenha}
                onChange={e => set('pfxSenha', e.target.value)}
                autoComplete="new-password"
              />
            </FormField>
          </div>
        )}

        <Row className="grid-cols-1 md:grid-cols-2 mt-4">
          <FormField id="csc_id" label="CSC ID (NFC-e)" hint="Código de Segurança do Contribuinte para QR Code">
            <Input id="csc_id" placeholder="Número do CSC" value={form.csc_id} onChange={e => set('csc_id', e.target.value)} />
          </FormField>
          <FormField id="csc_token" label="CSC Token (NFC-e)" hint="Deixe em branco para não alterar">
            <Input id="csc_token" type="password" placeholder={hasCert ? '••••••••' : 'Token do CSC'} value={form.csc_token} onChange={e => set('csc_token', e.target.value)} autoComplete="new-password" />
          </FormField>
        </Row>
      </section>

      {/* ── Ambiente SEFAZ ──────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Ambiente SEFAZ</SectionTitle>
        <Row className="grid-cols-1 md:grid-cols-2">
          <FormField id="ambiente" label="Ambiente">
            <select
              id="ambiente"
              value={form.ambiente}
              onChange={e => set('ambiente', e.target.value as '1' | '2')}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="2">Homologação (testes)</option>
              <option value="1">Produção</option>
            </select>
          </FormField>
        </Row>
        {form.ambiente === '1' && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Ambiente de produção — as notas emitidas terão validade fiscal real.
          </div>
        )}
      </section>

      {/* ── Padrões NF-e ────────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Padrões de Emissão</SectionTitle>
        <Row className="grid-cols-1 md:grid-cols-2">
          <FormField id="nat_op_venda" label="Natureza da Operação (Venda)">
            <Input id="nat_op_venda" value={form.nat_op_venda} onChange={e => set('nat_op_venda', e.target.value)} />
          </FormField>
          <FormField id="csosn" label="CSOSN padrão (Simples Nacional)">
            <Input id="csosn" placeholder="102" value={form.csosn} onChange={e => set('csosn', e.target.value)} />
          </FormField>
        </Row>
        <Row className="grid-cols-1 md:grid-cols-2 mt-4">
          <FormField id="ncm_padrao" label="NCM padrão" hint="Aplicado quando o produto não tem NCM específico">
            <Input id="ncm_padrao" placeholder="Ex: 84713012" value={form.ncm_padrao} onChange={e => set('ncm_padrao', e.target.value)} />
          </FormField>
          <FormField id="cest_padrao" label="CEST padrão" hint="Opcional — substituto tributário">
            <Input id="cest_padrao" placeholder="Ex: 2800300" value={form.cest_padrao} onChange={e => set('cest_padrao', e.target.value)} />
          </FormField>
        </Row>
      </section>

      {/* ── Numeração ───────────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Numeração</SectionTitle>
        <p className="text-xs text-muted-foreground mb-4">
          O próximo número emitido será o valor atual + 1. Altere apenas para corrigir sequências incorretas.
        </p>
        <Row className="grid-cols-2 md:grid-cols-4">
          <FormField id="serie_nfe" label="Série NF-e">
            <Input id="serie_nfe" value={form.serie_nfe} onChange={e => set('serie_nfe', e.target.value)} className="w-20" />
          </FormField>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Último nº NF-e</label>
            <div className="flex h-9 items-center px-3 rounded-md border bg-muted/40 text-sm text-muted-foreground font-mono">
              {config.ultimo_numero_nfe}
            </div>
          </div>
          <FormField id="serie_nfce" label="Série NFC-e">
            <Input id="serie_nfce" value={form.serie_nfce} onChange={e => set('serie_nfce', e.target.value)} className="w-20" />
          </FormField>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Último nº NFC-e</label>
            <div className="flex h-9 items-center px-3 rounded-md border bg-muted/40 text-sm text-muted-foreground font-mono">
              {config.ultimo_numero_nfce}
            </div>
          </div>
        </Row>
      </section>

      {/* ── Ações ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2 border-t">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          Certificado e tokens são criptografados no banco de dados
        </div>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={saving || (!!form.pfxBase64 && !form.pfxSenha)}
        >
          {saving ? (
            <><RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />Salvando…</>
          ) : (
            <><Save className="h-3.5 w-3.5 mr-2" />Salvar Configurações</>
          )}
        </Button>
      </div>
    </form>
  )
}
