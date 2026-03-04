'use client'

import { useEffect, useRef } from 'react'

/**
 * Service Worker Registration — handles SW lifecycle:
 * - Registers /sw.js on mount
 * - Skips waiting on update available
 * - Reloads page when new SW activates (controllerchange)
 * - Periodic update checks every 60 minutes
 */
export function SWRegister() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        })

        registrationRef.current = registration

        // Listen for update found
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            // New SW activated, reload to use new assets
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // Ask user or auto-update
              newWorker.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })

        // Periodic update check (every 60 min)
        const interval = setInterval(
          () => {
            registration.update().catch(() => {})
          },
          60 * 60 * 1000,
        )

        return () => clearInterval(interval)
      } catch (err) {
        console.error('[SW] Registration failed:', err)
      }
    }

    // Reload on new SW activation
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true
        window.location.reload()
      }
    })

    register()
  }, [])

  // This component renders nothing — purely side-effect
  return null
}
