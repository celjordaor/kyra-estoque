# Phase 2 — Isolamento Multitenant
**Data:** 2026-09-17  
**Status:** ✅ APROVADO — nenhuma vulnerabilidade de vazamento cross-tenant encontrada

---

## Escopo

Análise de todos os server actions e AI tools para detectar possível acesso cross-tenant:
- 24 arquivos em `apps/web/src/lib/actions/`
- `apps/web/src/lib/kyra/tools.ts`
- Função `public.my_company_id()` nas migrations

---

## Padrão de Arquitetura

### `getServerContext()` — padrão universal

```typescript
async function getServerContext() {
  const supabase = createServerSupabaseClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()   // JWT verificado server-side
  const admin = createAdminSupabaseClient()
  const { data: profile } = await admin.from('profiles').select('company_id').eq('id', user.id).single()
  return { supabase, admin, companyId: profile.company_id }
}
```

`company_id` **nunca vem do body/params do request** — sempre derivado do JWT autenticado.

### `my_company_id()` — função RLS

```sql
create or replace function public.my_company_id()
  returns uuid language sql security definer stable set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid() limit 1
$$;
```

- `SECURITY DEFINER` → executa com privilégios do owner, não do caller
- `set search_path = public` → previne search_path injection
- `auth.uid()` → definido pelo Supabase Auth no JWT, não pode ser spoofado client-side
- ✅ **Não pode ser forjada via client**

---

## Resultados por Arquivo

| Arquivo | Padrão | Company_ID | Mutations double-keyed | Status |
|---------|--------|------------|------------------------|--------|
| `billing.ts` | getServerContext() | JWT | `.eq('company_id', companyId)` | ✅ |
| `products.ts` | getServerContext() | JWT | `.eq('id', id).eq('company_id', companyId)` | ✅ |
| `channels.ts` | getServerContext() | JWT | `.eq('company_id', companyId)` | ✅ |
| `settings.ts` | getServerContext() | JWT | `.eq('id', companyId)` | ✅ |
| `team.ts` | getServerContext() | JWT | `.eq('id', userId).eq('company_id', companyId)` | ✅ |
| `security.ts` | supabase.auth.* | Auth | Sem mutations DB diretas | ✅ |
| `automations.ts` | getServerContext() | JWT | `.eq('id', id).eq('company_id', companyId)` | ✅ |
| `nfe.ts` | getServerContext() | JWT | `.eq('company_id', companyId)` | ✅ ¹ |
| `admin.ts` | requireSuperAdmin() | JWT | `input.company_id` (super-admin only) | ✅ ² |
| `dashboard.ts` | getServerContext() | JWT | Queries sempre `.eq('company_id', companyId)` | ✅ ³ |
| `reports.ts` | getServerContext() | JWT | `.eq('company_id', companyId)` | ✅ |
| `kyra/tools.ts` | parâmetro explícito | Chat API (JWT) | `.eq('company_id', companyId)` | ✅ |

**Notas:**
1. `nfe.ts`: falso positivo — `.eq('company_id')` é nome de coluna no filtro, não do body
2. `admin.ts`: `input.company_id` legítimo — `setTenantOverride()` protegida por `requireSuperAdmin()`
3. `dashboard.ts`: `sale_items` buscados via `.in('sale_id', saleIds)` — `saleIds` pré-filtrados por `company_id` da empresa, isolamento garantido indiretamente

---

## Análise Kyra AI Tools

`executeTool(toolName, input, companyId)` recebe `companyId` como parâmetro explícito.  
`companyId` é derivado na camada da API route (`/api/kyra/chat`) via JWT → profile query.  
Todas as 6 tools filtram queries por `.eq('company_id', companyId)`:

- `get_low_stock_alerts` ✅
- `get_product_info` ✅  
- `get_sales_analysis` ✅
- `get_purchase_suggestions` ✅
- `create_purchase_order` ✅ (insere `company_id: companyId` explicitamente)
- `get_demand_forecast` ✅

A IA **não pode acessar dados de outro tenant** — o `companyId` passado para as tools é sempre do usuário autenticado.

---

## Findings

### Nenhuma vulnerabilidade encontrada

Todos os server actions implementam corretamente:
1. Autenticação via `supabase.auth.getUser()` (verificação server-side, não decode local)
2. Derivação de `company_id` a partir do perfil do usuário autenticado
3. Filtros `.eq('company_id', companyId)` em todas as queries
4. Mutations double-keyed com `id` + `company_id` para prevenir IDOR

---

## Conclusão

**Phase 2: APROVADO** — Isolamento multitenant correto em todos os server actions analisados.  
Arquitetura de defesa em profundidade: application layer (getServerContext) + database layer (RLS com my_company_id).

