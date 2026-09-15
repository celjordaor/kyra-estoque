# Supabase — Kyra Estoque 360

## Setup local

```bash
# 1. Instalar Supabase CLI
npm install -g supabase

# 2. Login
supabase login

# 3. Iniciar stack local (Docker necessário)
supabase start

# 4. Aplicar migrations
supabase db push

# 5. Popular dados de dev
supabase db seed

# 6. Gerar types TypeScript (após mudanças no schema)
supabase gen types typescript --local > packages/database/src/types.ts
```

## Migrations

| Arquivo | O que cria |
|---|---|
| `001_init_extensions.sql` | Extensions pg, helper functions |
| `002_companies_profiles.sql` | Multi-tenant root + auth trigger |
| `003_categories_products.sql` | Catálogo de produtos + full-text search |
| `004_stock_movements.sql` | Movimentos (source of truth) + trigger cache |
| `005_sales.sql` | Vendas + itens + trigger de baixa automática |
| `006_ai_recommendations.sql` | Recomendações IA + logs de automação |

## Regras críticas de RLS

- `company_id` está em TODAS as tabelas — nunca acesse dados sem filtrar por ele
- O `company_id` vem SEMPRE da sessão autenticada (via `profiles`), nunca do frontend
- `stock_movements` é IMUTÁVEL — triggers bloqueiam UPDATE e DELETE
- `service_role` key NUNCA no frontend — somente em Server Actions, Route Handlers, e n8n
