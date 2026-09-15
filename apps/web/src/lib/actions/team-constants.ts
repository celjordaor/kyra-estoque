export const PERMISSION_GROUPS = [
  { group: 'Produtos', permissions: [{ key: 'products.view', label: 'Visualizar' }, { key: 'products.create', label: 'Criar' }, { key: 'products.edit', label: 'Editar' }, { key: 'products.delete', label: 'Excluir' }] },
  { group: 'Vendas', permissions: [{ key: 'sales.view', label: 'Visualizar' }, { key: 'sales.create', label: 'Criar' }, { key: 'sales.cancel', label: 'Cancelar' }] },
  { group: 'Estoque', permissions: [{ key: 'stock.view', label: 'Visualizar' }, { key: 'stock.adjust', label: 'Ajustar' }] },
  { group: 'Compras', permissions: [{ key: 'purchases.view', label: 'Visualizar' }, { key: 'purchases.create', label: 'Criar' }, { key: 'purchases.approve', label: 'Aprovar' }] },
  { group: 'Clientes', permissions: [{ key: 'customers.view', label: 'Visualizar' }, { key: 'customers.create', label: 'Criar' }, { key: 'customers.edit', label: 'Editar' }] },
  { group: 'Fornecedores', permissions: [{ key: 'suppliers.view', label: 'Visualizar' }, { key: 'suppliers.create', label: 'Criar' }, { key: 'suppliers.edit', label: 'Editar' }] },
  { group: 'Financeiro', permissions: [{ key: 'financial.view', label: 'Visualizar' }, { key: 'financial.create', label: 'Criar' }, { key: 'financial.approve', label: 'Aprovar' }] },
  { group: 'Relatórios', permissions: [{ key: 'reports.view', label: 'Visualizar' }] },
  { group: 'Automações', permissions: [{ key: 'automations.view', label: 'Visualizar' }, { key: 'automations.create', label: 'Criar' }, { key: 'automations.edit', label: 'Editar' }] },
  { group: 'Configurações', permissions: [{ key: 'settings.view', label: 'Visualizar' }, { key: 'settings.edit', label: 'Editar' }] },
] as const
