'use client'

import * as React from 'react'
import {
  FileText, Upload, RefreshCw, XCircle, Download, Trash2,
  CheckCircle2, Clock, AlertTriangle, Lock,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
// Badge import removido (não usado diretamente)
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  getNfeDocuments, importXml, syncNfeStatus, cancelNfeDoc, deleteNfeDoc,
} from '@/lib/actions/nfe'
import type { NfeDocument } from '@/lib/actions/nfe'

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
  // Mostra só primeiros 8 e últimos 6 dígitos
  return `${chave.slice(0, 8)}…${chave.slice(-6)}`
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  authorized:  { label: 'Autorizada',   cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400', Icon: CheckCircle2 },
  processing:  { label: 'Processando',  cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',             Icon: Clock },
  pending:     { label: 'Pendente',     cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',     Icon: Clock },
  rejected:    { label: 'Rejeitada',    cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',                 Icon: AlertTriangle },
  canceled:    { label: 'Cancelada',    cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',               Icon: XCircle },
  import:      { label: 'Importada',    cls: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',    Icon: Upload },
}

function NfeStatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600', Icon: Clock }
  const Icon = s.Icon
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium', s.cls)}>
      <Icon className="h-3 w-3" />
      {s.label}
    </span>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <tbody>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b">
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className="px-3 py-2.5">
              <div className="h-4 bg-muted animate-pulse rounded" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}

// ── UpgradeNotice ─────────────────────────────────────────────────────────────

function UpgradeNotice({ feature }: { feature: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Lock className="h-10 w-10 text-muted-foreground" />
      <p className="text-base font-semibold text-foreground">Recurso não disponível no seu plano</p>
      <p className="text-sm text-muted-foreground max-w-xs">
        {feature} está disponível nos planos <strong>Impulsiona</strong> e <strong>Escala</strong>.
      </p>
      <Button variant="default" size="sm" onClick={() => toast.info('Acesse Configurações → Plano para fazer upgrade.')}>
        Ver planos
      </Button>
    </div>
  )
}

// ── Tab: Documentos ───────────────────────────────────────────────────────────

function DocsTab({ hasFeature }: { hasFeature: boolean }) {
  const [docs, setDocs] = React.useState<NfeDocument[]>([])
  const [loading, setLoading] = React.useState(true)
  const [filterType, setFilterType] = React.useState<'all' | 'import' | 'emission'>('all')
  const [syncing, setSyncing] = React.useState<string | null>(null)
  const [cancelDialog, setCancelDialog] = React.useState<{ id: string; numero: string } | null>(null)
  const [cancelText, setCancelText] = React.useState('')
  const [canceling, setCanceling] = React.useState(false)
  const [deleting, setDeleting] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    const res = await getNfeDocuments({
      docType: filterType === 'all' ? undefined : filterType,
    })
    setDocs(res.docs)
    setLoading(false)
  }, [filterType])

  React.useEffect(() => { load() }, [load])

  const handleSync = async (docId: string) => {
    setSyncing(docId)
    const res = await syncNfeStatus(docId)
    if (res.ok) {
      toast.success(`Status atualizado: ${res.status}`)
      load()
    } else {
      toast.error(res.error ?? 'Erro ao sincronizar')
    }
    setSyncing(null)
  }

  const handleCancel = async () => {
    if (!cancelDialog) return
    setCanceling(true)
    const res = await cancelNfeDoc(cancelDialog.id, cancelText)
    setCanceling(false)
    if (res.ok) {
      toast.success('NF-e cancelada com sucesso.')
      setCancelDialog(null)
      setCancelText('')
      load()
    } else {
      toast.error(res.error ?? 'Erro ao cancelar')
    }
  }

  const handleDelete = async (docId: string) => {
    if (!window.confirm('Excluir este documento? Esta ação não pode ser desfeita.')) return
    setDeleting(docId)
    const res = await deleteNfeDoc(docId)
    setDeleting(null)
    if (res.ok) { toast.success('Documento excluído.'); load() }
    else toast.error(res.error ?? 'Erro ao excluir')
  }

  if (!hasFeature) return <UpgradeNotice feature="Consulta e emissão de NF-e" />

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <div className="flex items-center gap-2">
        {(['all', 'import', 'emission'] as const).map(t => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              filterType === t
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {{ all: 'Todos', import: 'Importadas', emission: 'Emitidas' }[t]}
          </button>
        ))}
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', loading && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipo</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Nº / Série</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Chave de Acesso</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Emissão</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Emitente / Destinatário</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            {loading ? <SkeletonRows cols={8} /> : (
              <tbody>
                {docs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-12 text-center text-muted-foreground text-sm">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      Nenhum documento encontrado
                    </td>
                  </tr>
                )}
                {docs.map(doc => (
                  <tr key={doc.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2.5">
                      <span className={cn(
                        'px-1.5 py-0.5 rounded text-xs font-medium',
                        doc.docType === 'import'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      )}>
                        {doc.docType === 'import' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">
                      {doc.numero ? `${doc.numero}/${doc.serie}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground" title={doc.chaveAcesso ?? ''}>
                      {fmtChave(doc.chaveAcesso)}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {fmtDate(doc.dataEmissao)}
                    </td>
                    <td className="px-3 py-2.5 max-w-[180px]">
                      <div className="truncate text-xs">
                        <span className="font-medium">{doc.emitenteNome ?? '—'}</span>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {doc.destinatarioNome ?? '—'}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium">
                      {fmt(doc.valorTotalCents)}
                    </td>
                    <td className="px-3 py-2.5">
                      <NfeStatusBadge status={doc.status} />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {doc.pdfUrl && (
                          <a
                            href={doc.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Baixar DANFE"
                          >
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        )}
                        {(doc.status === 'pending' || doc.status === 'processing') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Sincronizar status"
                            disabled={syncing === doc.id}
                            onClick={() => handleSync(doc.id)}
                          >
                            <RefreshCw className={cn('h-3.5 w-3.5', syncing === doc.id && 'animate-spin')} />
                          </Button>
                        )}
                        {doc.status === 'authorized' && doc.docType === 'emission' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-700"
                            title="Cancelar NF-e"
                            onClick={() => setCancelDialog({ id: doc.id, numero: doc.numero ?? doc.id })}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {(doc.status === 'import' || doc.status === 'rejected') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-red-600"
                            title="Excluir documento"
                            disabled={deleting === doc.id}
                            onClick={() => handleDelete(doc.id)}
                          >
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

      {/* Modal cancelamento */}
      {cancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card border rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">Cancelar NF-e #{cancelDialog.numero}</h2>
              <button onClick={() => { setCancelDialog(null); setCancelText('') }}>
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Informe a justificativa do cancelamento (mínimo 15 caracteres).
              O cancelamento só é aceito pela SEFAZ dentro de 24h da emissão.
            </p>
            <textarea
              className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none h-24 mb-4"
              placeholder="Ex: Erro na emissão, produto não entregue..."
              value={cancelText}
              onChange={e => setCancelText(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setCancelDialog(null); setCancelText('') }} disabled={canceling}>
                Voltar
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancel}
                disabled={canceling || cancelText.trim().length < 15}
              >
                {canceling ? 'Cancelando…' : 'Cancelar NF-e'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab: Importar XML ─────────────────────────────────────────────────────────

function ImportTab({ hasFeature }: { hasFeature: boolean }) {
  const [dragging, setDragging] = React.useState(false)
  const [xmlContent, setXmlContent] = React.useState<string | null>(null)
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [preview, setPreview] = React.useState<{
    emitenteNome?: string
    emitenteCnpj?: string
    destinatarioNome?: string
    numero?: string
    serie?: string
    dataEmissao?: string
    valorTotalCents?: number
    items?: { descricao: string; quantidade: number; valorBruto: number }[]
  } | null>(null)
  const [importing, setImporting] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  if (!hasFeature) return <UpgradeNotice feature="Importação de XML NF-e" />

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.xml')) {
      toast.error('Selecione um arquivo XML de NF-e.')
      return
    }
    const reader = new FileReader()
    reader.onload = e => {
      const content = e.target?.result as string
      setXmlContent(content)
      setFileName(file.name)
      // Preview rápido client-side — extrações básicas
      const get = (tag: string) => {
        const m = content.match(new RegExp(`<${tag}[^>]*>([^<]+)<\/${tag}>`, 'i'))
        return m?.[1] ?? null
      }
      const getAttr = (tag: string, attr: string) => {
        const m = content.match(new RegExp(`<${tag}[^>]*\\s${attr}="([^"]+)"`, 'i'))
        return m?.[1] ?? null
      }
      const nNF = get('nNF')
      const serie = get('serie')
      const dhEmi = get('dhEmi')
      const dateStr = dhEmi ? dhEmi.split('T')[0] : null
      const xNome = get('xNome')
      const xNomeDest = (() => {
        const m = content.match(/<dest>[\s\S]*?<xNome>([^<]+)<\/xNome>/i)
        return m?.[1] ?? null
      })()
      const id = getAttr('infNFe', 'Id')
      const chave = id ? id.replace('NFe', '') : null
      const vNF = get('vNF')

      setPreview({
        emitenteNome: xNome ?? undefined,
        numero: nNF ?? undefined,
        serie: serie ?? undefined,
        dataEmissao: dateStr ?? undefined,
        destinatarioNome: xNomeDest ?? undefined,
        valorTotalCents: vNF ? Math.round(parseFloat(vNF) * 100) : undefined,
      })
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleImport = async () => {
    if (!xmlContent) return
    setImporting(true)
    const res = await importXml(xmlContent)
    setImporting(false)
    if (res.ok) {
      toast.success('NF-e importada com sucesso!')
      setXmlContent(null)
      setFileName(null)
      setPreview(null)
    } else {
      toast.error(res.error ?? 'Erro ao importar')
    }
  }

  const handleClear = () => {
    setXmlContent(null)
    setFileName(null)
    setPreview(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Drop zone */}
      {!xmlContent ? (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer',
            'py-14 px-6 text-center transition-colors',
            dragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-muted/50'
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Upload className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Arraste o arquivo XML aqui</p>
            <p className="text-xs text-muted-foreground mt-0.5">ou clique para selecionar — apenas .xml NF-e</p>
          </div>
        </div>
      ) : (
        /* Preview do XML */
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium truncate max-w-[280px]">{fileName}</span>
            </div>
            <button onClick={handleClear} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {preview && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-5">
              <div>
                <span className="text-xs text-muted-foreground block">Emitente</span>
                <span className="font-medium">{preview.emitenteNome ?? '—'}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Destinatário</span>
                <span className="font-medium">{preview.destinatarioNome ?? '—'}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Nota / Série</span>
                <span className="font-medium">
                  {preview.numero ? `${preview.numero} / ${preview.serie ?? '1'}` : '—'}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Data de Emissão</span>
                <span className="font-medium">{fmtDate(preview.dataEmissao ?? null)}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Valor Total</span>
                <span className="font-semibold text-base">{fmt(preview.valorTotalCents ?? null)}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleClear}>Remover</Button>
            <Button size="sm" onClick={handleImport} disabled={importing}>
              {importing ? 'Importando…' : 'Confirmar Importação'}
            </Button>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".xml"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />

      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <strong className="text-foreground">Como funciona:</strong> Importe o XML da NF-e de compra
        para registrar a entrada no estoque. O sistema valida a chave de acesso e evita duplicatas.
        Suporte ao layout NF-e 4.00.
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

type Tab = 'docs' | 'import'

export function FiscalPage() {
  const [tab, setTab] = React.useState<Tab>('docs')
  const [hasImport, setHasImport] = React.useState(true)
  const [hasEmission, setHasEmission] = React.useState(true)
  const [featuresLoaded, setFeaturesLoaded] = React.useState(false)

  React.useEffect(() => {
    getNfeDocuments({ limit: 1 }).then(res => {
      setHasImport(res.hasFeatureImport)
      setHasEmission(res.hasFeatureEmission)
      setFeaturesLoaded(true)
    })
  }, [])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'docs',   label: 'Documentos' },
    { id: 'import', label: 'Importar XML' },
  ]

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Fiscal"
        description="Gestão de NF-e emitidas e importadas"
        icon={FileText}
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              tab === t.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {!featuresLoaded ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : tab === 'docs' ? (
        <DocsTab hasFeature={hasImport || hasEmission} />
      ) : (
        <ImportTab hasFeature={hasImport} />
      )}
    </div>
  )
}
