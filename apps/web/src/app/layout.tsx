import type { Metadata, Viewport } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'

import { Providers } from '@/providers/providers'
import { SWRegister, OfflineIndicator } from '@/components/pwa'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'OmniFlow — Votre patrimoine unifié, intelligent',
    template: '%s | OmniFlow',
  },
  description:
    'Agrégez banques, crypto, bourse, immobilier et dettes en une seule app propulsée par l\'IA. Budget intelligent, conseiller Nova, simulateur retraite.',
  keywords: [
    'patrimoine', 'gestion patrimoine', 'agrégation bancaire', 'crypto', 'bourse',
    'immobilier', 'budget', 'IA finance', 'fintech', 'OmniFlow',
  ],
  authors: [{ name: 'OmniFlow' }],
  creator: 'OmniFlow',
  icons: { icon: '/favicon.png', apple: '/icons/icon-192.svg' },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'OmniFlow',
  },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: 'OmniFlow',
    title: 'OmniFlow — Votre patrimoine unifié, intelligent',
    description:
      'Banque · Crypto · Bourse · Immobilier — une seule app, propulsée par l\'IA.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OmniFlow — Votre patrimoine unifié, intelligent',
    description:
      'Banque · Crypto · Bourse · Immobilier — une seule app, propulsée par l\'IA.',
  },
  robots: {
    index: true,
    follow: true,
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
    <html lang="fr" suppressHydrationWarning className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-screen font-sans">
        <SWRegister />
        <OfflineIndicator />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
