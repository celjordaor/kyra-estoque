'use client'

import * as React from 'react'
import {
  FileText, Upload, RefreshCw, XCircle, Download, Trash2,
  CheckCircle2, Clock, AlertTriangle, Lock, X,
  Shield, ShieldAlert, Settings, ReceiptText, ArrowLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  getNfeDocuments, importXml, syncNfeStatus, cancelNfeDoc, deleteNfeDoc,
} from '@/lib/actions/nfe'
import type { NfeDocument } from '@/lib/actions/nfe'
import { getFiscalConfig } from '@/lib/actions/fiscal-config'
import type { FiscalConfigDTO } from '@/lib/actions/fiscal-config'
import { FiscalConfigForm } from '@/components/domain/fiscal/fiscal-config-form'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(cents: number | null) {
  if (cents == null) return '—'
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(dateStr: string | null) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function fmtChave(chave: string | null) {
  if (!chave) return '—'
  return `${chave.slice(0, 8)}…${chave.slice(-6)}`
}

const STATUS_MAP: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  authorized: { label: 'Autorizada',  cls: 'bg-success/10 text-success', Icon: CheckCircle2 },
  processing: { label: 'Processando', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', Icon: Clock },
  pending:    { label: 'Pendente',    cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', Icon: Clock },
  rejected:   { label: 'Rejeitada',  cls: 'bg-danger/10 text-danger', Icon: AlertTriangle },
  canceled:   { label: 'Cancelada',  cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', Icon: XCircle },
  import:     { label: 'Importada',  cls: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', Icon: Upload },
}

function NfeStatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600', Icon: Clock }
  const Icon = s.Icon
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium', s.cls)}>
      <Icon className="h-3 w-3" />{s.label}
    </span>
  )
}

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <tbody>
      {Array.from({ length: 4 }).map((_, i) => (
        <tr key={i} className="border-b">
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className="px-3 py-2.5"><div className="h-4 bg-muted animate-pulse rounded" /></td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}

function UpgradeNotice({ feature }: { feature: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Lock className="h-10 w-10 text-muted-foreground" />
      <p className="text-base font-semibold">Recurso não disponível no seu plano</p>
      <p className="text-sm text-muted-foreground max-w-xs">{feature} está disponível nos planos Impulsiona e Escala.</p>
      <Button variant="primary" size="sm" onClick={() => toast.info('Acesse Configurações → Plano para fazer upgrade.')}>Ver planos</Button>
    </div>
  )
}

// ── DocsTab ───────────────────────────────────────────────────────────────────

function DocsTab({ hasFeature, docType }: { hasFeature: boolean; docType?: 'emission' | 'import' }) {
  const [docs, setDocs] = React.useState<NfeDocument[]>([])
  const [loading, setLoading] = React.useState(true)
  const [syncing, setSyncing] = React.useState<string | null>(null)
  const [cancelDialog, setCancelDialog] = React.useState<{ id: string; numero: string } | null>(null)
  const [cancelText, setCancelText] = React.useState('')
  const [canceling, setCanceling] = React.useState(false)
  const [deleting, setDeleting] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    const res = await getNfeDocuments({ docType })
    setDocs(res.docs); setLoading(false)
  }, [docType])

  React.useEffect(() => { load() }, [load])

  if (!hasFeature) return <UpgradeNotice feature="Consulta e emissão de NF-e" />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', loading && 'animate-spin')} />Atualizar
        </Button>
      </div>
      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {['Tipo','Nº / Série','Chave de Acesso','Emissão','Emitente','Valor','Status','Ações'].map(h => (
                  <th key={h} className={cn('px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide', h === 'Valor' || h === 'Ações' ? 'text-right' : 'text-left')}>{h}</th>
                ))}
              </tr>
            </thead>
            {loading ? <SkeletonRows cols={8} /> : (
              <tbody>
                {docs.length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-16 text-center text-muted-foreground text-sm">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />Nenhum documento encontrado
                  </td></tr>
                )}
                {docs.map(doc => (
                  <tr key={doc.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2.5">
                      <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium',
                        doc.docType === 'import' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400')}>
                        {doc.docType === 'import' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">{doc.numero ? `${doc.numero}/${doc.serie}` : '—'}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground" title={doc.chaveAcesso ?? ''}>{fmtChave(doc.chaveAcesso)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{fmtDate(doc.dataEmissao)}</td>
                    <td className="px-3 py-2.5 max-w-[160px]">
                      <div className="truncate text-xs font-medium">{doc.emitenteNome ?? '—'}</div>
                      <div className="truncate text-xs text-muted-foreground">{doc.destinatarioNome ?? '—'}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium">{fmt(doc.valorTotalCents)}</td>
                    <td className="px-3 py-2.5"><NfeStatusBadge status={doc.status} /></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {doc.pdfUrl && <a href={doc.pdfUrl} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-7 w-7"><Download className="h-3.5 w-3.5" /></Button></a>}
                        {(doc.status === 'pending' || doc.status === 'processing') && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={syncing === doc.id} onClick={async () => { setSyncing(doc.id); const r = await syncNfeStatus(doc.id); if (r.ok) { toast.success(`Status: ${r.status}`); load() } else toast.error(r.error ?? 'Erro'); setSyncing(null) }}>
                            <RefreshCw className={cn('h-3.5 w-3.5', syncing === doc.id && 'animate-spin')} />
                          </Button>
                        )}
                        {doc.status === 'authorized' && doc.docType === 'emission' && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-danger" onClick={() => setCancelDialog({ id: doc.id, numero: doc.numero ?? doc.id })}>
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {(doc.status === 'import' || doc.status === 'rejected') && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-danger" disabled={deleting === doc.id}
                            onClick={async () => { if (!window.confirm('Excluir?')) return; setDeleting(doc.id); const r = await deleteNfeDoc(doc.id); setDeleting(null); if (r.ok) { toast.success('Excluído'); load() } else toast.error(r.error ?? 'Erro') }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
      </div>
      {cancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card border rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">Cancelar NF-e #{cancelDialog.numero}</h2>
              <button onClick={() => { setCancelDialog(null); setCancelText('') }}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Justificativa mínima de 15 caracteres. Prazo: até 24h da emissão.</p>
            <Textarea resize="none" className="h-24 mb-4" placeholder="Ex: Erro na emissão..." value={cancelText} onChange={e => setCancelText(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setCancelDialog(null); setCancelText('') }} disabled={canceling}>Voltar</Button>
              <Button variant="destructive" disabled={canceling || cancelText.trim().length < 15}
                onClick={async () => { if (!cancelDialog) return; setCanceling(true); const r = await cancelNfeDoc(cancelDialog.id, cancelText); setCanceling(false); if (r.ok) { toast.success('NF-e cancelada.'); setCancelDialog(null); setCancelText(''); load() } else toast.error(r.error ?? 'Erro') }}>
                {canceling ? 'Cancelando…' : 'Cancelar NF-e'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── ImportTab ─────────────────────────────────────────────────────────────────

function ImportTab({ hasFeature }: { hasFeature: boolean }) {
  const [dragging, setDragging] = React.useState(false)
  const [xmlContent, setXmlContent] = React.useState<string | null>(null)
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [preview, setPreview] = React.useState<{ emitenteNome?: string; destinatarioNome?: string; numero?: string; serie?: string; dataEmissao?: string; valorTotalCents?: number } | null>(null)
  const [importing, setImporting] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  if (!hasFeature) return <UpgradeNotice feature="Importação de XML NF-e" />

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.xml')) { toast.error('Selecione um arquivo XML.'); return }
    const reader = new FileReader()
    reader.onload = e => {
      const content = e.target?.result as string
      setXmlContent(content); setFileName(file.name)
      const get = (tag: string) => content.match(new RegExp(`<${tag}[^>]*>([^<]+)<\/${tag}>`, 'i'))?.[1] ?? null
      const vNF = get('vNF')
      setPreview({
        emitenteNome: get('xNome') ?? undefined, numero: get('nNF') ?? undefined,
        serie: get('serie') ?? undefined, dataEmissao: get('dhEmi')?.split('T')[0] ?? undefined,
        destinatarioNome: content.match(/<dest>[\s\S]*?<xNome>([^<]+)<\/xNome>/i)?.[1] ?? undefined,
        valorTotalCents: vNF ? Math.round(parseFloat(vNF) * 100) : undefined,
      })
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleClear = () => { setXmlContent(null); setFileName(null); setPreview(null); if (inputRef.current) inputRef.current.value = '' }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {!xmlContent ? (
        <div onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          onClick={() => inputRef.current?.click()}
          className={cn('flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer py-14 px-6 text-center transition-colors',
            dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/50')}>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"><Upload className="h-5 w-5 text-muted-foreground" /></div>
          <div>
            <p className="text-sm font-medium">Arraste o arquivo XML aqui</p>
            <p className="text-xs text-muted-foreground mt-0.5">ou clique para selecionar — apenas .xml NF-e</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /><span className="text-sm font-medium truncate max-w-[280px]">{fileName}</span></div>
            <button onClick={handleClear}><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>
          {preview && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-5">
              <div><span className="text-xs text-muted-foreground block">Emitente</span><span className="font-medium">{preview.emitenteNome ?? '—'}</span></div>
              <div><span className="text-xs text-muted-foreground block">Destinatário</span><span className="font-medium">{preview.destinatarioNome ?? '—'}</span></div>
              <div><span className="text-xs text-muted-foreground block">Nota / Série</span><span className="font-medium">{preview.numero ? `${preview.numero} / ${preview.serie ?? '1'}` : '—'}</span></div>
              <div><span className="text-xs text-muted-foreground block">Emissão</span><span className="font-medium">{fmtDate(preview.dataEmissao ?? null)}</span></div>
              <div><span className="text-xs text-muted-foreground block">Valor</span><span className="font-semibold text-base">{fmt(preview.valorTotalCents ?? null)}</span></div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleClear}>Remover</Button>
            <Button size="sm" disabled={importing} onClick={async () => { if (!xmlContent) return; setImporting(true); const r = await importXml(xmlContent); setImporting(false); if (r.ok) { toast.success('NF-e importada!'); handleClear() } else toast.error(r.error ?? 'Erro') }}>
              {importing ? 'Importando…' : 'Confirmar Importação'}
            </Button>
          </div>
        </div>
      )}
      <input ref={inputRef} type="file" accept=".xml" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <strong className="text-foreground">Como funciona:</strong> Importe o XML da NF-e de compra para registrar entradas no estoque. Layout NF-e 4.00.
      </div>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

type View = 'dashboard' | 'nfe' | 'nfce' | 'entradas' | 'config'

function Dashboard({ config, hasImport, hasEmission, onNavigate }: {
  config: FiscalConfigDTO | null; hasImport: boolean; hasEmission: boolean; onNavigate: (v: View) => void
}) {
  const [recentDocs, setRecentDocs] = React.useState<NfeDocument[]>([])
  const [loadingDocs, setLoadingDocs] = React.useState(true)

  React.useEffect(() => {
    getNfeDocuments({ limit: 5 }).then(res => { setRecentDocs(res.docs); setLoadingDocs(false) })
  }, [])

  const hasCert = config?.certificado_configurado ?? false
  const ambiente = config?.ambiente === 1 ? 'Produção' : config?.ambiente === 2 ? 'Homologação' : null

  const navCards = [
    { id: 'nfe' as View,      label: 'NF-e',          sub: 'Notas de saída',       Icon: FileText,    iconCls: 'text-pink-500 bg-pink-50 dark:bg-pink-900/20' },
    { id: 'nfce' as View,     label: 'NFC-e',         sub: 'Cupons do PDV',        Icon: ReceiptText, iconCls: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' },
    { id: 'entradas' as View, label: 'Entradas',      sub: 'XML de fornecedores',  Icon: Download,    iconCls: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' },
    { id: 'config' as View,   label: 'Configurações', sub: 'Certificado e emissão', Icon: Settings,   iconCls: 'text-gray-500 bg-gray-100 dark:bg-gray-800' },
  ]

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-6 w-1 rounded-full bg-primary" />
          <h1 className="text-xl font-semibold text-foreground">Módulo Fiscal</h1>
        </div>
        <span className={cn('px-3 py-1 text-xs font-semibold rounded-full border tracking-wide',
          ambiente === 'Produção'    ? 'border-success/50 text-success bg-success/10' :
          ambiente === 'Homologação' ? 'border-yellow-500/50 text-yellow-700 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/20' :
          'border-border text-muted-foreground bg-muted/40')}>
          {ambiente ? ambiente.toUpperCase() : 'AMBIENTE NÃO DEFINIDO'}
        </span>
      </div>

      {/* Alert: sem certificado */}
      {!hasCert && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-800/50 dark:bg-amber-900/20">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Certificado A1 não importado</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Importe o certificado .pfx para assinar e transmitir notas à SEFAZ.</p>
            </div>
          </div>
          <Button size="sm" className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white border-0" onClick={() => onNavigate('config')}>
            Importar certificado
          </Button>
        </div>
      )}

      {/* Nav cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {navCards.map(card => {
          const Icon = card.Icon
          return (
            <button key={card.id} onClick={() => onNavigate(card.id)}
              className="flex flex-col gap-3 rounded-xl border bg-card p-5 text-left hover:border-primary/40 hover:shadow-sm transition-all">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', card.iconCls)}><Icon className="h-5 w-5" /></div>
              <div>
                <p className="text-sm font-semibold text-foreground">{card.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={cn('flex items-center gap-4 rounded-xl border p-4 cursor-pointer hover:shadow-sm transition-all', !hasCert && 'border-amber-200 bg-amber-50/50 dark:border-amber-800/50 dark:bg-amber-900/10')} onClick={() => onNavigate('config')}>
          <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg shrink-0', hasCert ? 'bg-success/10 text-success' : 'bg-amber-100 text-amber-500 dark:bg-amber-900/30')}><Shield className="h-4 w-4" /></div>
          <div><p className="text-xs text-muted-foreground">Certificado A1</p><p className="text-sm font-semibold">{hasCert ? 'Importado' : 'Não importado'}</p></div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border bg-card p-4 cursor-pointer hover:shadow-sm transition-all" onClick={() => onNavigate('nfce')}>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-50 text-pink-500 dark:bg-pink-900/20 shrink-0"><ReceiptText className="h-4 w-4" /></div>
          <div><p className="text-xs text-muted-foreground">Último NFC-e</p><p className="text-sm font-semibold">Série {config?.serie_nfce ?? '1'} · Nº {config?.ultimo_numero_nfce ?? 0}</p></div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border bg-card p-4 cursor-pointer hover:shadow-sm transition-all" onClick={() => onNavigate('nfe')}>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-500 dark:bg-emerald-900/20 shrink-0"><FileText className="h-4 w-4" /></div>
          <div><p className="text-xs text-muted-foreground">Último NF-e</p><p className="text-sm font-semibold">Série {config?.serie_nfe ?? '1'} · Nº {config?.ultimo_numero_nfe ?? 0}</p></div>
        </div>
      </div>

      {/* Notas recentes */}
      <div className="rounded-xl border bg-card">
        {loadingDocs ? (
          <div className="flex items-center justify-center py-12"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : recentDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-2 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">Nenhuma nota emitida ainda</p>
            <p className="text-xs text-muted-foreground">Configure os dados fiscais e comece a emitir</p>
          </div>
        ) : (
          <>
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <p className="text-sm font-semibold">Notas recentes</p>
              <button className="text-xs text-primary hover:underline" onClick={() => onNavigate('nfe')}>Ver todas</button>
            </div>
            <div className="divide-y">
              {recentDocs.map(doc => (
                <div key={doc.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{doc.emitenteNome ?? doc.destinatarioNome ?? 'Sem nome'}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(doc.dataEmissao)} · {doc.numero ? `Nº ${doc.numero}` : '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{fmt(doc.valorTotalCents)}</span>
                    <NfeStatusBadge status={doc.status} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export function FiscalPage() {
  const [view, setView] = React.useState<View>('dashboard')
  const [config, setConfig] = React.useState<FiscalConfigDTO | null>(null)
  const [hasImport, setHasImport] = React.useState(true)
  const [hasEmission, setHasEmission] = React.useState(true)
  const [loading, setLoading] = React.useState(true)

  const loadAll = React.useCallback(async () => {
    const [cfgRes, docsRes] = await Promise.all([getFiscalConfig(), getNfeDocuments({ limit: 1 })])
    if (cfgRes.ok && cfgRes.config) setConfig(cfgRes.config)
    setHasImport(docsRes.hasFeatureImport)
    setHasEmission(docsRes.hasFeatureEmission)
    setLoading(false)
  }, [])

  React.useEffect(() => { loadAll() }, [loadAll])

  if (loading) {
    return <div className="flex items-center justify-center h-full py-20"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }

  if (view === 'dashboard') {
    return <Dashboard config={config} hasImport={hasImport} hasEmission={hasEmission} onNavigate={setView} />
  }

  const labels: Record<View, string> = { dashboard: '', nfe: 'NF-e', nfce: 'NFC-e', entradas: 'Entradas', config: 'Configurações' }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 px-6 pt-6 pb-2">
        <button onClick={() => setView('dashboard')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />Módulo Fiscal
        </button>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-semibold text-foreground">{labels[view]}</span>
      </div>
      <div className="px-6 pb-6">
        {view === 'nfe'      && <DocsTab hasFeature={hasImport || hasEmission} docType="emission" />}
        {view === 'nfce'     && <DocsTab hasFeature={hasEmission} docType="emission" />}
        {view === 'entradas' && <ImportTab hasFeature={hasImport} />}
        {view === 'config'   && <FiscalConfigForm onSaved={() => { getFiscalConfig().then(r => { if (r.ok && r.config) setConfig(r.config) }) }} />}
      </div>
    </div>
  )
}
