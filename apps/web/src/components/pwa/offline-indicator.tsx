'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff, Wifi } from 'lucide-react'

/**
 * Offline Indicator — shows a top-of-screen banner when network is lost.
 * Transitions smoothly and auto-hides 3s after reconnection.
 */
export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true)
  const [showReconnected, setShowReconnected] = useState(false)
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    setIsOnline(navigator.onLine)

    const handleOnline = () => {
      setIsOnline(true)
      if (wasOffline) {
        setShowReconnected(true)
        setTimeout(() => setShowReconnected(false), 3000)
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
      setWasOffline(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [wasOffline])

  const showBanner = !isOnline || showReconnected

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          className="fixed top-0 left-0 right-0 z-[60]"
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          <div
            className={`flex items-center justify-center gap-2 py-2 px-4 text-xs font-medium text-white transition-colors ${
              isOnline
                ? 'bg-emerald-600/95 backdrop-blur-sm'
                : 'bg-red-600/95 backdrop-blur-sm'
            }`}
          >
            {isOnline ? (
              <>
                <Wifi size={14} />
                <span>Connexion rétablie</span>
              </>
            ) : (
              <>
                <WifiOff size={14} className="animate-pulse" />
                <span>Mode hors ligne — certaines fonctionnalités peuvent être limitées</span>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
