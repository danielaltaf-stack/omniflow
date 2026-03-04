'use client'

/**
 * OmniFlow — Stock Trading Terminal (F1.2)
 * Full-featured trading terminal with TradingView chart, ticker tape,
 * screener, watchlist, and key stats panel.
 * Replaces the basic StockDetailDrawer with a professional multi-panel layout.
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, ArrowLeft, ExternalLink, TrendingUp, TrendingDown,
  BarChart3, Activity, Globe, ChevronDown, Search, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api-client'
import { useThrottledMarket } from '@/lib/use-throttled-market'
import { type TickData } from '@/lib/useMarketWebSocket'
import TradingChart from './trading-chart'
import TickerTape from './ticker-tape'
import StockScreener from './stock-screener'
import StockWatchlist from './stock-watchlist'

// ── Types ─────────────────────────────────────────────

interface StockQuote {
  symbol: string
  name: string
  type: string
  sector: string
  country: string
  isin: string
  price: number | null
  change: number | null
  change_pct: number | null
  previous_close: number | null
  open: number | null
  day_high: number | null
  day_low: number | null
  volume: number | null
  avg_volume: number | null
  market_cap: number | null
  pe_ratio: number | null
  eps: number | null
  dividend_yield: number | null
  fifty_two_week_high: number | null
  fifty_two_week_low: number | null
  fifty_day_avg: number | null
  two_hundred_day_avg: number | null
  currency: string
  exchange: string | null
  market_state: string | null
}

interface SearchResult {
  symbol: string
  name: string
  exchange: string
  type: string
}

// ── Helpers ───────────────────────────────────────────

function fmtPrice(v: number | null, currency = 'EUR'): string {
  if (v == null) return '—'
  return v.toLocaleString('fr-FR', { style: 'currency', currency, minimumFractionDigits: 2 })
}

function fmtBig(v: number | null): string {
  if (v == null) return '—'
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)} T`
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)} Md`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)} M`
  return v.toLocaleString('fr-FR')
}

function fmtPct(v: number | null): string {
  if (v == null) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`
}

const COUNTRY_FLAGS: Record<string, string> = {
  FR: '🇫🇷', US: '🇺🇸', DE: '🇩🇪', NL: '🇳🇱', IE: '🇮🇪', GB: '🇬🇧', IT: '🇮🇹',
}

// ── Component ─────────────────────────────────────────

export default function StockTradingTerminal({
  initialSymbol,
  onClose,
}: {
  initialSymbol?: string
  onClose?: () => void
}) {
  const [selectedSymbol, setSelectedSymbol] = useState(initialSymbol || 'AAPL')
  const [quote, setQuote] = useState<StockQuote | null>(null)
  const [isLoadingQuote, setIsLoadingQuote] = useState(false)
  const [showWatchlist, setShowWatchlist] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)

  // Live price from WS
  const wsChannel = useMemo(
    () => [selectedSymbol.startsWith('^') ? `index:${selectedSymbol}` : `stock:${selectedSymbol}`],
    [selectedSymbol]
  )
  const { prices: livePrices, isConnected } = useThrottledMarket(wsChannel)
  const liveTick = wsChannel[0] ? livePrices.get(wsChannel[0]) : undefined

  // Fetch detailed quote
  const fetchQuote = useCallback(async (sym: string) => {
    setIsLoadingQuote(true)
    try {
      const data = await apiClient.get<StockQuote>(`/api/v1/market/stocks/quote/${encodeURIComponent(sym)}`)
      setQuote(data)
    } catch {
      setQuote(null)
    } finally {
      setIsLoadingQuote(false)
    }
  }, [])

  useEffect(() => {
    fetchQuote(selectedSymbol)
  }, [selectedSymbol, fetchQuote])

  // Search handler
  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q)
    if (!q.trim()) { setSearchResults([]); return }
    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await apiClient.get<{ results: SearchResult[] }>(
          `/api/v1/market/stocks/search?q=${encodeURIComponent(q)}`
        )
        setSearchResults(res.results || [])
      } catch { setSearchResults([]) }
      finally { setIsSearching(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [])

  const selectFromSearch = (sym: string) => {
    setSelectedSymbol(sym)
    setSearchQuery('')
    setSearchResults([])
    setSearchFocused(false)
  }

  // Effective price (live or from quote)
  const effectivePrice = liveTick?.price ?? quote?.price
  const effectiveChange = liveTick?.change_pct_24h ?? quote?.change_pct
  const isUp = (effectiveChange ?? 0) >= 0

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Ticker Tape */}
      <TickerTape onSelectSymbol={(sym) => setSelectedSymbol(sym)} />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Chart + Screener (flex-1) */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Symbol bar */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
            <div className="flex items-center gap-3 min-w-0">
              {onClose && (
                <button onClick={onClose} className="p-1 rounded hover:bg-surface-elevated text-foreground-tertiary">
                  <ArrowLeft size={16} />
                </button>
              )}

              {/* Search input */}
              <div className="relative min-w-[200px]">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-tertiary" />
                <input
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                  placeholder={`${selectedSymbol} — Rechercher...`}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-elevated/50 border border-border/50 rounded-omni-sm text-foreground placeholder:text-foreground-tertiary focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                />
                {isSearching && <Loader2 size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-foreground-tertiary" />}

                {/* Search dropdown */}
                {searchFocused && searchResults.length > 0 && (
                  <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-surface border border-border rounded-omni-sm shadow-elevated max-h-[200px] overflow-y-auto">
                    {searchResults.map((r) => (
                      <button
                        key={r.symbol}
                        onMouseDown={() => selectFromSearch(r.symbol)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-elevated transition-colors text-left"
                      >
                        <span className="font-medium text-foreground">{r.symbol}</span>
                        <span className="text-foreground-tertiary truncate flex-1">{r.name}</span>
                        <span className="text-[9px] text-foreground-tertiary">{r.type}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Current symbol info */}
              {quote && (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-foreground-tertiary">{COUNTRY_FLAGS[quote.country] || ''}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-foreground truncate">{quote.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-border/50 text-foreground-tertiary">{quote.type}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-foreground-tertiary">
                      <span>{quote.exchange}</span>
                      {quote.isin && <span>· {quote.isin}</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Price display */}
            <div className="flex items-center gap-3 shrink-0">
              {effectivePrice != null && (
                <div className="text-right">
                  <div className="text-lg font-bold text-foreground tabular-nums">
                    {fmtPrice(effectivePrice, quote?.currency)}
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-medium tabular-nums ${isUp ? 'text-gain' : 'text-loss'}`}>
                    {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {fmtPct(effectiveChange ?? null)}
                    {quote?.change != null && (
                      <span className="text-foreground-tertiary ml-0.5">
                        ({quote.change > 0 ? '+' : ''}{quote.change.toFixed(2)})
                      </span>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={() => setShowWatchlist(!showWatchlist)}
                className={`p-1.5 rounded transition-colors ${showWatchlist ? 'bg-brand/10 text-brand' : 'text-foreground-tertiary hover:text-foreground-secondary'}`}
                title="Watchlist"
              >
                <BarChart3 size={16} />
              </button>
            </div>
          </div>

          {/* Chart */}
          <div className="flex-1 min-h-0">
            <TradingChart symbol={selectedSymbol} symbolName={quote?.name} />
          </div>

          {/* Screener (bottom panel) */}
          <StockScreener onSelectSymbol={(sym) => setSelectedSymbol(sym)} />
        </div>

        {/* Right: Stats + Watchlist panel */}
        <AnimatePresence>
          {showWatchlist && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-l border-border/50 flex flex-col overflow-hidden shrink-0 hidden lg:flex"
            >
              {/* Key stats */}
              {quote && (
                <div className="border-b border-border/50 px-3 py-2">
                  <h3 className="text-[10px] font-semibold text-foreground-tertiary uppercase tracking-wider mb-1.5">
                    Statistiques clés
                  </h3>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <StatRow label="Ouverture" value={fmtPrice(quote.open, quote.currency)} />
                    <StatRow label="Clôture préc." value={fmtPrice(quote.previous_close, quote.currency)} />
                    <StatRow label="+ Haut jour" value={fmtPrice(quote.day_high, quote.currency)} />
                    <StatRow label="+ Bas jour" value={fmtPrice(quote.day_low, quote.currency)} />
                    <StatRow label="52 sem. haut" value={fmtPrice(quote.fifty_two_week_high, quote.currency)} />
                    <StatRow label="52 sem. bas" value={fmtPrice(quote.fifty_two_week_low, quote.currency)} />
                    <StatRow label="Cap. boursière" value={fmtBig(quote.market_cap)} />
                    <StatRow label="Volume" value={fmtBig(quote.volume)} />
                    <StatRow label="Vol. moyen" value={fmtBig(quote.avg_volume)} />
                    <StatRow label="P/E" value={quote.pe_ratio != null ? quote.pe_ratio.toFixed(1) : '—'} />
                    <StatRow label="BPA" value={quote.eps != null ? quote.eps.toFixed(2) : '—'} />
                    <StatRow label="Div. yield" value={quote.dividend_yield != null ? `${(quote.dividend_yield * 100).toFixed(2)}%` : '—'} />
                    <StatRow label="SMA 50" value={fmtPrice(quote.fifty_day_avg, quote.currency)} />
                    <StatRow label="SMA 200" value={fmtPrice(quote.two_hundred_day_avg, quote.currency)} />
                    <StatRow label="Secteur" value={quote.sector} />
                    <StatRow
                      label="État marché"
                      value={quote.market_state === 'REGULAR' ? '🟢 Ouvert' : quote.market_state === 'PRE' ? '🟡 Pré-marché' : '🔴 Fermé'}
                    />
                  </div>
                </div>
              )}

              {/* Watchlist */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <StockWatchlist onSelectSymbol={(sym) => setSelectedSymbol(sym)} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-foreground-tertiary">{label}</span>
      <span className="text-[10px] font-medium text-foreground tabular-nums">{value}</span>
    </div>
  )
}
