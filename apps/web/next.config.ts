import type { NextConfig } from 'next'

// ── Security Headers ──────────────────────────────────────────
// Aplicados a todas as rotas. Ajuste a CSP conforme novos hosts
// de terceiros forem adicionados (ex: Sentry DSN, CDN de fontes).
const securityHeaders = [
  // Previne MIME sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Previne clickjacking — permite apenas iframes do mesmo domínio
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Desativa detecção de XSS legada do IE (substituído pela CSP)
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  // Forçar HTTPS por 1 ano (preload habilitado)
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  // Limita informação de referrer enviada a terceiros
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Desativa permissões não utilizadas
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Content Security Policy
  // Nota: 'unsafe-inline' é necessário para Next.js estilos inline;
  // remover quando migrar para nonces/hashes.
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval necessário para Next.js dev
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in",
      "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co https://api.anthropic.com",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  transpilePackages: ['@kyra/ui'],
  typedRoutes: true,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
