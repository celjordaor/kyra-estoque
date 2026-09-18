# Phase 3 — RLS, Triggers e Functions
**Data:** 2026-09-17  
**Status:** ✅ APROVADO com 2 findings corrigidos

---

## Cobertura RLS

**100% das 41 tabelas** têm `enable row level security` — nenhuma tabela sem RLS.

### Tabelas com 0 políticas (DENY ALL intencional)

| Tabela | Justificativa |
|--------|---------------|
| `billing_events` | Admin/webhook only — acesso apenas via service_role |
| `leads` | Admin portal — acesso apenas via service_role |

Comportamento correto: RLS habilitado + sem policies = DENY ALL para authenticated/anon.  
Service role bypassa RLS por design do Supabase.

---

## Análise de Triggers

### Imutabilidade de stock_movements ✅
- `no_update_stock_movements` / `no_delete_stock_movements` → bloqueia qualquer UPDATE/DELETE externo
- `prevent_movement_mutation` com `pg_trigger_depth() > 1` → permite updates internos de triggers (ex: `balance_after`)
- Trilha de auditoria protegida contra adulteração

### Duplo-trigger de baixa de estoque ✅
- `sale_status_changed` → `handle_sale_completed()`: fires on UPDATE status→COMPLETED (fluxo tradicional)
- `sale_item_creates_stock_movement` → `handle_sale_item_inserted()`: fires on INSERT sale_item quando venda já é COMPLETED (fluxo PDV)
- Cenários mutuamente exclusivos: sem double-count de movimentos

### Trigger `on_auth_user_created` ✅
- `handle_new_user()` cria perfil automaticamente via SECURITY DEFINER
- Usa `set search_path = public` ✅

---

## Análise de Functions

### Security DEFINER — status geral

| Função | search_path | Grant | Status |
|--------|-------------|-------|--------|
| `handle_new_user` | ✅ | Trigger only | ✅ |
| `my_company_id` | ✅ | anon, authenticated | ✅ (necessário para RLS) |
| `my_role` | ✅ | anon, authenticated | ✅ (necessário para RLS) |
| `increment_usage_counter` | ✅ | ~~authenticated~~ → revogado | 🔧 F-008 |
| `create_company_trial` | ✅ | ~~authenticated~~ → revogado | 🔧 F-009 |
| `create_company_trial` (v2, 0032) | ✅ | ~~authenticated~~ → revogado | 🔧 F-009 |
| `handle_new_company` | ✅ | Trigger only | ✅ |
| `complete_automation_run` | ✅ | (revogado em 0026) | ✅ |
| `refresh_sales_summary` | ✅ | (revogado em 0028) | ✅ |
| `update_product_stock` | ~~faltando~~ → ✅ | Trigger only | 🔧 F-010 |
| `handle_sale_completed` | ~~faltando~~ → ✅ | Trigger only | 🔧 F-010 |
| `handle_sale_item_inserted` | ~~faltando~~ → ✅ | Trigger only | 🔧 F-010 |
| `mark_overdue_transactions` | ~~faltando~~ → ✅ | No grant | 🔧 F-010 |

---

## Findings

### F-008 (MEDIUM) — `increment_usage_counter` grant desnecessário a `authenticated`
**Risco:** Usuário autenticado podia chamar RPC diretamente com qualquer `p_company_id`.  
Efeito: inflacionar contadores de uso de outro tenant → forçar quota exceed → DoS lógico.  
A função é chamada somente via `createAdminSupabaseClient()` server-side.  
**Fix:** `REVOKE EXECUTE ... FROM authenticated` — migration 0048 ✅

### F-009 (LOW) — `create_company_trial` grant desnecessário a `authenticated`
**Risco:** Usuário autenticado podia criar trial para qualquer empresa via RPC.  
Mitigado parcialmente pela verificação de idempotência (empresa com subscription existente retorna sem ação).  
A função é chamada somente pelo trigger `on_company_created`.  
**Fix:** `REVOKE EXECUTE ... FROM authenticated` — migration 0048 ✅

### F-010 (LOW) — 4 funções SECURITY DEFINER sem `set search_path`
**Risco:** Violação de best practice — em teoria permite search_path injection.  
**Mitigação real:** Nenhuma das 4 é chamável por usuários (não há grant para authenticated/anon).  
As 3 trigger functions usam `public.` explícito nos SQL internos.  
`mark_overdue_transactions` usa nomes de tabela sem prefixo (mas sem grant).  
**Fix:** `set search_path = public` adicionado a todas — migration 0048 ✅

---

## Conclusão

**Phase 3: APROVADO** — RLS 100% coberto, triggers auditados sem regressões, grants de RPC corrigidos.  
**Migration 0048** gerada com 3 correções (F-008 + F-009 + F-010).  
Commit pendente.
