'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'

// ─── Primitives ───────────────────────────────────────────────────────────────

function Sparkle({ size = 14, color = "#0D9488" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 2L9.1 5.9H13.2L10 8.3L11.1 12.2L8 9.8L4.9 12.2L6 8.3L2.8 5.9H6.9L8 2Z" fill={color} />
    </svg>
  );
}

function KyraLogo({ size = 16, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="rounded-lg bg-teal-600 flex items-center justify-center flex-shrink-0"
        style={{ width: size * 1.75, height: size * 1.75 }}
      >
        <Sparkle size={size * 0.85} color="white" />
      </div>
      <span
        style={{ fontFamily: "var(--font-display)", fontSize: size, fontWeight: 800, letterSpacing: "-0.03em" }}
        className={dark ? "text-white" : "text-slate-900"}
      >
        Kyra Estoque
      </span>
    </div>
  );
}

function AIBadge({ label = "Kyra IA" }: { label?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200"
      style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", fontWeight: 600 }}
    >
      <Sparkle size={9} />
      {label}
    </span>
  );
}

function Btn({
  children,
  variant = "primary",
  size = "md",
  full = false,
  onClick,
}: {
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "outline" | "white";
  size?: "sm" | "md" | "lg";
  full?: boolean;
  onClick?: () => void;
}) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400";
  const sz = { sm: "px-4 py-2 text-sm", md: "px-5 py-2.5 text-sm", lg: "px-7 py-3.5 text-base" };
  const v = {
    primary: "bg-teal-600 text-white hover:bg-teal-700 shadow-sm hover:shadow-md",
    ghost:   "text-teal-700 hover:bg-teal-50 border border-teal-200",
    outline: "text-slate-700 border border-slate-200 hover:bg-slate-50",
    white:   "bg-white text-teal-700 hover:bg-teal-50 shadow-sm",
  };
  return (
    <button onClick={onClick} className={`${base} ${sz[size]} ${v[variant]} ${full ? "w-full" : ""}`} style={{ fontFamily: "var(--font-sans)" }}>
      {children}
    </button>
  );
}

function Check({ color = "teal" }: { color?: "teal" | "white" }) {
  const stroke = color === "white" ? "white" : "#0D9488";
  const fill = color === "white" ? "rgba(255,255,255,0.15)" : "#0D9488";
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0" aria-hidden>
      <circle cx="8" cy="8" r="7" fill={fill} opacity={color === "white" ? 1 : 0.12} />
      <path d="M5 8L7.2 10.2L11 6" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Section({ id, children, className = "", style }: { id?: string; children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <section id={id} className={`px-5 md:px-10 lg:px-16 ${className}`} style={style}>
      {children}
    </section>
  );
}

function SectionLabel({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.12em" }} className={`uppercase font-semibold mb-3 ${light ? "text-teal-300" : "text-teal-600"}`}>
      {children}
    </p>
  );
}

// ─── HERO MOCKUP ─────────────────────────────────────────────────────────────

function MockKPI({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="p-3 rounded-xl bg-white border border-slate-100" style={{ boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}>
      <p style={{ fontFamily: "var(--font-sans)", fontSize: 10 }} className="text-slate-400 mb-0.5">{label}</p>
      <p style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700 }} className={color}>{value}</p>
      <p style={{ fontFamily: "var(--font-sans)", fontSize: 10 }} className="text-slate-400">{sub}</p>
    </div>
  );
}

function HeroMockup() {
  return (
    <div
      className="relative rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden"
      style={{ boxShadow: "0 24px 64px rgba(15,23,42,.10), 0 4px 16px rgba(15,23,42,.06)" }}
    >
      {/* Browser chrome */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center gap-2">
        <div className="flex gap-1.5">
          {["bg-red-400", "bg-amber-400", "bg-green-400"].map((c, i) => <div key={i} className={`w-2.5 h-2.5 rounded-full ${c}`} />)}
        </div>
        <div className="flex-1 mx-3 bg-slate-100 rounded-md px-3 py-1 text-center" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#94A3B8" }}>
          app.kyraestoque.com.br
        </div>
      </div>
      {/* App shell */}
      <div className="flex" style={{ height: 460 }}>
        {/* Sidebar */}
        <div className="w-12 bg-white border-r border-slate-100 flex flex-col items-center py-4 gap-3 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-teal-600 flex items-center justify-center">
            <Sparkle size={11} color="white" />
          </div>
          {["M", "P", "E", "C", "V", "IA"].map((l) => (
            <div key={l} className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center" style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#94A3B8" }}>{l}</div>
          ))}
        </div>
        {/* Main */}
        <div className="flex-1 overflow-hidden p-4 flex flex-col gap-3">
          {/* Greeting */}
          <div className="flex items-center gap-2">
            <Sparkle size={13} />
            <p style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700 }} className="text-slate-900">Bom dia.</p>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 12 }} className="text-slate-400">Analisei sua operação.</p>
          </div>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <MockKPI label="Vendas" value="R$ 4.820" sub="+14% vs. média" color="text-teal-700" />
            <MockKPI label="Estoque crítico" value="7 produtos" sub="Risco de ruptura" color="text-red-600" />
            <MockKPI label="Estoque parado" value="R$ 8.430" sub="Sem venda +60d" color="text-amber-600" />
            <MockKPI label="Oportunidades" value="5 ativas" sub="Ações disponíveis" color="text-teal-700" />
          </div>
          {/* Alerts */}
          <div className="space-y-2">
            {[
              { bg: "bg-red-50 border-red-200", dot: "bg-red-500", text: "3 produtos podem ficar sem estoque nos próximos 7 dias.", action: "Criar pedido", abtn: "bg-red-500" },
              { bg: "bg-amber-50 border-amber-200", dot: "bg-amber-400", text: "R$ 8.430 parados sem venda há mais de 60 dias.", action: "Ver produtos", abtn: "bg-amber-500" },
              { bg: "bg-teal-50 border-teal-200", dot: "bg-teal-500", text: "5 oportunidades de venda identificadas esta semana.", action: "Ver análise", abtn: "bg-teal-600" },
            ].map((a) => (
              <div key={a.text} className={`flex items-start gap-2.5 p-3 rounded-xl border ${a.bg}`}>
                <div className={`w-2 h-2 rounded-full ${a.dot} flex-shrink-0 mt-1.5`} />
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 11 }} className="text-slate-700 flex-1 leading-snug">{a.text}</p>
                <button className={`${a.abtn} text-white text-xs font-semibold px-2.5 py-1 rounded-lg flex-shrink-0`} style={{ fontFamily: "var(--font-sans)" }}>{a.action}</button>
              </div>
            ))}
          </div>
          {/* Copilot strip */}
          <div className="mt-auto p-3 rounded-xl border border-teal-200 bg-teal-50/60 flex items-center gap-2">
            <Sparkle size={12} />
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 11 }} className="text-slate-500 flex-1">O que você precisa?</p>
            <div className="w-6 h-6 rounded-lg bg-teal-600 flex items-center justify-center flex-shrink-0">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5H8M8 5L5.5 2.5M8 5L5.5 7.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" /></svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── DEMO MODAL ───────────────────────────────────────────────────────────────

let _setDemoOpen: ((v: boolean) => void) | null = null;

function openDemoModal() {
  _setDemoOpen?.(true);
}

function phoneFormat(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

type DemoFields = {
  company: string;
  name: string;
  phone: string;
  email: string;
  usesStock: '' | 'sim' | 'nao';
  goals: string;
  termsAccepted: boolean;
};

function DemoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState<DemoFields>({
    company: '', name: '', phone: '', email: '', usesStock: '', goals: '', termsAccepted: false,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof DemoFields, string>>>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  useEffect(() => {
    if (!open) { setStatus('idle'); setErrors({}); }
  }, [open]);

  function validate() {
    const e: typeof errors = {};
    if (!form.company.trim()) e.company = 'Campo obrigatório';
    if (!form.name.trim()) e.name = 'Campo obrigatório';
    if (form.phone.replace(/\D/g, '').length < 10) e.phone = 'Telefone inválido (mínimo 10 dígitos)';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'E-mail inválido';
    if (!form.usesStock) e.usesStock = 'Selecione uma opção';
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setStatus('sending');
    try {
      const res = await fetch('/api/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setStatus(res.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  }

  if (!open) return null;

  const inp = (err?: string) =>
    `w-full rounded-xl border ${err ? 'border-red-300 focus:ring-red-400' : 'border-slate-200 focus:ring-teal-400'} px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all bg-white`;
  const lbl = 'block text-sm font-medium text-slate-700 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: '92vh' }}
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center">
                <Sparkle size={14} color="white" />
              </div>
              <span
                style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em' }}
                className="text-teal-600 font-semibold uppercase"
              >
                Kyra Estoque
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <h2
            style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}
            className="text-slate-900 text-2xl mt-4 mb-1"
          >
            Agende sua Demonstração
          </h2>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14 }} className="text-slate-500">
            Entraremos em contato em até 48 horas.
          </p>
        </div>

        {/* Body */}
        <div className="overflow-y-auto">
          {status === 'sent' ? (
            <div className="p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <circle cx="14" cy="14" r="13" stroke="#0D9488" strokeWidth="1.5" />
                  <path d="M9 14L12.5 17.5L19 11" stroke="#0D9488" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }} className="text-slate-900 mb-2">
                Solicitação enviada!
              </p>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14 }} className="text-slate-500 mb-6">
                Nossa equipe entrará em contato em breve.
              </p>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors"
                style={{ fontFamily: 'var(--font-sans)' }}
              >
                Fechar
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-4" noValidate>
              {/* Company */}
              <div>
                <label className={lbl} style={{ fontFamily: 'var(--font-sans)' }}>
                  Nome da Empresa <span className="text-red-500">*</span>
                </label>
                <input
                  className={inp(errors.company)}
                  style={{ fontFamily: 'var(--font-sans)' }}
                  placeholder="Ex: TechCorp LTDA"
                  value={form.company}
                  onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                />
                {errors.company && (
                  <p className="text-red-500 text-xs mt-1" style={{ fontFamily: 'var(--font-sans)' }}>{errors.company}</p>
                )}
              </div>

              {/* Name */}
              <div>
                <label className={lbl} style={{ fontFamily: 'var(--font-sans)' }}>
                  Nome e Sobrenome <span className="text-red-500">*</span>
                </label>
                <input
                  className={inp(errors.name)}
                  style={{ fontFamily: 'var(--font-sans)' }}
                  placeholder="Ex: João Silva"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
                {errors.name && (
                  <p className="text-red-500 text-xs mt-1" style={{ fontFamily: 'var(--font-sans)' }}>{errors.name}</p>
                )}
              </div>

              {/* Phone + Email */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl} style={{ fontFamily: 'var(--font-sans)' }}>
                    Telefone <span className="text-red-500">*</span>
                  </label>
                  <input
                    className={inp(errors.phone)}
                    style={{ fontFamily: 'var(--font-sans)' }}
                    placeholder="(11) 99999-9999"
                    value={form.phone}
                    maxLength={15}
                    onChange={e => setForm(f => ({ ...f, phone: phoneFormat(e.target.value) }))}
                  />
                  {errors.phone && (
                    <p className="text-red-500 text-xs mt-1" style={{ fontFamily: 'var(--font-sans)' }}>{errors.phone}</p>
                  )}
                </div>
                <div>
                  <label className={lbl} style={{ fontFamily: 'var(--font-sans)' }}>
                    E-mail <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    className={inp(errors.email)}
                    style={{ fontFamily: 'var(--font-sans)' }}
                    placeholder="joao@empresa.com.br"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  />
                  {errors.email && (
                    <p className="text-red-500 text-xs mt-1" style={{ fontFamily: 'var(--font-sans)' }}>{errors.email}</p>
                  )}
                </div>
              </div>

              {/* Uses stock system */}
              <div>
                <label className={lbl} style={{ fontFamily: 'var(--font-sans)' }}>
                  Já usa algum sistema de estoque atualmente? <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['sim', 'nao'] as const).map(v => (
                    <label
                      key={v}
                      className={`flex items-center justify-center gap-2.5 py-2.5 rounded-xl border cursor-pointer transition-all select-none ${
                        form.usesStock === v
                          ? 'bg-teal-50 border-teal-400 text-teal-700 font-semibold'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                      style={{ fontFamily: 'var(--font-sans)', fontSize: 14 }}
                    >
                      <input
                        type="radio"
                        name="usesStock"
                        value={v}
                        className="sr-only"
                        checked={form.usesStock === v}
                        onChange={() => setForm(f => ({ ...f, usesStock: v }))}
                      />
                      <span
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          form.usesStock === v ? 'border-teal-500' : 'border-slate-300'
                        }`}
                      >
                        {form.usesStock === v && <span className="w-2 h-2 rounded-full bg-teal-500" />}
                      </span>
                      {v === 'sim' ? 'Sim' : 'Não'}
                    </label>
                  ))}
                </div>
                {errors.usesStock && (
                  <p className="text-red-500 text-xs mt-1" style={{ fontFamily: 'var(--font-sans)' }}>{errors.usesStock}</p>
                )}
              </div>

              {/* Goals */}
              <div>
                <label className={lbl} style={{ fontFamily: 'var(--font-sans)' }}>
                  Principais desafios ou objetivos
                </label>
                <textarea
                  className={inp()}
                  style={{ fontFamily: 'var(--font-sans)', resize: 'vertical', minHeight: 88 }}
                  placeholder="Ex: Reduzir ruptura de estoque, ter mais visibilidade da operação..."
                  value={form.goals}
                  onChange={e => setForm(f => ({ ...f, goals: e.target.value }))}
                  rows={3}
                />
              </div>

              {status === 'error' && (
                <p className="text-red-600 text-sm text-center" style={{ fontFamily: 'var(--font-sans)' }}>
                  Ocorreu um erro. Tente novamente ou entre em contato pelo{' '}
                  <a href="mailto:contato@kyraestoque.com.br" className="underline">contato@kyraestoque.com.br</a>
                </p>
              )}

              {/* Terms acceptance */}
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  required
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-teal-600 accent-teal-600 shrink-0"
                  onChange={e => setForm(f => ({ ...f, termsAccepted: e.target.checked }))}
                />
                <span className="text-xs text-slate-500 leading-relaxed" style={{ fontFamily: 'var(--font-sans)' }}>
                  Li e concordo com os{' '}
                  <a href="/terms" target="_blank" rel="noopener" className="text-teal-600 hover:underline font-medium">
                    Termos de Uso
                  </a>{' '}
                  e com a{' '}
                  <a href="/privacy" target="_blank" rel="noopener" className="text-teal-600 hover:underline font-medium">
                    Política de Privacidade
                  </a>
                  , incluindo o tratamento dos meus dados para fins de contato comercial (LGPD, art. 7º, II).
                </span>
              </label>

              <button
                type="submit"
                disabled={status === 'sending' || !form.termsAccepted}
                className="w-full py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-base transition-colors disabled:opacity-60"
                style={{ fontFamily: 'var(--font-sans)' }}
              >
                {status === 'sending' ? 'Enviando...' : 'Enviar Solicitação →'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── NAV ─────────────────────────────────────────────────────────────────────

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function Nav() {
  const [open, setOpen] = useState(false);
  const links: { label: string; target: string }[] = [
    { label: "Produto",      target: "produto" },
    { label: "Recursos",     target: "recursos" },
    { label: "Integrações",  target: "integracoes" },
    { label: "Planos",       target: "planos" },
    { label: "Empresa",      target: "empresa" },
  ];
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-screen-xl mx-auto px-5 md:px-10 h-16 flex items-center justify-between">
        <KyraLogo size={15} />
        <nav className="hidden lg:flex items-center gap-0.5">
          {links.map((l) => (
            <button
              key={l.label}
              onClick={() => scrollToSection(l.target)}
              className="px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              {l.label}
            </button>
          ))}
          <div className="w-px h-5 bg-slate-200 mx-2" />
          
        </nav>
        <div className="hidden md:flex items-center gap-2">
          <Link href="/login" className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors" style={{ fontFamily: "var(--font-sans)" }}>Entrar</Link>
          <button type="button" onClick={openDemoModal} className="px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors shadow-sm" style={{ fontFamily: "var(--font-sans)" }}>Agendar demo</button>
        </div>
        <button className="md:hidden p-2 rounded-lg border border-slate-200" onClick={() => setOpen(!open)}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 4.5H16M2 9H16M2 13.5H16" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-slate-100 bg-white px-5 py-4 space-y-1">
          {links.map((l) => (
            <button key={l.label} onClick={() => { scrollToSection(l.target); setOpen(false); }} className="block w-full text-left px-3 py-2.5 rounded-lg text-sm text-slate-600 hover:bg-slate-50" style={{ fontFamily: "var(--font-sans)" }}>{l.label}</button>
          ))}
          <div className="pt-2 flex flex-col gap-2">
            <Link href="/login" className="block w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium text-center" style={{ fontFamily: "var(--font-sans)" }}>Entrar</Link>
            <button type="button" onClick={() => { openDemoModal(); setOpen(false); }} className="block w-full py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold" style={{ fontFamily: "var(--font-sans)" }}>Agendar demo</button>
          </div>
        </div>
      )}
    </header>
  );
}

// ─── HERO ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="max-w-screen-xl mx-auto px-5 md:px-10 pt-20 pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div>
          <div className="flex items-center gap-2 mb-5">
            <AIBadge label="Kyra IA" />
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 12 }} className="text-slate-400">inteligência integrada à operação</span>
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.08 }} className="text-slate-900 text-5xl md:text-6xl mb-6">
            Você vende.
            <br />
            <span className="text-teal-600">A gente cuida
            <br />do resto.</span>
          </h1>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 18, lineHeight: 1.65 }} className="text-slate-500 mb-4 max-w-md">
            Um sistema inteligente que entende sua operação, encontra problemas antes de você e ajuda a resolvê-los.
          </p>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 14 }} className="text-slate-400 mb-8 max-w-md">
            Você administra o negócio. O sistema administra a operação.
          </p>
          <div className="flex flex-wrap gap-3">
            <Btn size="lg" variant="primary" onClick={openDemoModal}>Agendar demonstração</Btn>
            <Btn size="lg" variant="outline" onClick={openDemoModal}>Quero conhecer</Btn>
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-8">
            {["Sem cartão de crédito", "Configuração em minutos", "Suporte incluído"].map((t) => (
              <div key={t} className="flex items-center gap-1.5">
                <Check />
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 12 }} className="text-slate-500">{t}</span>
              </div>
            ))}
          </div>
        </div>
        <div><HeroMockup /></div>
      </div>
    </section>
  );
}

// ─── PROBLEMA ─────────────────────────────────────────────────────────────────

function Problema() {
  const problems = [
    "Produto prestes a acabar — sem ninguém perceber",
    "Dinheiro parado em estoque sem venda há meses",
    "Produto sendo vendido abaixo da margem",
    "Compra atrasada por falta de acompanhamento",
    "Vendas caindo sem explicação visível",
    "Cadastro incompleto travando a operação",
    "Canais de venda fora de sincronização",
    "Tarefas repetitivas consumindo seu tempo",
  ];
  return (
    <Section id="produto" className="py-24 max-w-screen-xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        <div>
          <SectionLabel>O problema</SectionLabel>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 }} className="text-slate-900 mb-6">
            Seu negócio já gera todos esses sinais. Você só não deveria precisar encontrá-los sozinho.
          </h2>
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 mb-4">
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, lineHeight: 1.7 }} className="text-slate-600">
              "Hoje, alguém precisa <strong className="text-slate-900">entrar no sistema</strong>, abrir relatórios, procurar informações, cruzar dados e decidir o que fazer."
            </p>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-teal-50 border border-teal-200">
            <Sparkle size={18} />
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 500 }} className="text-teal-800">
              O Kyra Estoque faz essa análise por você.
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {problems.map((p, i) => (
            <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-100 bg-white hover:border-slate-200 transition-colors" style={{ boxShadow: "0 1px 2px rgba(15,23,42,.03)" }}>
              <div className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#94A3B8", fontWeight: 600 }}>
                {String(i + 1).padStart(2, "0")}
              </div>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 14 }} className="text-slate-600">{p}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── ANTES E DEPOIS ──────────────────────────────────────────────────────────

function AntesDepois() {
  const rows = [
    ["Conferir estoque manualmente",         "O sistema identifica"],
    ["Procurar relatórios",                  "O sistema explica"],
    ["Descobrir produtos parados",           "O sistema recomenda"],
    ["Perceber falta de estoque tarde",      "O sistema alerta"],
    ["Fazer compras no feeling",             "O sistema sugere compras"],
    ["Atualizar canais manualmente",         "O sistema sincroniza"],
    ["Acompanhar tarefas repetitivas",       "O sistema automatiza"],
  ];
  return (
    <Section className="py-24 rounded-3xl max-w-screen-xl mx-auto" style={{ background: "#F0FDF9" }}>
      <div className="max-w-4xl mx-auto">
        <SectionLabel>Antes e depois</SectionLabel>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15 }} className="text-slate-900 mb-3">
          Você administra o negócio.
          <span className="text-teal-600"> O sistema administra a operação.</span>
        </h2>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 15 }} className="text-slate-500 mb-10">
          Cada tarefa que o sistema assume é tempo que você recupera para o que realmente importa.
        </p>

        {/* Table */}
        <div className="rounded-2xl border border-slate-200 overflow-hidden" style={{ boxShadow: "0 4px 16px rgba(15,23,42,.06)" }}>
          {/* Header */}
          <div className="grid grid-cols-2 bg-slate-50 border-b border-slate-200">
            <div className="px-6 py-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-slate-400" />
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600 }} className="text-slate-500">ANTES</p>
            </div>
            <div className="px-6 py-3 flex items-center gap-2 border-l border-slate-200 bg-teal-50">
              <div className="w-2 h-2 rounded-full bg-teal-500" />
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600 }} className="text-teal-700">COM O KYRA ESTOQUE</p>
            </div>
          </div>
          {rows.map(([before, after], i) => (
            <div key={i} className="grid grid-cols-2 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
              <div className="px-6 py-3.5 flex items-start gap-2.5">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0 mt-0.5" aria-hidden>
                  <path d="M7 2V12M2 7H12" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" transform="rotate(45 7 7)" />
                </svg>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 13 }} className="text-slate-500">{before}</p>
              </div>
              <div className="px-6 py-3.5 flex items-start gap-2.5 border-l border-slate-100 bg-teal-50/30">
                <Check />
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500 }} className="text-teal-800">{after}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── DADO VS. INTELIGÊNCIA ────────────────────────────────────────────────────

function DadoVsInteligencia() {
  return (
    <Section id="recursos" className="py-24 rounded-3xl max-w-screen-xl mx-auto bg-slate-50">
      <div className="max-w-4xl mx-auto">
        <SectionLabel>Dado vs. inteligência</SectionLabel>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em" }} className="text-slate-900 mb-10">
          Informação que você pode usar.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tradicional */}
          <div className="rounded-2xl border border-slate-200 bg-white p-7">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6H10" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </div>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600 }} className="text-slate-400">Sistema tradicional</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 500 }} className="text-slate-600">"Vendas caíram 12%."</p>
            </div>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 12 }} className="text-slate-400 mt-3">Dado bruto. Sem contexto, explicação ou próximo passo.</p>
          </div>
          {/* Kyra */}
          <div className="rounded-2xl border border-teal-200 bg-white p-7">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center"><Sparkle size={11} /></div>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600 }} className="text-teal-700">Kyra Estoque</p>
            </div>
            <div className="space-y-2">
              {[
                { step: "DADO",       text: "Suas vendas caíram 12% nas últimas 4 semanas.",      bg: "bg-slate-50 border-slate-200 text-slate-700" },
                { step: "CONTEXTO",   text: "A queda veio principalmente da categoria Vestuário.", bg: "bg-teal-50 border-teal-200 text-teal-800" },
                { step: "EXPLICAÇÃO", text: "Camiseta Básica representa 43% da redução.",          bg: "bg-teal-50 border-teal-200 text-teal-800" },
                { step: "AÇÃO",       text: "Recomendo revisar preço ou criar uma promoção.",      bg: "bg-teal-100 border-teal-300 text-teal-900" },
              ].map(({ step, text, bg }) => (
                <div key={step} className={`p-3 rounded-xl border ${bg}`}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em" }} className="text-teal-500 font-bold uppercase">{step} </span>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: 13 }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─── GERENTE DIGITAL ─────────────────────────────────────────────────────────

function GerenteDigital() {
  return (
    <Section className="py-24 rounded-3xl max-w-screen-xl mx-auto bg-slate-50">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <SectionLabel>Gerente digital</SectionLabel>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 }} className="text-slate-900 mb-4">
            Imagine ter alguém olhando sua operação todos os dias.
          </h2>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 16, lineHeight: 1.65 }} className="text-slate-500 mb-6">
            O Kyra Estoque acompanha sua operação continuamente e chama sua atenção para aquilo que realmente importa.
          </p>
          <div className="space-y-3 mb-8">
            {[
              ["Riscos", "Produtos prestes a acabar, antes que seja tarde"],
              ["Oportunidades", "Padrões de venda que podem ser aproveitados"],
              ["Estoque parado", "Capital imobilizado que pode ser liberado"],
              ["Compras recomendadas", "O que comprar, quando e quanto"],
              ["Mudanças relevantes", "Variações fora do padrão histórico"],
            ].map(([title, desc]) => (
              <div key={title as string} className="flex items-start gap-3">
                <Check />
                <div>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600 }} className="text-slate-800">{title}</span>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: 14 }} className="text-slate-400"> — {desc}</span>
                </div>
              </div>
            ))}
          </div>
          <Btn size="lg" variant="primary">Ver recomendações</Btn>
        </div>

        {/* Interface mockup */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden" style={{ boxShadow: "0 12px 40px rgba(15,23,42,.08)" }}>
          <div className="border-b border-slate-100 px-5 py-3.5 flex items-center gap-2">
            <Sparkle size={14} />
            <p style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700 }} className="text-slate-900">Bom dia. Analisei sua operação.</p>
          </div>
          <div className="p-5 space-y-3">
            {[
              {
                dot: "bg-red-500", level: "Urgente",
                bg: "bg-red-50 border-red-200",
                chip: "bg-red-100 text-red-700 border-red-200",
                text: "3 produtos podem ficar sem estoque nos próximos 7 dias.",
                action: "Criar pedido", abtn: "bg-red-500 hover:bg-red-600",
              },
              {
                dot: "bg-amber-400", level: "Atenção",
                bg: "bg-amber-50 border-amber-200",
                chip: "bg-amber-100 text-amber-700 border-amber-200",
                text: "R$ 8.430 estão parados em produtos sem venda há mais de 60 dias.",
                action: "Ver produtos", abtn: "bg-amber-500 hover:bg-amber-600",
              },
              {
                dot: "bg-teal-500", level: "Oportunidade",
                bg: "bg-teal-50 border-teal-200",
                chip: "bg-teal-100 text-teal-700 border-teal-200",
                text: "5 oportunidades encontradas. Tênis Runner Pro vende 32% mais aos finais de semana.",
                action: "Ver análise", abtn: "bg-teal-600 hover:bg-teal-700",
              },
            ].map((item) => (
              <div key={item.level} className={`flex items-start gap-3 p-4 rounded-xl border ${item.bg}`}>
                <div className={`w-2 h-2 rounded-full ${item.dot} flex-shrink-0 mt-1.5`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${item.chip}`} style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.06em" }}>{item.level}</span>
                  </div>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.5 }} className="text-slate-700 mb-2">{item.text}</p>
                  <button className={`${item.abtn} text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors`} style={{ fontFamily: "var(--font-sans)" }}>{item.action}</button>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 px-5 py-3 bg-slate-50">
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 12 }} className="text-slate-400 text-center">Análise atualizada automaticamente · agora</p>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─── SISTEMA QUE APRENDE ──────────────────────────────────────────────────────

function SistemaAprende() {
  const nodes = [
    { label: "Vendas",   desc: "Padrões de venda" },
    { label: "Estoque",  desc: "Giro e comportamento" },
    { label: "Compras",  desc: "Necessidade futura" },
    { label: "Produtos", desc: "Desempenho" },
    { label: "Clientes", desc: "Comportamento" },
  ];
  return (
    <Section className="py-24 rounded-3xl max-w-screen-xl mx-auto bg-slate-900">
      <div className="max-w-3xl mx-auto text-center">
        <SectionLabel light>Sistema que aprende</SectionLabel>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 }} className="text-white mb-4">
          Quanto mais sua empresa vende, mais o sistema entende seu negócio.
        </h2>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, lineHeight: 1.7 }} className="text-slate-400 mb-12">
          O sistema não apenas registra o que aconteceu. Ele identifica padrões da sua operação e transforma sinais em ações.
        </p>

        {/* Flow diagram */}
        <div className="flex flex-wrap justify-center items-center gap-2 mb-8">
          {nodes.map((n, i) => (
            <span key={n.label} className="flex items-center gap-2">
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600 }} className="text-white mb-0.5">{n.label}</p>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 11 }} className="text-slate-500">{n.desc}</p>
              </div>
              {i < nodes.length - 1 && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                  <path d="M4 8H12M12 8L9 5M12 8L9 11" stroke="#475569" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              )}
            </span>
          ))}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
            <path d="M4 8H12M12 8L9 5M12 8L9 11" stroke="#475569" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          {/* Kyra IA */}
          <div className="rounded-xl border border-teal-500/40 bg-teal-900/40 px-5 py-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-0.5">
              <Sparkle size={12} color="#2DD4BF" />
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.06em" }} className="text-teal-400 font-semibold">Kyra IA</p>
            </div>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 11 }} className="text-teal-300">Recomendações melhores</p>
          </div>
        </div>

        <div className="inline-flex flex-col items-start gap-2 p-5 rounded-2xl bg-white/5 border border-white/10 text-left max-w-md">
          {[
            "Entende sua sazonalidade",
            "Aprende com o comportamento dos produtos",
            "Melhora as sugestões com o tempo",
            "Nunca usa dados de outros clientes",
          ].map((t) => (
            <div key={t} className="flex items-center gap-2">
              <Check color="white" />
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 13 }} className="text-white/80">{t}</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── IA COPILOT ───────────────────────────────────────────────────────────────

function IACopilot() {
  const [input, setInput] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const suggestions = [
    "Quais produtos estão com estoque baixo?",
    "Quanto vendi este mês?",
    "Quais produtos estão parados?",
    "O que preciso comprar?",
    "Quais produtos estão dando prejuízo?",
    "Crie um pedido de compra.",
  ];
  return (
    <Section className="py-24 max-w-screen-xl mx-auto">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <SectionLabel>IA Copilot</SectionLabel>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 42, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1 }} className="text-slate-900 mb-3">
            Você pergunta.<br /><span className="text-teal-600">A Kyra entende.</span><br />O sistema faz.
          </h2>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 15 }} className="text-slate-500">
            A Kyra faz parte da operação — não é um chatbot separado.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6" style={{ boxShadow: "0 8px 32px rgba(15,23,42,.07)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Sparkle size={15} />
            <p style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }} className="text-slate-900">O que você precisa?</p>
          </div>
          <div className="relative mb-4">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre vendas, estoque, produtos ou compras..."
              className="w-full rounded-xl border border-slate-200 pl-4 pr-20 py-3 text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all"
              style={{ fontFamily: "var(--font-sans)" }}
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors" style={{ fontFamily: "var(--font-sans)" }}>Enviar</button>
          </div>
          <div className="flex flex-wrap gap-2 mb-5">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => { setInput(s); setActive(s); }}
                className={`px-3 py-1.5 rounded-full border text-xs transition-all ${active === s ? "bg-teal-600 border-teal-600 text-white" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-700"}`}
                style={{ fontFamily: "var(--font-sans)" }}
              >
                {s}
              </button>
            ))}
          </div>
          {active && (
            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center flex-shrink-0 mt-0.5"><Sparkle size={12} /></div>
                <div>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500 }} className="text-slate-900 mb-1">
                    Encontrei <span className="text-teal-700 font-semibold">3 produtos</span> com risco de ruptura nos próximos 7 dias.
                  </p>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: 13 }} className="text-slate-500 mb-3">
                    Camiseta Básica, Tênis Runner Pro e Calça Slim precisam de reposição.
                  </p>
                  <div className="flex gap-2">
                    <button className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition-colors" style={{ fontFamily: "var(--font-sans)" }}>Ver produtos</button>
                    <button className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors" style={{ fontFamily: "var(--font-sans)" }}>Preparar pedido</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

// ─── CADASTRO POR IMAGEM ──────────────────────────────────────────────────────

function CadastroPorImagem() {
  const [open, setOpen] = useState(false);
  const fields = [
    { label: "Nome do produto", value: "Camiseta Básica", confidence: 98 },
    { label: "Categoria", value: "Vestuário", confidence: 96 },
    { label: "Marca", value: "Marca X", confidence: 72 },
    { label: "NCM", value: "6109.10.00", confidence: 58 },
  ];
  const barColor = (c: number) => c >= 85 ? "bg-teal-500" : c >= 70 ? "bg-amber-400" : "bg-red-400";
  const statusColor = (c: number) => c >= 85 ? "text-teal-700" : c >= 70 ? "text-amber-600" : "text-red-600";
  const statusLabel = (c: number) => c >= 85 ? "Alta confiança" : c >= 70 ? "Moderada" : "Revisão recomendada";

  return (
    <Section className="py-24 rounded-3xl max-w-screen-xl mx-auto" style={{ background: "#F0FDF9" }}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Mockup */}
        <div className="order-2 lg:order-1">
          <div className="rounded-2xl border border-slate-200 bg-white p-6" style={{ boxShadow: "0 8px 32px rgba(15,23,42,.07)" }}>
            <div className="aspect-video rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center mb-5">
              <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mb-2 shadow-sm">
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden><rect x="2" y="6" width="22" height="16" rx="3" stroke="#CBD5E1" strokeWidth="1.5" /><circle cx="9" cy="12" r="2.5" stroke="#CBD5E1" strokeWidth="1.5" /><path d="M2 19L8.5 13.5L12 16.5L16 12L24 19" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 12 }} className="text-slate-400">Foto do produto</p>
            </div>
            <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-teal-50 border border-teal-100">
              <Sparkle size={12} />
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 500 }} className="text-teal-700">Produto identificado pela Kyra IA</p>
            </div>
            <div className="space-y-3 mb-5">
              {fields.map((f) => (
                <div key={f.label}>
                  <div className="flex items-center justify-between mb-1">
                    <p style={{ fontFamily: "var(--font-sans)", fontSize: 11 }} className="text-slate-400">{f.label}</p>
                    <div className="flex items-center gap-1.5">
                      <div className="w-14 h-1 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full rounded-full ${barColor(f.confidence)}`} style={{ width: `${f.confidence}%` }} />
                      </div>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10 }} className="text-slate-500 w-7">{f.confidence}%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500 }} className="text-slate-800">{f.value}</p>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 500 }} className={statusColor(f.confidence)}>{statusLabel(f.confidence)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button className="flex-1 py-2 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors" style={{ fontFamily: "var(--font-sans)" }}>Confirmar e salvar</button>
              <button className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors" style={{ fontFamily: "var(--font-sans)" }}>Editar</button>
            </div>
          </div>
        </div>
        {/* Text */}
        <div className="order-1 lg:order-2">
          <SectionLabel>Cadastro inteligente</SectionLabel>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 }} className="text-slate-900 mb-4">
            Do produto à venda em poucos segundos.
          </h2>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 16, lineHeight: 1.65 }} className="text-slate-500 mb-6">
            Tire uma foto. A Kyra IA identifica o produto, preenche os campos e apresenta para você revisar.
          </p>
          <div className="flex flex-col gap-3 mb-8">
            {["Foto", "IA identifica", "IA preenche", "Você confirma", "Produto criado"].map((step, i) => (
              <div key={step} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center flex-shrink-0 font-bold" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#0D9488" }}>{i + 1}</div>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500 }} className="text-slate-700">{step}</p>
                {i < 4 && <div className="flex-1 border-t border-dashed border-slate-200" />}
              </div>
            ))}
          </div>
          <div className="p-4 rounded-xl bg-teal-50 border border-teal-200">
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500 }} className="text-teal-800">
              "A Kyra ajuda a preencher. <strong>Você confirma o que importa.</strong>"
            </p>
          </div>
          <button onClick={() => setOpen(!open)} className="mt-4 text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1 font-medium" style={{ fontFamily: "var(--font-sans)" }}>
            Como funciona a confiança?
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className={`transition-transform ${open ? "rotate-180" : ""}`}><path d="M3 5L6.5 8.5L10 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
          </button>
          {open && (
            <div className="mt-2 p-4 rounded-xl border border-slate-200 bg-slate-50">
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 13 }} className="text-slate-600 leading-relaxed">
                Campos com confiança ≥ 85% são identificados com alta certeza. Entre 70–84%, moderada — vale uma revisão. Abaixo de 70%, o sistema indica explicitamente para revisar antes de salvar.
              </p>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

// ─── ESTOQUE INTELIGENTE ─────────────────────────────────────────────────────

function EstoqueInteligente() {
  const [open, setOpen] = useState(false);
  return (
    <Section className="py-24 rounded-3xl max-w-screen-xl mx-auto bg-slate-50">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <SectionLabel>Estoque inteligente</SectionLabel>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 }} className="text-slate-900 mb-4">
            Seu estoque deixa de ser um número. Passa a ser uma operação que o sistema entende.
          </h2>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 16, lineHeight: 1.65 }} className="text-slate-500 mb-6">
            Cobertura de estoque, risco de ruptura e momento ideal de reposição — calculados automaticamente.
          </p>
          <div className="p-4 rounded-xl border border-teal-200 bg-teal-50 mb-6">
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500 }} className="text-teal-800">
              A Kyra recomenda. Você decide. O sistema executa.
            </p>
          </div>
          <Btn size="lg" variant="primary" onClick={openDemoModal}>Ver demonstração</Btn>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6" style={{ boxShadow: "0 8px 32px rgba(15,23,42,.07)" }}>
          <div className="flex items-center justify-between mb-5">
            <p style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }} className="text-slate-900">Camiseta Básica</p>
            <span className="px-2 py-1 rounded-lg bg-red-50 border border-red-200 text-red-600 font-semibold" style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>Risco de ruptura</span>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              { label: "Estoque atual", value: "29 un.", highlight: false },
              { label: "Venda média", value: "4,8 un./dia", highlight: false },
              { label: "Cobertura", value: "6 dias", highlight: true },
              { label: "Lead time", value: "7 dias", highlight: false },
            ].map((s) => (
              <div key={s.label} className={`p-3 rounded-xl border ${s.highlight ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-100"}`}>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 10 }} className="text-slate-400 mb-0.5">{s.label}</p>
                <p style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700 }} className={s.highlight ? "text-red-600" : "text-slate-900"}>{s.value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkle size={11} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em" }} className="text-teal-600 font-semibold uppercase">Kyra IA</span>
            </div>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.6 }} className="text-slate-700 mb-2">
              Recomendo comprar <strong>30 unidades</strong> — estoque cobre ~6 dias e o fornecedor leva 7 dias.
            </p>
            <button onClick={() => setOpen(!open)} className="text-teal-600 text-xs font-medium hover:text-teal-700 flex items-center gap-1" style={{ fontFamily: "var(--font-sans)" }}>
              Como calculamos?
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`transition-transform ${open ? "rotate-180" : ""}`}><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
            </button>
            {open && (
              <div className="mt-2 p-3 rounded-lg bg-white border border-teal-100">
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 11 }} className="text-slate-500 leading-relaxed">29 ÷ 4,8 ≈ 6 dias de cobertura<br />Lead time: 7 dias → reposição atrasada</p>
              </div>
            )}
            <button className="mt-3 px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition-colors block" style={{ fontFamily: "var(--font-sans)" }}>Criar pedido</button>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─── COMPRAS INTELIGENTES ─────────────────────────────────────────────────────

function ComprasInteligentes() {
  const rows = [
    { product: "Camiseta Básica", stock: 29, coverage: "6 dias", lead: "7 dias", suggestion: "Comprar 30", risk: true },
    { product: "Tênis Runner Pro", stock: 18, coverage: "11 dias", lead: "5 dias", suggestion: "Acompanhar", risk: false },
    { product: "Calça Slim", stock: 8, coverage: "4 dias", lead: "6 dias", suggestion: "Comprar 20", risk: true },
  ];
  return (
    <Section className="py-24 max-w-screen-xl mx-auto">
      <div className="max-w-3xl mx-auto">
        <SectionLabel>Compras inteligentes</SectionLabel>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em" }} className="text-slate-900 mb-3">Pare de comprar no feeling.</h2>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 16, lineHeight: 1.65 }} className="text-slate-500 mb-8">
          O sistema cruza vendas, estoque, histórico e prazo dos fornecedores para ajudar você a decidir o que, quando e quanto comprar.
        </p>
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden mb-6" style={{ boxShadow: "0 4px 16px rgba(15,23,42,.06)" }}>
          <div className="grid grid-cols-5 px-5 py-3 bg-slate-50 border-b border-slate-200">
            {["Produto", "Estoque", "Cobertura", "Lead time", "Sugestão"].map((h) => (
              <p key={h} style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em" }} className="text-slate-400 uppercase font-semibold">{h}</p>
            ))}
          </div>
          {rows.map((r) => (
            <div key={r.product} className="grid grid-cols-5 px-5 py-3.5 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors items-center">
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500 }} className="text-slate-800">{r.product}</p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 13 }} className="text-slate-700">{r.stock}</p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 13 }} className={r.risk ? "text-red-600 font-medium" : "text-slate-600"}>{r.coverage}</p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 13 }} className="text-slate-600">{r.lead}</p>
              <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-lg ${r.risk ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600"}`} style={{ fontFamily: "var(--font-sans)" }}>{r.suggestion}</span>
            </div>
          ))}
        </div>
        <Btn size="md" variant="primary">Ver sugestões de compra</Btn>
      </div>
    </Section>
  );
}

// ─── ESTOQUE PARADO ───────────────────────────────────────────────────────────

function EstoqueParado() {
  return (
    <Section className="py-24 rounded-3xl max-w-screen-xl mx-auto bg-slate-50">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <SectionLabel>Estoque parado</SectionLabel>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 }} className="text-slate-900 mb-4">
            Estoque parado também custa dinheiro.
          </h2>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 16, lineHeight: 1.65 }} className="text-slate-500 mb-8">
            Saber o que não está vendendo é tão importante quanto saber o que pode acabar.
          </p>
          <Btn size="md" variant="primary">Ver produtos parados</Btn>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-7">
          <div className="text-center mb-5">
            <p style={{ fontFamily: "var(--font-display)", fontSize: 48, fontWeight: 800, letterSpacing: "-0.03em" }} className="text-amber-600">R$ 8.430</p>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 14 }} className="text-slate-500">sem venda há mais de 60 dias</p>
          </div>
          <div className="rounded-xl border border-teal-200 bg-white p-4">
            <div className="flex items-center gap-2 mb-2"><Sparkle size={12} /><span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em" }} className="text-teal-600 font-semibold uppercase">Kyra IA</span></div>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 13 }} className="text-slate-700 mb-3">
              Identifiquei <strong>12 produtos</strong> sem vendas relevantes há mais de 60 dias. Considere criar uma promoção para liberar capital.
            </p>
            <button className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition-colors" style={{ fontFamily: "var(--font-sans)" }}>Ver produtos parados</button>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─── CANAIS ───────────────────────────────────────────────────────────────────

function Canais() {
  const channels = [{ name: "Loja Online", icon: "🛒" }, { name: "Instagram", icon: "📸" }, { name: "Facebook", icon: "📘" }, { name: "Mercado Livre", icon: "🛍" }, { name: "WhatsApp", icon: "💬" }];
  return (
    <Section id="integracoes" className="py-24 rounded-3xl max-w-screen-xl mx-auto bg-slate-900">
      <div className="max-w-3xl mx-auto text-center">
        <SectionLabel light>Canais de venda</SectionLabel>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 }} className="text-white mb-4">
          Venda em mais lugares sem multiplicar seu trabalho.
        </h2>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 15 }} className="text-slate-400 mb-10">
          Você vende em vários lugares. O sistema cuida da operação por trás.
        </p>
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {channels.map((c) => (
            <div key={c.name} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
              <span className="text-lg">{c.icon}</span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500 }} className="text-white">{c.name}</span>
            </div>
          ))}
        </div>
        <div className="inline-flex flex-col items-start gap-2 p-5 rounded-2xl bg-white/5 border border-white/10">
          {["Produtos sincronizados", "Estoque sincronizado", "Preços sincronizados", "Pedidos centralizados"].map((f) => (
            <div key={f} className="flex items-center gap-2"><Check color="white" /><span style={{ fontFamily: "var(--font-sans)", fontSize: 13 }} className="text-white/80">{f}</span></div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── AUTOMAÇÕES ───────────────────────────────────────────────────────────────

function Automacoes() {
  const automations = [
    "Alertar quando estoque estiver baixo",
    "Avisar produto sem venda há 30 dias",
    "Enviar relatório semanal de vendas",
    "Sugerir compras no momento certo",
    "Avisar quando uma compra atrasar",
    "Enviar pedido por WhatsApp",
    "Gerar descrição de produto automaticamente",
    "Atualizar catálogos nos canais",
  ];
  return (
    <Section className="py-24 max-w-screen-xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <SectionLabel>Automações</SectionLabel>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 }} className="text-slate-900 mb-4">
            O que pode acontecer sozinho, não deveria depender de você.
          </h2>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 16, lineHeight: 1.65 }} className="text-slate-500 mb-6">Configure uma vez. O sistema executa sempre que necessário.</p>
          <div className="flex items-center gap-2 flex-wrap">
            {[["Evento", "bg-slate-100 text-slate-700"], ["IA / Regra", "bg-teal-50 text-teal-800 border border-teal-200"], ["Ação automática", "bg-teal-600 text-white"]].map(([label, cls], i, arr) => (
              <span key={label as string} className="flex items-center gap-2">
                <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${cls}`} style={{ fontFamily: "var(--font-sans)" }}>{label}</span>
                {i < arr.length - 1 && <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7H11M11 7L8 4M11 7L8 10" stroke="#CBD5E1" strokeWidth="1.4" strokeLinecap="round" /></svg>}
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {automations.map((a) => (
            <div key={a} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:border-teal-200 hover:bg-teal-50/30 transition-all" style={{ boxShadow: "0 1px 2px rgba(15,23,42,.03)" }}>
              <Check />
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 13 }} className="text-slate-700">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── BENEFÍCIOS ───────────────────────────────────────────────────────────────

function Beneficios() {
  const cards = [
    {
      title: "Menos trabalho manual",
      desc: "Automatize tarefas que consomem seu dia.",
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M4 10h12M10 4v12" stroke="#0D9488" strokeWidth="1.5" strokeLinecap="round" transform="rotate(45 10 10)" opacity=".4"/><rect x="3" y="7" width="14" height="6" rx="2" stroke="#0D9488" strokeWidth="1.5"/></svg>
      ),
    },
    {
      title: "Menos ruptura",
      desc: "Saiba antes quando um produto está prestes a acabar.",
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M10 3L17 16H3L10 3Z" stroke="#0D9488" strokeWidth="1.5" fill="none"/><path d="M10 9V12" stroke="#0D9488" strokeWidth="1.5" strokeLinecap="round"/><circle cx="10" cy="14" r=".8" fill="#0D9488"/></svg>
      ),
    },
    {
      title: "Menos dinheiro parado",
      desc: "Identifique estoque sem giro e transforme-o em oportunidade.",
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden><circle cx="10" cy="10" r="7" stroke="#0D9488" strokeWidth="1.5"/><path d="M10 6v2.5L12.5 11" stroke="#0D9488" strokeWidth="1.5" strokeLinecap="round"/></svg>
      ),
    },
    {
      title: "Decisões melhores",
      desc: "Entenda não apenas o que aconteceu, mas o que fazer.",
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M3 13.5L7 9.5L10 12L14 7L17 9.5" stroke="#0D9488" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      ),
    },
  ];
  return (
    <Section className="py-24 rounded-3xl max-w-screen-xl mx-auto bg-slate-50">
      <div className="text-center mb-12">
        <SectionLabel>Resultado</SectionLabel>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 42, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1 }} className="text-slate-900">
          Menos operação.<br />Mais negócio.
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-4xl mx-auto">
        {cards.map((c) => (
          <div key={c.title} className="p-6 rounded-2xl border border-slate-200 bg-white hover:border-teal-200 hover:shadow-md transition-all" style={{ boxShadow: "0 1px 3px rgba(15,23,42,.04)" }}>
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center mb-4">{c.icon}</div>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700 }} className="text-slate-900 mb-2">{c.title}</p>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.55 }} className="text-slate-500">{c.desc}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─── FILOSOFIA ────────────────────────────────────────────────────────────────

function Filosofia() {
  return (
    <Section className="py-24 max-w-screen-xl mx-auto">
      <div className="max-w-2xl mx-auto text-center">
        <SectionLabel>Filosofia</SectionLabel>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 42, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1 }} className="text-slate-900 mb-4">
          Você não precisa aprender o sistema inteiro.
        </h2>
        <p style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500 }} className="text-teal-600 mb-10">
          Você precisa administrar o seu negócio.
        </p>
        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800">
          <p style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, lineHeight: 1.4 }} className="text-white mb-2">
            "Não queremos mostrar mais dados.
          </p>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, lineHeight: 1.4 }} className="text-teal-400">
            Queremos mostrar o que importa."
          </p>
        </div>
      </div>
    </Section>
  );
}

// ─── PLANOS ───────────────────────────────────────────────────────────────────

const FAQS = [
  { q: "Posso testar antes de pagar?", a: "Sim. Oferecemos 14 dias grátis no Kyra Impulsiona, sem cartão de crédito." },
  { q: "Clientes e fornecedores têm limite?", a: "Não. Clientes e fornecedores são ilimitados nos três planos." },
  { q: "Quantos usuários posso cadastrar?", a: "Usuários são ilimitados nos três planos." },
  { q: "O cadastro de produto por imagem está disponível em todos os planos?", a: "Sim. O Kyra Organiza inclui 50 cadastros por imagem por mês. No Kyra Impulsiona e no Kyra Escala, o uso é ilimitado." },
  { q: "A Kyra IA está incluída?", a: "Sim. A inteligência da Kyra faz parte do produto em todos os planos, com diferentes níveis de capacidade." },
  { q: "O Kyra possui recursos fiscais?", a: "Os recursos fiscais e de emissão serão disponibilizados conforme a evolução do produto. A importação de XML/NF-e é uma capacidade separada da emissão fiscal completa." },
  { q: "O plano anual tem desconto?", a: "Sim. O plano anual tem aproximadamente 20% de desconto em relação ao mensal." },
  { q: "Posso cancelar?", a: "Sim. O cancelamento impede a renovação e o acesso permanece disponível até o fim do período pago." },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-4 py-4 text-left"
      >
        <span style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500 }} className="text-slate-800">{q}</span>
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 13 }} className="text-slate-500 pb-4 leading-relaxed">{a}</p>
      )}
    </div>
  );
}

function Planos() {
  const [annual, setAnnual] = useState(false);

  const plans = [
    {
      name: "Kyra Organiza",
      tagline: "Coloque a operação em ordem.",
      priceMonthly: "R$ 66,90",
      priceAnnual: "R$ 53,52",
      period: "/mês",
      highlight: false,
      cta: "Começar agora",
      features: [
        "Até 1.000 produtos",
        "Clientes ilimitados",
        "Fornecedores ilimitados",
        "Usuários ilimitados",
        "Estoque e inventário",
        "Vendas e PDV",
        "Compras",
        "Dashboard",
        "Kyra e recomendações básicas",
        "50 cadastros por imagem/mês",
        "2 automações",
        "1 canal de venda",
      ],
      notIncluded: [],
    },
    {
      name: "Kyra Impulsiona",
      tagline: "Entenda e decida melhor.",
      priceMonthly: "R$ 129,90",
      priceAnnual: "R$ 103,92",
      period: "/mês",
      highlight: true,
      badge: "Mais popular",
      cta: "Começar grátis",
      features: [
        "Tudo do Kyra Organiza",
        "Até 5.000 produtos",
        "Cadastro por imagem ilimitado",
        "IA e recomendações avançadas",
        "Até 10 automações",
        "Até 3 canais de venda",
        "Importação de XML / NF-e",
        "PDV avançado",
        "Compras inteligentes",
        "WhatsApp operacional",
        "Recursos avançados de IA",
        "Integrações ampliadas",
      ],
      notIncluded: [],
    },
    {
      name: "Kyra Escala",
      tagline: "Automatize e cresça.",
      priceMonthly: "R$ 249,90",
      priceAnnual: "R$ 199,92",
      period: "/mês",
      highlight: false,
      cta: "Começar agora",
      features: [
        "Tudo do Kyra Impulsiona",
        "Produtos ilimitados",
        "Automações ilimitadas",
        "Até 10 canais de venda",
        "Histórico ilimitado",
        "BI e análises avançadas",
        "Multiestoque e transferências",
        "Suporte prioritário ampliado",
        "Recursos avançados de IA",
      ],
      notIncluded: [],
    },
  ];

  return (
    <Section id="planos" className="py-24 max-w-screen-xl mx-auto">
      <div className="text-center mb-10">
        <SectionLabel>Planos</SectionLabel>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 42, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1 }} className="text-slate-900 mb-4">
          Escolha o plano que<br />acompanha o seu negócio.
        </h2>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 16 }} className="text-slate-500 mb-6">
          Comece simples. Evolua conforme sua operação cresce.
        </p>

        {/* Billing toggle */}
        <div className="inline-flex items-center gap-3 bg-slate-100 rounded-xl p-1">
          <button
            type="button"
            onClick={() => setAnnual(false)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${!annual ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Mensal
          </button>
          <button
            type="button"
            onClick={() => setAnnual(true)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${annual ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Anual
            <span className="text-xs font-semibold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-md">−20%</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto items-start">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`relative rounded-2xl flex flex-col overflow-hidden ${
              plan.highlight
                ? "bg-teal-600 text-white ring-2 ring-teal-500 ring-offset-2 scale-[1.02]"
                : "bg-white border border-slate-200"
            }`}
            style={{ boxShadow: plan.highlight ? "0 20px 60px rgba(13,148,136,.30)" : "0 4px 16px rgba(15,23,42,.06)" }}
          >
            {/* Badge */}
            {plan.badge && (
              <div className="absolute top-4 right-4">
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em" }} className="px-2.5 py-1 rounded-full bg-white/20 text-white uppercase">
                  {plan.badge}
                </span>
              </div>
            )}

            {/* Header */}
            <div className={`px-7 pt-8 pb-6 ${plan.highlight ? "border-b border-white/15" : "border-b border-slate-100"}`}>
              <p style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700 }} className={plan.highlight ? "text-white mb-1" : "text-slate-900 mb-1"}>
                {plan.name}
              </p>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 13 }} className={plan.highlight ? "text-teal-100 mb-5" : "text-slate-400 mb-5"}>
                {plan.tagline}
              </p>
              <div className="flex items-end gap-1">
                <span style={{ fontFamily: "var(--font-display)", fontSize: 38, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }} className={plan.highlight ? "text-white" : "text-slate-900"}>
                  {annual ? plan.priceAnnual : plan.priceMonthly}
                </span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 13 }} className={plan.highlight ? "text-teal-200 mb-1" : "text-slate-400 mb-1"}>
                  {plan.period}
                </span>
              </div>
              {annual && (
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 11 }} className={plan.highlight ? "text-teal-200 mt-1" : "text-slate-400 mt-1"}>
                  cobrado anualmente
                </p>
              )}
            </div>

            {/* Features */}
            <div className="px-7 py-6 flex-1">
              <div className="space-y-3">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-start gap-2.5">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 mt-0.5" aria-hidden>
                      <circle cx="8" cy="8" r="7" fill={plan.highlight ? "rgba(255,255,255,0.15)" : "rgba(13,148,136,0.12)"} />
                      <path d="M5 8L7.2 10.2L11 6" stroke={plan.highlight ? "white" : "#0D9488"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: 13 }} className={plan.highlight ? "text-teal-50" : "text-slate-700"}>
                      {f}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="px-7 pb-8 pt-2">
              <button type="button" onClick={openDemoModal} className={`block w-full py-3 rounded-xl text-sm font-semibold transition-all text-center ${
                  plan.highlight
                    ? "bg-white text-teal-700 hover:bg-teal-50"
                    : "border border-teal-600 text-teal-700 hover:bg-teal-50"
                }`} style={{ fontFamily: "var(--font-sans)" }}>
                {plan.cta}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Note */}
      <p style={{ fontFamily: "var(--font-sans)", fontSize: 13 }} className="text-center text-slate-500 mt-8 max-w-xl mx-auto">
        Todos os planos incluem o essencial para vender, controlar estoque e acompanhar sua operação. Clientes, fornecedores e usuários são ilimitados nos três planos. Mude de plano quando quiser.
      </p>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto mt-14">
        <p style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }} className="text-slate-900 mb-6 text-center">
          Dúvidas frequentes
        </p>
        <div className="bg-white rounded-2xl border border-slate-100 px-6" style={{ boxShadow: "0 4px 16px rgba(15,23,42,.05)" }}>
          {FAQS.map((item) => (
            <FaqItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── PROVA SOCIAL ─────────────────────────────────────────────────────────────

function ProvasSocial() {
  const testimonials = [
    {
      quote: "Antes eu passava horas procurando o que estava errado na operação. Agora o sistema me mostra antes mesmo de eu perceber.",
      name: "Marina S.",
      role: "Gestora de operações · e-commerce de moda",
    },
    {
      quote: "Perdi estoque várias vezes por não perceber que um produto ia acabar. Desde que comecei a usar, isso não aconteceu mais.",
      name: "Rafael C.",
      role: "Dono · loja de artigos esportivos",
    },
    {
      quote: "O que mais gostei foi que o sistema não me dá apenas um número. Ele me explica o que está acontecendo e o que eu deveria fazer.",
      name: "Juliana M.",
      role: "Gerente comercial · distribuidora",
    },
  ];
  return (
    <Section id="empresa" className="py-24 rounded-3xl max-w-screen-xl mx-auto bg-slate-50">
      <div className="text-center mb-12">
        <SectionLabel>Quem usa</SectionLabel>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em" }} className="text-slate-900">
          O sistema que trabalha por você.
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
        {testimonials.map((t) => (
          <div key={t.name} className="rounded-2xl border border-slate-200 bg-white p-6" style={{ boxShadow: "0 1px 3px rgba(15,23,42,.04)" }}>
            <div className="flex gap-0.5 mb-4">
              {[...Array(5)].map((_, i) => (
                <svg key={i} width="14" height="14" viewBox="0 0 14 14" fill="#0D9488" aria-hidden><path d="M7 1L8.5 5.2H13L9.5 7.8L11 12L7 9.4L3 12L4.5 7.8L1 5.2H5.5L7 1Z" /></svg>
              ))}
            </div>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.65 }} className="text-slate-700 mb-4">"{t.quote}"</p>
            <div>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600 }} className="text-slate-900">{t.name}</p>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 12 }} className="text-slate-400">{t.role}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

const FAQ_DATA = [
  { q: "O Kyra Estoque é um ERP?", a: "Não. O Kyra Estoque é um sistema de gestão de operações com inteligência integrada — mais simples e direto que um ERP tradicional." },
  { q: "Preciso entender de gestão de estoque?", a: "Não. O sistema entende a operação por você e apresenta o que é importante no momento certo." },
  { q: "Posso conectar minha loja online?", a: "Sim. O Kyra Estoque integra com as principais plataformas de e-commerce e sincroniza produtos, estoque e pedidos." },
  { q: "Posso vender pelo Instagram?", a: "Sim. Você gerencia catálogos e pedidos do Instagram diretamente no Kyra Estoque." },
  { q: "A Kyra executa ações sozinha?", a: "Não. A Kyra recomenda e prepara ações, mas operações que alteram dados passam pela sua aprovação antes de serem executadas." },
  { q: "Posso aprovar as ações antes da execução?", a: "Sempre. O sistema nunca executa ações críticas sem a sua confirmação." },
  { q: "Posso começar com poucos produtos?", a: "Sim. O sistema funciona bem com qualquer volume — de pequenas operações a milhares de produtos." },
  { q: "Quais integrações estão disponíveis?", a: "Mercado Livre, Shopify, WooCommerce, Instagram, Facebook, WhatsApp e mais. Novas integrações são adicionadas regularmente." },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Section className="py-24 max-w-screen-xl mx-auto">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <SectionLabel>Perguntas frequentes</SectionLabel>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em" }} className="text-slate-900">Dúvidas comuns</h2>
        </div>
        <div className="space-y-2">
          {FAQ_DATA.map((item, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(15,23,42,.03)" }}>
              <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors" aria-expanded={open === i}>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500 }} className="text-slate-800 pr-4">{item.q}</p>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={`transition-transform flex-shrink-0 ${open === i ? "rotate-180" : ""}`}><path d="M4 6L8 10L12 6" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
              {open === i && (
                <div className="px-5 pb-4"><p style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.65 }} className="text-slate-500">{item.a}</p></div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── CTA FINAL ────────────────────────────────────────────────────────────────

function CTAFinal() {
  return (
    <Section className="py-24 max-w-screen-xl mx-auto">
      <div className="rounded-3xl bg-teal-600 p-12 md:p-16 text-center" style={{ boxShadow: "0 24px 64px rgba(13,148,136,.25)" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.12em" }} className="text-teal-200 uppercase font-semibold mb-4">Comece agora</p>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 42, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1 }} className="text-white mb-4">
          Quer ver o sistema trabalhando na sua operação?
        </h2>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 17, lineHeight: 1.65 }} className="text-teal-100 max-w-xl mx-auto mb-8">
          Conheça o Kyra Estoque e veja como transformar estoque, vendas e operação em uma rotina mais inteligente.
        </p>
        <p style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700 }} className="text-white/80 mb-8">
          Você vende. A gente cuida do resto.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <button type="button" onClick={openDemoModal} className="px-7 py-3.5 rounded-xl bg-white text-teal-700 font-semibold text-base hover:bg-teal-50 transition-colors shadow-sm" style={{ fontFamily: "var(--font-sans)" }}>Agendar demonstração</button>
          <button type="button" onClick={openDemoModal} className="px-7 py-3.5 rounded-xl bg-teal-700 text-white font-semibold text-base hover:bg-teal-800 transition-colors border border-teal-500" style={{ fontFamily: "var(--font-sans)" }}>Quero conhecer</button>
        </div>
      </div>
    </Section>
  );
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────

function Footer() {
  const cols = [
    { title: "Produto", links: ["Recursos", "Integrações", "Kyra IA", "Automação"] },
    { title: "Família Kyra", links: ["Kyra Estoque", "Kyra CS", "Kyra CRM"] },
    { title: "Empresa", links: ["Sobre", "Contato", "Blog"] },
  ];
  const legalLinks = [
    { label: "Termos de Uso", href: "/terms" },
    { label: "Privacidade", href: "/privacy" },
  ];
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="max-w-screen-xl mx-auto px-5 md:px-10 py-12">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mb-10">
          <div className="md:col-span-1">
            <KyraLogo size={14} />
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 13 }} className="text-slate-400 mt-3">Você vende. A gente cuida do resto.</p>
          </div>
          {cols.map((col) => (
            <div key={col.title}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em" }} className="text-slate-400 uppercase font-semibold mb-3">{col.title}</p>
              <ul className="space-y-1.5">
                {col.links.map((l) => (
                  <li key={l}><button className="text-sm text-slate-500 hover:text-slate-800 transition-colors" style={{ fontFamily: "var(--font-sans)" }}>{l}</button></li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em" }} className="text-slate-400 uppercase font-semibold mb-3">Legal</p>
            <ul className="space-y-1.5">
              {legalLinks.map((l) => (
                <li key={l.href}><Link href={l.href} className="text-sm text-slate-500 hover:text-teal-600 transition-colors" style={{ fontFamily: "var(--font-sans)" }}>{l.label}</Link></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-100 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 12 }} className="text-slate-400">© {new Date().getFullYear()} Kyra Estoque. Todos os direitos reservados.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-xs text-slate-400 hover:text-slate-600 transition-colors" style={{ fontFamily: "var(--font-sans)" }}>Política de Privacidade</Link>
            <Link href="/terms" className="text-xs text-slate-400 hover:text-slate-600 transition-colors" style={{ fontFamily: "var(--font-sans)" }}>Termos de Uso</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [demoOpen, setDemoOpen] = useState(false);

  useEffect(() => {
    _setDemoOpen = setDemoOpen;
    return () => { _setDemoOpen = null; };
  }, []);

  return (
    <>
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
      <div className="min-h-screen bg-white overflow-x-hidden">
      <Nav />
      <Hero />
      <div className="max-w-screen-xl mx-auto space-y-6 px-0">
        <Problema />
        <AntesDepois />
        <DadoVsInteligencia />
        <GerenteDigital />
        <SistemaAprende />
        <IACopilot />
        <CadastroPorImagem />
        <EstoqueInteligente />
        <ComprasInteligentes />
        <EstoqueParado />
        <Canais />
        <Automacoes />
        <Beneficios />
        <Filosofia />
        <Planos />
        <ProvasSocial />
        <FAQ />
        <CTAFinal />
      </div>
      <Footer />
    </div>
    </>
  );
}
