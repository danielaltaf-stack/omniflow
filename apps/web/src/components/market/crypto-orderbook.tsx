'use client'

/**
 * OmniFlow — Crypto Orderbook (F1.3)
 * Real-time 20-level bid/ask depth visualization with imbalance indicator.
 * Polls Binance orderbook every 2s via backend proxy.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { apiClient } from '@/lib/api-client'

interface DepthData {
  symbol: string
  pair: string
  bids: [number, number][]
  asks: [number, number][]
  spread: number
  spread_pct: number
  imbalance: number
  last_update_id: number | null
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

export default function CryptoOrderbook({ symbol }: { symbol: string }) {
  const [depth, setDepth] = useState<DepthData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchDepth = useCallback(async () => {
    try {
      const data = await apiClient.get<DepthData>(
        `/api/v1/market/crypto/depth/${encodeURIComponent(symbol)}?limit=20`
      )
      setDepth(data)
      setIsLoading(false)
    } catch {
      // silent — keep old data
    }
  }, [symbol])

  useEffect(() => {
    setIsLoading(true)
    fetchDepth()
    intervalRef.current = setInterval(fetchDepth, 2000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchDepth])

  if (isLoading || !depth) {
    return (
      <div className="flex items-center justify-center h-full text-foreground-tertiary">
        <Loader2 size={16} className="animate-spin mr-2" />
        <span className="text-xs">Chargement orderbook…</span>
      </div>
    )
  }

  // Compute cumulative totals for depth bars
  const bidCum: number[] = []
  let cumB = 0
  for (const [, q] of depth.bids) { cumB += q; bidCum.push(cumB) }

  const askCum: number[] = []
  let cumA = 0
  for (const [, q] of depth.asks) { cumA += q; askCum.push(cumA) }

  const maxCum = Math.max(bidCum[bidCum.length - 1] ?? 1, askCum[askCum.length - 1] ?? 1)

  // Imbalance label
  const imbLabel = depth.imbalance > 1.5 ? '🟢 Acheteuse' : depth.imbalance < 0.66 ? '🔴 Vendeuse' : '⚪ Neutre'

  return (
    <div className="flex flex-col h-full text-[10px]">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/50">
        <span className="font-semibold text-foreground-tertiary uppercase tracking-wider">Orderbook</span>
        <span className="text-foreground-tertiary">
          Spread: <span className="text-foreground font-medium">{fmtPrice(depth.spread)}</span>
          <span className="ml-1 text-foreground-tertiary">({depth.spread_pct.toFixed(3)}%)</span>
        </span>
      </div>

      {/* Column headers */}
      <div className="flex px-2 py-0.5 text-foreground-tertiary border-b border-border/30">
        <span className="flex-1 text-left">Prix</span>
        <span className="flex-1 text-right">Quantité</span>
        <span className="flex-1 text-right">Total</span>
      </div>

      {/* Asks (reversed — lowest ask at bottom) */}
      <div className="flex-1 flex flex-col justify-end overflow-hidden">
        {[...depth.asks].reverse().map(([price, qty], i) => {
          const revIdx = depth.asks.length - 1 - i
          const cum = askCum[revIdx] ?? 0
          const pct = (cum / maxCum) * 100
          return (
            <div key={`a-${i}`} className="relative flex items-center px-2 py-px hover:bg-surface-elevated/50">
              <div
                className="absolute right-0 top-0 bottom-0 bg-loss/10 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
              <span className="flex-1 text-left text-loss font-medium relative z-10">{fmtPrice(price)}</span>
              <span className="flex-1 text-right text-foreground relative z-10">{fmtQty(qty)}</span>
              <span className="flex-1 text-right text-foreground-tertiary relative z-10">{fmtQty(cum)}</span>
            </div>
          )
        })}
      </div>

      {/* Mid price / Spread */}
      <div className="flex items-center justify-center px-2 py-1 bg-surface-elevated/50 border-y border-border/30">
        <span className="font-bold text-xs text-foreground tabular-nums">
          {depth.bids[0] ? fmtPrice((depth.bids[0][0]! + (depth.asks[0]?.[0] ?? depth.bids[0][0]!)) / 2) : '—'}
        </span>
      </div>

      {/* Bids */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {depth.bids.map(([price, qty], i) => {
          const cum = bidCum[i] ?? 0
          const pct = (cum / maxCum) * 100
          return (
            <div key={`b-${i}`} className="relative flex items-center px-2 py-px hover:bg-surface-elevated/50">
              <div
                className="absolute right-0 top-0 bottom-0 bg-gain/10 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
              <span className="flex-1 text-left text-gain font-medium relative z-10">{fmtPrice(price)}</span>
              <span className="flex-1 text-right text-foreground relative z-10">{fmtQty(qty)}</span>
              <span className="flex-1 text-right text-foreground-tertiary relative z-10">{fmtQty(cum)}</span>
            </div>
          )
        })}
      </div>

      {/* Imbalance footer */}
      <div className="flex items-center justify-between px-2 py-1.5 border-t border-border/50">
        <span className="text-foreground-tertiary">Pression :</span>
        <span className="font-medium">{imbLabel} ({depth.imbalance.toFixed(2)})</span>
      </div>
    </div>
  )
}
