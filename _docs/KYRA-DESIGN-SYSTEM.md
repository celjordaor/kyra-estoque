# KYRA ESTOQUE — DESIGN SYSTEM UNIFICADO

> Documento autocontido. Tokens, componentes, regras e decisões em um único lugar.
> Referência visual definitiva: Figma (consultar frame antes de implementar).
> Última revisão: 2026-09-06

---

## 1. TOKENS DE COR

### Primária
| Token | Hex | Uso |
|-------|-----|-----|
| `teal-600` | `#0D9488` | Ação principal, links ativos, botão primário |
| `teal-700` | `#0F766E` | Hover do primário |
| `teal-50` | `#F0FDFA` | Background sutil, highlight |
| `teal-100` | `#CCFBF1` | Badge background |
| `teal-200` | `#99F6E4` | Border accent suave |

> **ATENÇÃO:** A cor é TEAL (#0D9488), não green. Sempre usar `teal-*`, nunca `green-*`.

### Neutros (Slate)
| Token | Hex | Uso |
|-------|-----|-----|
| `slate-900` | `#0F172A` | Heading, texto primário |
| `slate-700` | `#334155` | Texto secundário |
| `slate-600` | `#475569` | Texto corpo |
| `slate-500` | `#64748B` | Placeholder, muted |
| `slate-400` | `#94A3B8` | Disabled, helper text |
| `slate-300` | `#CBD5E1` | Border secundária |
| `slate-200` | `#E2E8F0` | Border padrão |
| `slate-100` | `#F1F5F9` | Background card |
| `slate-50` | `#F8FAFC` | Background página |
| `white` | `#FFFFFF` | Background card/modal |

### Semânticas
| Token | Tailwind | Uso |
|-------|----------|-----|
| Sucesso | `emerald-500` / `emerald-50` | Confirmação, salvo |
| Erro | `red-500` / `red-50` | Erro, validação |
| Aviso | `amber-500` / `amber-50` | Atenção, baixo estoque |
| Info | `blue-500` / `blue-50` | Informação neutra |

### Regras de cor
- Nunca usar cor como único indicador de estado — sempre complementar com ícone ou label
- Cor semântica é separada da cor accent (teal)
- Manter contraste WCAG AA mínimo

---

## 2. TIPOGRAFIA

### Famílias (definidas em app/layout.tsx via next/font/google)
| Variável CSS | Fonte | Papel |
|---|---|---|
| `--font-display` | DM Sans | Títulos, destaques, logotipo |
| `--font-sans` | Inter | Corpo, UI, formulários |
| `--font-mono` | JetBrains Mono | Código, SKU, EAN, valores técnicos |

### Escala tipográfica
| Nome | Tailwind | Uso |
|------|----------|-----|
| Display XL | `text-4xl font-extrabold` | Hero landing page |
| Display L | `text-3xl font-bold` | Títulos de página |
| Display M | `text-2xl font-bold` | Títulos de seção |
| Heading | `text-xl font-semibold` | Subtítulos, cards |
| Subheading | `text-base font-semibold` | Labels de grupo |
| Body | `text-sm` (14px) | Corpo de texto principal |
| Small | `text-xs` (12px) | Helper text, badges, captions |
| Mono | `font-mono text-sm` | SKU, EAN, código |

### Regras
- `font-display` em headings (`style={{ fontFamily: 'var(--font-display)' }}`)
- `font-sans` em corpo e UI (`style={{ fontFamily: 'var(--font-sans)' }}`)
- Uppercase labels com `tracking-widest` ou `tracking-wide`
- `text-wrap: balance` em títulos longos
- Números tabulares: `font-variant-numeric: tabular-nums` em colunas

---

## 3. ESPAÇAMENTO E LAYOUT

### Grid e container
- Max container: `max-w-screen-xl mx-auto px-5 md:px-10`
- Conteúdo legal/leitura: `max-w-3xl mx-auto`
- App interno: sidebar fixa + área principal flex-1

### Espaçamento padrão
- Gap entre seções: `gap-6` ou `gap-8`
- Padding de card: `p-5` ou `p-6`
- Padding interno de item: `px-4 py-3`
- Gap de formulário: `space-y-4`

### Breakpoints
- Mobile: < 768px
- Tablet: 768px (md)
- Desktop: 1024px (lg)
- Wide: 1280px (xl)

---

## 4. BORDER RADIUS E SOMBRA

| Token | Tailwind | Uso |
|-------|----------|-----|
| Pequeno | `rounded-lg` (8px) | Inputs, badges, chips |
| Médio | `rounded-xl` (12px) | Cards, botões |
| Grande | `rounded-2xl` (16px) | Modais, panels |

### Sombras
| Token | Tailwind | Uso |
|-------|----------|-----|
| Sutil | `shadow-sm` | Cards em repouso |
| Padrão | `shadow-md` | Cards hover, dropdowns |
| Elevado | `shadow-xl` | Modais, overlays |
| Máximo | `shadow-2xl` | Cookie banner, drawers |

---

## 5. COMPONENTES PRIMITIVOS

### Button
```
Variantes: primary | secondary | ghost | danger | outline
Tamanhos: sm (py-1.5 px-3 text-xs) | md (py-2 px-4 text-sm) | lg (py-2.5 px-5 text-base)
Primary: bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold
Secondary: border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl
Ghost: hover:bg-slate-100 text-slate-600
Danger: bg-red-600 hover:bg-red-700 text-white
States: disabled (opacity-50 cursor-not-allowed) | loading (spinner inline)
```

### Input
```
Base: w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
      text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2
      focus:ring-teal-400 focus:border-transparent
Error: border-red-400 focus:ring-red-400
Disabled: opacity-50 cursor-not-allowed bg-slate-50
Label: text-sm font-medium text-slate-700 mb-1
Helper: text-xs text-slate-400 mt-1
Error msg: text-xs text-red-500 mt-1
```

### Select / Combobox
- Mesmos estilos de Input
- Ícone ChevronDown alinhado à direita
- Dropdown com `shadow-xl rounded-xl border border-slate-200 bg-white`

### Checkbox / Switch
- Checkbox: `accent-teal-600` + label text-sm
- Switch: `w-10 h-5 rounded-full` — ativo: `bg-teal-500`, inativo: `bg-slate-200`
- Handle: `w-4 h-4 rounded-full bg-white shadow-sm`

### Badge / Pill
```
Base: px-2 py-0.5 rounded-full text-xs font-semibold
Cores por estado:
  Ativo/Sucesso:   bg-emerald-100 text-emerald-700
  Aviso/Baixo:     bg-amber-100 text-amber-700
  Erro/Inativo:    bg-red-100 text-red-700
  Info/Neutro:     bg-slate-100 text-slate-600
  Destaque:        bg-teal-100 text-teal-700
```

### Card
```
Base: bg-white rounded-2xl border border-slate-200 shadow-sm
Hover (clicável): hover:shadow-md hover:border-slate-300 transition-all
Padding: p-5 ou p-6
Header interno: border-b border-slate-100 pb-4 mb-4
```

---

## 6. COMPONENTES COMPOSTOS

### PageHeader
```
<header>
  <p class="text-xs font-semibold uppercase tracking-widest text-teal-600">Seção</p>
  <h1 class="text-3xl font-bold text-slate-900 tracking-tight">Título</h1>
  <p class="text-slate-500 text-sm">Descrição opcional</p>
</header>
```

### StatCard (KPI)
```
Título: text-sm text-slate-500 font-medium
Valor: text-2xl font-bold text-slate-900 (DM Sans)
Delta: text-sm — positivo: text-emerald-600, negativo: text-red-500
Ícone background: rounded-xl p-2 bg-teal-50
```

4 KPIs no Dashboard: Vendas | Margem | Estoque | Ticket médio

### EmptyState
```
Ícone: text-slate-300 text-4xl ou lucide w-12 h-12
Título: text-slate-900 font-semibold
Descrição: text-slate-500 text-sm
CTA: Button primary
```

### DataTable
```
Thead: bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide
Tbody: divide-y divide-slate-100
Linha hover: hover:bg-slate-50
Paginação: text-sm text-slate-500 + botões ghost
Overflow: overflow-x-auto no container
```

### Toast (notificações)
- Biblioteca: Sonner ou similar
- Posição: bottom-right
- Sucesso: ícone check + text-emerald
- Erro: ícone X + text-red
- Duração: 4s

### Modal / Dialog
```
Overlay: fixed inset-0 bg-black/40 z-50
Panel: bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4
Header: px-6 pt-6 pb-4 border-b border-slate-100
Body: px-6 py-4
Footer: px-6 pb-6 pt-4 flex gap-2 justify-end
```

### Drawer (lateral)
```
Overlay: fixed inset-0 bg-black/40 z-40
Panel: fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl
Transição: translate-x-0 / translate-x-full
```

### FilterBar
```
Row: flex flex-wrap gap-2 items-center
SearchInput: w-64 (desktop) | w-full (mobile)
Filter chips: pills clicáveis com X para remover
```

---

## 7. COMPONENTES DE DOMÍNIO

### ProductCard
- Imagem quadrada com fallback (ícone Package)
- Nome, categoria, SKU, preço de venda
- Badge de status (ativo, inativo, rascunho)
- Stock indicator com cor semântica

### StatusBadge
```
Mapeamento:
  ativo      → emerald
  inativo    → slate
  rascunho   → amber
  pendente   → blue
  cancelado  → red
  concluido  → emerald
```

### PurchaseSuggestion
- Produto + nível de estoque atual
- Qtd sugerida pela IA + confiança
- Ação: "Adicionar ao pedido"

### SaleCart
- Lista de itens com quantidade editável
- Subtotal, desconto, total
- Seleção de forma de pagamento
- Botão "Finalizar venda"

---

## 8. COMPONENTES DE AI UX

> Reutilizar sempre. Não criar variantes. Consultar `docs/figma/ai-ux/12_AI_UX_PATTERNS.md`.

### AICopilot
- Campo de pergunta com ícone Sparkles
- 6 suggestion pills de ação rápida
- Header "Converse com a Kyra"

### AIRecommendation (card principal)
```
Estrutura obrigatória:
  [★ KYRA RECOMENDA]
  Título do problema (bold)
  Contexto/evidência (text-sm text-slate-600)
  Prioridade badge (Alta/Média/Baixa)
  Ação primária (Button primary)
  Ação secundária (Button ghost), quando aplicável
```

### AIExplanation
- Parágrafo explicativo em tom natural
- Exemplo: "As vendas cresceram 12% neste mês. 68% veio de calçados."
- Fonte Inter, text-sm, leading-relaxed

### AIConfidence
```
Alta (>85%):  indicador verde, exibir valor
Média (60–85%): indicador amber, pedir confirmação
Baixa (<60%): indicador red, destacar campo para revisão manual
```

### AIAction / AIActionState
```
Estados:
  idle     → botão de ação normal
  pending  → "Executando..." com spinner
  success  → check + confirmação
  error    → X + mensagem de erro
```

### AIAlert
- Banner inline (não toast) para alertas de IA
- `bg-amber-50 border-l-4 border-amber-400`
- Ícone + texto + ação opcional

### AIEmpty
- Quando não há dados para analisar
- Explicar o que está faltando
- CTA para próximo passo (ex: "Registre sua primeira venda")

### AILoading
- Skeleton animado, não spinner genérico
- Texto de progresso por etapa (ex: "Analisando imagem... Identificando produto...")

### AIError
- Explicar o que falhou
- Ação de retry quando aplicável
- Nunca mensagem técnica/stack trace para o usuário

---

## 9. SIDEBAR — NAVEGAÇÃO OFICIAL

Ordem fixa e imutável (Decisão 0002):

```
Início
Produtos
Estoque
Compras
PDV
Vendas
Clientes
Fornecedores
Canais
Automações
Kyra
Configurações
```

- Largura: 240px (desktop) / drawer (mobile)
- Ícones: Lucide React
- Item ativo: `bg-teal-50 text-teal-700 font-semibold`
- Item inativo: `text-slate-600 hover:bg-slate-100`

---

## 10. ESTADOS OBRIGATÓRIOS

Toda tela/módulo deve implementar os 4 estados:

| Estado | Descrição |
|--------|-----------|
| Normal | Dados carregados e operação fluindo |
| Loading | Skeleton animado (não spinner genérico) |
| Empty | Explicação do estado + próximo passo |
| Error | O que aconteceu + o que fazer |

Empty nunca deve ser tela em branco. Error nunca deve mostrar stack trace.

---

## 11. LOGO E IDENTIDADE

```jsx
// Logo padrão
<div className="flex items-center gap-2">
  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600">
    <Sparkles className="h-4 w-4 text-white" />
  </span>
  <div className="flex flex-col leading-none">
    <span className="text-[15px] font-bold text-slate-900 tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}>Kyra</span>
    <span className="text-[9.5px] font-medium text-slate-400 tracking-[0.06em] uppercase"
          style={{ fontFamily: "var(--font-sans)" }}>Estoque</span>
  </div>
</div>
```

Nome da IA: **Kyra** (não Maia — obsoleto, não usar)

---

## 12. REGRAS DE IMPLEMENTAÇÃO

### O que reutilizar
- Sempre usar Foundation antes de criar componente novo
- Componente reutilizável em `components/ui/` antes de repetir padrão
- AI UX: apenas os 12 componentes oficiais, sem variantes

### O que não fazer
- Não criar identidade visual separada para IA
- Não transformar Dashboard em BI com dezenas de gráficos
- Não simplificar telas aprovadas no Figma sem decisão explícita
- Não inventar visual: consultar Figma quando doc não detalhar
- Não duplicar componentes — verificar antes de criar
- Não usar cor como único indicador de estado
- Não substituir recomendações de IA por tabela genérica
- Não remover "O que merece sua atenção" ou "O Kyra recomenda" do Dashboard

### Antes de implementar qualquer tela
1. Ler o doc em `docs/product/XX-NOME.md`
2. Localizar o frame no Figma correspondente
3. Reutilizar Foundation e AI UX
4. Inspecionar código existente
5. Implementar todos os estados (Normal/Loading/Empty/Error)
6. Comparar visualmente com o Figma

---

## 13. LANDING PAGE — COMPONENTES ESPECÍFICOS

### Hero
- Headline: `text-4xl font-extrabold` (DM Sans)
- Subtítulo: `text-lg text-slate-600`
- CTA primário: teal-600, CTA secundário: ghost
- Badge de social proof acima do headline

### Planos (cards de pricing)
- Toggle Mensal/Anual (desconto 20% no anual)
- Card destaque (Kyra Impulsiona): borda teal, badge "Mais popular"
- Feature list com ✓ para itens incluídos
- CTA "Começar grátis" no destaque, "Começar agora" nos demais

### FAQ (accordion)
- Clicável com ChevronDown animado
- Abrir/fechar individual
- Border-bottom entre itens

### Footer
- Links para /privacy e /terms obrigatórios
- Copyright com ano dinâmico: `new Date().getFullYear()`
