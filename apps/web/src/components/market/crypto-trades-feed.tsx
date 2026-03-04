'use client'

/**
 * OmniFlow — Crypto Trades Feed / Time & Sales (F1.3)
 * Real-time scrolling trade feed from Binance aggTrades.
 * Polls every 2s with smart merge (no duplicates).
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { apiClient } from '@/lib/api-client'

interface Trade {
  id: number
  price: number
  qty: number
  time: number
  is_buyer_maker: boolean
}

interface TradesResponse {
  symbol: string
  pair: string
  trades: Trade[]
}

function fmtPrice(v: number): string {
  if (v >= 1000) return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (v >= 1) return v.toLocaleString('fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 6, maximumFractionDigits: 8 })
}

function fmtQty(v: number): string {
  if (v >= 1000) return v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
  if (v >= 1) return v.toLocaleString('fr-FR', { maximumFractionDigits: 4 })
  return v.toLocaleString('fr-FR', { maximumFractionDigits: 6 })
}

function fmtTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    + '.' + String(d.getMilliseconds()).padStart(3, '0').slice(0, 2)
}

export default function CryptoTradesFeed({ symbol }: { symbol: string }) {
  const [trades, setTrades] = useState<Trade[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [avgQty, setAvgQty] = useState(0)
  const seenIdsRef = useRef(new Set<number>())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchTrades = useCallback(async () => {
    try {
      const data = await apiClient.get<TradesResponse>(
        `/api/v1/market/crypto/trades/${encodeURIComponent(symbol)}?limit=50`
      )
      const incoming = data.trades || []

      // Merge: only add trades we haven't seen
      setTrades(prev => {
        const newTrades: Trade[] = []
        for (const t of incoming) {
          if (!seenIdsRef.current.has(t.id)) {
            seenIdsRef.current.add(t.id)
            newTrades.push(t)
          }
        }
        if (newTrades.length === 0) return prev
        const combined = [...newTrades, ...prev].slice(0, 100)
        // Update avg qty for big trade detection
        const avg = combined.reduce((s, t) => s + t.qty, 0) / combined.length
        setAvgQty(avg)
        return combined
      })
      setIsLoading(false)
    } catch {
      // silent
    }
  }, [symbol])

  useEffect(() => {
    setIsLoading(true)
    setTrades([])
    seenIdsRef.current.clear()
    fetchTrades()
    intervalRef.current = setInterval(fetchTrades, 2000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchTrades])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-foreground-tertiary">
        <Loader2 size={16} className="animate-spin mr-2" />
        <span className="text-xs">Chargement trades…</span>
      </div>
    )
  }

  const bigThreshold = avgQty * 3

  return (
    <div className="flex flex-col h-full text-[10px]">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/50">
        <span className="font-semibold text-foreground-tertiary uppercase tracking-wider">Trades</span>
        <span className="text-foreground-tertiary">{trades.length} derniers</span>
      </div>

      {/* Column headers */}
      <div className="flex px-2 py-0.5 text-foreground-tertiary border-b border-border/30">
        <span className="w-[70px]">Heure</span>
        <span className="flex-1 text-right">Prix</span>
        <span className="flex-1 text-right">Quantité</span>
        <span className="w-[36px] text-right">Side</span>
      </div>

      {/* Trades list */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {trades.map((t) => {
          const isBuy = !t.is_buyer_maker
          const isBig = t.qty > bigThreshold
          return (
            <div
              key={t.id}
              className={`flex items-center px-2 py-px transition-colors
                ${isBig ? 'bg-warning/10 font-semibold' : 'hover:bg-surface-elevated/30'}
              `}
            >
              <span className="w-[70px] text-foreground-tertiary tabular-nums">{fmtTime(t.time)}</span>
              <span className={`flex-1 text-right tabular-nums font-medium ${isBuy ? 'text-gain' : 'text-loss'}`}>
                {fmtPrice(t.price)}
              </span>
              <span className={`flex-1 text-right tabular-nums ${isBig ? 'text-warning' : 'text-foreground'}`}>
                {fmtQty(t.qty)}
              </span>
              <span className={`w-[36px] text-right font-medium ${isBuy ? 'text-gain' : 'text-loss'}`}>
                {isBuy ? 'BUY' : 'SELL'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
