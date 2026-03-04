'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'
import { RefreshCw } from 'lucide-react'

interface PullToRefreshProps {
  children: React.ReactNode
  onRefresh: () => Promise<void>
  /** Disable on desktop */
  disabled?: boolean
}

const THRESHOLD = 80
const MAX_PULL = 120

/**
 * Mobile pull-to-refresh with spring physics.
 * Swipe down from scroll-top to trigger refresh.
 */
export function PullToRefresh({
  children,
  onRefresh,
  disabled = false,
}: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pulling, setPulling] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const pullDistance = useSpring(0, { stiffness: 300, damping: 30 })
  const spinAngle = useTransform(pullDistance, [0, THRESHOLD], [0, 360])
  const indicatorOpacity = useTransform(pullDistance, [0, 30, THRESHOLD], [0, 0.5, 1])
  const indicatorScale = useTransform(pullDistance, [0, THRESHOLD], [0.5, 1])

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled || refreshing) return
      const el = containerRef.current
      if (!el || el.scrollTop > 5) return
      startY.current = e.touches[0]!.clientY
      setPulling(true)
    },
    [disabled, refreshing]
  )

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!pulling || disabled || refreshing) return
      const diff = Math.max(0, e.touches[0]!.clientY - startY.current)
      const dampened = Math.min(MAX_PULL, diff * 0.5)
      pullDistance.set(dampened)
    },
    [pulling, disabled, refreshing, pullDistance]
  )

  const handleTouchEnd = useCallback(async () => {
    if (!pulling) return
    setPulling(false)
    const current = pullDistance.get()
    if (current >= THRESHOLD && !refreshing) {
      setRefreshing(true)
      pullDistance.set(60)
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
        pullDistance.set(0)
      }
    } else {
      pullDistance.set(0)
    }
  }, [pulling, refreshing, onRefresh, pullDistance])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: true })
    el.addEventListener('touchend', handleTouchEnd)
    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  return (
    <div ref={containerRef} className="relative overflow-y-auto h-full">
      {/* Pull indicator */}
      <motion.div
        className="absolute top-0 left-0 right-0 flex items-center justify-center z-50 pointer-events-none"
        style={{
          height: pullDistance,
          opacity: indicatorOpacity,
        }}
      >
        <motion.div
          style={{ scale: indicatorScale, rotate: refreshing ? undefined : spinAngle }}
          animate={refreshing ? { rotate: 360 } : undefined}
          transition={refreshing ? { repeat: Infinity, duration: 0.8, ease: 'linear' } : undefined}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-surface border border-border shadow-sm"
        >
          <RefreshCw size={14} className="text-brand" />
        </motion.div>
      </motion.div>

      {/* Content pushed down by pull */}
      <motion.div style={{ y: pullDistance }}>{children}</motion.div>
    </div>
  )
}
