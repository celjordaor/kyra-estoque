import { Suspense } from 'react'
import { UpdatePasswordForm } from './update-password-form'

export const metadata = { title: 'Criar senha | Kyra Estoque' }

export default function UpdatePasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
            </svg>
          </span>
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Kyra Estoque</h1>
            <p className="text-sm text-muted-foreground">Você vende. A gente cuida do resto.</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-semibold text-foreground">Crie sua senha</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Defina uma senha para acessar sua conta sempre que quiser.
            </p>
          </div>
          <Suspense fallback={null}>
            <UpdatePasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
