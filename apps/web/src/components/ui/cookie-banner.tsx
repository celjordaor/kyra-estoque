'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type Consent = {
  necessary: true
  analytics: boolean
  marketing: boolean
  preferences: boolean
}

const STORAGE_KEY = 'kyra_cookie_consent'
const STORAGE_VERSION = '1'

function loadConsent(): Consent | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed.version !== STORAGE_VERSION) return null
    return parsed.consent as Consent
  } catch {
    return null
  }
}

function saveConsent(consent: Consent) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, consent, ts: Date.now() }))
  } catch {}
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const [detailed, setDetailed] = useState(false)
  const [prefs, setPrefs] = useState<Omit<Consent, 'necessary'>>({
    analytics: false,
    marketing: false,
    preferences: false,
  })

  useEffect(() => {
    const saved = loadConsent()
    if (!saved) {
      // Small delay so the banner doesn't flash on first render
      const t = setTimeout(() => setVisible(true), 600)
      return () => clearTimeout(t)
    }
  }, [])

  function acceptAll() {
    const consent: Consent = { necessary: true, analytics: true, marketing: true, preferences: true }
    saveConsent(consent)
    setVisible(false)
  }

  function acceptNecessary() {
    const consent: Consent = { necessary: true, analytics: false, marketing: false, preferences: false }
    saveConsent(consent)
    setVisible(false)
  }

  function savePrefs() {
    const consent: Consent = { necessary: true, ...prefs }
    saveConsent(consent)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Preferências de cookies"
      aria-modal="false"
      className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 md:bottom-4 md:left-auto md:right-4 md:max-w-md"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl" aria-hidden="true">🍪</span>
            <h2 className="text-base font-bold text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>
              Preferências de Cookies
            </h2>
          </div>
          <p className="text-sm text-slate-500 leading-relaxed" style={{ fontFamily: 'var(--font-sans)' }}>
            Usamos cookies para melhorar sua experiência. Saiba mais em nossa{' '}
            <Link href="/privacy" className="text-teal-600 hover:underline font-medium">
              Política de Privacidade
            </Link>
            .
          </p>
        </div>

        {/* Detailed preferences (toggleable) */}
        {detailed && (
          <div className="px-5 py-4 space-y-3 border-b border-slate-100">
            {([
              {
                key: 'necessary' as const,
                label: 'Estritamente necessários',
                desc: 'Essenciais para o funcionamento da plataforma (sessão, autenticação, segurança). Sempre ativos.',
                locked: true,
              },
              {
                key: 'analytics' as const,
                label: 'Analíticos',
                desc: 'Ajudam a entender como você usa a plataforma para melhorarmos os serviços (ex.: Google Analytics).',
                locked: false,
              },
              {
                key: 'preferences' as const,
                label: 'Preferências',
                desc: 'Lembram configurações como idioma, tema e filtros para personalizar sua experiência.',
                locked: false,
              },
              {
                key: 'marketing' as const,
                label: 'Marketing',
                desc: 'Utilizados para exibir anúncios relevantes em outros sites e medir a eficácia de campanhas.',
                locked: false,
              },
            ] as const).map((item) => (
              <div key={item.key} className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800" style={{ fontFamily: 'var(--font-sans)' }}>
                    {item.label}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed" style={{ fontFamily: 'var(--font-sans)' }}>
                    {item.desc}
                  </p>
                </div>
                {item.locked ? (
                  <span className="mt-0.5 text-xs text-teal-600 font-semibold shrink-0" style={{ fontFamily: 'var(--font-sans)' }}>
                    Sempre ativo
                  </span>
                ) : (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={prefs[item.key as keyof typeof prefs]}
                    onClick={() =>
                      setPrefs(p => ({ ...p, [item.key]: !p[item.key as keyof typeof prefs] }))
                    }
                    className={`shrink-0 mt-0.5 w-10 h-5 rounded-full transition-colors relative focus:outline-none focus:ring-2 focus:ring-teal-400 ${
                      prefs[item.key as keyof typeof prefs] ? 'bg-teal-500' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform ${
                        prefs[item.key as keyof typeof prefs] ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="px-5 py-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={acceptAll}
            className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            Aceitar todos
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={acceptNecessary}
              className="flex-1 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium transition-colors"
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              Somente necessários
            </button>
            {detailed ? (
              <button
                type="button"
                onClick={savePrefs}
                className="flex-1 py-2 rounded-xl border border-teal-200 hover:bg-teal-50 text-teal-700 text-sm font-semibold transition-colors"
                style={{ fontFamily: 'var(--font-sans)' }}
              >
                Salvar preferências
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setDetailed(true)}
                className="flex-1 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 text-sm font-medium transition-colors"
                style={{ fontFamily: 'var(--font-sans)' }}
              >
                Personalizar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
