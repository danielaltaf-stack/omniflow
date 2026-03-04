'use client'

/**
 * OmniFlow — Crypto Trading Terminal (F1.3)
 * Full-featured crypto terminal: TradingView chart, orderbook, trades feed,
 * top movers + treemap, fear & greed gauge.
 * Reuses TradingChart from F1.2 with crypto OHLCV endpoint.
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, TrendingUp, TrendingDown, ArrowLeft, Loader2,
  Activity, BarChart3,
} from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { useThrottledMarket } from '@/lib/use-throttled-market'
import { type TickData } from '@/lib/useMarketWebSocket'
import TradingChart from './trading-chart'
import CryptoOrderbook from './crypto-orderbook'
import CryptoTradesFeed from './crypto-trades-feed'
import CryptoTopMovers from './crypto-top-movers'
import CryptoFearGreed from './crypto-fear-greed'

interface SearchResult {
  id: string
  symbol: string
  name: string
}

function fmtPrice(v: number | null, big = false): string {
  if (v == null) return '—'
  if (big || v >= 1000) return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (v >= 1) return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 8 })}`
}

function fmtPct(v: number | null): string {
  if (v == null) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`
}

export default function CryptoTradingTerminal({
  initialSymbol,
  onClose,
}: {
  initialSymbol?: string
  onClose?: () => void
}) {
  const [selectedSymbol, setSelectedSymbol] = useState(initialSymbol || 'BTC')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const [showRightPanel, setShowRightPanel] = useState(true)

  // Live price via WS
  const wsChannel = useMemo(() => [`crypto:${selectedSymbol}`], [selectedSymbol])
  const { prices: livePrices, isConnected } = useThrottledMarket(wsChannel)
  const liveTick = wsChannel[0] ? livePrices.get(wsChannel[0]) : undefined

  const effectivePrice = liveTick?.price ?? null
  const effectiveChange = liveTick?.change_pct_24h ?? null
  const isUp = (effectiveChange ?? 0) >= 0

  // Override the OHLCV fetch URL for TradingChart → use crypto endpoint
  // We pass a custom symbol that TradingChart will use
  // But TradingChart fetches from /api/v1/market/stocks/ohlcv/ — we need to make it
  // use the crypto endpoint. Since TradingChart is generic, we'll pass a prop.
  // For now, the simplest approach: TradingChart already accepts `symbol` and
  // fetches from a URL. We'll need to either:
  // 1. Add a `dataUrl` prop to TradingChart, or
  // 2. Create a thin wrapper that provides data differently

  // Search
  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q)
    if (!q.trim()) { setSearchResults([]); return }
    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await apiClient.get<{ results: SearchResult[] }>(
          `/api/v1/market/crypto/search?q=${encodeURIComponent(q)}`
        )
        setSearchResults(res.results?.slice(0, 8) || [])
      } catch { setSearchResults([]) }
      finally { setIsSearching(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [])

  const selectFromSearch = (sym: string) => {
    setSelectedSymbol(sym.toUpperCase())
    setSearchQuery('')
    setSearchResults([])
    setSearchFocused(false)
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Top bar: Fear&Greed + Search + Price */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {onClose && (
            <button onClick={onClose} className="p-1 rounded hover:bg-surface-elevated text-foreground-tertiary">
              <ArrowLeft size={16} />
            </button>
          )}

          {/* Fear & Greed compact */}
          <CryptoFearGreed compact />

          {/* Search */}
          <div className="relative min-w-[180px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-tertiary" />
            <input
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              placeholder={`${selectedSymbol} — Rechercher…`}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-elevated/50 border border-border/50 rounded-omni-sm text-foreground placeholder:text-foreground-tertiary focus:border-brand focus:ring-1 focus:ring-brand outline-none"
            />
            {isSearching && <Loader2 size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-foreground-tertiary" />}

            {searchFocused && searchResults.length > 0 && (
              <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-surface border border-border rounded-omni-sm shadow-elevated max-h-[200px] overflow-y-auto">
                {searchResults.map((r) => (
                  <button
                    key={r.id || r.symbol}
                    onMouseDown={() => selectFromSearch(r.symbol)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-elevated transition-colors text-left"
                  >
                    <span className="font-medium text-foreground">{r.symbol.toUpperCase()}</span>
                    <span className="text-foreground-tertiary truncate flex-1">{r.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Symbol name */}
          <span className="text-sm font-semibold text-foreground hidden sm:inline">{selectedSymbol}/USDT</span>

          {/* WS indicator */}
          {isConnected && (
            <span className="flex items-center gap-1 text-[9px] text-gain">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gain opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-gain" />
              </span>
              LIVE
            </span>
          )}
        </div>

        {/* Price */}
        <div className="flex items-center gap-3 shrink-0">
          {effectivePrice != null && (
            <div className="text-right">
              <div className="text-lg font-bold text-foreground tabular-nums">
                {fmtPrice(effectivePrice)}
              </div>
              <div className={`flex items-center gap-1 text-xs font-medium tabular-nums ${isUp ? 'text-gain' : 'text-loss'}`}>
                {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {fmtPct(effectiveChange)}
              </div>
            </div>
          )}

          <button
            onClick={() => setShowRightPanel(!showRightPanel)}
            className={`p-1.5 rounded transition-colors ${showRightPanel ? 'bg-brand/10 text-brand' : 'text-foreground-tertiary hover:text-foreground-secondary'}`}
            title="Orderbook & Trades"
          >
            <BarChart3 size={16} />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Chart + Top Movers */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Chart */}
          <div className="flex-1 min-h-0">
            <CryptoChart symbol={selectedSymbol} />
          </div>

          {/* Top Movers panel (bottom, collapsible) */}
          <CryptoTopMovers onSelectSymbol={(sym) => setSelectedSymbol(sym)} />
        </div>

        {/* Right: Orderbook + Trades */}
        <AnimatePresence>
          {showRightPanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-l border-border/50 flex flex-col overflow-hidden shrink-0 hidden lg:flex"
            >
              {/* Orderbook (top half) */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <CryptoOrderbook symbol={selectedSymbol} />
              </div>

              {/* Trades feed (bottom half) */}
              <div className="h-[250px] border-t border-border/50 overflow-hidden">
                <CryptoTradesFeed symbol={selectedSymbol} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/**
 * CryptoChart — Thin wrapper that fetches OHLCV from the crypto endpoint
 * and renders a lightweight-charts candlestick chart.
 * Reuses the exact same TradingChart indicator engine (SMA, EMA, Bollinger, RSI, MACD).
 *
 * Since TradingChart fetches /api/v1/market/stocks/ohlcv/{symbol},
 * we need to override the data source. The simplest approach: pass `cryptoMode`
 * prop to TradingChart. But since TradingChart doesn't have that prop yet,
 * we use a separate mini-chart that uses the same library.
 *
 * For maximum reuse, we pass `ohlcvUrl` as a prop pattern.
 */
function CryptoChart({ symbol }: { symbol: string }) {
  // Use TradingChart with a crypto URL override
  return (
    <TradingChart
      symbol={symbol}
      symbolName={`${symbol}/USDT`}
      ohlcvUrlPrefix="/api/v1/market/crypto/ohlcv"
    />
  )
}
