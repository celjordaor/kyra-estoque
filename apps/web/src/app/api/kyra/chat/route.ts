/**
 * POST /api/kyra/chat — Kyra IA Real
 * Sprint 15 — Anthropic API com tool use
 *
 * Segurança:
 * - company_id SEMPRE derivado do JWT, nunca do body
 * - ANTHROPIC_API_KEY somente server-side
 * - Entitlement check antes de qualquer chamada à Anthropic
 * - IA nunca acessa banco diretamente — usa executeTool() com RLS
 */
import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'
import { cookies } from 'next/headers'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'
import { hasFeature, canUse, incrementUsage } from '@kyra/business-rules'
import { BASIC_TOOLS, ADVANCED_TOOLS, executeTool } from '@/lib/kyra/tools'
import { buildSystemPrompt } from '@/lib/kyra/system-prompt'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Max tool loop iterations — prevent infinite loops
const MAX_TOOL_ITERATIONS = 5

export async function POST(req: NextRequest) {
  try {
    // ── 1. Autenticação ───────────────────────────────────────
    const cookieStore = await cookies()
    const supabase = createServerSupabaseClient(cookieStore)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const admin = createAdminSupabaseClient()
    const { data: profileData } = await admin
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()
    const profile = profileData as { company_id: string | null } | null

    if (!profile?.company_id) {
      return Response.json({ error: 'Empresa não encontrada' }, { status: 403 })
    }

    const companyId = profile.company_id as string

    // ── 2. Entitlement: ai.queries.monthly ───────────────────
    const check = await canUse(companyId, 'ai.queries.monthly')
    if (!check.allowed) {
      return Response.json(
        { error: 'MONTHLY_AI_LIMIT', limit: check.limit, current: check.current },
        { status: 429 }
      )
    }

    // ── 3. Feature flag para tools avançadas ─────────────────
    const isAdvanced = await hasFeature(companyId, 'ai.advanced.enabled')
    const tools = isAdvanced ? ADVANCED_TOOLS : BASIC_TOOLS

    // ── 4. Parse body ─────────────────────────────────────────
    const body = await req.json()
    const clientMessages: MessageParam[] = body.messages ?? []

    if (!clientMessages.length) {
      return Response.json({ error: 'Mensagens não fornecidas' }, { status: 400 })
    }

    // ── 5. Build system prompt ────────────────────────────────
    const systemPrompt = await buildSystemPrompt(companyId, isAdvanced)

    // ── 6. Tool use loop ──────────────────────────────────────
    const messages: MessageParam[] = [...clientMessages]
    let iterations = 0
    let finalResponse: Anthropic.Message | null = null

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++

      const response = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 4096,
        system: systemPrompt,
        messages,
        tools,
      })

      finalResponse = response

      // Se parou por tool_use: executar tools e continuar loop
      if (response.stop_reason === 'tool_use') {
        // Adiciona a resposta do assistente ao histórico
        messages.push({ role: 'assistant', content: response.content })

        // Executa todas as tool_use blocks em paralelo
        const toolUseBlocks = response.content.filter(b => b.type === 'tool_use')
        const toolResults = await Promise.all(
          toolUseBlocks.map(async (block) => {
            if (block.type !== 'tool_use') return null
            const result = await executeTool(
              block.name,
              block.input as Record<string, unknown>,
              companyId
            )
            return {
              type: 'tool_result' as const,
              tool_use_id: block.id,
              content: JSON.stringify(result),
            }
          })
        )

        // Adiciona resultados das tools ao histórico
        messages.push({
          role: 'user',
          content: toolResults.filter(Boolean) as Anthropic.ToolResultBlockParam[],
        })

        continue
      }

      // stop_reason === 'end_turn' — resposta final
      break
    }

    if (!finalResponse) {
      return Response.json({ error: 'Erro ao processar resposta' }, { status: 500 })
    }

    // ── 7. Incrementar usage counter ──────────────────────────
    await incrementUsage(companyId, 'ai.queries.monthly').catch(err => {
      console.error('[kyra/chat] incrementUsage error:', err)
    })

    // ── 8. Retornar resposta ──────────────────────────────────
    // Extrai apenas blocos de texto (não inclui tool_use)
    const textContent = finalResponse.content
      .filter(b => b.type === 'text')
      .map(b => (b as Anthropic.TextBlock).text)
      .join('\n\n')

    return Response.json({
      content: textContent,
      usage: {
        input_tokens: finalResponse.usage.input_tokens,
        output_tokens: finalResponse.usage.output_tokens,
      },
    })

  } catch (err) {
    console.error('[kyra/chat] Error:', err)
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return Response.json({ error: msg }, { status: 500 })
  }
}
