import { NextRequest, NextResponse } from 'next/server'

const TO_EMAIL = 'contato@kyraestoque.com.br'
const FROM_EMAIL = 'noreply@kyraestoque.com.br' // trocar pelo domínio verificado no Resend

export async function POST(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('[demo] RESEND_API_KEY não configurado')
    return NextResponse.json({ error: 'not_configured' }, { status: 500 })
  }

  const body = await req.json()
  const { company, name, phone, email, usesStock, goals } = body

  // Basic server-side validation
  if (!company || !name || !email || !phone) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
      <div style="background: #0d9488; padding: 20px 24px; border-radius: 12px 12px 0 0;">
        <h2 style="margin: 0; color: white; font-size: 18px;">✨ Novo lead — Demonstração Kyra Estoque</h2>
      </div>
      <div style="border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px; width: 160px;">Empresa</td><td style="padding: 8px 0; font-weight: 600;">${company}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px;">Nome</td><td style="padding: 8px 0;">${name}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px;">Telefone</td><td style="padding: 8px 0;">${phone}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px;">E-mail</td><td style="padding: 8px 0;"><a href="mailto:${email}" style="color: #0d9488;">${email}</a></td></tr>
          <tr><td style="padding: 8px 0; color: #64748b; font-size: 13px;">Usa sistema?</td><td style="padding: 8px 0;">${usesStock === 'sim' ? 'Sim' : 'Não'}</td></tr>
          ${goals ? `<tr><td style="padding: 8px 0; color: #64748b; font-size: 13px; vertical-align: top;">Desafios</td><td style="padding: 8px 0;">${goals}</td></tr>` : ''}
        </table>
      </div>
      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 16px;">Kyra Estoque · Lead capture</p>
    </div>
  `

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: `Kyra Estoque <${FROM_EMAIL}>`,
      to: [TO_EMAIL],
      reply_to: email,
      subject: `🎯 Demo solicitada — ${company}`,
      html,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[demo] Resend error:', err)
    return NextResponse.json({ error: 'send_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
