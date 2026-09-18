# Phase 4 — Consistência de Queries e Dados
**Data:** 2026-09-17  
**Status:** ✅ APROVADO — nenhum problema crítico encontrado

---

## Foreign Keys

### Cascade ON DELETE (por design)
Todas as 35 entidades de tenant têm `references public.companies(id) on delete cascade`.  
Deleção de empresa cascateia corretamente para todos os dados relacionados.

### Tabelas com ON DELETE RESTRICT
- `purchase_order_items → products` — produto não pode ser deletado se tem pedido de compra
- `sale_items → products` — produto não pode ser deletado se tem vendas históricas  
- `stock_movements → products` — produto não pode ser deletado se tem movimentações

Correto: app usa soft-delete (`is_active = false`) em vez de hard-delete para produtos.

### Tabelas com NO ACTION (risco potencial)
| Tabela | Referencia | Impacto |
|--------|-----------|---------|
| `financial_accounts` | companies | Company deletion bloqueado se tem contas financeiras |
| `financial_transactions` | companies + financial_accounts | Idem + transações |
| `channel_orders` | sales | Sale deletion bloqueado se tem channel order vinculado |
| `nfe_documents` | sales, purchase_orders | Idem |

**Severidade:** LOW — deleção de empresa não é feature do produto (apenas admin via service_role).  
Para offboarding completo de empresa, precisaria deletar financial_accounts/transactions primeiro.

---

## Unique Constraints

Todos os objetos de negócio têm unique constraints tenant-scoped:

| Tabela | Unique |
|--------|--------|
| categories | (company_id, slug) |
| products | (company_id, sku) |
| sales | (company_id, sale_number) |
| suppliers/customers | (company_id, document) |
| company_automations | (company_id, automation_type) |
| discount_coupons | (company_id, code) |
| roles | (company_id, name) |
| user_roles | (company_id, user_id, role_id) |
| usage_counters | (company_id, metric_key, period_start) |
| billing_events | (provider, event_id) — idempotência de webhook |
| tenant_entitlement_overrides | (company_id, feature_key) |

---

## Check Constraints

| Tabela | Constraint |
|--------|-----------|
| products | max_stock is null OR max_stock >= min_stock |
| stock_movements | quantity > 0 (sempre positivo; tipo define crédito/débito) |
| plan_entitlements | value_type in ('integer', 'boolean', 'string') |
| companies | plan in ('free', 'pro', 'enterprise') — campo legado |
| subscriptions | status in ('trialing','active','past_due','canceled','expired','paused') |

---

## Observações

### `companies.plan` — campo legado
A tabela `companies` tem coluna `plan text not null default 'free'` que não é referenciada no código da aplicação.  
O sistema de planos migrou para `subscriptions + plan_entitlements`.  
**Ação futura:** Pode ser removida em migration futura após confirmar que nenhum código externo a usa.

### `generate_sale_number` — sequence global
`nextval('public.sale_number_seq')` é uma sequência global (não por empresa).  
Resultado: números não são sequenciais por empresa, e não resetam por ano.  
Ex: Company A recebe VND-2026-00001, Company B recebe VND-2026-00002.  
**Impacto:** Cosmético apenas — unicidade está garantida pelo índice `unique(company_id, sale_number)`.

### RLS em policies `sales` migradas para `my_company_id()`
Migration 0008 substituiu subquery em profiles por `my_company_id()` em todas as policies de `sales`.  
Policies antigas (migration 0005) foram explicitamente removidas com `drop policy if exists`.

---

## Conclusão

**Phase 4: APROVADO** — Integridade referencial correta, constraints adequados.  
Dois itens de tech debt identificados (campo legado + sale_number sequence) sem impacto de segurança ou integridade.
