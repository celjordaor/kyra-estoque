# Phase 6 — Segurança HTTP e Exposição de Secrets
**Data:** 2026-09-17  
**Status:** ✅ APROVADO com 2 fixes aplicados

---

## HTTP Security Headers

### F-012 (MEDIUM): Headers de segurança ausentes
`next.config.ts` não configurava nenhum header de segurança HTTP.  
Risco: XSS, clickjacking, MIME sniffing, HTTPS downgrade.

**Fix aplicado:** `apps/web/next.config.ts` atualizado com:

| Header | Valor | Proteção |
|--------|-------|----------|
| `X-Content-Type-Options` | nosniff | MIME sniffing |
| `X-Frame-Options` | SAMEORIGIN | Clickjacking |
| `X-XSS-Protection` | 1; mode=block | XSS (IE legado) |
| `Strict-Transport-Security` | max-age=31536000; includeSubDomains; preload | HTTPS downgrade |
| `Referrer-Policy` | strict-origin-when-cross-origin | Info leakage |
| `Permissions-Policy` | camera=(), microphone=(), geolocation=() | Device APIs |
| `Content-Security-Policy` | (completo — ver arquivo) | XSS, injection |

**Nota CSP:** `unsafe-inline` e `unsafe-eval` incluídos por compatibilidade com Next.js.  
Para produção hardened: migrar para nonces/hashes quando houver ciclo de manutenção.

---

## Exposição de Secrets

### Variáveis client-side (NEXT_PUBLIC_*) ✅
- `NEXT_PUBLIC_SUPABASE_URL` — OK (URL pública)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — OK (anon key é pública by design do Supabase)
- `NEXT_PUBLIC_APP_URL` — OK

### Variáveis server-side ✅
- `SUPABASE_SERVICE_ROLE_KEY` — usado somente em `createAdminSupabaseClient()` server-side
- `ANTHROPIC_API_KEY` — usado somente em `/api/kyra/chat` server-side
- `RESEND_API_KEY` — usado somente em `automations.ts` server action
- `ASAAS_WEBHOOK_TOKEN` — usado somente em `/api/webhooks/asaas/route.ts`

### .gitignore ✅
`.env`, `.env.local`, `.env.*.local`, `.env.production` todos ignorados.

### .env.example incompleto (F-013, LOW)
O arquivo original não documentava `RESEND_API_KEY`, `ASAAS_WEBHOOK_TOKEN`.  
**Fix:** `.env.example` atualizado com todas as variáveis necessárias + comentários.

---

## Input Validation

### Formulários com Zod ✅
- `src/lib/validations/product.ts` — schema completo com tipos, ranges, formatos

### API Routes ✅
- `/api/kyra/chat` — auth JWT → company_id → entitlement check → input shape via TypeScript
- `/api/webhooks/shopify` + `/woocommerce` — HMAC-SHA256 verification antes de processar
- `/api/webhooks/asaas` — token verification (F-007 corrigido na Phase 1)

### Rate Limiting
- Kyra chat: entitlement `ai.queries.monthly` limita chamadas/mês
- Outros endpoints: sem rate limiting explícito (depende de Supabase/Vercel)
- **Tech debt futuro:** Adicionar rate limiting no middleware para endpoints sensíveis

---

## Conclusão

**Phase 6: APROVADO** com 2 fixes:
- F-012: Security headers adicionados ao `next.config.ts`
- F-013: `.env.example` atualizado com variáveis completas
