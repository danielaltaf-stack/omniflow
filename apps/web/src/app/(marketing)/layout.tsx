'use client'

import { SmoothScrollProvider, NoiseOverlay, ScrollProgress, Navbar, Footer } from '@/components/landing'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <SmoothScrollProvider>
      <NoiseOverlay />
      <ScrollProgress />
      <Navbar />
      <main className="min-h-screen bg-black pt-16 dark:bg-black">{children}</main>
      <Footer />
    </SmoothScrollProvider>
  )
}
