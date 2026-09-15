# CLAUDE.md — Contrato de Desenvolvimento do Projeto

## 1. Objetivo deste arquivo

Este arquivo define as regras permanentes para desenvolvimento do SaaS de gestão de estoque, vendas, operação e automação com IA.

Antes de implementar qualquer funcionalidade, leia este arquivo e o Blueprint oficial do projeto:

`blueprint/Blueprint_MVP_SaaS_Estoque_IA_Automacao_V3.md`

O Blueprint contém as decisões de produto, UX, arquitetura e MVP. Este arquivo contém as regras de execução e desenvolvimento.

---

## Documentação de contexto rápida (_docs/)

Os três arquivos abaixo são a referência consolidada e autocontida do projeto:

- `_docs/KYRA-CONTEXT.md` — contexto completo (stack, banco, módulos, decisões, segurança)
- `_docs/KYRA-DESIGN-SYSTEM.md` — design system (tokens, componentes, AI UX, regras visuais)
- `_docs/KYRA-PROXIMOS-PASSOS.md` — roadmap das próximas fases (IA, n8n, Financeiro, Relatórios, Canais)

Ler esses arquivos antes de iniciar qualquer tarefa nova.

---

## 1.1 Identidade do produto

**Nome oficial:** Kyra Estoque.

A IA é uma capacidade integrada ao produto e não deve ser usada como nome da marca.

Mensagem principal:
> Você vende. A gente cuida do resto.

Arquitetura de marca: Kyra CS, Kyra CRM, Kyra Estoque.

# 2. Regra principal

Não desenvolver apenas para "fazer a tela funcionar".

Toda implementação deve preservar:

- simplicidade para o usuário;
- reutilização de componentes;
- consistência visual;
- separação entre UI, regras de negócio e infraestrutura;
- segurança multi-tenant;
- rastreabilidade;
- possibilidade de automação;
- possibilidade de evolução da IA;
- baixo esforço operacional para o usuário.

Princípio central do produto:

> Você vende. A gente cuida do resto.

Outro princípio obrigatório:

> O usuário não precisa procurar problemas; o sistema encontra os problemas e apresenta as ações que precisam ser tomadas.

---

# 3. Fonte oficial de decisões

A fonte ativa de decisão de produto é:

`blueprint/Blueprint_MVP_SaaS_Estoque_IA_Automacao_V3.md`

A versão V1 é histórica e não deve ser usada como especificação ativa.

Se houver conflito entre arquivos:

1. Verificar o V3 (docs/blueprint/Blueprint_MVP_SaaS_Estoque_IA_Automacao_V3.md).
2. Verificar este CLAUDE.md.
3. Não inventar uma nova decisão.
4. Se o conflito não puder ser resolvido, sinalizar antes de implementar.

Não criar uma nova arquitetura, padrão visual ou componente apenas porque parece conveniente.

---

# 4. Estrutura oficial do projeto

Manter inicialmente esta estrutura:

```text
/
├── CLAUDE.md
├── docs/
│   ├── blueprint/
│   │   └── Blueprint_MVP_SaaS_Estoque_IA_Automacao_V3.md
│   ├── architecture/
│   ├── design-system/
│   ├── ai/
│   ├── agents/
│   └── decisions/
├── prompts/
├── apps/
│   ├── web/
│   └── admin/
├── packages/
│   ├── ui/
│   ├── database/
│   ├── ai/
│   ├── integrations/
│   ├── business-rules/
│   └── types/
└── workflows/
    └── n8n/
```

Nem todas as pastas precisam ser preenchidas imediatamente.

Não criar dezenas de arquivos ou pastas antecipadamente apenas para "organizar".

Criar conforme o projeto evoluir.

---

# 5. Ordem de desenvolvimento

Sempre que possível, seguir esta sequência:

```text
Domínio
↓
Regra de negócio
↓
Serviço
↓
Evento
↓
Tool/API
↓
Componente
↓
Tela
```

Não começar pela tela quando a funcionalidade depende de regras de negócio importantes.

---

# 6. Regra "componente primeiro, tela depois"

Antes de criar um componente novo:

1. Procurar se já existe um componente equivalente.
2. Verificar os componentes do Design System.
3. Verificar se o componente pode ser composto a partir de componentes existentes.
4. Só criar um componente novo quando houver necessidade real.

Antes de criar uma nova tela:

1. Verificar se uma tela existente pode suportar o fluxo.
2. Verificar se a funcionalidade pode ser resolvida com drawer, modal, painel contextual ou ação inline.
3. Evitar criar uma tela apenas porque existe uma nova entidade no banco.

Princípio:

> Menos telas, mais contexto e ações inteligentes.

---

# 7. Componentização

Organizar componentes em três níveis:

## 7.1 Primitivos

Componentes visuais básicos e reutilizáveis:

- Button
- Input
- NumberInput
- Select
- Combobox
- Checkbox
- Switch
- Radio
- Badge
- Tooltip
- Dialog
- Drawer
- Tabs
- Card
- Table
- Dropdown
- Avatar
- Skeleton
- Alert
- Toast

## 7.2 Componentes compostos

Combinações reutilizáveis:

- SearchInput
- FilterBar
- PageHeader
- StatCard
- EmptyState
- DataTable
- FormSection
- ConfirmDialog
- ProductSelector
- CustomerSelector
- PaymentSelector
- StatusBadge
- AIRecommendationCard

## 7.3 Componentes de domínio

Componentes específicos do produto:

- ProductCard
- ProductForm
- ProductImageUploader
- ProductAIReview
- StockSummary
- StockMovementList
- SaleCart
- SalePayment
- PurchaseSuggestion
- ChannelCard
- AIInsight
- AgentAction

Não duplicar componentes visualmente equivalentes em módulos diferentes.

---

# 8. NumberInput

Não utilizar o `<input type="number">` nativo diretamente na interface quando existir um componente de Design System apropriado.

Usar um NumberInput padronizado para:

- quantidade;
- preço;
- custo;
- estoque;
- margem;
- percentuais;
- descontos;
- limites;
- outros valores numéricos.

O comportamento visual e de teclado deve ser consistente em todo o sistema.

---

# 9. Badges, Pills e status

Utilizar badges/pills para estados e informações curtas.

Padrão:

- altura aproximada de 24px;
- borda muito arredondada;
- tipografia pequena e semibold;
- fundo suave;
- texto com contraste adequado.

Estados devem possuir significado consistente:

- verde: sucesso/ativo/disponível;
- amarelo: atenção/pendência;
- vermelho: erro/risco/bloqueio;
- neutro: informação sem urgência.

Não usar cores apenas como decoração.

---

# 10. Design System

O sistema deve possuir tokens centralizados para:

- cores;
- tipografia;
- espaçamentos;
- radius;
- sombras;
- bordas;
- tamanhos;
- estados;
- breakpoints.

Não espalhar valores arbitrários pelo código.

Quando um padrão visual se repetir, transformá-lo em componente ou token.

---

# 11. Formulários

Formulários devem:

- possuir labels claras;
- informar campos obrigatórios;
- apresentar mensagens de erro próximas ao campo;
- preservar os dados digitados quando possível;
- evitar campos desnecessários;
- agrupar informações por contexto;
- usar valores padrão inteligentes;
- utilizar componentes padronizados.

Não transformar todo cadastro em um formulário gigantesco.

Quando houver IA:

1. IA sugere.
2. Sistema apresenta a sugestão.
3. Usuário confirma ou altera.
4. Backend valida.
5. Sistema grava.

---

# 12. IA

A IA é uma interface inteligente sobre o sistema, não uma camada que pode ignorar as regras do sistema.

Regra obrigatória:

```text
Usuário
↓
IA / Orquestrador
↓
Tool
↓
Regra de negócio
↓
Banco de dados
```

Nunca permitir que o LLM altere diretamente tabelas ou execute SQL arbitrário como mecanismo de negócio.

Toda ação que altera dados deve passar por:

- autenticação;
- autorização;
- validação;
- regras de negócio;
- auditoria quando necessário;
- persistência controlada.

---

# 13. IA que recomenda e IA que executa

Separar claramente:

### Recomendar

A IA pode:

- analisar;
- explicar;
- sugerir;
- identificar riscos;
- indicar produtos;
- sugerir compras;
- sugerir promoções;
- sugerir descrições;
- sugerir classificações.

### Executar

A IA só executa ações por meio de ferramentas controladas.

Exemplo:

```text
Usuário:
"Compre 30 unidades do produto X."

IA:
Identifica intenção.

Tool:
create_purchase()

Business Rule:
Valida fornecedor, produto, estoque, permissões e condições.

Sistema:
Cria pedido de compra.

Automação:
Pode enviar o pedido por WhatsApp/e-mail.
```

---

# 14. Confiança das sugestões de IA

Quando a IA preencher ou sugerir dados importantes, permitir visualização de confiança quando fizer sentido.

Exemplo:

- Nome — alta confiança
- Marca — alta confiança
- Categoria — média confiança
- NCM — baixa confiança

Não esconder incerteza.

Quanto maior o impacto da decisão, maior deve ser a transparência.

---

# 15. IA de produto por imagem

Fluxo previsto:

```text
Foto
↓
OCR / Visão
↓
Identificação
↓
Enriquecimento por IA
↓
Validação
↓
Cadastro
↓
Publicação opcional
```

A IA pode sugerir:

- nome;
- marca;
- categoria;
- cor;
- atributos;
- descrição;
- tags;
- SEO;
- classificação;
- informações extraídas da imagem.

O usuário deve conseguir revisar antes da confirmação.

---

# 16. Estoque

O estoque deve ser tratado como uma consequência de movimentações.

Fonte de verdade:

`stock_movements`

Tipos principais:

- ENTRADA
- SAÍDA
- AJUSTE
- TRANSFERÊNCIA
- DEVOLUÇÃO
- INVENTÁRIO

Evitar depender exclusivamente de um campo manual `product.stock`.

Isso é importante para:

- auditoria;
- explicação da IA;
- histórico;
- rastreabilidade;
- cálculo de saldo;
- automações.

A IA deve conseguir explicar de onde veio uma recomendação.

---

# 17. Produto e variantes

Produto é uma entidade central do sistema.

Separar:

- produto;
- variante;
- SKU;
- EAN/GTIN;
- preço;
- custo;
- estoque;
- fornecedor;
- imagens;
- canais;
- dados fiscais;
- dados de IA.

Quando houver variações, cada variante pode possuir:

- SKU;
- EAN;
- preço;
- custo;
- estoque;
- imagem.

---

# 18. Multi-tenant

O sistema deve ser multi-tenant desde o início.

Entidades de negócio devem possuir referência à empresa/tenant quando aplicável.

Usar RLS no Supabase.

Nunca confiar somente em filtros feitos pelo frontend para isolamento de dados.

Toda consulta e mutação deve respeitar o tenant autenticado.

---

# 19. Segurança

Nunca:

- expor service role key no frontend;
- confiar em company_id enviado pelo cliente;
- permitir acesso a dados de outro tenant;
- executar comandos administrativos através da IA sem autorização;
- armazenar segredos diretamente no código.

Credenciais e chaves devem utilizar variáveis de ambiente/secret management.

---

# 20. n8n

O n8n será usado principalmente para:

- integrações;
- notificações;
- automações;
- webhooks;
- tarefas assíncronas;
- comunicação com serviços externos.

Não colocar regras críticas de negócio exclusivamente dentro do n8n.

Regra:

> A regra de negócio pertence ao sistema. O n8n executa e conecta processos.

---

# 21. Automações prontas

Não exigir que o usuário construa automações complexas manualmente.

Oferecer automações prontas, como:

- alerta de estoque baixo;
- alerta de produto sem venda;
- relatório semanal de vendas;
- sugestão semanal de compras;
- alerta de compra atrasada;
- envio de pedido por WhatsApp;
- envio de pedido por e-mail;
- geração automática de descrição;
- atualização de catálogo;
- análise de produtos encalhados;
- relatórios periódicos.

---

# 22. Canais de venda

Canais devem ser tratados como uma área de negócio integrada.

Exemplos:

- Loja Online;
- Instagram;
- Facebook;
- Mercado Livre;
- WhatsApp;
- outros marketplaces.

O produto deve permitir publicação para múltiplos canais quando possível.

Se houver erro de sincronização, apresentar o problema em linguagem humana e, quando possível, oferecer ação de correção.

Exemplo:

> Instagram não foi atualizado porque 3 produtos estão sem imagem.

Ação:

`Corrigir produtos`

---

# 23. Dashboard

Não criar um dashboard baseado somente em gráficos.

Priorizar:

1. O que aconteceu?
2. Por que aconteceu?
3. O que precisa de atenção?
4. O que o sistema recomenda fazer?

Exemplo:

> Bom dia. Analisei sua operação.

Mostrar:

- vendas;
- estoque;
- margem;
- produtos em risco;
- estoque parado;
- oportunidades;
- recomendações.

---

# 24. Copilot / Assistente

A experiência deve permitir perguntas e comandos naturais.

Exemplos:

- "Cadastre esse produto."
- "Me mostre o que está encalhado."
- "Quanto vendi esse mês?"
- "Quais produtos preciso comprar?"
- "Crie um pedido de compra."
- "Quais produtos estão dando prejuízo?"
- "Quero fazer uma promoção."
- "Envie os produtos com estoque baixo para meu WhatsApp."

A IA deve responder de forma objetiva e orientada à ação.

---

# 25. Agentes

Arquitetura conceitual:

- ~~Maia~~ — **obsoleto; não usar** (a IA se chama Kyra)
- Inventory Agent
- Purchasing Agent
- Product Agent
- Analyst Agent
- Marketing Agent
- Finance Agent
- WhatsApp Agent

Não é necessário implementar todos no MVP.

Implementar primeiro os agentes que geram maior valor operacional.

---

# 26. Recomendação como entidade

Recomendações importantes da IA devem poder ser persistidas.

Estrutura conceitual:

`ai_recommendations`

Campos esperados:

- type;
- product_id;
- priority;
- reason;
- suggested_action;
- status.

Exemplos:

- LOW_STOCK
- SLOW_PRODUCT
- EXCESS_STOCK
- PURCHASE_OPPORTUNITY

---

# 27. Idempotência e eventos

Integrações e automações devem considerar:

- eventos duplicados;
- webhooks repetidos;
- reprocessamento;
- falhas;
- retries;
- idempotência.

Não assumir que uma chamada externa acontecerá apenas uma vez.

---

# 28. Auditoria

Ações importantes devem ser rastreáveis.

Especialmente:

- alteração de preço;
- alteração de estoque;
- compras;
- vendas;
- ações executadas pela IA;
- integrações;
- automações;
- alterações de configuração.

Sempre que uma ação relevante for executada pela IA, deve ser possível saber:

- quem solicitou;
- qual ação foi executada;
- quando;
- resultado;
- origem.

---

# 29. Estados de interface

Todo fluxo relevante deve considerar:

- loading;
- sucesso;
- vazio;
- erro;
- sem permissão;
- parcialmente carregado;
- processamento;
- ação concluída;
- ação falhou.

Não entregar telas que funcionam apenas no "happy path".

---

# 30. Empty States

Empty state não deve ser apenas:

> Nenhum registro encontrado.

Sempre que possível, explicar:

- o que deveria aparecer;
- por que está vazio;
- o que o usuário pode fazer agora.

Exemplo:

> Você ainda não possui produtos.
> Cadastre seu primeiro produto ou importe sua lista.

Botão:

`Cadastrar produto`

---

# 31. Responsividade

O sistema deve funcionar bem em:

- desktop;
- notebook;
- tablet;
- telas menores quando aplicável.

Não criar layouts que dependam de uma resolução específica.

Tabelas devem possuir comportamento responsivo planejado.

---

# 32. Acessibilidade

Priorizar:

- labels;
- contraste;
- navegação por teclado;
- foco visível;
- aria-label quando necessário;
- mensagens de erro compreensíveis;
- tamanho adequado de áreas clicáveis.

Não depender somente de cor para transmitir estado.

---

# 33. Performance

Evitar:

- consultas desnecessárias;
- carregamento de dados que não estão sendo utilizados;
- componentes excessivamente pesados;
- chamadas de IA desnecessárias;
- processamento caro no frontend.

Preferir carregamento sob demanda e paginação quando apropriado.

---

# 34. Banco de dados

Antes de criar uma tabela nova, verificar:

1. Existe entidade equivalente?
2. O dado pode pertencer a uma entidade existente?
3. É realmente necessário persistir?
4. Existe risco de duplicação?
5. Como ficará o relacionamento multi-tenant?
6. Como será auditado?
7. Como a IA usará esse dado?

Não criar tabelas apenas para facilitar uma implementação temporária.

---

# 35. Código

Priorizar:

- TypeScript;
- tipos explícitos;
- funções pequenas;
- responsabilidades bem definidas;
- nomes claros;
- baixo acoplamento;
- reutilização;
- tratamento de erros.

Evitar:

- lógica de negócio dentro de componentes visuais;
- duplicação;
- funções gigantes;
- componentes gigantes;
- valores mágicos;
- código morto;
- comentários explicando código óbvio.

---

# 36. Regra para novas funcionalidades

Antes de implementar uma nova funcionalidade, responder:

1. Qual problema do usuário ela resolve?
2. Ela reduz trabalho?
3. Pode ser resolvida por uma funcionalidade existente?
4. Precisa de uma nova tela?
5. Precisa de um novo componente?
6. Existe componente reutilizável?
7. Precisa de uma nova tabela?
8. Existe oportunidade de IA?
9. Existe oportunidade de automação?
10. Qual é o impacto no MVP?
11. Qual é o critério de aceite?

Se a resposta indicar aumento de complexidade sem ganho operacional claro, questionar a necessidade da funcionalidade.

---

# 37. O que evitar

Não criar:

- telas excessivas;
- configurações espalhadas;
- dashboards cheios de gráficos sem ação;
- formulários gigantes sem necessidade;
- componentes duplicados;
- regras de negócio escondidas no frontend;
- regras críticas somente no n8n;
- IA com acesso direto ao banco;
- automações sem idempotência;
- funcionalidades apenas para "ficar parecido com concorrente".

Não copiar Olist ou Kyte visualmente.

Usar os concorrentes como referência de fluxo e problema, não como modelo de cópia.

---

# 38. Critério de sucesso do produto

Uma boa implementação deve fazer o usuário pensar:

> "Eu não precisei fazer quase nada."

E não:

> "O sistema tem muitas funções."

A métrica mental mais importante é redução de esforço operacional.

---

# 39. Desenvolvimento com Claude Code / Cowork

Antes de executar uma tarefa:

1. Ler este CLAUDE.md.
2. Ler a parte relevante do Blueprint V3.
3. Inspecionar o código existente.
4. Procurar componentes existentes.
5. Procurar serviços/regras existentes.
6. Reutilizar antes de criar.
7. Implementar a menor solução consistente.
8. Testar.
9. Verificar estados de erro/loading/vazio.
10. Verificar responsividade.
11. Verificar segurança e tenant.
12. Verificar se a solução criou duplicação.
13. Atualizar documentação quando uma decisão estrutural nova for tomada.

Não reescrever partes não relacionadas da aplicação.

---

# 40. Quando uma nova decisão for necessária

Não simplesmente inventar.

Se for uma decisão pequena e claramente derivável dos padrões existentes, seguir os padrões.

Se for uma decisão arquitetural, de UX ou de produto que possa afetar outras partes do sistema:

- sinalizar a decisão;
- explicar as alternativas;
- escolher somente após alinhamento quando houver impacto relevante;
- registrar a decisão em `docs/decisions/decision-log.md`.

---

# 41. Documentação

Manter:

```text
docs/
├── blueprint/
│   └── Blueprint_MVP_SaaS_Estoque_IA_Automacao_V3.md
├── architecture/
├── design-system/
├── ai/
├── agents/
└── decisions/
    └── decision-log.md
```

O Blueprint é a visão consolidada.

O CLAUDE.md é o contrato permanente de desenvolvimento.

O decision-log registra novas decisões importantes.

---

# 42. Regra final

Sempre priorizar:

```text
Simplicidade
↓
Reutilização
↓
Automação
↓
Inteligência
↓
Profundidade invisível
```

O sistema pode ser tecnicamente complexo por trás.

Para o usuário, deve parecer simples.

A experiência desejada é:

```text
Usuário faz pouco
↓
Sistema entende
↓
IA recomenda
↓
Sistema valida
↓
Automação executa
↓
Usuário acompanha o resultado
```

Este é o padrão que deve orientar o desenvolvimento de todo o produto.


---

# 14. Referência visual oficial — Figma

As telas aprovadas no Figma são a referência visual oficial do produto.

Referências locais do projeto:

```text
/figma
├── README.md
├── telas/
├── design-system/
├── ai-ux/
└── assets/
```

Telas aprovadas atualmente:

- Início / Dashboard
- Produtos
- Estoque
- Compras
- Vendas
- Nova Venda / PDV
- Clientes
- Fornecedores
- Canais
- Assistente Kyra
- Configurações
- Usuários
- Perfis

Regra obrigatória:

> Não recriar visualmente do zero uma tela já aprovada. Implementar a experiência aprovada usando os componentes existentes da Foundation.

Antes de construir qualquer nova tela ou componente, procurar primeiro em `/figma/design-system` e nos componentes existentes do código.

---

# 15. Hierarquia das fontes

Quando houver dúvida, seguir esta ordem:

1. Blueprint V3
2. CLAUDE.md e decisões registradas
3. Design System
4. AI UX Patterns
5. Telas aprovadas no Figma
6. Documentação específica do módulo
7. Código existente

Se houver conflito real entre fontes, não escolher silenciosamente. Registrar a inconsistência e solicitar decisão quando necessário.

---

# 16. Regra de escopo

Cada funcionalidade deve ser classificada como:

- MVP
- FASE 2
- FUTURO
- HIPÓTESE

Não implementar funcionalidades futuras apenas porque estão descritas na documentação.

Financeiro completo e fiscal completo não fazem parte do MVP.

PDV avançado é Fase 2; o PDV básico é MVP.

---

# 17. Nome da IA

A IA oficial do produto é **Kyra**.

Nunca utilizar o nome Maia em código, interface, documentação nova ou prompts. A IA oficial chama-se **Kyra**.

O avatar oficial, quando necessário, está em `/figma/assets/`.
