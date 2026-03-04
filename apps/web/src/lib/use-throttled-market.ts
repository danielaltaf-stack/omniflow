'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useMarketWebSocket, type TickData } from './useMarketWebSocket'

/**
 * OmniFlow F1.6 — RAF-Batched Market Data Hook
 *
 * Wraps useMarketWebSocket but batches all tick updates into a single
 * React state update per animation frame (requestAnimationFrame).
 *
 * Problem solved: raw WS can fire 50+ ticks/s → 50 setState calls/s → jank.
 * This hook guarantees at most 1 setState per frame (60/s).
 *
 * Drop-in replacement for useMarketWebSocket with identical API.
 */
export function useThrottledMarket(
  channels: string[],
  onTick?: (channel: string, data: TickData) => void,
) {
  // Buffered ticks accumulate between frames
  const tickBufferRef = useRef<Map<string, TickData>>(new Map())
  const rafIdRef = useRef<number | null>(null)
  const mountedRef = useRef(true)
  const onTickRef = useRef(onTick)
  onTickRef.current = onTick

  // The actual state consumers see — updated once per frame
  const [throttledPrices, setThrottledPrices] = useState<Map<string, TickData>>(new Map())

  // Metrics for perf monitoring (exposed for dev overlay)
  const metricsRef = useRef({ ticksPerSecond: 0, flushesPerSecond: 0, _tickCount: 0, _flushCount: 0, _lastReset: Date.now() })

  // Flush: merge buffer into React state, only called via RAF
  const flush = useCallback(() => {
    rafIdRef.current = null
    if (!mountedRef.current) return

    const buffer = tickBufferRef.current
    if (buffer.size === 0) return

    // Copy buffer and clear
    const batch = new Map(buffer)
    buffer.clear()

    metricsRef.current._flushCount++

    setThrottledPrices(prev => {
      const next = new Map(prev)
      batch.forEach((data, channel) => {
        next.set(channel, data)
      })
      return next
    })
  }, [])

  // Schedule a flush on the next animation frame (if not already scheduled)
  const scheduleFlush = useCallback(() => {
    if (rafIdRef.current === null && mountedRef.current) {
      rafIdRef.current = requestAnimationFrame(flush)
    }
  }, [flush])

  // Tick handler: buffer the tick, schedule flush
  const handleTick = useCallback((channel: string, data: TickData) => {
    tickBufferRef.current.set(channel, data)
    metricsRef.current._tickCount++
    onTickRef.current?.(channel, data)
    scheduleFlush()
  }, [scheduleFlush])

  // Use the raw WS hook — all ticks go through handleTick
  const { isConnected, subscribe, unsubscribe } = useMarketWebSocket(channels, handleTick)

  // Metrics reset interval (every second)
  useEffect(() => {
    const id = setInterval(() => {
      const m = metricsRef.current
      m.ticksPerSecond = m._tickCount
      m.flushesPerSecond = m._flushCount
      m._tickCount = 0
      m._flushCount = 0
      m._lastReset = Date.now()
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // Cleanup RAF on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [])

  return {
    prices: throttledPrices,
    isConnected,
    subscribe,
    unsubscribe,
    /** Performance metrics (dev only) */
    metrics: metricsRef,
  }
}
