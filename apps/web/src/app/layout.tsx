import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'

import { Providers } from '@/providers/providers'
import { SWRegister, OfflineIndicator } from '@/components/pwa'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'OmniFlow — Votre patrimoine unifié',
  description:
    'Agrégez banques, crypto, bourse, immobilier et dettes en une seule app.',
  icons: { icon: '/favicon.png', apple: '/icons/icon-192.svg' },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'OmniFlow',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" suppressHydrationWarning className={inter.variable}>
      <body className="min-h-screen font-sans">
        <SWRegister />
        <OfflineIndicator />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
