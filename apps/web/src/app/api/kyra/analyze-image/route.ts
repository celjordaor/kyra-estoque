/**
 * POST /api/kyra/analyze-image — Análise de imagem de produto com Anthropic Vision
 * Sprint 25 — Substituição do mock por IA real
 *
 * Segurança:
 * - company_id SEMPRE derivado do JWT, nunca do body
 * - ANTHROPIC_API_KEY somente server-side
 * - Aceita apenas imagens (image/jpeg, image/png, image/webp, image/gif)
 * - Limite de 5MB por imagem
 */
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@kyra/database'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
type AllowedMediaType = (typeof ALLOWED_MEDIA_TYPES)[number]

const SYSTEM_PROMPT = `Você é um assistente especializado em catalogação de produtos para estoque.
Analise a imagem fornecida e extraia informações sobre o produto visível.
Retorne APENAS um objeto JSON válido, sem markdown, sem texto adicional.`

const USER_PROMPT = `Analise esta imagem de produto e retorne um JSON com a seguinte estrutura exata:
{
  "overallConfidence": <número entre 0 e 1>,
  "fields": {
    "name":        { "value": "<nome do produto>",        "confidence": <0-1> },
    "category":    { "value": "<categoria>",               "confidence": <0-1> },
    "brand":       { "value": "<marca ou vazio>",          "confidence": <0-1> },
    "color":       { "value": "<cor principal>",           "confidence": <0-1> },
    "size":        { "value": "<tamanho ou vazio>",        "confidence": <0-1> },
    "description": { "value": "<descrição curta>",         "confidence": <0-1> },
    "tags":        { "value": "<tags separadas por vírgula>", "confidence": <0-1> }
  }
}

Regras:
- name: nome descritivo incluindo cor/tamanho se visível
- category: categoria genérica em português (ex: Vestuário, Eletrônicos, Calçados, Acessórios)
- brand: deixe vazio string se não identificável
- size: deixe vazio string se não aplicável
- confidence: 0.0 a 1.0 refletindo sua certeza
- overallConfidence: média ponderada das confidences dos campos principais
- Responda APENAS com o JSON, sem markdown, sem explicações`

export async function POST(req: NextRequest) {
  try {
    // ── 1. Autenticação ───────────────────────────────────────
    const cookieStore = await cookies()
    const supabase = createServerSupabaseClient(cookieStore)
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // ── 2. Extrair imagem do body ─────────────────────────────
    const body = await req.json() as { imageDataUrl?: string }
    const { imageDataUrl } = body

    if (!imageDataUrl || typeof imageDataUrl !== 'string') {
      return NextResponse.json({ error: 'imageDataUrl é obrigatório' }, { status: 400 })
    }

    // Parsear data URL: data:<mediaType>;base64,<data>
    const match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) {
      return NextResponse.json({ error: 'Formato de imagem inválido' }, { status: 400 })
    }

    const mediaType = match[1] as AllowedMediaType
    const base64Data = match[2]

    if (!ALLOWED_MEDIA_TYPES.includes(mediaType)) {
      return NextResponse.json(
        { error: `Tipo de mídia não suportado: ${mediaType}` },
        { status: 400 }
      )
    }

    // Verificar tamanho (base64 ≈ 4/3 do tamanho original)
    const estimatedBytes = Math.ceil(base64Data.length * 0.75)
    if (estimatedBytes > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Imagem excede o limite de 5MB' },
        { status: 413 }
      )
    }

    // ── 3. Verificar API key ──────────────────────────────────
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Serviço de IA não configurado' },
        { status: 503 }
      )
    }

    // ── 4. Chamar Anthropic Vision ────────────────────────────
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data,
              },
            },
            {
              type: 'text',
              text: USER_PROMPT,
            },
          ],
        },
      ],
    })

    // ── 5. Parsear resposta ───────────────────────────────────
    const rawText = message.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')

    let result
    try {
      // Remover markdown se o modelo incluir por acidente
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      result = JSON.parse(cleaned)
    } catch {
      console.error('[analyze-image] JSON parse error:', rawText)
      return NextResponse.json(
        { error: 'Resposta da IA em formato inválido' },
        { status: 502 }
      )
    }

    // ── 6. Validação básica da estrutura ──────────────────────
    if (
      typeof result.overallConfidence !== 'number' ||
      !result.fields ||
      typeof result.fields !== 'object'
    ) {
      return NextResponse.json(
        { error: 'Estrutura de resposta inesperada da IA' },
        { status: 502 }
      )
    }

    // Garantir que todos os campos existam com valores padrão
    const fields = ['name', 'category', 'brand', 'color', 'size', 'description', 'tags']
    for (const field of fields) {
      if (!result.fields[field]) {
        result.fields[field] = { value: '', confidence: 0 }
      }
    }

    return NextResponse.json(result)
  } catch (err: unknown) {
    console.error('[analyze-image] Erro:', err)
    const message = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
