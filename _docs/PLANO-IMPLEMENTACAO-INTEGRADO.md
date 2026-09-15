# Plano de Implementação Integrado — Kyra Estoque
## Sprints 10–19+ | Assinatura · Configurações · Admin Portal · IA · n8n · Relatórios · Financeiro · Canais

> **Status:** plano aprovado para execução  
> **Pré-requisito de leitura:** KYRA-CONTEXT.md, KYRA-PROXIMOS-PASSOS.md, 03ARQUITETURAASSINATURAS.md  
> **Regra transversal:** nenhum `if plan === ...` no código. Toda gating passa pelo `entitlement service`.

---

## 0. Cadeia de Dependências (leia antes dos sprints)

```
[Sprint 10a] DB migrations (plans, plan_entitlements, subscriptions, usage_counters)
      ↓
[Sprint 10b] Entitlement Service + Trial (14d Impulsiona no signup)
      ↓
[Sprint 11] Settings: Assinatura UI + Usuários + Perfis/Permissões
      ↓
[Sprint 12] Settings: Inteligência + Integrações + Segurança
      ↓
[Sprint 13] Admin Portal (Tenants, Leads, Suporte, Automations Log)
      ↓
[Sprint 14] Enforcement nos módulos existentes (produtos, canais, automações, IA, imagem)
      ↓
[Sprint 15] Kyra IA Real — Anthropic API com tool use
      ↓
[Sprint 16] Relatórios (7 relatórios core + exportação)
      ↓
[Sprint 17] Financeiro + Asaas (contas a pagar/receber, boleto, Pix)
      ↓
[Sprint 18] Canais — integração real (Shopify, Mercado Livre, WooCommerce)
      ↓
[Sprint 19+] PDV Avançado · XML NF-e Import · Multiestoque · BI · WhatsApp operacional
```

**Regra:** nenhum sprint pode começar sem o anterior entregue e em produção. O entitlement service é o alicerce de tudo que vem depois.

---

## 1. Matriz de Features por Plano

Usada para popular `plan_entitlements` no seed e para guiar toda gating.

| feature_key | Organiza | Impulsiona | Escala | Fase |
|---|---|---|---|---|
| `products.max` | 1000 | 5000 | NULL (ilimitado) | 10a |
| `customers.max` | NULL | NULL | NULL | 10a |
| `suppliers.max` | NULL | NULL | NULL | 10a |
| `users.max` | NULL | NULL | NULL | 10a |
| `channels.max` | 1 | 3 | 10 | 10a |
| `automations.max` | 2 | 10 | NULL | 10a |
| `image_product_ai.monthly` | 50 | NULL | NULL | 10a |
| `history.months` | 6 | 24 | NULL | 10a |
| `nfe.import.enabled` | false | true | true | 19+ |
| `fiscal.enabled` | false | true | true | 19+ |
| `nfe.emission.enabled` | false | true | true | 19+ |
| `pdv.advanced.enabled` | false | true | true | 19+ |
| `channels.advanced.enabled` | false | true | true | 18 |
| `automations.advanced.enabled` | false | true | true | 14 |
| `purchasing.advanced.enabled` | false | true | true | 19+ |
| `whatsapp.operational.enabled` | false | true | true | 19+ |
| `ai.advanced.enabled` | false | true | true | 15 |
| `multi_stock.enabled` | false | false | true | 19+ |
| `bi.advanced.enabled` | false | true | true | 19+ |
| `reports.advanced.enabled` | false | true | true | 16 |
| `financial.enabled` | false | true | true | 17 |
| `support.priority` | false | true | true | 13 |

> **NULL = ilimitado** (nunca usar `0` para ilimitado — `0` significa bloqueado).

---

## 2. Sprint 10a — Fundação de Banco (Assinaturas)

**Objetivo:** criar toda a camada de dados de assinatura. Sem UI ainda.

### Migrations a criar

```sql
-- 001_plans.sql
create table plans (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,         -- 'kyra-organiza' | 'kyra-impulsiona' | 'kyra-escala'
  name text not null,
  description text,
  active boolean default true,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- 002_plan_prices.sql
create table plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans(id),
  billing_interval text not null,    -- 'month' | 'year'
  amount_cents int not null,
  currency text default 'BRL',
  active boolean default true,
  provider_price_id text,            -- ex: Stripe price_xxx (quando definido)
  created_at timestamptz default now()
);

-- 003_plan_entitlements.sql
create table plan_entitlements (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans(id),
  feature_key text not null,
  value_type text not null,         -- 'integer' | 'boolean' | 'unlimited'
  int_value int,                    -- NULL = ilimitado quando value_type = 'integer'
  bool_value boolean,
  created_at timestamptz default now(),
  unique(plan_id, feature_key)
);

-- 004_subscriptions.sql
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) not null,
  plan_id uuid references plans(id) not null,
  price_id uuid references plan_prices(id),
  status text not null default 'trialing',  -- trialing|active|past_due|canceled|expired|paused
  billing_interval text,             -- 'month' | 'year'
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_start timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean default false,
  canceled_at timestamptz,
  provider text,                    -- 'stripe' | 'asaas' | 'mock'
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- índice e RLS
create index on subscriptions(company_id);
alter table subscriptions enable row level security;
create policy "company vê própria assinatura" on subscriptions
  for select using (company_id = my_company_id());

-- 005_usage_counters.sql
create table usage_counters (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) not null,
  metric_key text not null,         -- ex: 'image_product_ai.monthly'
  period_start date not null,
  period_end date not null,
  quantity int default 0,
  updated_at timestamptz default now(),
  unique(company_id, metric_key, period_start)
);
alter table usage_counters enable row level security;
create policy "company vê próprio uso" on usage_counters
  for select using (company_id = my_company_id());

-- 006_billing_events.sql
create table billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,           -- usado para idempotência
  event_type text not null,
  payload jsonb,
  processed_at timestamptz,
  status text default 'pending',    -- pending | processed | failed
  error_message text,
  unique(provider, event_id)
);
-- sem RLS — apenas service_role acessa

-- 007_roles_permissions.sql (para Sprint 11 — Perfis)
create table roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) not null,
  name text not null,
  description text,
  permissions jsonb default '{}',  -- { "products.create": true, "sales.view": true, ... }
  is_default boolean default false,
  created_at timestamptz default now()
);
alter table roles enable row level security;
create policy "company gerencia próprios roles" on roles
  for all using (company_id = my_company_id());

-- user_roles (vínculo usuário ↔ role)
create table user_roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) not null,
  user_id uuid references auth.users(id) not null,
  role_id uuid references roles(id) not null,
  created_at timestamptz default now(),
  unique(company_id, user_id, role_id)
);
alter table user_roles enable row level security;
create policy "company gerencia vínculos" on user_roles
  for all using (company_id = my_company_id());
```

### Seed dos 3 planos

```sql
-- seed_plans.sql
insert into plans (slug, name, description, sort_order) values
  ('kyra-organiza',   'Kyra Organiza',   'Para colocar sua operação em ordem.', 1),
  ('kyra-impulsiona', 'Kyra Impulsiona', 'Para entender e decidir melhor.',      2),
  ('kyra-escala',     'Kyra Escala',     'Para automatizar e crescer.',          3);

-- preços mensais
insert into plan_prices (plan_id, billing_interval, amount_cents) 
  select id, 'month', 6690  from plans where slug = 'kyra-organiza';
insert into plan_prices (plan_id, billing_interval, amount_cents)
  select id, 'month', 12990 from plans where slug = 'kyra-impulsiona';
insert into plan_prices (plan_id, billing_interval, amount_cents)
  select id, 'month', 24990 from plans where slug = 'kyra-escala';

-- preços anuais (20% de desconto)
insert into plan_prices (plan_id, billing_interval, amount_cents)
  select id, 'year', 64224  from plans where slug = 'kyra-organiza';   -- 66,90 * 12 * 0.8
insert into plan_prices (plan_id, billing_interval, amount_cents)
  select id, 'year', 124704 from plans where slug = 'kyra-impulsiona'; -- 129,90 * 12 * 0.8
insert into plan_prices (plan_id, billing_interval, amount_cents)
  select id, 'year', 239904 from plans where slug = 'kyra-escala';     -- 249,90 * 12 * 0.8

-- entitlements (ver função helper abaixo)
-- Organiza
insert into plan_entitlements (plan_id, feature_key, value_type, int_value)
  select id, 'products.max', 'integer', 1000 from plans where slug = 'kyra-organiza';
insert into plan_entitlements (plan_id, feature_key, value_type, int_value)
  select id, 'customers.max', 'unlimited', null from plans where slug = 'kyra-organiza';
-- ... (repetir para todos os entitlements da tabela da seção 1)
```

---

## 3. Sprint 10b — Entitlement Service + Trial

**Objetivo:** serviço central que toda a aplicação usa. Nenhum módulo verifica plano diretamente.

### Arquivo: `packages/shared/src/entitlements/entitlement-service.ts`

```typescript
import { createClient } from '@/lib/supabase/server'

export type EntitlementResult = {
  allowed: boolean
  limit: number | null     // null = ilimitado
  usage: number
  remaining: number | null // null = ilimitado
}

// Cache por request (Next.js cache() ou React cache)
export async function getCompanyEntitlements(companyId: string) {
  const supabase = createClient()
  
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan_id, status, trial_end')
    .eq('company_id', companyId)
    .single()

  if (!subscription || ['canceled', 'expired'].includes(subscription.status)) {
    return null // sem acesso
  }

  const { data: entitlements } = await supabase
    .from('plan_entitlements')
    .select('feature_key, value_type, int_value, bool_value')
    .eq('plan_id', subscription.plan_id)

  return { subscription, entitlements: entitlements ?? [] }
}

export async function hasFeature(companyId: string, featureKey: string): Promise<boolean> {
  const ctx = await getCompanyEntitlements(companyId)
  if (!ctx) return false
  const ent = ctx.entitlements.find(e => e.feature_key === featureKey)
  if (!ent) return false
  return ent.value_type === 'boolean' ? (ent.bool_value ?? false) : true
}

export async function getLimit(companyId: string, metricKey: string): Promise<number | null> {
  const ctx = await getCompanyEntitlements(companyId)
  if (!ctx) return 0
  const ent = ctx.entitlements.find(e => e.feature_key === metricKey)
  if (!ent) return 0
  if (ent.value_type === 'unlimited') return null  // null = sem limite
  return ent.int_value ?? 0
}

export async function getUsage(companyId: string, metricKey: string): Promise<number> {
  const supabase = createClient()
  const periodStart = new Date()
  periodStart.setDate(1)
  const { data } = await supabase
    .from('usage_counters')
    .select('quantity')
    .eq('company_id', companyId)
    .eq('metric_key', metricKey)
    .eq('period_start', periodStart.toISOString().slice(0, 10))
    .single()
  return data?.quantity ?? 0
}

export async function canUse(companyId: string, metricKey: string): Promise<EntitlementResult> {
  const limit = await getLimit(companyId, metricKey)
  const usage = await getUsage(companyId, metricKey)
  
  if (limit === null) {
    return { allowed: true, limit: null, usage, remaining: null }
  }
  
  return {
    allowed: usage < limit,
    limit,
    usage,
    remaining: Math.max(0, limit - usage)
  }
}

export async function incrementUsage(companyId: string, metricKey: string, amount = 1) {
  const supabase = createClient()
  const periodStart = new Date()
  periodStart.setDate(1)
  const periodEnd = new Date(periodStart)
  periodEnd.setMonth(periodEnd.getMonth() + 1)
  periodEnd.setDate(0)

  await supabase.rpc('increment_usage_counter', {
    p_company_id: companyId,
    p_metric_key: metricKey,
    p_period_start: periodStart.toISOString().slice(0, 10),
    p_period_end: periodEnd.toISOString().slice(0, 10),
    p_amount: amount
  })
}
```

### Função Supabase para increment (atomic)

```sql
create or replace function increment_usage_counter(
  p_company_id uuid, p_metric_key text,
  p_period_start date, p_period_end date, p_amount int default 1
) returns void language plpgsql security definer as $$
begin
  insert into usage_counters (company_id, metric_key, period_start, period_end, quantity)
  values (p_company_id, p_metric_key, p_period_start, p_period_end, p_amount)
  on conflict (company_id, metric_key, period_start)
  do update set quantity = usage_counters.quantity + p_amount, updated_at = now();
end;
$$;
```

### Trial no signup

No Server Action de criação de empresa (provavelmente `app/(auth)/signup/actions.ts`):

```typescript
// Após criar a empresa, criar subscription de trial
const impulsionaId = await db.from('plans').select('id').eq('slug', 'kyra-impulsiona').single()
const now = new Date()
const trialEnd = new Date(now)
trialEnd.setDate(trialEnd.getDate() + 14)

await db.from('subscriptions').insert({
  company_id: newCompany.id,
  plan_id: impulsionaId.data.id,
  status: 'trialing',
  billing_interval: 'month',
  trial_start: now.toISOString(),
  trial_end: trialEnd.toISOString(),
  provider: 'mock',
})
```

### Cron para expirar trials (Edge Function ou n8n)

```typescript
// supabase/functions/expire-trials/index.ts
const { error } = await supabase
  .from('subscriptions')
  .update({ status: 'expired' })
  .eq('status', 'trialing')
  .lt('trial_end', new Date().toISOString())
// NÃO apagar dados — só atualizar status
```

---

## 4. Sprint 11 — Settings: Assinatura + Usuários + Perfis

### 4.1 Seção Assinatura (`SubscriptionSection`)

UI em `apps/web/src/components/domain/settings/subscription-section.tsx`

**Dados necessários (Server Component ou route handler):**
```typescript
// /api/settings/subscription → retorna:
{
  plan: { name, slug, description },
  status: 'trialing' | 'active' | 'past_due' | ...,
  billing_interval: 'month' | 'year',
  current_period_end: string,
  trial_end: string | null,
  usage: {
    products: { used: number, limit: number | null },
    channels: { used: number, limit: number | null },
    automations: { used: number, limit: number | null },
    image_product_ai: { used: number, limit: number | null },
  },
  features: string[],  // feature_keys habilitadas
}
```

**UX esperada:**
- Badge de plano + status (verde = active, amarelo = trialing, vermelho = past_due/expired)
- Barra de progresso para cada métrica com limite (ex: "423 / 1.000 produtos")
- CTA "Alterar plano" abre drawer com os 3 planos + toggle mensal/anual
- CTA "Cancelar assinatura" → confirmar → `cancel_at_period_end = true`
- Se status = expired: banner proeminente com CTA de upgrade
- Histórico de faturas (quando provider real definido)

### 4.2 Seção Usuários (`UsersSection`)

**Tabelas usadas:** `company_members` (ou equivalente existente), `user_roles`

**Features:**
- Listar usuários da empresa com role, status (ativo/inativo), último acesso
- Convidar novo usuário por email → cria invite no Supabase Auth
- Desativar/reativar usuário (não deletar — LGPD)
- Alterar role do usuário
- **Não tem limite de quantidade** (ilimitado nos 3 planos)

**Server Actions:**
```typescript
export async function inviteUser(email: string, roleId: string) { ... }
export async function updateUserRole(userId: string, roleId: string) { ... }
export async function deactivateUser(userId: string) { ... }
```

### 4.3 Seção Perfis e Permissões (`ProfilesSection`)

**Modelo de permissões:** RBAC simplificado — roles com mapa de permissões em JSONB.

**Permissões do sistema (granularidade inicial):**
```
products.view | products.create | products.edit | products.delete
sales.view | sales.create | sales.cancel
purchases.view | purchases.create | purchases.approve
stock.view | stock.adjust
customers.view | customers.create | customers.edit
suppliers.view | suppliers.create | suppliers.edit
reports.view
financial.view | financial.create | financial.approve
settings.view | settings.edit
automations.view | automations.create | automations.edit
```

**Roles padrão (seed):**
- `Administrador` — todas as permissões
- `Vendedor` — products.view, sales.create, customers.view/create
- `Estoquista` — products.view/edit, stock.view/adjust, purchases.view
- `Financeiro` — financial.view/create, reports.view

**UI esperada:**
- Lista de roles da empresa (padrão + customizados)
- Ao clicar: editor visual de permissões (matriz checkbox)
- Criar role personalizado
- Não deletar role com usuários ativos → erro claro

---

## 5. Sprint 12 — Settings: Inteligência + Integrações + Segurança

### 5.1 Seção Inteligência (`IntelligenceSection`)

**Gating:** `ai.advanced.enabled` = Impulsiona+; básico disponível para todos.

**Configurações expostas:**
- Nível de proatividade da Kyra (slider: conservador → moderado → proativo)
- Quais análises a Kyra deve fazer (checkboxes: estoque baixo, produtos parados, oportunidades de compra, sugestão de preço)
- Histórico de interações com a Kyra (para planos com histórico ampliado)
- Se `ai.advanced.enabled = false`: mostrar seção com lock + CTA upgrade

**Tabela:**
```sql
create table ai_preferences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) unique not null,
  proactivity_level text default 'moderate',  -- 'conservative' | 'moderate' | 'proactive'
  enabled_analyses jsonb default '["low_stock","stale_products"]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 5.2 Seção Integrações (`IntegrationsSection`)

**Gating por entitlement:**
- `channels.max` = 1 (Organiza) → apenas 1 integração de canal ativa
- `channels.advanced.enabled` = Impulsiona+ → Shopify, Mercado Livre, WooCommerce

**Integrações planejadas:**
| Integração | Plano mínimo | Sprint de integração real |
|---|---|---|
| Asaas (financeiro) | Impulsiona | Sprint 17 |
| n8n (automações) | Organiza (2 automações) | Sprint 14 |
| Mercado Livre | Impulsiona | Sprint 18 |
| Shopify | Impulsiona | Sprint 18 |
| WooCommerce | Impulsiona | Sprint 18 |
| WhatsApp Business | Impulsiona | Sprint 19 |
| Nota Fiscal / SEFAZ | Impulsiona | Sprint 19 |

**Tabela:**
```sql
create table integration_configs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) not null,
  provider text not null,           -- 'asaas' | 'shopify' | 'mercadolivre' | 'n8n' | ...
  status text default 'inactive',   -- 'inactive' | 'connecting' | 'active' | 'error'
  config jsonb default '{}',        -- credentials encriptadas, webhook_url, etc
  last_sync_at timestamptz,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(company_id, provider)
);
-- config NUNCA deve conter credentials em plaintext — usar Supabase Vault ou encrypt antes
```

**UI:** cards por integração, status badge, botão Conectar/Desconectar. Para integrações futuras: chip "Em breve" + tooltip com sprint esperado.

### 5.3 Seção Segurança (`SecuritySection`)

**Features:**
- Autenticação: ver método atual (email/senha, Google OAuth)
- Alterar senha (fluxo via Supabase Auth)
- Sessões ativas: listar dispositivos/sessões + revogar
- 2FA (toggle) — Supabase Auth suporta TOTP
- Log de eventos de segurança (últimos logins, IPs, dispositivos)
- Exclusão de conta (LGPD) — não delete dados, marque `deleted_at`

**Tabela:**
```sql
create table security_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) not null,
  user_id uuid references auth.users(id),
  event_type text not null,         -- 'login' | 'logout' | 'password_change' | '2fa_enabled' | ...
  ip_address inet,
  user_agent text,
  metadata jsonb,
  created_at timestamptz default now()
);
```

---

## 6. Sprint 13 — Admin Portal (Multi-tenant)

**Rota:** `app/(admin)/` — protegida por role `super_admin` (verificado server-side via middleware).

### Middleware de proteção

```typescript
// middleware.ts — adicionar ao matcher
if (pathname.startsWith('/admin')) {
  const { data: { user } } = await supabase.auth.getUser()
  const isSuperAdmin = user?.user_metadata?.role === 'super_admin'
  if (!isSuperAdmin) return NextResponse.redirect('/dashboard')
}
```

### 6.1 Tenants (`/admin/tenants`)

**Tabelas (sem RLS — super_admin usa service role):**
```sql
create table admin_tenants_view as -- ou uma view que agrega
  select 
    c.id, c.name, c.cnpj, c.created_at,
    s.status as subscription_status,
    s.plan_id, p.name as plan_name,
    s.trial_end,
    (select count(*) from company_members cm where cm.company_id = c.id) as user_count,
    (select count(*) from products pr where pr.company_id = c.id) as product_count
  from companies c
  left join subscriptions s on s.company_id = c.id
  left join plans p on p.id = s.plan_id;
```

**UI:** DataTable com filtros por plano, status, data de criação. Ações: ver detalhe, mudar plano, suspender, enviar email.

### 6.2 Detalhe do Tenant (`/admin/tenants/[id]`)

- Informações da empresa (editável)
- Assinatura atual + histórico de mudanças de plano
- Uso de recursos (produtos, canais, automações, créditos de IA)
- Usuários da empresa
- Alterar plano manualmente (sem billing, direto no banco — para suporte)
- Créditos extras de IA (campo `ai_credits_bonus` na tabela de assinatura ou usage_counters)
- Timeline de eventos (logins, ações relevantes)

### 6.3 Leads (`/admin/leads`)

```sql
create table leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  company_name text,
  source text,                      -- 'landing' | 'referral' | 'organic' | ...
  status text default 'new',        -- 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
  notes text,
  assigned_to uuid references auth.users(id),
  converted_company_id uuid references companies(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

**UI:** Kanban por status ou DataTable. Ações: atualizar status, adicionar nota, marcar como convertido (vincula a empresa criada).

### 6.4 Automation Logs (`/admin/automation-logs`)

- Log de execuções de automações de todos os tenants
- Filtrar por tenant, tipo, status, data
- Ver payload de entrada/saída
- Reexecutar (trigger manual via n8n webhook)

### 6.5 Suporte (`/admin/support`)

```sql
create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) not null,
  user_id uuid references auth.users(id),
  subject text not null,
  description text,
  status text default 'open',      -- 'open' | 'in_progress' | 'resolved' | 'closed'
  priority text default 'normal',  -- 'low' | 'normal' | 'high' | 'critical'
  assigned_to uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references support_tickets(id) not null,
  author_id uuid references auth.users(id),
  is_admin boolean default false,
  content text not null,
  created_at timestamptz default now()
);
```

**UI:** fila de tickets com filtros por prioridade, status, tenant. Chat thread por ticket. **Suporte prioritário** (plano Impulsiona+): entitlement `support.priority = true` → SLA diferente na exibição.

---

## 7. Sprint 14 — Enforcement nos Módulos Existentes

**Objetivo:** aplicar entitlement checks em todos os Server Actions de criação/uso.

### Padrão de enforcement (replicar em todos os módulos):

```typescript
// Padrão a seguir em TODOS os Server Actions que criam recursos limitados
export async function createProduct(data: ProductFormData) {
  const companyId = await getAuthenticatedCompanyId() // NUNCA do cliente

  // 1. Verificar entitlement
  const check = await canUse(companyId, 'products.max')
  if (!check.allowed) {
    return {
      error: 'LIMIT_REACHED',
      message: `Você atingiu o limite de ${check.limit} produtos do seu plano.`,
      upgradeRequired: true,
    }
  }

  // 2. Executar operação
  const { data: product, error } = await supabase
    .from('products')
    .insert({ ...data, company_id: companyId })
    .select()
    .single()

  if (error) throw error
  
  // 3. NÃO incrementar usage_counter para contagens (estas são consultadas ao vivo)
  // Usage counter é para métricas de uso mensal (IA, imagem, etc)
  return { data: product }
}

// Para métricas mensais (ex: cadastro por imagem IA):
export async function createProductFromImage(imageUrl: string) {
  const companyId = await getAuthenticatedCompanyId()
  
  const check = await canUse(companyId, 'image_product_ai.monthly')
  if (!check.allowed) {
    return { error: 'MONTHLY_LIMIT_REACHED', limit: check.limit }
  }

  // ... processar imagem com IA ...

  await incrementUsage(companyId, 'image_product_ai.monthly')
  return { data: product }
}
```

### Contagens ao vivo (sem usage_counter):

Para `products.max`, `channels.max`, `automations.max` — consultar `count(*)` ao vivo, não usar `usage_counters`. Só usar `usage_counters` para métricas mensais (resets por período):
- `image_product_ai.monthly`
- `ai.queries.monthly` (quando Kyra IA real estiver implementada)

### UI de limite atingido:

Criar componente reutilizável `<UpgradePrompt feature="products" limit={1000} />` que aparece em modais de criação quando `allowed = false`. Deve mostrar o plano que desbloquearia + CTA de upgrade.

---

## 8. Sprint 15 — Kyra IA Real (Anthropic API)

**Gating:** `ai.advanced.enabled` = Impulsiona+; básico (respostas simples) para todos.

### Arquitetura

```
Frontend (chat) → Server Action → Anthropic API (server-only)
                                        ↓
                              Tools executados no backend:
                              - get_stock_levels(product_ids)
                              - get_sales_history(period, filters)
                              - get_purchase_suggestions()
                              - get_low_stock_alerts()
                              - create_purchase_order(data)  ← ação direta
```

**Regra:** Anthropic API key fica em variável de ambiente, nunca exposta ao cliente. A IA NUNCA acessa o banco diretamente — ela chama tools que são Server Actions com RLS.

### Server Action de conversa

```typescript
// app/api/kyra/chat/route.ts
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic() // usa ANTHROPIC_API_KEY do env

export async function POST(req: Request) {
  const companyId = await getAuthenticatedCompanyId()
  
  // Verificar entitlement (avançado vs básico)
  const isAdvanced = await hasFeature(companyId, 'ai.advanced.enabled')
  
  // Verificar quota mensal
  const check = await canUse(companyId, 'ai.queries.monthly')
  if (!check.allowed) {
    return Response.json({ error: 'MONTHLY_AI_LIMIT' }, { status: 429 })
  }

  const { messages } = await req.json()
  
  const tools = isAdvanced ? ADVANCED_TOOLS : BASIC_TOOLS // tools definem o que a Kyra pode acessar
  
  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4096,
    system: buildSystemPrompt(companyId, isAdvanced),
    messages,
    tools,
  })
  
  // Processar tool_use blocks
  if (response.stop_reason === 'tool_use') {
    const toolResults = await executeTools(response.content, companyId)
    // ... continuar conversa com tool_results
  }

  await incrementUsage(companyId, 'ai.queries.monthly')
  return Response.json({ content: response.content })
}
```

### Tools disponíveis

```typescript
const BASIC_TOOLS = [
  {
    name: 'get_low_stock_alerts',
    description: 'Retorna produtos com estoque abaixo do ponto de reposição',
    input_schema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'get_product_info',
    description: 'Busca informações de um produto pelo nome ou código',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query']
    }
  }
]

const ADVANCED_TOOLS = [
  ...BASIC_TOOLS,
  {
    name: 'get_sales_analysis',
    description: 'Análise de vendas por período, produto, categoria',
    input_schema: { /* ... */ }
  },
  {
    name: 'get_purchase_suggestions',
    description: 'Sugestões de compra baseadas em histórico e estoque atual',
    input_schema: { /* ... */ }
  },
  {
    name: 'create_purchase_order',
    description: 'Cria ordem de compra (requer confirmação do usuário)',
    input_schema: { /* ... */ }
  },
  {
    name: 'get_demand_forecast',
    description: 'Previsão de demanda para os próximos 30/60/90 dias',
    input_schema: { /* ... */ }
  },
  {
    name: 'run_custom_query',
    description: 'Executa consulta estruturada nos dados da empresa (read-only)',
    input_schema: { /* ... */ }
  }
]
```

### Tabela para histórico de conversas

```sql
create table ai_conversations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) not null,
  user_id uuid references auth.users(id) not null,
  messages jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table ai_conversations enable row level security;
create policy "company vê próprias conversas" on ai_conversations
  for all using (company_id = my_company_id());
```

**Retenção por plano:**
- Organiza: 6 meses (entitlement `history.months = 6`)
- Impulsiona: 24 meses
- Escala: ilimitado

---

## 9. Sprint 16 — Módulo de Relatórios

**Gating:** `reports.advanced.enabled` — relatórios básicos para todos, avançados para Impulsiona+.

### 7 Relatórios Core

| Relatório | Básico (todos) | Avançado (Impulsiona+) |
|---|---|---|
| Estoque atual | ✓ | + filtros avançados, exportação |
| Movimentações | ✓ | + por categoria, fornecedor, período |
| Curva ABC | ✗ | ✓ |
| Vendas por período | ✓ simples | + breakdown produto/categoria/vendedor |
| Compras realizadas | ✓ | + análise de fornecedor |
| Produtos parados | ✗ | ✓ |
| Margem e rentabilidade | ✗ | ✓ |

### Arquitetura de dados

```typescript
// Todas as queries via Server Actions com RLS — nunca SQL direto no cliente

export async function getStockReport(filters: StockReportFilters) {
  const companyId = await getAuthenticatedCompanyId()
  const isAdvanced = await hasFeature(companyId, 'reports.advanced.enabled')
  
  // Se avançado, aplicar filtros extras; se básico, retornar versão simplificada
  const query = supabase
    .from('products')
    .select('id, name, sku, stock_quantity, min_stock, ...')
    .eq('company_id', companyId)
  
  if (isAdvanced && filters.category) query.eq('category_id', filters.category)
  // ...
  
  return query
}
```

**Exportação:** CSV e PDF. Exportação disponível para todos no básico; Excel e agendamento de relatório apenas para Impulsiona+.

```sql
-- View materializada para performance (atualizada por trigger ou cron)
create materialized view mv_product_sales_summary as
  select 
    p.id as product_id,
    p.company_id,
    p.name,
    coalesce(sum(si.quantity), 0) as total_sold_qty,
    coalesce(sum(si.quantity * si.unit_price), 0) as total_revenue,
    max(s.created_at) as last_sale_date
  from products p
  left join sale_items si on si.product_id = p.id
  left join sales s on s.id = si.sale_id and s.status = 'completed'
  group by p.id, p.company_id, p.name;
```

---

## 10. Sprint 17 — Módulo Financeiro (Asaas)

**Gating:** `financial.enabled` — apenas Impulsiona+.

### Funcionalidades do módulo

1. **Contas a receber:** venda gera cobrança automática (Pix, boleto, cartão via Asaas)
2. **Contas a pagar:** lançamentos manuais de despesas
3. **Conciliação:** importar extrato e vincular a lançamentos
4. **Dashboard financeiro:** DRE simplificado, fluxo de caixa do mês

### Integração com Asaas

```typescript
// packages/shared/src/billing/asaas-adapter.ts
// Implementar a interface BillingProvider:

interface BillingProvider {
  createCustomer(data: CustomerData): Promise<string>          // retorna provider_customer_id
  createCharge(data: ChargeData): Promise<ChargeResult>
  createSubscription(data: SubscriptionData): Promise<string>
  changeSubscription(id: string, planData: PlanData): Promise<void>
  cancelSubscription(id: string): Promise<void>
  handleWebhook(payload: unknown): Promise<WebhookResult>
}

// AsaasAdapter implementa BillingProvider
// StripeAdapter implementa BillingProvider (futuro)
// MockAdapter implementa BillingProvider (testes/desenvolvimento)
```

**Tabelas:**

```sql
create table financial_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) not null,
  name text not null,               -- 'Conta corrente', 'Caixa', etc
  type text not null,               -- 'checking' | 'cash' | 'savings'
  balance_cents int default 0,
  created_at timestamptz default now()
);

create table financial_transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) not null,
  account_id uuid references financial_accounts(id),
  type text not null,               -- 'receivable' | 'payable'
  description text not null,
  amount_cents int not null,
  due_date date not null,
  paid_at timestamptz,
  status text default 'pending',    -- 'pending' | 'paid' | 'overdue' | 'canceled'
  category text,
  reference_id uuid,                -- ex: sale_id ou purchase_id
  reference_type text,              -- 'sale' | 'purchase' | 'manual'
  provider_charge_id text,          -- Asaas payment ID
  metadata jsonb,
  created_at timestamptz default now()
);
```

**Enforcement:** no Server Action de criação de venda, verificar `financial.enabled` antes de criar cobrança automática. Se não habilitado, criar lançamento manual sem integração Asaas.

---

## 11. Sprint 18 — Canais Reais (Marketplaces)

**Gating:** `channels.max` (1/3/10 por plano), `channels.advanced.enabled` (Impulsiona+).

### Canais planejados

| Canal | Complexidade | Provider |
|---|---|---|
| Shopify | Alta | REST API + Webhooks |
| Mercado Livre | Alta | OAuth2 + Notifications |
| WooCommerce | Média | REST API |
| VTEX | Muito alta | Sprint 20+ |
| Amazon | Muito alta | Sprint 20+ |

### Arquitetura de sincronização

```
Canal externo (webhook) → Edge Function → validar → normalizar → gravar no Kyra
Kyra (venda/estoque) → Event → fila (ex: Supabase Realtime ou pg_notify) → Sync Worker → Canal externo API
```

**Tabelas:**

```sql
create table channel_listings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) not null,
  integration_config_id uuid references integration_configs(id) not null,
  product_id uuid references products(id) not null,
  external_id text not null,        -- ID do produto no canal externo
  external_sku text,
  status text default 'active',
  last_synced_at timestamptz,
  sync_error text,
  created_at timestamptz default now()
);

create table channel_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) not null,
  integration_config_id uuid references integration_configs(id) not null,
  external_order_id text not null,
  sale_id uuid references sales(id),  -- vínculo com venda no Kyra (após criação)
  status text,
  raw_payload jsonb,
  created_at timestamptz default now()
);
```

**Enforcement:** no Server Action de ativação de canal, verificar `channels.max`. Se atingido, retornar erro com upgrade prompt.

---

## 12. Sprint 14 (paralelo) — n8n Integração Real

**Objetivo:** conectar automações da UI ao n8n real, em vez de mock.

### Arquitetura atual vs futura

```
Atual: UI cria automação → salva no banco → nada acontece

Futura:
UI cria automação → Server Action → cria workflow no n8n via API → salva n8n_workflow_id no banco
Trigger ocorre (ex: estoque baixo) → pg_notify ou Edge Function → POST webhook n8n → executa workflow
```

### Tabelas adicionais para automações

```sql
-- Adicionar coluna n8n_workflow_id à tabela automations existente
alter table automations add column n8n_workflow_id text;
alter table automations add column n8n_webhook_url text;
alter table automations add column last_run_at timestamptz;
alter table automations add column run_count int default 0;

create table automation_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) not null,
  automation_id uuid references automations(id) not null,
  status text,                      -- 'success' | 'error' | 'running'
  triggered_by text,                -- 'manual' | 'schedule' | 'event'
  input_data jsonb,
  output_data jsonb,
  error_message text,
  duration_ms int,
  created_at timestamptz default now()
);
```

### n8n API wrapper

```typescript
// packages/shared/src/n8n/n8n-client.ts
export class N8nClient {
  private baseUrl: string
  private apiKey: string

  async createWorkflow(definition: N8nWorkflowDefinition): Promise<string>
  async activateWorkflow(workflowId: string): Promise<void>
  async deactivateWorkflow(workflowId: string): Promise<void>
  async deleteWorkflow(workflowId: string): Promise<void>
  async triggerWebhook(webhookUrl: string, payload: unknown): Promise<unknown>
}
```

**Gating automações avançadas:** `automations.advanced.enabled` (Impulsiona+) libera automações com ações de integração externa (email, WhatsApp, Mercado Livre). Plano Organiza tem automações simples (ex: alertar baixo estoque internamente, gerar ordem de compra sugerida).

---

## 13. Sprint 19+ — Features Avançadas

### 13.1 Multiestoque (`multi_stock.enabled` — Escala only)

```sql
create table warehouses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) not null,
  name text not null,
  address jsonb,
  is_default boolean default false,
  created_at timestamptz default now()
);

-- product_stock_by_warehouse (em vez de stock_quantity direto no produto)
create table product_warehouse_stock (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) not null,
  warehouse_id uuid references warehouses(id) not null,
  quantity int default 0,
  unique(product_id, warehouse_id)
);

create table stock_transfers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) not null,
  from_warehouse_id uuid references warehouses(id),
  to_warehouse_id uuid references warehouses(id),
  status text default 'pending',
  items jsonb not null,             -- [{product_id, quantity}]
  created_at timestamptz default now()
);
```

### 13.2 Importação XML NF-e (`nfe.import.enabled` — Impulsiona+)

- Upload de XML de NF-e de entrada
- Parser extrai produtos, fornecedor, valores
- Cria/atualiza entradas de produtos e dispara movimentação de estoque
- Biblioteca: `fast-xml-parser` ou similar

### 13.3 BI Avançado (`bi.advanced.enabled` — Impulsiona+)

- Dashboard executivo com KPIs consolidados
- Comparativo de períodos
- Análise de mix de produtos (Curva ABC)
- Previsão de demanda (com Anthropic ou algoritmo simples inicialmente)
- Exportação de dados para BI externo (CSV, API)

### 13.4 WhatsApp Operacional (`whatsapp.operational.enabled` — Impulsiona+)

- Integração via WhatsApp Business API (Meta) ou Twilio
- Envio de nota de venda/recibo por WhatsApp
- Alertas de estoque baixo para o gestor
- (Futura) Chatbot de vendas

### 13.5 PDV Avançado (`pdv.advanced.enabled` — Impulsiona+)

- Impressão de cupom não-fiscal (thermal printer via WebUSB ou Bluetooth)
- Múltiplas formas de pagamento por venda
- Sangria e suprimento de caixa
- Relatório de fechamento de caixa

---

## 14. Regras de Implementação (não negociáveis)

1. **Nunca apagar dados no downgrade** — bloquear criação, nunca deletar.
2. **Nunca confiar no frontend para limites** — toda verificação no backend.
3. **Nunca `if plan === '...'` no código** — sempre via `hasFeature()` / `canUse()`.
4. **`company_id` derivado do contexto autenticado** — `await getAuthenticatedCompanyId()` que lê do JWT, nunca do body/params.
5. **`NULL` = ilimitado** — nunca `0` para representar ilimitado.
6. **Billing adapter pattern** — domínio não pode ficar preso ao provedor (Asaas hoje, Stripe amanhã).
7. **Recursos essenciais funcionam no Organiza** — o produto deve ser útil no plano base.
8. **Features de Fase 2 preparadas na arquitetura** — entitlements já criados mesmo antes da feature existir.
9. **Fiscal/NF-e é uma frente separada** — disponibilidade comercial não significa implementação técnica pronta.
10. **RLS desde o início** — toda nova tabela tem `company_id` + `enable row level security` + policy.

---

## 15. Resumo dos Sprints

| Sprint | Foco | Resultado |
|---|---|---|
| **10a** | DB migrations (planos, assinaturas, entitlements, roles) | Schema completo em produção |
| **10b** | Entitlement service + trial (14d Impulsiona) | Todo módulo pode verificar plano |
| **11** | Settings: Assinatura + Usuários + Perfis | 3 seções de configurações funcionando |
| **12** | Settings: Inteligência + Integrações + Segurança | Settings completo (6/6 seções) |
| **13** | Admin Portal (Tenants, Leads, Suporte, Logs) | Portal multi-tenant operacional |
| **14** | Enforcement nos módulos + n8n real | Limites aplicados em produção |
| **15** | Kyra IA Real (Anthropic API + tool use) | Kyra responde com dados reais |
| **16** | Módulo de Relatórios (7 relatórios + exportação) | Relatórios disponíveis |
| **17** | Financeiro + Asaas (contas, cobranças, Pix) | Módulo financeiro ativo |
| **18** | Canais reais (Shopify, Mercado Livre, WooCommerce) | Vendas de marketplace integradas |
| **19+** | PDV Avançado · XML NF-e · Multiestoque · BI · WhatsApp | Features premium completas |

---

*Gerado em: setembro 2026 | Kyra Estoque — projeto confidencial*
