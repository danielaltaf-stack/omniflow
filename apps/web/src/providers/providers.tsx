'use client'

import { useEffect } from 'react'
import { ThemeProvider } from 'next-themes'
import { ToastProvider } from '@/components/ui/toast'
import { PWAInstallPrompt } from '@/components/pwa'
import { initWebVitalsReporter } from '@/lib/web-vitals-reporter'
import { initSentry } from '@/lib/sentry.client.config'

export function Providers({ children }: { children: React.ReactNode }) {
  // Initialize monitoring once on mount
  useEffect(() => {
    initWebVitalsReporter()
    initSentry()
  }, [])

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange={false}
    >
      <ToastProvider>
        {children}
        <PWAInstallPrompt />
      </ToastProvider>
    </ThemeProvider>
  )
}
