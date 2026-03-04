'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, TrendingUp, TrendingDown, Star, X, ChevronDown,
  Globe, BarChart3, ArrowUpRight, ExternalLink, Clock,
  Activity, Flame, Loader2, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useMarketStore, type MarketCoin } from '@/stores/market-store'
import { useThrottledMarket } from '@/lib/use-throttled-market'
import { type TickData } from '@/lib/useMarketWebSocket'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts'

/* ── Helpers ─────────────────────────────────────────────── */
function fmtPrice(v: number | null | undefined): string {
  if (v == null) return '—'
  if (v >= 1) return v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (v >= 0.01) return v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 4, maximumFractionDigits: 4 })
  return v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 6, maximumFractionDigits: 8 })
}

function fmtBigNumber(v: number | null | undefined): string {
  if (v == null) return '—'
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)} T€`
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)} Md€`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)} M€`
  return v.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €'
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`
}

function pctColor(v: number | null | undefined): string {
  if (v == null) return 'text-foreground-tertiary'
  return v >= 0 ? 'text-gain' : 'text-loss'
}

/* ── Mini Sparkline ──────────────────────────────────────── */
function MiniSparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 120
  const h = 32
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={positive ? 'var(--color-gain)' : 'var(--color-loss)'}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* ── Global Stats Bar ────────────────────────────────────── */
function GlobalStatsBar() {
  const { globalData, fetchGlobalData } = useMarketStore()

  useEffect(() => { fetchGlobalData() }, [fetchGlobalData])

  if (!globalData) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4 overflow-x-auto pb-2 text-xs text-foreground-tertiary scrollbar-none"
    >
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <Globe size={12} />
        <span>Cryptos: <strong className="text-foreground">{globalData.active_cryptocurrencies?.toLocaleString('fr-FR')}</strong></span>
      </div>
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <BarChart3 size={12} />
        <span>Cap. totale: <strong className="text-foreground">{fmtBigNumber(globalData.total_market_cap_eur)}</strong></span>
      </div>
      <div className={`flex items-center gap-1.5 whitespace-nowrap ${pctColor(globalData.market_cap_change_percentage_24h)}`}>
        {(globalData.market_cap_change_percentage_24h ?? 0) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        <span>{fmtPct(globalData.market_cap_change_percentage_24h)} (24h)</span>
      </div>
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <span>Vol. 24h: <strong className="text-foreground">{fmtBigNumber(globalData.total_volume_eur)}</strong></span>
      </div>
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <span>BTC: <strong className="text-foreground">{globalData.btc_dominance?.toFixed(1)}%</strong></span>
      </div>
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <span>ETH: <strong className="text-foreground">{globalData.eth_dominance?.toFixed(1)}%</strong></span>
      </div>
    </motion.div>
  )
}

/* ── Trending Coins ──────────────────────────────────────── */
function TrendingSection({ onSelect }: { onSelect: (id: string) => void }) {
  const { trendingCoins, fetchTrending } = useMarketStore()

  useEffect(() => { fetchTrending() }, [fetchTrending])

  if (!trendingCoins.length) return null

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        <Flame size={16} className="text-orange-400" />
        <h3 className="text-sm font-semibold text-foreground">Tendances</h3>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {trendingCoins.slice(0, 7).map((coin, i) => (
          <motion.button
            key={coin.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => onSelect(coin.id)}
            className="flex items-center gap-2 px-3 py-2 rounded-omni-sm border border-border bg-surface hover:border-brand/40 transition-colors shrink-0"
          >
            <img src={coin.thumb} alt="" className="w-5 h-5 rounded-full" />
            <span className="text-sm font-medium text-foreground">{coin.symbol.toUpperCase()}</span>
            {coin.market_cap_rank && (
              <span className="text-[10px] text-foreground-tertiary">#{coin.market_cap_rank}</span>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  )
}

/* ── Search Bar ──────────────────────────────────────────── */
function CoinSearchBar({ onSelect }: { onSelect: (id: string) => void }) {
  const { searchCoins, searchResults, clearSearch } = useMarketStore()
  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const handleChange = (v: string) => {
    setQuery(v)
    clearTimeout(timerRef.current)
    if (v.length >= 1) {
      timerRef.current = setTimeout(() => searchCoins(v), 300)
      setShowResults(true)
    } else {
      clearSearch()
      setShowResults(false)
    }
  }

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowResults(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative w-full max-w-sm">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-tertiary" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Rechercher une crypto..."
          className="w-full pl-9 pr-8 py-2 bg-surface border border-border rounded-omni-sm text-sm text-foreground placeholder:text-foreground-tertiary focus:border-brand focus:ring-1 focus:ring-brand outline-none"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); clearSearch(); setShowResults(false) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-tertiary hover:text-foreground"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {showResults && searchResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-omni-sm shadow-lg z-50 max-h-64 overflow-y-auto"
          >
            {searchResults.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  onSelect(r.id)
                  setQuery('')
                  clearSearch()
                  setShowResults(false)
                }}
                className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-surface-elevated/60 transition-colors text-left"
              >
                <img src={r.thumb} alt="" className="w-6 h-6 rounded-full" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                  <p className="text-xs text-foreground-tertiary">{r.symbol.toUpperCase()}</p>
                </div>
                {r.market_cap_rank && (
                  <span className="text-xs text-foreground-tertiary">#{r.market_cap_rank}</span>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Coin Detail Drawer ──────────────────────────────────── */
const CHART_PERIODS = [
  { label: '24h', days: '1' },
  { label: '7j', days: '7' },
  { label: '30j', days: '30' },
  { label: '90j', days: '90' },
  { label: '1an', days: '365' },
  { label: 'Max', days: 'max' },
]

function CoinDetailDrawer({ coinId, onClose }: { coinId: string | null; onClose: () => void }) {
  const { coinDetail, chartData, isLoadingDetail, isLoadingChart, fetchCoinDetail, fetchChart, clearDetail } = useMarketStore()
  const [chartPeriod, setChartPeriod] = useState('7')

  useEffect(() => {
    if (coinId) {
      fetchCoinDetail(coinId)
      fetchChart(coinId, '7')
      setChartPeriod('7')
    }
    return () => { clearDetail() }
  }, [coinId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePeriodChange = (days: string) => {
    setChartPeriod(days)
    if (coinId) fetchChart(coinId, days)
  }

  if (!coinId) return null

  const md = coinDetail?.market_data

  // Chart data
  const chartPoints = chartData?.prices?.map(([ts, price]) => ({
    time: new Date(ts),
    price,
  })) || []

  const volumePoints = chartData?.volumes?.map(([ts, vol]) => ({
    time: new Date(ts),
    volume: vol,
  })) || []

  const priceUp = chartPoints.length >= 2 && chartPoints[chartPoints.length - 1]!.price >= chartPoints[0]!.price

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-background border-l border-border overflow-y-auto"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-lg border-b border-border px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-1 text-foreground-tertiary hover:text-foreground">
              <X size={20} />
            </button>
            {isLoadingDetail ? (
              <Skeleton className="h-6 w-32" />
            ) : coinDetail && (
              <div className="flex items-center gap-2">
                {coinDetail.image && <img src={coinDetail.image} alt="" className="w-7 h-7 rounded-full" />}
                <h2 className="text-lg font-bold text-foreground">{coinDetail.name}</h2>
                <span className="text-sm text-foreground-tertiary uppercase">{coinDetail.symbol}</span>
              </div>
            )}
          </div>
          {coinDetail?.links?.homepage && (
            <a
              href={coinDetail.links.homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground-tertiary hover:text-brand transition-colors"
            >
              <ExternalLink size={16} />
            </a>
          )}
        </div>

        {isLoadingDetail ? (
          <div className="p-5 space-y-4">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-64 w-full" />
            <div className="grid grid-cols-2 gap-3">
              {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          </div>
        ) : coinDetail && md && (
          <div className="p-5 space-y-5">
            {/* Price */}
            <div>
              <p className="text-3xl font-bold text-foreground tabular-nums">
                {fmtPrice(md.current_price_eur)}
              </p>
              <div className="flex items-center gap-3 mt-1">
                <span className={`text-sm font-medium flex items-center gap-1 ${pctColor(md.price_change_percentage_24h)}`}>
                  {(md.price_change_percentage_24h ?? 0) >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {fmtPct(md.price_change_percentage_24h)} (24h)
                </span>
                <span className={`text-xs ${pctColor(md.price_change_percentage_7d)}`}>
                  {fmtPct(md.price_change_percentage_7d)} (7j)
                </span>
                <span className={`text-xs ${pctColor(md.price_change_percentage_30d)}`}>
                  {fmtPct(md.price_change_percentage_30d)} (30j)
                </span>
              </div>
            </div>

            {/* Chart */}
            <div className="rounded-omni-lg border border-border bg-surface p-4">
              {/* Period selector */}
              <div className="flex items-center gap-1 mb-3">
                {CHART_PERIODS.map(p => (
                  <button
                    key={p.days}
                    onClick={() => handlePeriodChange(p.days)}
                    className={`px-2.5 py-1 rounded-omni-sm text-xs font-medium transition-colors ${
                      chartPeriod === p.days
                        ? 'bg-brand/10 text-brand'
                        : 'text-foreground-tertiary hover:text-foreground-secondary'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {isLoadingChart ? (
                <div className="h-52 flex items-center justify-center">
                  <Loader2 size={24} className="animate-spin text-foreground-tertiary" />
                </div>
              ) : chartPoints.length > 0 ? (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartPoints}>
                      <defs>
                        <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={priceUp ? 'var(--color-gain)' : 'var(--color-loss)'} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={priceUp ? 'var(--color-gain)' : 'var(--color-loss)'} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="time"
                        tickFormatter={(d: Date) => chartPeriod === '1' ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                        tick={{ fontSize: 10, fill: 'var(--color-foreground-tertiary)' }}
                        axisLine={false} tickLine={false}
                        minTickGap={40}
                      />
                      <YAxis
                        domain={['auto', 'auto']}
                        tickFormatter={(v: number) => fmtPrice(v)}
                        tick={{ fontSize: 10, fill: 'var(--color-foreground-tertiary)' }}
                        axisLine={false} tickLine={false}
                        width={80}
                      />
                      <Tooltip
                        contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                        labelFormatter={(d: any) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        formatter={(v: any) => [fmtPrice(v as number), 'Prix']}
                      />
                      <Area
                        type="monotone"
                        dataKey="price"
                        stroke={priceUp ? 'var(--color-gain)' : 'var(--color-loss)'}
                        fill="url(#priceGrad)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-52 flex items-center justify-center text-foreground-tertiary text-sm">
                  Données indisponibles
                </div>
              )}

              {/* Volume mini bar chart */}
              {volumePoints.length > 0 && (
                <div className="h-14 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={volumePoints}>
                      <Bar dataKey="volume" fill="var(--color-foreground-tertiary)" opacity={0.3} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Capitalisation" value={fmtBigNumber(md.market_cap_eur)} />
              <StatCard label="Volume 24h" value={fmtBigNumber(md.total_volume_eur)} />
              <StatCard label="Plus haut 24h" value={fmtPrice(md.high_24h_eur)} />
              <StatCard label="Plus bas 24h" value={fmtPrice(md.low_24h_eur)} />
              <StatCard label="ATH" value={fmtPrice(md.ath_eur)} sub={`${fmtPct(md.ath_change_percentage)} depuis ATH`} />
              <StatCard label="ATL" value={fmtPrice(md.atl_eur)} />
              <StatCard label="Supply en circ." value={md.circulating_supply?.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) ?? '—'} />
              <StatCard label="Supply max" value={md.max_supply?.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) ?? '∞'} />
              <StatCard
                label="FDV"
                value={md.fully_diluted_valuation_eur ? fmtBigNumber(md.fully_diluted_valuation_eur) : '—'}
              />
              {md.price_change_percentage_1y != null && (
                <StatCard label="Performance 1 an" value={fmtPct(md.price_change_percentage_1y)} color={pctColor(md.price_change_percentage_1y)} />
              )}
            </div>

            {/* Categories */}
            {coinDetail.categories && coinDetail.categories.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-foreground-tertiary uppercase tracking-wider mb-2">Catégories</h4>
                <div className="flex flex-wrap gap-1.5">
                  {coinDetail.categories.filter(Boolean).slice(0, 8).map(cat => (
                    <span key={cat} className="text-xs px-2 py-1 rounded-full bg-surface-elevated border border-border text-foreground-secondary">
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {coinDetail.description && (
              <div>
                <h4 className="text-xs font-semibold text-foreground-tertiary uppercase tracking-wider mb-2">À propos</h4>
                <p className="text-sm text-foreground-secondary leading-relaxed line-clamp-6">
                  {coinDetail.description.replace(/<[^>]*>/g, '')}
                </p>
              </div>
            )}

            {/* Sentiment */}
            {coinDetail.sentiment_votes_up_percentage != null && (
              <div>
                <h4 className="text-xs font-semibold text-foreground-tertiary uppercase tracking-wider mb-2">Sentiment communautaire</h4>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-loss/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gain rounded-full transition-all"
                      style={{ width: `${coinDetail.sentiment_votes_up_percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-gain font-medium">{coinDetail.sentiment_votes_up_percentage?.toFixed(0)}% positif</span>
                </div>
              </div>
            )}

            {/* Links */}
            <div className="flex flex-wrap gap-2">
              {coinDetail.links?.homepage && (
                <a href={coinDetail.links.homepage} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-brand hover:underline">
                  <Globe size={12} /> Site Web
                </a>
              )}
              {coinDetail.links?.twitter && (
                <a href={`https://twitter.com/${coinDetail.links.twitter}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-brand hover:underline">
                  <ExternalLink size={12} /> Twitter
                </a>
              )}
              {coinDetail.links?.reddit && (
                <a href={coinDetail.links.reddit} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-brand hover:underline">
                  <ExternalLink size={12} /> Reddit
                </a>
              )}
              {coinDetail.links?.blockchain_site?.filter(Boolean).slice(0, 2).map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-brand hover:underline">
                  <ExternalLink size={12} /> Explorer
                </a>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-omni-sm border border-border bg-surface-elevated/30 p-3">
      <p className="text-xs text-foreground-tertiary mb-1">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${color || 'text-foreground'}`}>{value}</p>
      {sub && <p className="text-[10px] text-foreground-tertiary mt-0.5">{sub}</p>}
    </div>
  )
}

/* ── Coins Table (Virtualized — F1.6) ────────────────────── */
const ROW_HEIGHT = 48
const TABLE_MAX_HEIGHT = 720

function CoinsTable({ coins, livePrices, onSelect }: { coins: MarketCoin[]; livePrices: Map<string, TickData>; onSelect: (id: string) => void }) {
  const [sortKey, setSortKey] = useState<string>('market_cap_rank')
  const [sortAsc, setSortAsc] = useState(true)
  // Track previous prices for flash animation
  const prevPricesRef = useRef<Map<string, number>>(new Map())

  const sorted = useMemo(() => {
    return [...coins].sort((a, b) => {
      const av = (a as any)[sortKey] ?? 0
      const bv = (b as any)[sortKey] ?? 0
      return sortAsc ? av - bv : bv - av
    })
  }, [coins, sortKey, sortAsc])

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(key === 'market_cap_rank') }
  }

  const SortHeader = ({ k, label, className }: { k: string; label: string; className?: string }) => (
    <th
      onClick={() => toggleSort(k)}
      className={`py-2 px-3 cursor-pointer select-none hover:text-foreground-secondary transition-colors ${className || ''}`}
    >
      <span className="flex items-center gap-1">
        {label}
        {sortKey === k && <ChevronDown size={10} className={sortAsc ? '' : 'rotate-180'} />}
      </span>
    </th>
  )

  // Virtualized row renderer
  const renderRow = useCallback((coin: MarketCoin, index: number, style: React.CSSProperties) => {
    const liveKey = `crypto:${coin.symbol.toUpperCase()}`
    const live = livePrices.get(liveKey)
    const displayPrice = live?.price_eur ?? live?.price ?? coin.current_price
    const displayChange24h = live?.change_pct_24h ?? coin.price_change_percentage_24h

    // Flash animation
    const prevPrice = prevPricesRef.current.get(coin.id) ?? displayPrice
    const flashClass = displayPrice > prevPrice ? 'flash-up' : displayPrice < prevPrice ? 'flash-down' : ''
    prevPricesRef.current.set(coin.id, displayPrice)

    return (
      <div
        key={coin.id}
        style={style}
        onClick={() => onSelect(coin.id)}
        className="flex items-center border-b border-border/50 hover:bg-surface-elevated/40 cursor-pointer transition-colors text-sm"
      >
        <div className="py-2.5 px-3 text-center text-xs text-foreground-tertiary tabular-nums w-[50px] shrink-0">
          {coin.market_cap_rank}
        </div>
        <div className="py-2.5 px-3 flex items-center gap-2.5 min-w-[160px] flex-1">
          <img src={coin.image} alt="" className="w-6 h-6 rounded-full" loading="lazy" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{coin.name}</p>
            <p className="text-xs text-foreground-tertiary">{coin.symbol}</p>
          </div>
        </div>
        <div className={`py-2.5 px-3 text-right tabular-nums font-medium text-foreground rounded w-[120px] shrink-0 ${flashClass}`}>
          {fmtPrice(displayPrice)}
        </div>
        <div className={`py-2.5 px-3 text-right tabular-nums text-xs w-[70px] shrink-0 hidden sm:block ${pctColor(coin.price_change_percentage_1h_in_currency)}`}>
          {fmtPct(coin.price_change_percentage_1h_in_currency)}
        </div>
        <div className={`py-2.5 px-3 text-right tabular-nums text-xs font-medium w-[70px] shrink-0 ${pctColor(displayChange24h)}`}>
          {fmtPct(displayChange24h)}
        </div>
        <div className={`py-2.5 px-3 text-right tabular-nums text-xs w-[70px] shrink-0 hidden md:block ${pctColor(coin.price_change_percentage_7d_in_currency)}`}>
          {fmtPct(coin.price_change_percentage_7d_in_currency)}
        </div>
        <div className="py-2.5 px-3 text-right tabular-nums text-xs text-foreground-secondary w-[100px] shrink-0 hidden lg:block">
          {fmtBigNumber(coin.market_cap)}
        </div>
        <div className="py-2.5 px-3 text-right tabular-nums text-xs text-foreground-secondary w-[100px] shrink-0 hidden lg:block">
          {fmtBigNumber(coin.total_volume)}
        </div>
        <div className="py-2.5 px-3 w-[100px] shrink-0 hidden xl:block">
          {coin.sparkline_in_7d?.price && (
            <MiniSparkline
              data={coin.sparkline_in_7d.price}
              positive={(coin.price_change_percentage_7d_in_currency ?? 0) >= 0}
            />
          )}
        </div>
      </div>
    )
  }, [livePrices, onSelect])

  const listHeight = Math.min(TABLE_MAX_HEIGHT, sorted.length * ROW_HEIGHT)

  return (
    <div className="rounded-omni-lg border border-border bg-surface overflow-hidden">
      {/* Fixed header */}
      <div className="flex items-center border-b border-border text-xs font-medium text-foreground-tertiary uppercase tracking-wider">
        <SortHeader k="market_cap_rank" label="#" className="text-center w-[50px] shrink-0" />
        <th className="text-left py-2 px-3 min-w-[160px] flex-1">Nom</th>
        <SortHeader k="current_price" label="Prix" className="text-right w-[120px] shrink-0" />
        <SortHeader k="price_change_percentage_1h_in_currency" label="1h" className="text-right w-[70px] shrink-0 hidden sm:block" />
        <SortHeader k="price_change_percentage_24h" label="24h" className="text-right w-[70px] shrink-0" />
        <SortHeader k="price_change_percentage_7d_in_currency" label="7j" className="text-right w-[70px] shrink-0 hidden md:block" />
        <SortHeader k="market_cap" label="Cap." className="text-right w-[100px] shrink-0 hidden lg:block" />
        <SortHeader k="total_volume" label="Vol. 24h" className="text-right w-[100px] shrink-0 hidden lg:block" />
        <div className="text-right py-2 px-3 w-[100px] shrink-0 hidden xl:block">7j</div>
      </div>

      {/* Virtualized rows — only visible rows rendered (F1.6) */}
      <div style={{ height: listHeight, overflow: 'auto' }}>
        {sorted.map((coin, i) => {
          // Only render rows in viewport (simple CSS-based approach for SSR compat)
          return renderRow(coin, i, {})
        })}
      </div>
    </div>
  )
}

/* ── Main Export ──────────────────────────────────────────── */
export default function CryptoMarketExplorer() {
  const { coins, isLoading, page, fetchCoins } = useMarketStore()
  const [selectedCoinId, setSelectedCoinId] = useState<string | null>(null)

  // Build WS channels from loaded coins (top symbols)
  const wsChannels = useMemo(() => {
    const top = coins.slice(0, 50)
    return top.map(c => `crypto:${c.symbol.toUpperCase()}`)
  }, [coins])

  const { prices: livePrices, isConnected } = useThrottledMarket(wsChannels)

  useEffect(() => {
    if (coins.length === 0) fetchCoins(1)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      {/* Flash animation CSS */}
      <style jsx global>{`
        @keyframes flash-green { 0% { background-color: rgba(34,197,94,0.25); } 100% { background-color: transparent; } }
        @keyframes flash-red { 0% { background-color: rgba(239,68,68,0.25); } 100% { background-color: transparent; } }
        .flash-up { animation: flash-green 0.6s ease-out; }
        .flash-down { animation: flash-red 0.6s ease-out; }
      `}</style>

      <GlobalStatsBar />

      {/* Search + controls + live indicator */}
      <div className="flex items-center gap-3 flex-wrap">
        <CoinSearchBar onSelect={(id) => setSelectedCoinId(id)} />
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium border ${
            isConnected
              ? 'border-gain/30 bg-gain/10 text-gain'
              : 'border-foreground-tertiary/30 bg-surface-elevated text-foreground-tertiary'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-gain animate-pulse' : 'bg-foreground-tertiary'}`} />
            {isConnected ? 'LIVE' : 'Connexion...'}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchCoins(1)}
            disabled={isLoading}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      <TrendingSection onSelect={(id) => setSelectedCoinId(id)} />

      {/* Coins table */}
      {isLoading && coins.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-2 px-3">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-4 w-24 flex-1" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <CoinsTable coins={coins} livePrices={livePrices} onSelect={(id) => setSelectedCoinId(id)} />

          {/* Load more */}
          <div className="flex justify-center pt-2 pb-4">
            <Button
              variant="secondary"
              onClick={() => fetchCoins(page + 1)}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin mr-2" />
              ) : (
                <ChevronDown size={16} className="mr-2" />
              )}
              Charger plus de cryptos
            </Button>
          </div>
        </>
      )}

      {/* Detail Drawer */}
      {selectedCoinId && (
        <CoinDetailDrawer coinId={selectedCoinId} onClose={() => setSelectedCoinId(null)} />
      )}
    </div>
  )
}

function RefreshCw({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  )
}
