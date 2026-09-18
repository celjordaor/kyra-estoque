import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@kyra/database'

const TO_EMAIL = 'contato@kyraestoque.com.br'

// ── Rate limiting (F-014) ──────────────────────────────────────
// 5 requisições por IP a cada 60 s — protege endpoint público de spam/abuso
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 60_000

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }
  if (entry.count >= RATE_LIMIT_MAX) return true
  entry.count++
  return false
}
const FROM_EMAIL = 'noreply@kyraestoque.com.br' // trocar pelo domínio verificado no Resend

/** Escapa caracteres HTML especiais para evitar HTML injection em e-mails (F-015) */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

export async function POST(req: NextRequest) {
  // ── Rate limiting ───────────────────────────────────────────
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'too_many_requests' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  const body = await req.json()
  const { company, name, phone, email, usesStock, goals } = body

  // Basic server-side validation
  if (!company || !name || !email || !phone) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  // 1. Save lead to database first (always, regardless of email status)
  try {
    const admin = createAdminSupabaseClient()
    const message = [
      usesStock ? `Usa sistema: ${usesStock === 'sim' ? 'Sim' : 'Não'}` : null,
      goals ? `Desafios: ${goals}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    const { error: dbError } = await (admin as any).from('leads').insert({
      name,
      email,
      phone,
      company,
      message: message || null,
      source: 'demo',
      status: 'new',
    })

    if (dbError) {
      console.error('[demo] DB insert error:', dbError)
      return NextResponse.json({ error: 'db_error' }, { status: 500 })
    }
  } catch (err) {
    console.error('[demo] Unexpected DB error:', err)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  // 2. Send email notification (best-effort — lead is already saved)
  const apiKey = process.env.RESEND_API_KEY
  if (apiKey) {
    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
        <div style="background: #0d9488; padding: 20px 24px; border-radius: 12px 12px 0 0;">
          <h2 style="margin: 0; color: white; font-size: 18px;">✨ Novo lead — Demonstração Kyra Estoque</h2>
        </div>
        <div style="border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px; width: 160px;">Empresa</td><td style="padding: 8px 0; font-weight: 600;">${escapeHtml(company)}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px;">Nome</td><td style="padding: 8px 0;">${escapeHtml(name)}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px;">Telefone</td><td style="padding: 8px 0;">${escapeHtml(phone)}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px;">E-mail</td><td style="padding: 8px 0;"><a href="mailto:${escapeHtml(email)}" style="color: #0d9488;">${escapeHtml(email)}</a></td></tr>
            <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px;">Usa sistema?</td><td style="padding: 8px 0;">${usesStock === 'sim' ? 'Sim' : 'Não'}</td></tr>
            ${goals ? `<tr><td style="padding: 8px 0; color: #64748b; font-size: 13px; vertical-align: top;">Desafios</td><td style="padding: 8px 0;">${escapeHtml(goals)}</td></tr>` : ''}
          </table>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 16px;">Kyra Estoque · Lead capture</p>
      </div>
    `

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: `Kyra Estoque <${FROM_EMAIL}>`,
          to: [TO_EMAIL],
          reply_to: email,
          subject: `🎯 Demo solicitada — ${escapeHtml(company)}`,
          html,
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        console.error('[demo] Resend error (lead already saved):', err)
      }
    } catch (err) {
      console.error('[demo] Resend fetch error (lead already saved):', err)
    }
  } else {
    console.warn('[demo] RESEND_API_KEY not configured — email skipped, lead saved to DB')
  }

  return NextResponse.json({ ok: true })
}
