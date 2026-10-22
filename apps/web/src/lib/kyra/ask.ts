// Pergunta reutilizável à Kyra IA (usada pelo WhatsApp). O chat web segue em /api/kyra/chat.
import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'
import { hasFeature, canUse, incrementUsage } from '@kyra/business-rules'
import { BASIC_TOOLS, ADVANCED_TOOLS, executeTool } from '@/lib/kyra/tools'
import { buildSystemPrompt } from '@/lib/kyra/system-prompt'

const MAX_TOOL_ITERATIONS = 5

export type AskKyraResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'limit' | 'error'; message: string }

export async function askKyra(input: {
  companyId: string
  messages: { role: 'user' | 'assistant'; content: string }[]
}): Promise<AskKyraResult> {
  const { companyId } = input
  try {
    const check = await canUse(companyId, 'ai.queries.monthly')
    if (!check.allowed) {
      return { ok: false, reason: 'limit', message: 'O limite mensal de consultas à Kyra IA do seu plano foi atingido.' }
    }
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const isAdvanced = await hasFeature(companyId, 'ai.advanced.enabled')
    const tools = isAdvanced ? ADVANCED_TOOLS : BASIC_TOOLS
    const system =
      (await buildSystemPrompt(companyId, isAdvanced)) +
      '\n\nCanal: WhatsApp. Responda em português, de forma curta e direta (até ~900 caracteres), em texto simples, sem tabelas nem títulos em markdown.'

    const messages: MessageParam[] = input.messages.map(m => ({ role: m.role, content: m.content }))
    let finalResponse: Anthropic.Message | null = null

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        system,
        messages,
        tools,
      })
      finalResponse = response
      if (response.stop_reason !== 'tool_use') break
      messages.push({ role: 'assistant', content: response.content })
      const results = await Promise.all(
        response.content.filter(b => b.type === 'tool_use').map(async block => {
          if (block.type !== 'tool_use') return null
          const result = await executeTool(block.name, block.input as Record<string, unknown>, companyId)
          return { type: 'tool_result' as const, tool_use_id: block.id, content: JSON.stringify(result) }
        }),
      )
      messages.push({ role: 'user', content: results.filter(Boolean) as Anthropic.ToolResultBlockParam[] })
    }

    if (!finalResponse) return { ok: false, reason: 'error', message: 'Não consegui processar sua pergunta agora.' }
    await incrementUsage(companyId, 'ai.queries.monthly').catch(() => {})
    const text = finalResponse.content
      .filter(b => b.type === 'text')
      .map(b => (b as Anthropic.TextBlock).text)
      .join('\n')
      .trim()
    return { ok: true, text: text || 'Não encontrei uma resposta para isso.' }
  } catch (e) {
    console.error('[askKyra] error:', e)
    return { ok: false, reason: 'error', message: 'Tive um problema para responder agora. Tente novamente em instantes.' }
  }
}
