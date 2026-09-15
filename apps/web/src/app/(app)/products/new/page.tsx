'use client'

import { useRouter } from 'next/navigation'
import { ClipboardList, Star, ChevronLeft, ArrowRight } from 'lucide-react'

export default function ProductNewPage() {
  const router = useRouter()

  return (
    <div className="flex flex-col flex-1 items-center justify-center min-h-[70vh] px-6 py-12">
      {/* Back */}
      <div className="w-full max-w-lg mb-8">
        <button
          onClick={() => router.push('/products')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar para produtos
        </button>
      </div>

      {/* Title */}
      <div className="w-full max-w-lg mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Novo produto</h1>
        <p className="mt-1 text-muted-foreground text-sm">Como você quer cadastrar este produto?</p>
      </div>

      {/* Cards */}
      <div className="w-full max-w-lg flex flex-col gap-3">

        {/* Upload / IA — recomendado */}
        <button
          onClick={() => router.push('/products/new/upload')}
          className="flex items-center gap-4 rounded-xl border-2 border-primary bg-card p-5 text-left transition-all hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary">
            <Star className="h-5 w-5 text-white" fill="white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">Cadastrar com foto</span>
              <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                Recomendado
              </span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Tire ou envie uma foto e deixe o Kyra preparar o cadastro para você.
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>

        {/* Manual */}
        <button
          onClick={() => router.push('/products/new/manual')}
          className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/30 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-foreground">Cadastrar manualmente</span>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Preencha os dados do produto você mesmo.
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>

      </div>
    </div>
  )
}
