'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, X, Bell, BellOff, Smartphone } from 'lucide-react'
import { usePushNotifications } from '@/lib/usePushNotifications'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'omniflow_pwa_dismissed'
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/**
 * PWA Install Prompt — Custom banner replacing the native browser prompt.
 * Features:
 * - Smart timing (3s delay after mount)
 * - Persistence of "not now" choice (7 days)
 * - Standalone detection (already installed → hidden)
 * - Push notification opt-in toggle
 * - Smooth Framer Motion animations
 */
export function PWAInstallPrompt() {
  const [showBanner, setShowBanner] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null)
  const {
    isSupported: pushSupported,
    permission: pushPermission,
    isSubscribed: pushSubscribed,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
    isLoading: pushLoading,
  } = usePushNotifications()

  // Check if already installed (standalone mode)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    setIsInstalled(isStandalone)
  }, [])

  // Listen for beforeinstallprompt
  useEffect(() => {
    if (typeof window === 'undefined' || isInstalled) return

    const handler = (e: Event) => {
      e.preventDefault()
      deferredPromptRef.current = e as BeforeInstallPromptEvent

      // Check if user dismissed recently
      const dismissedAt = localStorage.getItem(DISMISS_KEY)
      if (dismissedAt) {
        const elapsed = Date.now() - parseInt(dismissedAt, 10)
        if (elapsed < DISMISS_DURATION_MS) return
      }

      // Show banner after 3 seconds (let user discover the app first)
      setTimeout(() => setShowBanner(true), 3000)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // For browsers that already support install (app installed listener)
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
      setShowBanner(false)
      deferredPromptRef.current = null
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [isInstalled])

  // Also show push opt-in for already-installed users who haven't subscribed
  useEffect(() => {
    if (
      isInstalled &&
      pushSupported &&
      !pushSubscribed &&
      pushPermission === 'default'
    ) {
      const dismissedAt = localStorage.getItem(DISMISS_KEY)
      if (dismissedAt) {
        const elapsed = Date.now() - parseInt(dismissedAt, 10)
        if (elapsed < DISMISS_DURATION_MS) return
      }
      setTimeout(() => setShowBanner(true), 5000)
    }
  }, [isInstalled, pushSupported, pushSubscribed, pushPermission])

  const handleInstall = useCallback(async () => {
    const prompt = deferredPromptRef.current
    if (!prompt) return

    prompt.prompt()
    const choice = await prompt.userChoice

    if (choice.outcome === 'accepted') {
      setIsInstalled(true)
      setShowBanner(false)
    }
    deferredPromptRef.current = null
  }, [])

  const handleDismiss = useCallback(() => {
    setShowBanner(false)
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  }, [])

  const handleTogglePush = useCallback(async () => {
    if (pushSubscribed) {
      await unsubscribePush()
    } else {
      await subscribePush()
    }
  }, [pushSubscribed, subscribePush, unsubscribePush])

  // Don't render anything if nothing to show
  if (!showBanner && !isInstalled) return null
  if (isInstalled && pushSubscribed) return null

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-0"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <div className="max-w-lg mx-auto md:max-w-none md:mx-0">
            <div className="bg-surface/95 backdrop-blur-xl border border-border md:border-t md:border-x-0 md:border-b-0 rounded-2xl md:rounded-none shadow-2xl overflow-hidden">
              {/* Brand accent line */}
              <div className="h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-violet-500" />

              <div className="px-5 py-4">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <Smartphone size={22} className="text-white" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">
                      {deferredPromptRef.current
                        ? 'Installer OmniFlow'
                        : 'Notifications Push'}
                    </h3>
                    <p className="text-xs text-foreground-secondary mt-0.5 leading-relaxed">
                      {deferredPromptRef.current
                        ? 'Accès instantané, mode offline, notifications push'
                        : 'Restez informé : alertes prix, anomalies, rapports'}
                    </p>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 mt-3">
                      {/* Install button (only if not yet installed) */}
                      {deferredPromptRef.current && (
                        <button
                          onClick={handleInstall}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-semibold rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all shadow-md shadow-indigo-500/20 active:scale-95"
                        >
                          <Download size={13} />
                          Installer
                        </button>
                      )}

                      {/* Push toggle */}
                      {pushSupported && pushPermission !== 'denied' && (
                        <button
                          onClick={handleTogglePush}
                          disabled={pushLoading}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all active:scale-95 ${
                            pushSubscribed
                              ? 'bg-gain/10 text-gain border border-gain/20'
                              : 'bg-surface-elevated text-foreground-secondary border border-border hover:text-foreground'
                          }`}
                        >
                          {pushSubscribed ? (
                            <>
                              <Bell size={13} />
                              Push activé
                            </>
                          ) : (
                            <>
                              <BellOff size={13} />
                              Activer Push
                            </>
                          )}
                        </button>
                      )}

                      {/* Dismiss */}
                      <button
                        onClick={handleDismiss}
                        className="text-xs text-foreground-tertiary hover:text-foreground transition-colors px-2 py-1.5"
                      >
                        Plus tard
                      </button>
                    </div>
                  </div>

                  {/* Close */}
                  <button
                    onClick={handleDismiss}
                    className="flex-shrink-0 p-1 text-foreground-tertiary hover:text-foreground transition-colors rounded-md hover:bg-surface-elevated"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
