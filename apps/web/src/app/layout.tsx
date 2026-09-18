import type { Metadata } from 'next'
import { DM_Sans, Inter, JetBrains_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/toast'
import { CookieBanner } from '@/components/ui/cookie-banner'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    template: '%s | Kyra',
    default: 'Kyra — Gestão de Estoque',
  },
  description: 'Você vende. A gente cuida do resto.',
  icons: {
    icon: [
      { url: '/kyra-icon.png', type: 'image/png', sizes: '512x512' },
      { url: '/kyra-icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [
      { url: '/kyra-icon.png', type: 'image/png', sizes: '180x180' },
    ],
    shortcut: '/kyra-icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${dmSans.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        {children}
        <CookieBanner />
        <Toaster
          position="top-right"
          richColors
          toastOptions={{
            classNames: {
              toast: 'font-sans text-sm',
            },
          }}
        />
      </body>
    </html>
  )
}
