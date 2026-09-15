# KYRA ESTOQUE — PRÓXIMOS PASSOS

> Roadmap das próximas fases de desenvolvimento.
> Última revisão: 2026-09-06

---

## VISÃO GERAL DE PRIORIDADES

```
CRÍTICO (bloqueante para produto funcional):
  1. Kyra IA Real (Anthropic API)
  2. n8n Workflows Reais

ALTA (funcionalidade core ausente):
  3. Relatórios
  4. Módulo Financeiro (Asaas)

MÉDIA (expansão de produto):
  5. Canais — Integração Real
  6. Cadastro de Produto por Imagem (IA real)

BAIXO (refinamento):
  7. Melhorias de UX e performance
  8. Auditoria e compliance
```

---

## 1. KYRA IA REAL (Anthropic API)

### Status atual
Mock — respostas fixas em `lib/actions/kyra.ts`. Interface e componentes de AI UX prontos.

### O que implementar

**A. Integração base com Anthropic**
- Instalar `@anthropic-ai/sdk` ou usar fetch direto
- Configurar `ANTHROPIC_API_KEY` no `.env.local` e Vercel
- Criar `lib/anthropic.ts` com cliente singleton (server-side only)
- Usar Claude 3.5 Sonnet como modelo padrão

**B. Tool Use (Function Calling)**
Kyra não executa ações diretamente — chama tools controladas:

```typescript
// Exemplo de tool definition
{
  name: "get_stock_status",
  description: "Retorna status atual do estoque para análise",
  input_schema: {
    type: "object",
    properties: {
      product_ids: { type: "array", items: { type: "string" } },
      threshold_days: { type: "number" }
    }
  }
}
```

Tools a implementar (fase 1):
- `get_stock_status` — estoque atual por produto
- `get_sales_summary` — resumo de vendas por período
- `get_purchase_suggestions` — sugestões de compra baseadas em dados
- `get_low_stock_alerts` — produtos abaixo do mínimo
- `get_dead_stock` — produtos parados (sem venda em N dias)
- `create_purchase_order` — criar pedido de compra (com aprovação do usuário)

**C. Fluxo obrigatório (nunca violar)**
```
Usuário → Kyra (interface) → Server Action → Anthropic API → Tool call
→ Business Rule (validação) → Banco (via service role)
→ resultado para Anthropic → resposta final → usuário
```

**D. Contexto do sistema**
Prompt de sistema deve incluir:
- Dados da empresa (nome, segmento)
- Resumo do período atual (KPIs)
- Instruções de persona (Kyra, assistente de estoque)
- Instruções de segurança (nunca inventar dados, sempre usar tools)

**E. Histórico de conversas**
- Tabela `ai_conversations` + `ai_messages` já existem (migration 0017, 0018)
- Persistir histórico por empresa e por sessão
- Carregar últimas N mensagens como contexto

**F. Dashboard — recomendações reais**
- Substituir mock por chamada real à Anthropic
- Tools: `get_low_stock_alerts`, `get_dead_stock`, `get_sales_anomalies`
- Renderizar resultados nos componentes AIRecommendation existentes

**G. Cadastro de produto por imagem**
- Upload de imagem → base64 → Anthropic Vision
- Retorna: nome, marca, categoria, cor, descrição, SKU sugerido, EAN
- Confidence score por campo (já suportado na UI)
- Fluxo de validação já implementado (estados: Analisando → Resultado IA → Validação → Sucesso)

### Arquivos a criar/modificar
- `lib/anthropic.ts` — cliente
- `lib/actions/kyra.ts` — substituir mock por real
- `lib/actions/products.ts` — adicionar análise por imagem real
- `lib/tools/stock-tools.ts` — implementações das tools
- `app/(app)/kyra/page.tsx` — conectar com API real

---

## 2. n8n WORKFLOWS REAIS

### Status atual
Interface de Automações pronta. n8n configurado mas sem workflows conectados à aplicação.

### O que implementar

**A. Arquitetura de integração**
```
Kyra Estoque (evento)
→ Webhook POST para n8n
→ n8n processa (notificação, integração)
→ n8n pode chamar API do Kyra para ler dados
→ resultado (email, WhatsApp, etc.)
```

n8n NUNCA decide regras de negócio. Só executa notificações e integrações.

**B. Webhooks de saída (Kyra → n8n)**
Criar endpoint: `app/api/webhooks/n8n/route.ts`

Eventos a emitir:
- `stock.low_alert` — produto abaixo do mínimo
- `stock.out` — produto zerado
- `purchase.created` — novo pedido de compra
- `sale.completed` — venda finalizada
- `automation.triggered` — automação ativada pelo usuário

**C. API de leitura para n8n (n8n → Kyra)**
Criar `app/api/n8n/` com autenticação por API key:
- `GET /api/n8n/stock` — estoque atual
- `GET /api/n8n/sales/summary` — resumo de vendas
- `GET /api/n8n/alerts` — alertas ativos

Autenticação: `X-API-Key` header, validado contra tabela `api_keys` (migration 0019).

**D. Workflows prioritários**
1. **Alerta de estoque baixo** — produto < mínimo → email + WhatsApp para gestor
2. **Relatório semanal** — toda segunda 8h → PDF por email com resumo da semana
3. **Produto parado** → alerta semanal: produtos sem venda há 30+ dias
4. **Boas-vindas** → novo usuário cadastrado → email de onboarding
5. **Cobrança próxima** → 3 dias antes do vencimento → lembrete por email

**E. Interface de Automações**
Ligar toggles reais:
```typescript
// Quando usuário ativa automação:
// 1. Salvar no banco (tabela automations)
// 2. POST para n8n para ativar o workflow
// 3. Confirmar ativação
```

**F. Configuração necessária**
- `N8N_WEBHOOK_URL` no env
- `N8N_API_KEY` no env
- URL base do n8n: configurável por empresa (multi-tenant futuramente)

---

## 3. RELATÓRIOS

### Status atual
Não existe. Módulo não implementado.

### O que implementar

**A. Rota e navegação**
- Adicionar "Relatórios" na Sidebar (entre Kyra e Configurações? Definir com Figma)
- Rota: `app/(app)/reports/`

**B. Relatórios prioritários (fase 1)**

| Relatório | Dados | Filtros |
|-----------|-------|---------|
| Vendas por período | Total, ticket médio, qtd transações | Data, canal, cliente |
| Produtos mais vendidos | Ranking por qtd e faturamento | Data, categoria |
| Margem por produto | Custo vs preço venda | Data, categoria |
| Estoque atual | Qtd, valor, dias de cobertura | Categoria, fornecedor |
| Compras por período | Total comprado, por fornecedor | Data, fornecedor |
| Produtos parados | Sem saída há X dias | Dias, categoria |
| Fluxo de estoque | Entradas vs saídas | Produto, período |

**C. Componentes de relatório**
- DateRangePicker (input de período)
- ExportButton (CSV + PDF) — via n8n para PDF
- ChartBar / ChartLine (Recharts ou similar)
- ReportTable com ordenação e paginação
- SummaryCard com delta vs período anterior

**D. Backend**
- Server Actions em `lib/actions/reports.ts`
- Queries otimizadas com índices em `stock_movements`, `sales`, `sale_items`
- Cache de relatórios pesados (revalidar a cada hora)

**E. Exportação**
- CSV: gerado no frontend (client-side)
- PDF: via n8n workflow (n8n → Puppeteer/HTML → PDF → email ou download)

---

## 4. MÓDULO FINANCEIRO (Asaas)

### Status atual
Não existe. Nenhuma integração financeira implementada.

### O que implementar

**A. Integração com Asaas**
- Asaas = gateway de pagamento e gestão financeira brasileiro
- Criar conta sandbox para desenvolvimento
- Env vars: `ASAAS_API_KEY`, `ASAAS_WEBHOOK_SECRET`
- Criar `lib/asaas.ts` com wrapper de API

**B. Módulos financeiros fase 1**

**Contas a Receber**
- Geração de boleto/PIX/cartão ao finalizar venda
- Status: pendente, pago, vencido, cancelado
- Webhook Asaas → atualizar status no banco
- Listagem com filtros (período, status, cliente)

**Contas a Pagar**
- Registro de parcelas de compra
- Associar a pedido de compra
- Vencimento, valor, status
- Alertas de vencimento próximo (via n8n)

**Fluxo de Caixa**
- Visão de entradas e saídas por período
- Projeção baseada em contas a receber/pagar abertas
- Saldo atual e projetado

**C. Schema de banco (migrations novas)**
```sql
-- financial_accounts (contas bancárias/PIX da empresa)
-- receivables (contas a receber — vinculado a sales)
-- payables (contas a pagar — vinculado a purchases)
-- cash_flow_entries (lançamentos manuais)
```

**D. Interface**
- Rota: `app/(app)/financeiro/`
- Tabs: Visão Geral | Receber | Pagar | Fluxo de Caixa
- Consultar Figma para frames de financeiro

**E. Assinatura da plataforma**
- Integrar cobrança recorrente da assinatura do próprio SaaS via Asaas
- Planos: Organiza R$66,90 | Impulsiona R$129,90 | Escala R$249,90
- Trial: 14 dias → depois gerar cobrança automaticamente
- Cancelamento: desabilitar conta após período pago

---

## 5. CANAIS — INTEGRAÇÃO REAL

### Status atual
UI existe (MVP mockup). Sem integração real com nenhum canal.

### Visão de produto
```
Produto criado → escolher canais → publicar → acompanhar status → pedidos sincronizados
```

### Fase 1 — Infraestrutura
**A. Schema de canal**
```sql
-- channels (já existe, migration 0009)
-- channel_products (produto × canal, com status de publicação)
-- channel_orders (pedidos oriundos de canais)
-- channel_sync_log (histórico de sincronizações)
```

**B. Interface de configuração de canal**
- Adicionar canal (nome, tipo, credenciais)
- Status de conexão (conectado, erro, desconectado)
- Últimas sincronizações

**C. Arquitetura de sincronização**
```
n8n Workflow por canal
  → API do marketplace (via credenciais do canal)
  → POST para /api/channels/sync com dados
  → Kyra processa e salva
```

### Fase 2 — Integrações reais
Prioridade baseada no público-alvo:
1. **Mercado Livre** — marketplace líder Brasil
2. **Shopify** — e-commerce próprio
3. **Instagram Shopping** — catálogo + vendas
4. **WooCommerce** — WordPress e-commerce
5. **Bling** — integração via API (muitos clientes migram do Bling)

Cada integração via n8n + webhook + API do canal.

### Fase 3 — Sincronização bidirecional
- Atualizar estoque no canal quando vender no PDV
- Importar pedidos do canal para Vendas
- Sincronizar preços e descrições

---

## 6. OUTROS ITENS DA FASE FIGMA

### A. Relatório semanal automático
- n8n: toda segunda 8h, gerar PDF com KPIs da semana
- Enviar por email via Resend
- Conteúdo: vendas, margem, estoque crítico, recomendações Kyra

### B. WhatsApp Operacional (Kyra Impulsiona+)
- Integrar WhatsApp Business API (via n8n ou provider como Zapi/Z-API)
- Enviar alertas para o gestor
- Receber perguntas simples (ex: "qual meu estoque de X?")
- Kyra responde com dados reais

### C. PDV Avançado (Kyra Impulsiona+)
- Impressão de cupom fiscal (não nota fiscal)
- Integração com impressora térmica (QZ Tray ou similar)
- Sangria e suprimento de caixa
- Relatório de fechamento de caixa
- Múltiplos operadores por caixa

### D. Importação XML/NF-e (Kyra Impulsiona+)
- Upload de XML de NF-e de compra
- Parse e criação automática de pedido de compra
- Atualização de custo dos produtos
- Vinculação com fornecedor existente

### E. Multiestoque e Transferências (Kyra Escala)
- Múltiplos locais/depósitos por empresa
- Transferência entre locais
- Estoque por local
- Dashboard com visão consolidada

### F. BI e Análises Avançadas (Kyra Escala)
- Painel de BI com gráficos interativos
- Análise de curva ABC de produtos
- Previsão de demanda
- Comparativo de períodos
- Export para Excel

### G. Recursos Fiscais (todos os planos — conforme homologação)
- Emissão de NF-e (Nota Fiscal Eletrônica)
- Emissão de NFC-e (Cupom Fiscal Eletrônico — PDV)
- Consulta de CNPJ e NCM
- SPED e obrigações acessórias
- **ATENÇÃO:** Requer homologação SEFAZ por estado. Complexidade alta. Fase posterior.

---

## 7. MELHORIAS DE UX E PERFORMANCE

### A. Onboarding
- Wizard de primeiros passos após cadastro
- Checklist: cadastrar produto, registrar venda, configurar automação
- Tour guiado com tooltips

### B. Busca Global
- Atalho Cmd/Ctrl+K
- Busca em produtos, clientes, fornecedores, vendas
- Navegação rápida entre módulos

### C. Notificações In-App
- Central de notificações (sino no header)
- Alertas de estoque baixo, vencimentos, novos pedidos
- Tabela `notifications` já existe (migration 0015)

### D. Performance
- Paginação cursor-based nas listas grandes
- Índices de banco nas queries mais comuns
- React Query / SWR para cache no cliente
- Skeleton loading em todas as telas

### E. Modo Offline (futuro)
- PWA básico para PDV
- Cache de produtos e clientes para venda offline
- Sincronização ao reconectar

---

## 8. ORDEM DE IMPLEMENTAÇÃO SUGERIDA

```
Sprint 10: Kyra IA Real (Anthropic API + tools básicas)
Sprint 11: n8n Workflows (alertas + relatório semanal)
Sprint 12: Relatórios (fase 1 — 7 relatórios core)
Sprint 13: Financeiro fase 1 (Asaas — receber/pagar)
Sprint 14: Canais infraestrutura + Mercado Livre MVP
Sprint 15: PDV Avançado + XML NF-e
Sprint 16: BI Avançado + Multiestoque
Sprint 17+: Fiscal, WhatsApp, expansão de canais
```

---

## 9. CONSIDERAÇÕES TÉCNICAS

### Segurança (nunca violar)
- `company_id` sempre do servidor
- IA nunca acessa banco diretamente
- n8n não decide regras críticas
- service_role somente server-side
- Webhooks externos validados por secret/assinatura

### Dados
- Toda nova tabela com `company_id` + RLS
- Migrations sequenciais (0021 em diante)
- Testar RLS antes de ir para produção

### Testes
- Testar multi-tenant: dados de empresa A não vazam para empresa B
- Testar stock_movements: UPDATE/DELETE devem falhar
- Testar revogação de acesso (cancelamento de plano)
