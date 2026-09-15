# KYRA ESTOQUE — CONTEXTO DO PROJETO

> Documento unificado para uso de IA/Claude. Autocontido. Sem referências cruzadas.
> Última revisão: 2026-09-06

---

## 1. O QUE É O PROJETO

**Kyra Estoque** é um SaaS de gestão de estoque com inteligência artificial para pequenos e médios negócios brasileiros.

**Posicionamento:** "Você vende. A gente cuida do resto."

Não é um ERP genérico. É um sistema que entende a operação, encontra problemas antes do usuário e recomenda ações.

**Produto:** Multi-tenant SaaS. Cada empresa (tenant) tem dados isolados por `company_id` + RLS no banco.

---

## 2. STACK TÉCNICO

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 15.3, App Router, TypeScript strict, Tailwind v4 |
| Backend | Supabase (PostgreSQL + RLS + Edge Functions) |
| Auth | Supabase Auth |
| IA | Anthropic API (Claude) — integração pendente, hoje mock |
| Automações | n8n — configurado, workflows reais pendentes |
| Email | Resend REST API (sem package, fetch direto) |
| Monorepo | Turborepo — apps/web, packages/shared |
| Deploy | Vercel (frontend), Supabase Cloud |

**Versão do Node:** compatível com Next.js 15.3  
**Package manager:** pnpm

---

## 3. ESTRUTURA DE PASTAS (apps/web/src)

```
app/
  (auth)/          → login, register
  (app)/           → módulos internos (sidebar layout)
    dashboard/
    products/
    stock/
    purchases/
    pdv/
    sales/
    customers/
    suppliers/
    channels/
    automations/
    kyra/
    settings/
  (legal)/         → /privacy, /terms (layout sem sidebar)
  layout.tsx       → root layout (fontes, CookieBanner, Toaster)
  page.tsx         → landing page pública

components/
  ui/              → componentes reutilizáveis (Button, Input, etc.)
  layout/          → Sidebar, AppShell, Topbar

lib/
  actions/         → Server Actions
  supabase/        → client, server, middleware
  utils/

types/             → tipos TypeScript do domínio
```

---

## 4. BANCO DE DADOS (Supabase)

### Regras absolutas de segurança (NUNCA violar)
- `company_id` nunca vem do frontend — sempre do token de sessão server-side
- `service_role` key somente server-side (Edge Functions, Server Actions)
- RLS ativo em TODAS as tabelas desde a migration 0001
- IA nunca acessa o banco diretamente — sempre via tool controlada
- n8n não é dono de regras críticas de negócio
- `stock_movements` é imutável: trigger bloqueia UPDATE/DELETE

### Migrations aplicadas (0001–0020)
0001 company_id/RLS base · 0002 products · 0003 stock_movements · 0004 customers · 0005 suppliers · 0006 purchases · 0007 sales · 0008 sale_items · 0009 channels · 0010 automations · 0011 settings · 0012 product_images · 0013 price_history · 0014 purchase_items · 0015 notifications · 0016 ai_recommendations · 0017 ai_conversations · 0018 ai_messages · 0019 api_keys · 0020 audit_log

### Tabela central: stock_movements
- Fonte de verdade do estoque (imutável)
- Estoque atual = soma de todos os movimentos por produto
- Tipos: entrada, saida, ajuste, transferencia, inventario
- Trigger impede UPDATE e DELETE — erros se corrigem com movimentos contrários

---

## 5. ARQUITETURA DE IA

```
Usuário
→ Kyra (interface)
→ Tool controlada (Server Action)
→ Business Rule (validação)
→ Banco (via service role server-side)
→ Resultado para Kyra
→ Resposta ao usuário
```

**IA atual:** mock — respostas fixas em `lib/actions/kyra.ts`  
**IA planejada:** Anthropic Claude API com tools/function calling  
**Componentes de AI UX:** AICopilot, AIRecommendation, AIExplanation, AIConfidence, AIAction, AIActionState, AIInline, AIAlert, AISummary, AIEmpty, AILoading, AIError

---

## 6. MÓDULOS — STATUS ATUAL

| Módulo | Status | Observações |
|--------|--------|-------------|
| Dashboard | ✅ Implementado | KPIs reais, recomendações (mock IA) |
| Produtos | ✅ Implementado | Cadastro manual + upload por imagem (Anthropic pendente) |
| Estoque | ✅ Implementado | stock_movements, inventário |
| Compras | ✅ Implementado | Pedidos, recebimento |
| PDV | ✅ Implementado | Venda presencial, pagamento |
| Vendas | ✅ Implementado | Histórico, cancelamento |
| Clientes | ✅ Implementado | CRUD completo |
| Fornecedores | ✅ Implementado | CRUD completo |
| Canais | ⚠️ MVP/Mockup | UI existe, sem integração real |
| Automações | ⚠️ UI pronta | n8n não conectado |
| Kyra IA | ⚠️ Mock | Anthropic API não integrada |
| Configurações | ✅ Implementado | Empresa, usuários, planos |
| Landing Page | ✅ Implementada | Planos atualizados (Organiza/Impulsiona/Escala) |
| Legal (LGPD) | ✅ Implementado | /privacy, /terms, CookieBanner |
| Relatórios | ❌ Não existe | Próxima fase |
| Financeiro | ❌ Não existe | Próxima fase |

---

## 7. PLANOS DO PRODUTO

| Plano | Preço Mensal | Preço Anual | Destaque |
|-------|-------------|-------------|---------|
| Kyra Organiza | R$ 66,90 | R$ 53,52 | — |
| Kyra Impulsiona | R$ 129,90 | R$ 103,92 | MAIS POPULAR |
| Kyra Escala | R$ 249,90 | R$ 199,92 | — |

Trial: 14 dias grátis no Kyra Impulsiona.  
Desconto anual: ~20%.  
Clientes, fornecedores e usuários são ilimitados em todos os planos.

---

## 8. FONTES TIPOGRÁFICAS

- `--font-display`: DM Sans — títulos, destaques
- `--font-sans`: Inter — corpo, UI
- `--font-mono`: JetBrains Mono — código, dados técnicos

Definidas em `app/layout.tsx` via next/font/google.

---

## 9. IDENTIDADE VISUAL

- Cor primária: Teal `#0D9488` (NÃO green — é teal)
- Variantes Tailwind: `teal-600` = #0D9488
- Backgrounds: white, `slate-50`, `slate-100`
- Texto: `slate-900` (heading), `slate-600` (body), `slate-400` (muted)
- Borda: `slate-200`
- Erro: `red-500`
- Sucesso: `emerald-500`
- Aviso: `amber-500`
- Logo: ícone Sparkles (lucide-react) em container teal + "Kyra" bold + "Estoque" pequeno

---

## 10. PADRÕES DE CÓDIGO

### Componentes
- `'use client'` somente quando necessário (eventos, useState, useEffect)
- Server Components por padrão no App Router
- Componentes de domínio em `components/ui/`
- Estados obrigatórios em toda tela: Normal, Loading, Empty, Error

### Formulários
- Validação client-side + server-side (nunca só um lado)
- Campos monetários com `NumberInput` padronizado
- Badges/pills para estados (nunca só cor)

### Server Actions
- Sempre validar `company_id` do servidor
- Nunca confiar em dados do body para `company_id`
- Retornar `{ data, error }` padronizado

### Sidebar (ordem fixa)
Início → Produtos → Estoque → Compras → PDV → Vendas → Clientes → Fornecedores → Canais → Automações → Kyra → Configurações

---

## 11. LGPD

- Política de Privacidade: `/privacy` — LGPD Art. 9 compliant
- Termos de Uso: `/terms` — 14 seções, CDC art. 49 (7 dias)
- Cookie Banner: `components/ui/cookie-banner.tsx` — localStorage `kyra_cookie_consent`
- DemoModal: checkbox de aceite obrigatório antes de enviar
- DPO email: privacidade@kyraestoque.com.br
- 72h breach notification (Art. 48)

---

## 12. DECISÕES ARQUITETURAIS REGISTRADAS

| ID | Decisão |
|----|---------|
| 0001 | Blueprint V3 é a fonte de verdade do produto |
| 0002 | Sidebar = navegação oficial (Figma-based, imutável) |
| 0003 | stock_movements imutável (trigger bloqueia UPDATE/DELETE) |
| 0004 | company_id sempre do servidor, nunca do frontend |
| 0005 | IA nunca acessa banco diretamente |
| 0006 | n8n não é dono de regras críticas de negócio |
| 0007 | Anthropic API = integração de IA oficial (pendente) |
| 0008 | Resend = provedor de email (REST, sem package) |
| 0009 | DM Sans + Inter + JetBrains Mono = tipografia oficial |
| 0010 | Teal #0D9488 = cor primária (não green) |
| 0011 | Figma = referência visual definitiva; não inventar sem consultar |
| 0012 | Planos: Organiza / Impulsiona / Escala (nomes oficiais) |
| 0013 | LGPD: /privacy, /terms, cookie banner implementados |

---

## 13. CONTEXTO DE IMPLEMENTAÇÃO ATUAL (Sprint 9)

**Sprint atual foca em:**
- Kyra IA real (Anthropic API + tools)
- n8n workflows reais
- Relatórios
- Financeiro (Asaas)
- Canais (integração real)

**Regra:** Antes de implementar qualquer tela, consultar o frame no Figma e os docs em `docs/product/`. Não inventar visual — seguir o Figma. Reutilizar Foundation e AI UX components.

---

## 14. ARQUIVOS-CHAVE PARA REFERÊNCIA

| Arquivo | Descrição |
|---------|-----------|
| `CLAUDE.md` (raiz) | Contrato de desenvolvimento — 42 regras absolutas |
| `docs/blueprint/Blueprint_MVP_SaaS_Estoque_IA_Automacao_V3.md` | Spec completa do produto (V3, 73 seções) |
| `docs/product/` | Spec de implementação por módulo (01–12) |
| `docs/figma/design-system/README.md` | Componentes do design system |
| `docs/figma/ai-ux/12_AI_UX_PATTERNS.md` | 20 padrões de AI UX oficiais |
| `docs/decisions/` | ADRs registradas |
| `_docs/KYRA-DESIGN-SYSTEM.md` | Design system unificado (este projeto) |
| `_docs/KYRA-PROXIMOS-PASSOS.md` | Roadmap das próximas fases |
