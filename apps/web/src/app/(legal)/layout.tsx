import React from 'react'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'

export const metadata = {}

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-screen-xl mx-auto px-5 md:px-10 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600">
              <Sparkles className="h-4 w-4 text-white" />
            </span>
            <div className="flex flex-col leading-none">
              <span className="text-[15px] font-bold text-slate-900 tracking-tight">Kyra</span>
              <span className="text-[9.5px] font-medium text-slate-400 tracking-[0.06em] uppercase">Estoque</span>
            </div>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-slate-500">
            <Link href="/privacy" className="hover:text-teal-600 transition-colors">Privacidade</Link>
            <Link href="/terms" className="hover:text-teal-600 transition-colors">Termos</Link>
            <Link href="/login" className="px-4 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-700 font-medium">
              Entrar
            </Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-5 md:px-10 py-12">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="max-w-screen-xl mx-auto px-5 md:px-10 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-slate-400">
          <p>© {new Date().getFullYear()} Kyra Estoque. Todos os direitos reservados.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-slate-600 transition-colors">Política de Privacidade</Link>
            <Link href="/terms" className="hover:text-slate-600 transition-colors">Termos de Uso</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
