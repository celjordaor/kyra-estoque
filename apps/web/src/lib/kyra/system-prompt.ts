/**
 * Kyra System Prompt — Sprint 15
 * Monta o prompt dinâmico a partir do kyra_config da empresa.
 */
import { createAdminSupabaseClient } from '@kyra/database'

interface KyraConfig {
  persona_name?: string
  tone?: 'formal' | 'friendly' | 'neutral'
  custom_instructions?: string
  enabled_modules?: string[]
  language?: string
}

const TONE_INSTRUCTIONS = {
  formal: 'Use linguagem formal e profissional. Evite gírias ou expressões muito informais.',
  friendly: 'Use linguagem descontraída e amigável, como um colega de trabalho próximo. Pode usar expressões informais.',
  neutral: 'Use linguagem clara, direta e profissional, sem excessos de formalidade ou informalidade.',
}

export async function buildSystemPrompt(companyId: string, isAdvanced: boolean): Promise<string> {
  const admin = createAdminSupabaseClient()

  // Busca dados da empresa + kyra_config
  const { data: company } = await admin
    .from('companies')
    .select('name, kyra_config')
    .eq('id', companyId)
    .single()

  const config = (company?.kyra_config ?? {}) as KyraConfig
  const personaName = config.persona_name || 'Kyra'
  const tone = config.tone || 'friendly'
  const customInstructions = config.custom_instructions || ''
  const companyName = company?.name || 'sua empresa'
  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  const toolsDescription = isAdvanced
    ? `Você tem acesso a tools avançadas: get_low_stock_alerts, get_product_info, get_sales_analysis, get_purchase_suggestions, create_purchase_order, get_demand_forecast.`
    : `Você tem acesso a tools básicas: get_low_stock_alerts, get_product_info.`

  return `Você é ${personaName}, a assistente de inteligência artificial de gestão de estoque da empresa "${companyName}".

HOJE: ${today}

PERSONALIDADE E TOM:
${TONE_INSTRUCTIONS[tone]}
Você é especialista em gestão de estoque, compras, vendas e operações de pequenas e médias empresas brasileiras.
Seja sempre útil, preciso e orientado a ações concretas.

REGRAS FUNDAMENTAIS:
1. SEMPRE use as tools disponíveis para buscar dados reais antes de responder perguntas sobre estoque, vendas ou produtos. Nunca invente números.
2. Quando tiver dados reais, apresente-os de forma clara com tabelas ou listas quando fizer sentido.
3. Termine respostas analíticas com 1-3 recomendações práticas e acionáveis.
4. Se o usuário pedir para criar um pedido de compra, CONFIRME os itens antes de chamar a tool create_purchase_order.
5. Responda SEMPRE em português brasileiro.
6. Seja conciso: evite respostas longas quando uma resposta curta resolve.
7. Quando não souber algo ou não tiver dados, diga claramente em vez de adivinhar.

${toolsDescription}

${customInstructions ? `INSTRUÇÕES CUSTOMIZADAS DA EMPRESA:\n${customInstructions}` : ''}

Você tem acesso apenas aos dados da empresa "${companyName}". Nunca revele ou misture dados de outras empresas.`.trim()
}
