# Phase 9 — Behaviors / Features

Data: 2026-09-17 | Status: COMPLETO

## Canais de venda — webhook_secret
- ✅ Gerado via `randomBytes(32).toString('hex')` em `channels.ts:176`
- ✅ Secret por-tenant armazenado em `company_integrations.config.webhook_secret`
- ✅ Shopify e WooCommerce: verificação HMAC-SHA256 com secret do tenant

## Notificações in-app (topbar Bell)
- ⚠️ **Sprint 23 (pendente):** `notificationCount` sempre 0
  - `AppShell` aceita `notificationCount?: number` mas layout não o passa
  - Bell icon renderizado, mas nunca mostra badge real
  - Não é bug de segurança; é feature não implementada

## Kyra — greeting hardcoded
- ⚠️ **Sprint 24 (pendente):** `"${greeting()}, Celso."` em `kyra-page.tsx:364`
  - Deve usar nome real do usuário autenticado
  - Não é bug de segurança; é bug de UX

## Kyra insights
- ⚠️ Insights cards na tela Kyra usam dados mockados/placeholders
  - Sprint 24 deve conectar com dados reais via `dashboard.ts`

## Billing history
- ✅ `getBillingHistory()` em `billing.ts` chama Asaas API com `company_id` filtrado
- ✅ Retorna invoices com links de boleto/invoice do provider

## Entitlement overrides (fase 10)
- ✅ `fetchActiveOverride()` verifica `expires_at` antes de retornar
- ✅ `hasFeature()`: feature_flag → override → plano (prioridade correta)
- ✅ `getLimit()`: override → plano
- ✅ `canUse()`: getLimit + getUsage → boolean `allowed`
- ✅ Feature flags: `commercial_enabled && technical_status === 'available'`
- ✅ Fail-open para features não cadastradas em `feature_flags`
- ✅ `incrementUsage()` usa admin client via RPC

## Verificações de plano hardcoded
- ✅ Nenhum `plan === '...'` encontrado no código (exceto comentários e tipos)
- ✅ 100% do gating via `hasFeature()` / `canUse()` / `getLimit()`
