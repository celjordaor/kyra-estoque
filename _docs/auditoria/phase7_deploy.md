# Phase 7 — Deploy / Vercel / API Routes

Data: 2026-09-17 | Status: COMPLETO

## API Routes analisadas

### /api/demo (público — lead capture)
- ✅ Sem autenticação por design (landing page pública)
- ✅ Validação de campos obrigatórios (company, name, email, phone)
- ✅ Lead sempre salvo em DB antes do e-mail (fail-safe)
- ⚠️ **F-014 (LOW):** Sem rate limiting — sujeito a spam/DoS
- ⚠️ **F-015 (LOW):** Campos de usuário interpolados diretamente no HTML do e-mail (sem escape)

### /api/kyra/chat (autenticado)
- ✅ JWT via cookie → user.id → company_id via profile (admin client)
- ✅ Entitlement check via `canUse()` antes de qualquer call à Anthropic
- ✅ Feature flag para tools avançadas (`hasFeature('ai.advanced.enabled')`)
- ✅ `executeTool()` recebe `companyId` de autenticação, nunca do body
- ✅ MAX_TOOL_ITERATIONS = 5 (prevenção de loop infinito)

### /api/kyra/callback (n8n — webhook interno)
- ✅ Autenticado via `x-kyra-secret` vs `KYRA_WEBHOOK_SECRET` env var
- ✅ Validação de campos e enum de status
- ⚠️ **F-016 (LOW) — CORRIGIDO:** `KYRA_WEBHOOK_SECRET` não estava em `.env.example`

### /api/webhooks/asaas (Asaas billing)
- ✅ Autenticado via `asaas-access-token` header vs `ASAAS_WEBHOOK_TOKEN` env var
- ✅ Idempotência via `event_id` único
- ✅ Status mapping explícito (RECEIVED/CONFIRMED → paid, etc.)

### /api/webhooks/mercadolivre (ML notifications)
- 🔴 **F-017 (MEDIUM) — CORRIGIDO:** HMAC v2 message usava `xRequestId` nos dois campos
  (`id:` e `request-id:`), quando `id:` deve ser o `payload.id` da notificação.
  Bug causava: com secret configurado → todos os webhooks rejeitados (401);
  sem secret → sem verificação alguma.
- ✅ Após fix: `id:${payload.id};request-id:${xRequestId};ts:${ts};`

### /api/webhooks/shopify, /woocommerce
- ✅ HMAC-SHA256 por-tenant via `company_integrations.config.webhook_secret`
- ✅ `timingSafeEqual` para comparação (timing-safe)
- ✅ `randomBytes(32).toString('hex')` no cadastro da integração

### /auth/callback
- ✅ PKCE flow (`exchangeCodeForSession`) para forgot-password
- ✅ OTP flow (`verifyOtp`) para convites de membros
- ✅ Ativação de perfil (`is_active = true`) apenas no fluxo `invite`

## .env.example
- ✅ Adicionados: `KYRA_WEBHOOK_SECRET`, `MERCADOLIVRE_CLIENT_SECRET`
- ✅ Sem plano === '...' hardcoded em código-fonte

## Verificações gerais
- ✅ `vercel.json`: apenas installCommand, buildCommand, outputDirectory
- ✅ `@supabase/supabase-js: ^2.49.4`, `@supabase/ssr: ^0.6.1`
- ✅ Sem tokens JWT format antigo (`eyJhb`) no source
- ✅ `createAdminSupabaseClient()` usado apenas em arquivos server-side

## Fixes nesta fase
- F-016: Adicionado `KYRA_WEBHOOK_SECRET` e `MERCADOLIVRE_CLIENT_SECRET` ao `.env.example`
- F-017: Corrigido formato HMAC v2 no webhook do Mercado Livre
