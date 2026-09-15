'use client'

import * as React from 'react'
import { Plus, Search, MoreHorizontal, Pencil, Trash2, X, Users } from 'lucide-react'
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
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '@/lib/actions/customers'
import type { CustomerRow } from '@kyra/database'
import { formatPhone, formatDoc, isValidCpf, isValidCnpj } from '@/lib/formatters'

type Column<T> = { key: string; header: string; cell: (row: T) => React.ReactNode; sortable?: boolean; className?: string }

const STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
]

type FormValues = {
  person_type: 'individual' | 'company'
  name: string
  document: string
  email: string
  phone: string
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
  person_type: 'individual', name: '', document: '', email: '', phone: '',
  zipcode: '', address: '', address_number: '', complement: '', neighborhood: '', city: '', state: '', notes: '',
}


// ── Section header ────────────────────────────────────────────
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{children}</p>
    </div>
  )
}

export function CustomersPage() {
  const [customers, setCustomers] = React.useState<CustomerRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  const [formOpen, setFormOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [editing, setEditing] = React.useState<CustomerRow | null>(null)
  const [values, setValues] = React.useState<FormValues>(EMPTY)
  const [deleteTarget, setDeleteTarget] = React.useState<CustomerRow | null>(null)
  const [deleteLoading, setDeleteLoading] = React.useState(false)

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const r = await getCustomers({ search: debouncedSearch || undefined, status: 'all' })
      setCustomers(r.data)
    } catch { toast.error('Erro ao carregar clientes') }
    finally { setLoading(false) }
  }, [debouncedSearch])

  React.useEffect(() => { load() }, [load])

  function openNew() { setEditing(null); setValues(EMPTY); setFormOpen(true) }
  function openEdit(c: CustomerRow) {
    setEditing(c)
    setValues({
      person_type: c.person_type, name: c.name, document: c.document ?? '',
      email: c.email ?? '', phone: c.phone ?? '', zipcode: c.zipcode ?? '',
      address: c.address ?? '', address_number: c.address_number ?? '',
      complement: c.complement ?? '', neighborhood: c.neighborhood ?? '',
      city: c.city ?? '', state: c.state ?? '', notes: c.notes ?? '',
    })
    setFormOpen(true)
  }

  function set(key: keyof FormValues, val: string) {
    setValues(prev => ({ ...prev, [key]: val }))
  }

  async function handleSave() {
    if (!values.name.trim()) { toast.error('Nome é obrigatório'); return }
    setSaving(true)
    try {
      const payload = {
        ...values, document: values.document || null, email: values.email || null,
        phone: values.phone || null, zipcode: values.zipcode || null, address: values.address || null,
        address_number: values.address_number || null, complement: values.complement || null,
        neighborhood: values.neighborhood || null, city: values.city || null,
        state: values.state || null, notes: values.notes || null, is_active: true,
      }
      const r = editing
        ? await updateCustomer(editing.id, payload)
        : await createCustomer(payload)
      if (!r.success) { toast.error(r.error ?? 'Erro ao salvar'); return }
      toast.success(editing ? 'Cliente atualizado' : 'Cliente cadastrado')
      setFormOpen(false)
      load()
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    const r = await deleteCustomer(deleteTarget.id)
    setDeleteLoading(false)
    if (!r.success) { toast.error(r.error ?? 'Erro ao excluir'); return }
    toast.success('Cliente removido')
    setDeleteTarget(null)
    load()
  }

  const columns: Column<CustomerRow>[] = [
    {
      key: 'name', header: 'Nome', sortable: true,
      cell: (c) => (
        <div>
          <p className="font-medium text-sm">{c.name}</p>
          {c.document && <p className="text-xs text-muted-foreground">{c.document}</p>}
        </div>
      )
    },
    { key: 'email', header: 'E-mail', cell: (c) => <span className="text-sm">{c.email ?? '—'}</span> },
    { key: 'phone', header: 'Telefone', cell: (c) => <span className="text-sm">{c.phone ?? '—'}</span> },
    {
      key: 'city', header: 'Cidade', className: 'hidden md:table-cell',
      cell: (c) => <span className="text-sm">{c.city ? `${c.city}${c.state ? ` / ${c.state}` : ''}` : '—'}</span>
    },
    {
      key: 'is_active', header: 'Status',
      cell: (c) => <Badge variant={c.is_active ? 'default' : 'secondary'}>{c.is_active ? 'Ativo' : 'Inativo'}</Badge>
    },
    {
      key: 'actions', header: '',
      cell: (c) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEdit(c)}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(c)}><Trash2 className="mr-2 h-4 w-4" />Remover</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  ]

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        icon={Users}
        title="Clientes"
        description="Cadastro de clientes para identificação nas vendas"
        actions={<Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo cliente</Button>}
      />

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar clientes..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
        </div>
      </div>

      <DataTable
        columns={columns} data={customers} loading={loading} keyExtractor={c => c.id}
        emptyTitle="Nenhum cliente cadastrado"
        emptyDescription="Cadastre seu primeiro cliente clicando em Novo cliente"
        emptyAction={{ label: "Novo cliente", onClick: openNew }}
        onRowClick={openEdit}
      />

      {/* ── Sheet — slide-over from right ─────────────────────── */}
      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editing ? 'Editar cliente' : 'Novo cliente'}</SheetTitle>
            <SheetDescription>Preencha os dados do cliente.</SheetDescription>
          </SheetHeader>

          <SheetBody>
            {/* DADOS PESSOAIS */}
            <SectionHeader>Dados pessoais</SectionHeader>

            <div className="flex flex-col gap-4 mb-6">
              <FormField label="Tipo de pessoa">
                <Select value={values.person_type} onValueChange={v => { set('person_type', v as 'individual' | 'company'); set('document', '') }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Pessoa Física</SelectItem>
                    <SelectItem value="company">Pessoa Jurídica</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Nome completo *">
                <Input
                  placeholder={values.person_type === 'individual' ? 'Nome completo' : 'Razão social'}
                  value={values.name}
                  onChange={e => set('name', e.target.value)}
                />
              </FormField>

              <FormField label={values.person_type === 'individual' ? 'CPF' : 'CNPJ'}>
                <Input
                  placeholder={values.person_type === 'individual' ? '000.000.000-00' : '00.000.000/0000-00'}
                  value={values.document}
                  onChange={e => set('document', formatDoc(e.target.value, values.person_type))}
                />
              </FormField>

              <FormField label="Telefone">
                <Input
                  placeholder="(00) 00000-0000"
                  value={values.phone}
                  onChange={e => set('phone', formatPhone(e.target.value))}
                />
              </FormField>

              <FormField label="E-mail">
                <Input type="email" placeholder="email@exemplo.com" value={values.email} onChange={e => set('email', e.target.value)} />
              </FormField>

              <FormField label="Observações">
                <textarea
                  className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Observações internas..."
                  value={values.notes}
                  onChange={e => set('notes', e.target.value)}
                />
              </FormField>
            </div>

            {/* ENDEREÇO */}
            <SectionHeader>Endereço</SectionHeader>

            <div className="flex flex-col gap-4">
              <FormField label="CEP">
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

              <FormField label="Logradouro">
                <Input placeholder="Rua, Av..." value={values.address} onChange={e => set('address', e.target.value)} />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Número">
                  <Input placeholder="Nº" value={values.address_number} onChange={e => set('address_number', e.target.value)} />
                </FormField>
                <FormField label="Complemento">
                  <Input placeholder="Apto, sala..." value={values.complement} onChange={e => set('complement', e.target.value)} />
                </FormField>
              </div>

              <FormField label="Bairro">
                <Input placeholder="Bairro" value={values.neighborhood} onChange={e => set('neighborhood', e.target.value)} />
              </FormField>

              <div className="grid grid-cols-3 gap-3">
                <FormField label="Cidade" className="col-span-2">
                  <Input placeholder="Cidade" value={values.city} onChange={e => set('city', e.target.value)} />
                </FormField>
                <FormField label="UF">
                  <Select value={values.state} onValueChange={v => set('state', v)}>
                    <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent>{STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
              </div>
            </div>
          </SheetBody>

          <SheetFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Salvar cliente'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title="Remover cliente"
        description={`Tem certeza que deseja remover "${deleteTarget?.name}"?`}
        confirmLabel="Remover"
        onConfirm={handleDelete}
        loading={deleteLoading}
        variant="danger"
      />
    </div>
  )
}
