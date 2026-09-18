# Phase 5 — Performance e Indexes
**Data:** 2026-09-17  
**Status:** ✅ APROVADO com 1 fix gerado

---

## Cobertura de Indexes

**31 de 34 tabelas** com `company_id` têm index explícito ou implícito nessa coluna.

### Exceções verificadas

| Tabela | Situação | Impacto |
|--------|----------|---------|
| `purchase_orders` | ⚠️ Sem index em company_id | HIGH — usada em 13+ queries |
| `company_integrations` | ✅ `unique(company_id, type)` implícito | OK |
| `notification_preferences` | ✅ `unique(user_id, company_id)` implícito | OK |

### F-011: `purchase_orders` sem index em `company_id`

**Impacto:** Toda listagem de pedidos de compra por empresa faz full table scan.  
Com centenas de empresas e milhares de pedidos, isso degrada O(n) → necessita atenção.

`purchase_order_items` também carecia de index em `purchase_order_id` (FK sem index auto-criado).

**Fix:** Migration 0049 — 4 indexes criados:
- `purchase_orders(company_id)` ✅
- `purchase_orders(company_id, status)` ✅
- `purchase_orders(company_id, created_at desc)` ✅
- `purchase_order_items(purchase_order_id)` ✅

---

## Materialized View

`mv_product_sales_summary` — precomputa totais de vendas por produto/empresa.

- Indexada por `product_id` (unique) e `(company_id, total_revenue desc)`
- `refresh_sales_summary()` callable apenas por service_role
- Evita joins pesados na tela de relatório ABC/curva

✅ Padrão correto para queries de relatório.

---

## Dashboard — Multiple Round Trips

`getDashboardData()` executa ~10 queries sequenciais:
- products (todos da empresa)
- sales atual + anterior (dois queries)
- sale_items para margem (dois queries via `.in()`)
- stock_movements para atividade recente

**Observação:** Para empresas com alto volume (10k+ vendas/mês), o `.in('sale_id', saleIds)` pode retornar um IN clause muito longo. Threshold prático: sem impacto perceptível até ~1.000 vendas/mês.  
**Recomendação futura:** Criar função ou view para KPIs mensais, reduzindo para 2-3 queries.  
**Prioridade:** BAIXA — não afeta MVP.

---

## RLS Policy Performance

Policies mais custosas detectadas em `notifications`:
```sql
company_id = (SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1)
```
Esta política usa subquery em vez de `my_company_id()`.  
`profiles(company_id)` indexado → custo baixo, mas inconsistente com padrão do projeto.

**Tech debt:** Uniformizar para `my_company_id()` numa migration futura.

---

## Conclusão

**Phase 5: APROVADO** — Cobertura de índices adequada.  
1 fix gerado (migration 0049) para `purchase_orders`.  
Dashboard funciona corretamente para volumes normais de SaaS early-stage.
