'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

/**
 * Tick data received from the MarketHub WebSocket.
 */
export interface TickData {
  symbol: string
  price: number
  price_eur?: number
  open_24h?: number
  high_24h?: number
  low_24h?: number
  volume_24h?: number
  quote_volume_24h?: number
  change_pct_24h?: number
  market_cap?: number
  prev_close?: number
  currency?: string
  source?: string
  ts: number
}

interface WSMessage {
  type: 'tick' | 'snapshot' | 'subscribed' | 'unsubscribed' | 'heartbeat' | 'pong' | 'error'
  channel?: string
  channels?: string[]
  data?: TickData
  message?: string
  ts?: number
}

interface UseMarketWebSocketReturn {
  /** Latest price data by channel (e.g. "crypto:BTC" → TickData) */
  prices: Map<string, TickData>
  /** Whether the WebSocket is currently connected */
  isConnected: boolean
  /** Subscribe to additional channels dynamically */
  subscribe: (channels: string[]) => void
  /** Unsubscribe from channels */
  unsubscribe: (channels: string[]) => void
}

const WS_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')
  .replace('http://', 'ws://')
  .replace('https://', 'wss://')
  + '/api/v1/ws/markets'

const SNAPSHOT_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')
  + '/api/v1/market/live/snapshot'

const MAX_RETRIES = 50
const BASE_BACKOFF = 1000  // 1 second
const MAX_BACKOFF = 30000  // 30 seconds
const FALLBACK_POLL_INTERVAL = 10000  // 10 seconds

/**
 * React hook for real-time market price updates via WebSocket.
 *
 * @param channels - Array of channels to subscribe to, e.g. ["crypto:BTC", "stock:AAPL"]
 * @param onTick - Optional callback fired on each new tick
 *
 * @example
 * ```tsx
 * const { prices, isConnected } = useMarketWebSocket(['crypto:BTC', 'crypto:ETH'])
 * const btcPrice = prices.get('crypto:BTC')?.price
 * ```
 */
export function useMarketWebSocket(
  channels: string[],
  onTick?: (channel: string, data: TickData) => void,
): UseMarketWebSocketReturn {
  const [prices, setPrices] = useState<Map<string, TickData>>(new Map())
  const [isConnected, setIsConnected] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const channelsRef = useRef<string[]>(channels)
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fallbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onTickRef = useRef(onTick)
  const mountedRef = useRef(true)

  // Keep refs in sync
  channelsRef.current = channels
  onTickRef.current = onTick

  const handleTick = useCallback((channel: string, data: TickData) => {
    if (!mountedRef.current) return
    setPrices(prev => {
      const next = new Map(prev)
      next.set(channel, data)
      return next
    })
    onTickRef.current?.(channel, data)
  }, [])

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return }
        setIsConnected(true)
        retryCountRef.current = 0

        // Stop fallback polling
        if (fallbackTimerRef.current) {
          clearInterval(fallbackTimerRef.current)
          fallbackTimerRef.current = null
        }

        // Subscribe to channels
        if (channelsRef.current.length > 0) {
          ws.send(JSON.stringify({
            action: 'subscribe',
            channels: channelsRef.current,
          }))
        }
      }

      ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data)

          if (msg.type === 'tick' && msg.channel && msg.data) {
            handleTick(msg.channel, msg.data)
          } else if (msg.type === 'snapshot' && msg.channel && msg.data) {
            handleTick(msg.channel, msg.data)
          } else if (msg.type === 'heartbeat') {
            // Respond with pong
            ws.send(JSON.stringify({ action: 'ping', ts: msg.ts }))
          }
        } catch {
          // Ignore parse errors
        }
      }

      ws.onclose = () => {
        if (!mountedRef.current) return
        setIsConnected(false)
        wsRef.current = null
        scheduleReconnect()
      }

      ws.onerror = () => {
        // onclose will fire after onerror
      }
    } catch {
      scheduleReconnect()
    }
  }, [handleTick])

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return
    if (retryCountRef.current >= MAX_RETRIES) {
      // Fallback to REST polling
      startFallbackPolling()
      return
    }

    const backoff = Math.min(
      BASE_BACKOFF * Math.pow(2, retryCountRef.current),
      MAX_BACKOFF,
    )
    // Add jitter ±20%
    const jitter = backoff * 0.2 * (2 * Math.random() - 1)
    const delay = backoff + jitter

    retryCountRef.current += 1
    retryTimerRef.current = setTimeout(() => {
      connect()
    }, delay)
  }, [connect])

  const startFallbackPolling = useCallback(() => {
    if (fallbackTimerRef.current) return

    const poll = async () => {
      if (!mountedRef.current || channelsRef.current.length === 0) return
      try {
        const symbolsParam = channelsRef.current.join(',')
        const resp = await fetch(`${SNAPSHOT_URL}?symbols=${encodeURIComponent(symbolsParam)}`)
        if (resp.ok) {
          const json = await resp.json()
          const data = json.data || {}
          for (const [channel, tickData] of Object.entries(data)) {
            handleTick(channel, tickData as TickData)
          }
        }
      } catch {
        // Silently fail
      }
    }

    poll() // Immediate first call
    fallbackTimerRef.current = setInterval(poll, FALLBACK_POLL_INTERVAL)
  }, [handleTick])

  // Dynamic subscribe function
  const subscribe = useCallback((newChannels: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'subscribe',
        channels: newChannels,
      }))
    }
  }, [])

  // Dynamic unsubscribe function
  const unsubscribe = useCallback((removeChannels: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'unsubscribe',
        channels: removeChannels,
      }))
    }
  }, [])

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    mountedRef.current = true
    connect()

    return () => {
      mountedRef.current = false
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      if (fallbackTimerRef.current) clearInterval(fallbackTimerRef.current)
      if (wsRef.current) {
        wsRef.current.onclose = null // Prevent reconnect on intentional close
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-subscribe when channels change
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && channels.length > 0) {
      wsRef.current.send(JSON.stringify({
        action: 'subscribe',
        channels,
      }))
    }
  }, [channels.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  return { prices, isConnected, subscribe, unsubscribe }
}
