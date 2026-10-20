'use client'
// apps/web/src/components/domain/fiscal/fiscal-config-form.tsx

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
  return (
    <h3 className="text-sm font-semibold text-foreground border-b pb-2 mb-4">{children}</h3>
  )
}

function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('grid gap-4', className)}>{children}</div>
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('pt-BR')
  } catch { return iso }
}

// ── Estado inicial ────────────────────────────────────────────────────────────

type FormState = {
  ambiente: '1' | '2'
  crt: '1' | '2' | '3'
  ie: string
  im: string
  cnae: string
  nome_fantasia: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  municipio: string
  uf: string
  cep: string
  cod_municipio: string
  telefone: string
  nat_op_venda: string
  csosn: string
  cfop_dentro_estado: string
  cfop_fora_estado: string
  ncm_padrao: string
  cest_padrao: string
  csc_id: string
  serie_nfe: string
  serie_nfce: string
  // certificado
  pfxBase64: string | null   // novo arquivo carregado, null = não alterar
  pfxSenha: string           // senha do arquivo novo
  csc_token: string          // novo CSC token
}

function dtoToForm(dto: FiscalConfigDTO): FormState {
  return {
    ambiente: String(dto.ambiente) as '1' | '2',
    crt: String(dto.crt) as '1' | '2' | '3',
    ie: dto.ie ?? '',
    im: dto.im ?? '',
    cnae: dto.cnae ?? '',
    nome_fantasia: dto.nome_fantasia ?? '',
    logradouro: dto.logradouro ?? '',
    numero: dto.numero ?? '',
    complemento: dto.complemento ?? '',
    bairro: dto.bairro ?? '',
    municipio: dto.municipio ?? '',
    uf: dto.uf ?? '',
    cep: dto.cep ?? '',
    cod_municipio: dto.cod_municipio ?? '',
    telefone: dto.telefone ?? '',
    nat_op_venda: dto.nat_op_venda,
    csosn: dto.csosn,
    cfop_dentro_estado: dto.cfop_dentro_estado,
    cfop_fora_estado: dto.cfop_fora_estado,
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

// ── Componente principal ──────────────────────────────────────────────────────

export function FiscalConfigForm() {
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [config, setConfig] = React.useState<FiscalConfigDTO | null>(null)
  const [form, setForm] = React.useState<FormState | null>(null)
  const [pfxFileName, setPfxFileName] = React.useState<string | null>(null)
  const [certInfo, setCertInfo] = React.useState<{
    cnpj: string | null; nomeTitular: string | null; validoAte: string
  } | null>(null)

  const pfxInputRef = React.useRef<HTMLInputElement>(null)

  // ── Carregamento inicial ──────────────────────────────────────────────────

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

  // ── Helpers de edição de form ─────────────────────────────────────────────

  const set = (field: keyof FormState, value: string) => {
    setForm(prev => prev ? { ...prev, [field]: value } : prev)
  }

  // ── Upload do certificado ─────────────────────────────────────────────────

  const handlePfxFile = (file: File) => {
    if (!file.name.endsWith('.pfx') && !file.name.endsWith('.p12')) {
      toast.error('Selecione um arquivo .pfx ou .p12')
      return
    }
    const reader = new FileReader()
    reader.onload = e => {
      const result = e.target?.result as string
      // FileReader.readAsDataURL retorna "data:...;base64,XXXXX" — extraímos só o base64
      const base64 = result.includes(',') ? result.split(',')[1] : result
      setForm(prev => prev ? { ...prev, pfxBase64: base64 } : prev)
      setPfxFileName(file.name)
    }
    reader.readAsDataURL(file)
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    setSaving(true)

    const payload: Record<string, unknown> = {
      ambiente: Number(form.ambiente),
      crt: Number(form.crt),
      ie: form.ie || null,
      im: form.im || null,
      cnae: form.cnae || null,
      nome_fantasia: form.nome_fantasia || null,
      logradouro: form.logradouro || null,
      numero: form.numero || null,
      complemento: form.complemento || null,
      bairro: form.bairro || null,
      municipio: form.municipio || null,
      uf: form.uf || null,
      cep: form.cep || null,
      cod_municipio: form.cod_municipio || null,
      telefone: form.telefone || null,
      nat_op_venda: form.nat_op_venda,
      csosn: form.csosn,
      cfop_dentro_estado: form.cfop_dentro_estado,
      cfop_fora_estado: form.cfop_fora_estado,
      ncm_padrao: form.ncm_padrao || null,
      cest_padrao: form.cest_padrao || null,
      csc_id: form.csc_id || null,
      serie_nfe: form.serie_nfe,
      serie_nfce: form.serie_nfce,
    }

    // Certificado: só envia se um novo arquivo foi carregado
    if (form.pfxBase64) {
      payload.certificado_pfx = form.pfxBase64
      payload.certificado_senha = form.pfxSenha
    }
    // CSC token: só envia se preenchido
    if (form.csc_token) {
      payload.csc_token = form.csc_token
    }

    const res = await saveFiscalConfig(payload)
    setSaving(false)

    if (res.ok) {
      toast.success('Configurações salvas com sucesso!')
      if (res.certInfo) setCertInfo(res.certInfo)
      // Limpa campos de certificado
      setForm(prev => prev ? { ...prev, pfxBase64: null, pfxSenha: '', csc_token: '' } : prev)
      setPfxFileName(null)
      if (pfxInputRef.current) pfxInputRef.current.value = ''
      // Recarrega para atualizar indicadores
      loadConfig()
    } else {
      toast.error(res.error ?? 'Erro ao salvar configurações')
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!form || !config) return null

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8 max-w-3xl">

      {/* ── Certificado Digital ─────────────────────────────────────────── */}
      <section>
        <SectionTitle>Certificado Digital (A1)</SectionTitle>

        {/* Status atual */}
        <div className={cn(
          'flex items-start gap-3 rounded-lg border p-4 mb-5 text-sm',
          config.certificado_configurado
            ? 'border-success/30 bg-success/5'
            : 'border-warning/30 bg-warning/5'
        )}>
          {config.certificado_configurado
            ? <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
            : <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
          }
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-foreground">
              {config.certificado_configurado ? 'Certificado configurado' : 'Nenhum certificado configurado'}
            </span>
            {certInfo && (
              <span className="text-xs text-muted-foreground">
                {certInfo.nomeTitular ?? ''}
                {certInfo.cnpj ? ` — CNPJ: ${certInfo.cnpj}` : ''}
                {' — válido até '}
                {fmtDate(certInfo.validoAte)}
              </span>
            )}
            {!certInfo && config.certificado_configurado && (
              <span className="text-xs text-muted-foreground">
                Faça upload novamente para ver os detalhes do certificado.
              </span>
            )}
          </div>
        </div>

        <Row className="grid-cols-1 md:grid-cols-[1fr_auto] items-end gap-3">
          {/* Área de upload */}
          <div
            onClick={() => pfxInputRef.current?.click()}
            className={cn(
              'flex items-center gap-3 rounded-lg border-2 border-dashed cursor-pointer px-4 py-3 transition-colors',
              pfxFileName
                ? 'border-primary/40 bg-primary/5'
                : 'border-border hover:border-primary/40 hover:bg-muted/40'
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Upload className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              {pfxFileName ? (
                <>
                  <p className="text-sm font-medium truncate">{pfxFileName}</p>
                  <p className="text-xs text-muted-foreground">Pronto para enviar</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">Clique para selecionar o certificado</p>
                  <p className="text-xs text-muted-foreground">Arquivo .pfx ou .p12 (A1)</p>
                </>
              )}
            </div>
          </div>

          <input
            ref={pfxInputRef}
            type="file"
            accept=".pfx,.p12"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handlePfxFile(file)
            }}
          />

          {/* Senha do certificado */}
          <FormField id="pfxSenha" label="Senha do certificado">
            <Input
              id="pfxSenha"
              type="password"
              autoComplete="off"
              placeholder={config.certificado_senha_configurada ? '••••••••' : 'Senha do arquivo .pfx'}
              value={form.pfxSenha}
              onChange={e => set('pfxSenha', e.target.value)}
              disabled={!form.pfxBase64}
            />
          </FormField>
        </Row>

        {form.pfxBase64 && !form.pfxSenha && (
          <p className="text-xs text-warning mt-2 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            Informe a senha do certificado para continuar.
          </p>
        )}

        {/* CSC (NFC-e) */}
        <Row className="grid-cols-1 md:grid-cols-2 mt-4">
          <FormField
            id="csc_id"
            label="CSC ID (NFC-e)"
            hint="Identificador do Código de Segurança do Contribuinte"
          >
            <Input
              id="csc_id"
              placeholder="Ex: 000001"
              value={form.csc_id}
              onChange={e => set('csc_id', e.target.value)}
            />
          </FormField>
          <FormField
            id="csc_token"
            label="CSC Token (NFC-e)"
            hint={config.csc_token_configurado ? 'Já configurado — preencha para substituir' : 'Código de Segurança do Contribuinte'}
          >
            <Input
              id="csc_token"
              type="password"
              autoComplete="off"
              placeholder={config.csc_token_configurado ? '••••••••' : 'Token fornecido pela SEFAZ'}
              value={form.csc_token}
              onChange={e => set('csc_token', e.target.value)}
            />
          </FormField>
        </Row>
      </section>

      {/* ── Ambiente & Regime ───────────────────────────────────────────── */}
      <section>
        <SectionTitle>Ambiente & Regime Tributário</SectionTitle>
        <Row className="grid-cols-1 md:grid-cols-2">
          <FormField id="ambiente" label="Ambiente SEFAZ">
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
          <FormField id="crt" label="Código de Regime Tributário (CRT)">
            <select
              id="crt"
              value={form.crt}
              onChange={e => set('crt', e.target.value as '1' | '2' | '3')}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="1">1 – Simples Nacional</option>
              <option value="2">2 – Simples Nacional – Excesso de sublimite</option>
              <option value="3">3 – Regime Normal</option>
            </select>
          </FormField>
        </Row>

        {form.ambiente === '1' && (
          <div className="flex items-center gap-2 mt-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              <strong>Atenção:</strong> Ambiente de Produção selecionado.
              As notas emitidas terão validade fiscal perante a SEFAZ.
            </span>
          </div>
        )}
      </section>

      {/* ── Dados Fiscais ───────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Dados Fiscais do Emitente</SectionTitle>
        <Row className="grid-cols-1 md:grid-cols-3">
          <FormField id="ie" label="Inscrição Estadual (IE)">
            <Input id="ie" placeholder="Sem IE" value={form.ie} onChange={e => set('ie', e.target.value)} />
          </FormField>
          <FormField id="im" label="Inscrição Municipal (IM)">
            <Input id="im" placeholder="Opcional" value={form.im} onChange={e => set('im', e.target.value)} />
          </FormField>
          <FormField id="cnae" label="CNAE Principal">
            <Input id="cnae" placeholder="0000-0/00" value={form.cnae} onChange={e => set('cnae', e.target.value)} />
          </FormField>
        </Row>
        <Row className="grid-cols-1 mt-4">
          <FormField id="nome_fantasia" label="Nome Fantasia">
            <Input id="nome_fantasia" placeholder="Igual à Razão Social se não houver" value={form.nome_fantasia} onChange={e => set('nome_fantasia', e.target.value)} />
          </FormField>
        </Row>
      </section>

      {/* ── Endereço Fiscal ─────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Endereço Fiscal</SectionTitle>
        <Row className="grid-cols-1 md:grid-cols-[1fr_auto_auto]">
          <FormField id="logradouro" label="Logradouro">
            <Input id="logradouro" placeholder="Rua, Av., Alameda…" value={form.logradouro} onChange={e => set('logradouro', e.target.value)} />
          </FormField>
          <FormField id="numero" label="Número">
            <Input id="numero" placeholder="S/N" value={form.numero} onChange={e => set('numero', e.target.value)} className="w-24" />
          </FormField>
          <FormField id="complemento" label="Complemento">
            <Input id="complemento" placeholder="Sala, Bloco…" value={form.complemento} onChange={e => set('complemento', e.target.value)} className="w-36" />
          </FormField>
        </Row>
        <Row className="grid-cols-1 md:grid-cols-3 mt-4">
          <FormField id="bairro" label="Bairro">
            <Input id="bairro" value={form.bairro} onChange={e => set('bairro', e.target.value)} />
          </FormField>
          <FormField id="municipio" label="Município">
            <Input id="municipio" value={form.municipio} onChange={e => set('municipio', e.target.value)} />
          </FormField>
          <FormField id="uf" label="UF">
            <select
              id="uf"
              value={form.uf}
              onChange={e => set('uf', e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Selecione</option>
              {['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'].map(uf => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </FormField>
        </Row>
        <Row className="grid-cols-1 md:grid-cols-3 mt-4">
          <FormField id="cep" label="CEP">
            <Input id="cep" placeholder="00000-000" value={form.cep} onChange={e => set('cep', e.target.value)} />
          </FormField>
          <FormField id="cod_municipio" label="Cód. Município (IBGE)">
            <Input id="cod_municipio" placeholder="7 dígitos" value={form.cod_municipio} onChange={e => set('cod_municipio', e.target.value)} />
          </FormField>
          <FormField id="telefone" label="Telefone">
            <Input id="telefone" placeholder="(11) 9 9999-9999" value={form.telefone} onChange={e => set('telefone', e.target.value)} />
          </FormField>
        </Row>
      </section>

      {/* ── Padrões Fiscais ─────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Padrões Fiscais</SectionTitle>
        <Row className="grid-cols-1 md:grid-cols-2">
          <FormField id="nat_op_venda" label="Natureza da Operação (Venda)">
            <Input id="nat_op_venda" value={form.nat_op_venda} onChange={e => set('nat_op_venda', e.target.value)} />
          </FormField>
          <FormField id="csosn" label="CSOSN padrão (Simples Nacional)">
            <Input id="csosn" placeholder="102" value={form.csosn} onChange={e => set('csosn', e.target.value)} />
          </FormField>
        </Row>
        <Row className="grid-cols-1 md:grid-cols-2 mt-4">
          <FormField id="cfop_dentro_estado" label="CFOP Dentro do Estado">
            <Input id="cfop_dentro_estado" placeholder="5102" value={form.cfop_dentro_estado} onChange={e => set('cfop_dentro_estado', e.target.value)} />
          </FormField>
          <FormField id="cfop_fora_estado" label="CFOP Fora do Estado">
            <Input id="cfop_fora_estado" placeholder="6102" value={form.cfop_fora_estado} onChange={e => set('cfop_fora_estado', e.target.value)} />
          </FormField>
        </Row>
        <Row className="grid-cols-1 md:grid-cols-2 mt-4">
          <FormField id="ncm_padrao" label="NCM padrão" hint="Código NCM aplicado quando o produto não tem NCM específico">
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
