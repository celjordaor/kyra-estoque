'use client'

import * as React from 'react'
import { Plus, Search, MoreHorizontal, Pencil, Trash2, X, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { CepInput } from '@/components/ui/cep-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { FormField } from '@/components/ui/form-field'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DataTable } from '@/components/composite/data-table'
import { Sheet, SheetContent, SheetHeader, SheetBody, SheetFooter, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '@/lib/actions/suppliers'
import type { SupplierRow } from '@kyra/database'
import { formatPhone, formatDoc, isValidCnpj } from '@/lib/formatters'

type Column<T> = { key: string; header: string; cell: (row: T) => React.ReactNode; sortable?: boolean; className?: string }

const STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
]

type FormValues = {
  person_type: 'individual' | 'company'
  name: string
  trade_name: string
  document: string
  state_registration: string
  email: string
  phone: string
  whatsapp: string
  contact_name: string
  zipcode: string
  address: string
  address_number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  notes: string
}

const EMPTY: FormValues = {
  person_type: 'company', name: '', trade_name: '', document: '', state_registration: '',
  email: '', phone: '', whatsapp: '', contact_name: '', zipcode: '', address: '',
  address_number: '', complement: '', neighborhood: '', city: '', state: '', notes: '',
}


function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{children}</p>
    </div>
  )
}

export function SuppliersPage() {
  const [suppliers, setSuppliers] = React.useState<SupplierRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  const [formOpen, setFormOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [editing, setEditing] = React.useState<SupplierRow | null>(null)
  const [values, setValues] = React.useState<FormValues>(EMPTY)
  const [deleteTarget, setDeleteTarget] = React.useState<SupplierRow | null>(null)
  const [deleteLoading, setDeleteLoading] = React.useState(false)

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const r = await getSuppliers({ search: debouncedSearch || undefined, status: 'all' })
      setSuppliers(r.data)
    } catch { toast.error('Erro ao carregar fornecedores') }
    finally { setLoading(false) }
  }, [debouncedSearch])

  React.useEffect(() => { load() }, [load])

  function openNew() { setEditing(null); setValues(EMPTY); setFormOpen(true) }
  function openEdit(s: SupplierRow) {
    setEditing(s)
    setValues({
      person_type: s.person_type, name: s.name, trade_name: s.trade_name ?? '',
      document: s.document ?? '',
      state_registration: (s as unknown as { state_registration?: string }).state_registration ?? '',
      email: s.email ?? '', phone: s.phone ?? '',
      whatsapp: (s as unknown as { whatsapp?: string }).whatsapp ?? '',
      contact_name: s.contact_name ?? '',
      zipcode: s.zipcode ?? '', address: s.address ?? '', address_number: s.address_number ?? '',
      complement: s.complement ?? '', neighborhood: s.neighborhood ?? '',
      city: s.city ?? '', state: s.state ?? '', notes: s.notes ?? '',
    })
    setFormOpen(true)
  }

  function set(key: keyof FormValues, val: string) {
    setValues(prev => ({ ...prev, [key]: val }))
  }

  async function handleSave() {
    if (!values.name.trim()) { toast.error('Razão social é obrigatória'); return }
    setSaving(true)
    try {
      const payload = {
        person_type: values.person_type,
        name: values.name,
        trade_name: values.trade_name || null,
        document: values.document || null,
        state_registration: values.state_registration || null,
        email: values.email || null,
        phone: values.phone || null,
        whatsapp: values.whatsapp || null,
        contact_name: values.contact_name || null,
        zipcode: values.zipcode || null,
        address: values.address || null,
        address_number: values.address_number || null,
        complement: values.complement || null,
        neighborhood: values.neighborhood || null,
        city: values.city || null,
        state: values.state || null,
        notes: values.notes || null,
        is_active: true,
      }
      const r = editing
        ? await updateSupplier(editing.id, payload)
        : await createSupplier(payload)
      if (!r.success) { toast.error(r.error ?? 'Erro ao salvar'); return }
      toast.success(editing ? 'Fornecedor atualizado' : 'Fornecedor cadastrado')
      setFormOpen(false)
      load()
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    const r = await deleteSupplier(deleteTarget.id)
    setDeleteLoading(false)
    if (!r.success) { toast.error(r.error ?? 'Erro ao excluir'); return }
    toast.success('Fornecedor removido')
    setDeleteTarget(null)
    load()
  }

  const columns: Column<SupplierRow>[] = [
    {
      key: 'name', header: 'Fornecedor', sortable: true,
      cell: (s) => (
        <div>
          <p className="font-medium text-sm">{s.trade_name || s.name}</p>
          {s.trade_name && <p className="text-xs text-muted-foreground">{s.name}</p>}
          {s.document && <p className="text-xs text-muted-foreground">{s.document}</p>}
        </div>
      )
    },
    { key: 'contact_name', header: 'Contato', className: 'hidden md:table-cell', cell: (s) => <span className="text-sm">{s.contact_name ?? '—'}</span> },
    { key: 'phone', header: 'Telefone', cell: (s) => <span className="text-sm">{s.phone ?? '—'}</span> },
    { key: 'email', header: 'E-mail', className: 'hidden lg:table-cell', cell: (s) => <span className="text-sm">{s.email ?? '—'}</span> },
    {
      key: 'is_active', header: 'Status',
      cell: (s) => <Badge variant={s.is_active ? 'success' : 'neutral'}>{s.is_active ? 'Ativo' : 'Inativo'}</Badge>
    },
    {
      key: 'actions', header: '',
      cell: (s) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEdit(s)}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(s)}><Trash2 className="mr-2 h-4 w-4" />Remover</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  ]

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        icon={Truck}
        title="Fornecedores"
        description="Cadastro de fornecedores utilizados nas compras"
        actions={<Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo fornecedor</Button>}
      />

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar fornecedores..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
        </div>
      </div>

      <DataTable
        columns={columns} data={suppliers} loading={loading} keyExtractor={s => s.id}
        emptyTitle="Nenhum fornecedor cadastrado"
        emptyDescription="Cadastre seu primeiro fornecedor clicando em Novo fornecedor"
        emptyAction={{ label: "Novo fornecedor", onClick: openNew }}
        onRowClick={openEdit}
      />

      {/* ── Sheet — slide-over from right ─────────────────────── */}
      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editing ? 'Editar fornecedor' : 'Novo fornecedor'}</SheetTitle>
            <SheetDescription>Preencha os dados do fornecedor.</SheetDescription>
          </SheetHeader>

          <SheetBody>
            {/* DADOS DA EMPRESA */}
            <SectionHeader>Dados da empresa</SectionHeader>

            <div className="flex flex-col gap-4 mb-6">
              <FormField id="person_type" label="Tipo">
                <Select value={values.person_type} onValueChange={v => set('person_type', v as 'individual' | 'company')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company">Pessoa Jurídica</SelectItem>
                    <SelectItem value="individual">Pessoa Física</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>

              <FormField id="name" label={values.person_type === 'company' ? 'Razão social *' : 'Nome *'}>
                <Input
                  placeholder={values.person_type === 'company' ? 'Razão social' : 'Nome completo'}
                  value={values.name}
                  onChange={e => set('name', e.target.value)}
                />
              </FormField>

              {values.person_type === 'company' && (
                <FormField id="trade_name" label="Nome fantasia">
                  <Input placeholder="Nome fantasia" value={values.trade_name} onChange={e => set('trade_name', e.target.value)} />
                </FormField>
              )}

              <FormField id="document" label={values.person_type === 'company' ? 'CNPJ' : 'CPF'}>
                <Input
                  placeholder={values.person_type === 'company' ? '00.000.000/0000-00' : '000.000.000-00'}
                  value={values.document}
                  onChange={e => set('document', formatDoc(e.target.value, values.person_type))}
                />
              </FormField>

              {values.person_type === 'company' && (
                <FormField id="state_registration" label="Inscrição estadual">
                  <Input placeholder="Inscrição estadual" value={values.state_registration} onChange={e => set('state_registration', e.target.value)} />
                </FormField>
              )}

              <FormField id="phone" label="Telefone">
                <Input placeholder="(00) 00000-0000" value={values.phone} onChange={e => set('phone', formatPhone(e.target.value))} />
              </FormField>

              <FormField id="whatsapp" label="WhatsApp">
                <Input placeholder="(00) 00000-0000" value={values.whatsapp} onChange={e => set('whatsapp', formatPhone(e.target.value))} />
              </FormField>

              <FormField id="email" label="E-mail">
                <Input type="email" placeholder="email@fornecedor.com" value={values.email} onChange={e => set('email', e.target.value)} />
              </FormField>

              <FormField id="contact_name" label="Contato (responsável)">
                <Input placeholder="Nome do responsável" value={values.contact_name} onChange={e => set('contact_name', e.target.value)} />
              </FormField>
            </div>

            {/* ENDEREÇO */}
            <SectionHeader>Endereço</SectionHeader>

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField id="zipcode" label="CEP" className="col-span-2">
                  <CepInput
                    value={values.zipcode}
                    onChange={v => set('zipcode', v)}
                    onAddressFound={addr => setValues(prev => ({
                      ...prev,
                      address: addr.address,
                      neighborhood: addr.neighborhood,
                      city: addr.city,
                      state: addr.state,
                    }))}
                    onNotFound={() => toast.error('CEP não encontrado')}
                  />
                </FormField>
              </div>

              <FormField id="address" label="Logradouro">
                <Input placeholder="Rua, Av..." value={values.address} onChange={e => set('address', e.target.value)} />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField id="address_number" label="Número">
                  <Input placeholder="Nº" value={values.address_number} onChange={e => set('address_number', e.target.value)} />
                </FormField>
                <FormField id="complement" label="Complemento">
                  <Input placeholder="Sala, galpão..." value={values.complement} onChange={e => set('complement', e.target.value)} />
                </FormField>
              </div>

              <FormField id="neighborhood" label="Bairro">
                <Input placeholder="Bairro" value={values.neighborhood} onChange={e => set('neighborhood', e.target.value)} />
              </FormField>

              <div className="grid grid-cols-3 gap-3">
                <FormField id="city" label="Cidade" className="col-span-2">
                  <Input placeholder="Cidade" value={values.city} onChange={e => set('city', e.target.value)} />
                </FormField>
                <FormField id="state" label="UF">
                  <Select value={values.state} onValueChange={v => set('state', v)}>
                    <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent>{STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
              </div>

              <FormField id="notes" label="Observações">
                <textarea
                  className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Observações internas..."
                  value={values.notes}
                  onChange={e => set('notes', e.target.value)}
                />
              </FormField>
            </div>
          </SheetBody>

          <SheetFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Salvar fornecedor'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title="Remover fornecedor"
        description={`Tem certeza que deseja remover "${deleteTarget?.trade_name || deleteTarget?.name}"?`}
        confirmLabel="Remover"
        onConfirm={handleDelete}
        loading={deleteLoading}
        variant="danger"
      />
    </div>
  )
}
