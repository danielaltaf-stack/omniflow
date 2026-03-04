'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, TrendingUp, TrendingDown, X, ChevronDown,
  Globe, BarChart3, ExternalLink, Loader2, Filter,
  Building2, Landmark, Shield, Briefcase,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { apiClient } from '@/lib/api-client'
import { useThrottledMarket } from '@/lib/use-throttled-market'
import { type TickData } from '@/lib/useMarketWebSocket'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts'

/* ── Types ───────────────────────────────────────────────── */
interface StockItem {
  symbol: string
  name: string
  type: string
  sector: string
  country: string
  isin: string
  price: number | null
  change_pct: number | null
  change: number | null
  previous_close: number | null
  open: number | null
  day_high: number | null
  day_low: number | null
  volume: number | null
  market_cap: number | null
  fifty_two_week_high: number | null
  fifty_two_week_low: number | null
  currency: string
  exchange: string | null
}

interface StockQuoteDetail {
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

interface ChartData {
  symbol: string
  timestamps: number[]
  prices: (number | null)[]
  volumes: (number | null)[]
  currency: string
}

/* ── Helpers ─────────────────────────────────────────────── */
function fmtPrice(v: number | null | undefined, currency = 'EUR'): string {
  if (v == null) return '—'
  return v.toLocaleString('fr-FR', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtBigNumber(v: number | null | undefined): string {
  if (v == null) return '—'
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)} T`
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)} Md`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)} M`
  return v.toLocaleString('fr-FR', { maximumFractionDigits: 0 })
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`
}

function pctColor(v: number | null | undefined): string {
  if (v == null) return 'text-foreground-tertiary'
  return v >= 0 ? 'text-gain' : 'text-loss'
}

const TYPE_LABELS: Record<string, string> = {
  action: 'Action',
  etf: 'ETF',
  obligation: 'Obligation',
}

const TYPE_ICONS: Record<string, typeof Building2> = {
  action: Building2,
  etf: Briefcase,
  obligation: Shield,
}

const TYPE_COLORS: Record<string, string> = {
  action: 'bg-blue-400/10 text-blue-400 border-blue-400/30',
  etf: 'bg-brand/10 text-brand border-brand/30',
  obligation: 'bg-amber-400/10 text-amber-400 border-amber-400/30',
}

const COUNTRY_FLAGS: Record<string, string> = {
  FR: '🇫🇷', DE: '🇩🇪', NL: '🇳🇱', IE: '🇮🇪', US: '🇺🇸', GB: '🇬🇧',
}

/* ── Stock Detail Drawer ─────────────────────────────────── */
const CHART_PERIODS = [
  { label: '1j', period: '1d', interval: '5m' },
  { label: '5j', period: '5d', interval: '15m' },
  { label: '1m', period: '1mo', interval: '1d' },
  { label: '6m', period: '6mo', interval: '1d' },
  { label: '1an', period: '1y', interval: '1d' },
  { label: '5an', period: '5y', interval: '1wk' },
  { label: 'Max', period: 'max', interval: '1mo' },
]

function StockDetailDrawer({ symbol, onClose }: { symbol: string | null; onClose: () => void }) {
  const [detail, setDetail] = useState<StockQuoteDetail | null>(null)
  const [chart, setChart] = useState<ChartData | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [isLoadingChart, setIsLoadingChart] = useState(false)
  const [chartPeriod, setChartPeriod] = useState<typeof CHART_PERIODS[0]>(CHART_PERIODS[3]!)

  useEffect(() => {
    if (!symbol) return
    setDetail(null)
    setChart(null)
    setIsLoadingDetail(true)
    apiClient.get<StockQuoteDetail>(`/api/v1/market/stocks/quote/${symbol}`)
      .then(d => setDetail(d))
      .catch(() => {})
      .finally(() => setIsLoadingDetail(false))
    fetchChart(CHART_PERIODS[3]!)
  }, [symbol]) // eslint-disable-line

  const fetchChart = (p: typeof CHART_PERIODS[0]) => {
    if (!symbol) return
    setChartPeriod(p)
    setIsLoadingChart(true)
    apiClient.get<ChartData>(`/api/v1/market/stocks/chart/${symbol}?period=${p.period}&interval=${p.interval}`)
      .then(d => setChart(d))
      .catch(() => {})
      .finally(() => setIsLoadingChart(false))
  }

  if (!symbol) return null

  const chartPoints = chart ? chart.timestamps.map((ts, i) => ({
    time: new Date(ts * 1000),
    price: chart.prices[i],
    volume: chart.volumes[i],
  })).filter(p => p.price != null) : []

  const priceUp = chartPoints.length >= 2 && (chartPoints[chartPoints.length - 1]!.price ?? 0) >= (chartPoints[0]!.price ?? 0)
  const currency = detail?.currency || chart?.currency || 'EUR'

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
              <Skeleton className="h-6 w-40" />
            ) : detail && (
              <div className="flex items-center gap-2">
                <span className="text-lg">{COUNTRY_FLAGS[detail.country] || ''}</span>
                <h2 className="text-lg font-bold text-foreground">{detail.name}</h2>
                <span className="text-sm text-foreground-tertiary">{detail.symbol}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${TYPE_COLORS[detail.type] || ''}`}>
                  {TYPE_LABELS[detail.type] || detail.type}
                </span>
              </div>
            )}
          </div>
        </div>

        {isLoadingDetail ? (
          <div className="p-5 space-y-4">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-64 w-full" />
            <div className="grid grid-cols-2 gap-3">
              {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          </div>
        ) : detail && (
          <div className="p-5 space-y-5">
            {/* Price */}
            <div>
              <div className="flex items-center gap-2">
                <p className="text-3xl font-bold text-foreground tabular-nums">
                  {fmtPrice(detail.price, currency)}
                </p>
                {detail.market_state === 'CLOSED' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-foreground-tertiary/20 text-foreground-tertiary font-medium">
                    Marché fermé
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className={`text-sm font-medium flex items-center gap-1 ${pctColor(detail.change_pct)}`}>
                  {(detail.change_pct ?? 0) >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {fmtPct(detail.change_pct)}
                  {detail.change != null && (
                    <span className="text-foreground-tertiary ml-1">
                      ({detail.change > 0 ? '+' : ''}{fmtPrice(detail.change, currency)})
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Chart */}
            <div className="rounded-omni-lg border border-border bg-surface p-4">
              <div className="flex items-center gap-1 mb-3">
                {CHART_PERIODS.map(p => (
                  <button
                    key={p.period}
                    onClick={() => fetchChart(p)}
                    className={`px-2.5 py-1 rounded-omni-sm text-xs font-medium transition-colors ${
                      chartPeriod.period === p.period
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
                        <linearGradient id="stockPriceGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={priceUp ? 'var(--color-gain)' : 'var(--color-loss)'} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={priceUp ? 'var(--color-gain)' : 'var(--color-loss)'} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="time"
                        tickFormatter={(d: Date) => {
                          if (chartPeriod.period === '1d') return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                          return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
                        }}
                        tick={{ fontSize: 10, fill: 'var(--color-foreground-tertiary)' }}
                        axisLine={false} tickLine={false}
                        minTickGap={40}
                      />
                      <YAxis
                        domain={['auto', 'auto']}
                        tickFormatter={(v: number) => fmtPrice(v, currency)}
                        tick={{ fontSize: 10, fill: 'var(--color-foreground-tertiary)' }}
                        axisLine={false} tickLine={false}
                        width={80}
                      />
                      <Tooltip
                        contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                        labelFormatter={(d: any) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                        formatter={(v: any) => [fmtPrice(v as number, currency), 'Prix']}
                      />
                      <Area
                        type="monotone"
                        dataKey="price"
                        stroke={priceUp ? 'var(--color-gain)' : 'var(--color-loss)'}
                        fill="url(#stockPriceGrad)"
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
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Ouverture" value={fmtPrice(detail.open, currency)} />
              <StatCard label="Clôture préc." value={fmtPrice(detail.previous_close, currency)} />
              <StatCard label="Plus haut" value={fmtPrice(detail.day_high, currency)} />
              <StatCard label="Plus bas" value={fmtPrice(detail.day_low, currency)} />
              <StatCard label="Volume" value={fmtBigNumber(detail.volume)} />
              <StatCard label="Vol. moyen (3M)" value={fmtBigNumber(detail.avg_volume)} />
              {detail.market_cap && <StatCard label="Capitalisation" value={fmtBigNumber(detail.market_cap) + ' ' + currency} />}
              {detail.pe_ratio && <StatCard label="PER" value={detail.pe_ratio.toFixed(2)} />}
              {detail.eps && <StatCard label="BPA" value={fmtPrice(detail.eps, currency)} />}
              {detail.dividend_yield != null && detail.dividend_yield > 0 && (
                <StatCard label="Rendement div." value={`${(detail.dividend_yield * 100).toFixed(2)}%`} color="text-gain" />
              )}
              <StatCard label="+ haut 52 sem." value={fmtPrice(detail.fifty_two_week_high, currency)} />
              <StatCard label="+ bas 52 sem." value={fmtPrice(detail.fifty_two_week_low, currency)} />
              {detail.fifty_day_avg && <StatCard label="Moy. 50j" value={fmtPrice(detail.fifty_day_avg, currency)} />}
              {detail.two_hundred_day_avg && <StatCard label="Moy. 200j" value={fmtPrice(detail.two_hundred_day_avg, currency)} />}
            </div>

            {/* Info */}
            <div className="flex flex-wrap gap-2 text-xs text-foreground-tertiary">
              {detail.isin && <span className="px-2 py-1 rounded-full bg-surface-elevated border border-border">ISIN: {detail.isin}</span>}
              {detail.exchange && <span className="px-2 py-1 rounded-full bg-surface-elevated border border-border">{detail.exchange}</span>}
              {detail.sector && <span className="px-2 py-1 rounded-full bg-surface-elevated border border-border">{detail.sector}</span>}
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

/* ── Main Export ──────────────────────────────────────────── */
export default function StockMarketExplorer() {
  const [items, setItems] = useState<StockItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [filterType, setFilterType] = useState<string | null>(null)
  const [filterSector, setFilterSector] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<string>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()
  const prevPricesRef = useRef<Map<string, number>>(new Map())

  // Build WS channels from loaded stock items
  const wsChannels = useMemo(() => {
    if (items.length === 0) return []
    const top = items.slice(0, 60)
    return top.map(i => `stock:${i.symbol}`)
  }, [items])

  const { prices: livePrices, isConnected } = useThrottledMarket(wsChannels)

  const fetchData = useCallback(async (type?: string | null, search?: string | null) => {
    setIsLoading(true)
    try {
      let url = '/api/v1/market/stocks/universe?'
      if (type) url += `asset_type=${type}&`
      if (search) url += `search=${encodeURIComponent(search)}&`
      const data = await apiClient.get<StockItem[]>(url)
      setItems(data)
    } catch {
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleTypeFilter = (type: string | null) => {
    setFilterType(type)
    fetchData(type, searchQuery || null)
  }

  const handleSearch = (q: string) => {
    setSearchQuery(q)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      fetchData(filterType, q || null)
    }, 400)
  }

  // Client-side sort
  const sorted = [...items].sort((a, b) => {
    const av = (a as any)[sortKey] ?? ''
    const bv = (b as any)[sortKey] ?? ''
    if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av
    return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
  })

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(true) }
  }

  // Unique sectors for pills
  const sectors = Array.from(new Set(items.map(i => i.sector))).sort()

  return (
    <div className="space-y-4">
      {/* Flash animation CSS */}
      <style jsx global>{`
        @keyframes flash-green { 0% { background-color: rgba(34,197,94,0.25); } 100% { background-color: transparent; } }
        @keyframes flash-red { 0% { background-color: rgba(239,68,68,0.25); } 100% { background-color: transparent; } }
        .flash-up { animation: flash-green 0.6s ease-out; }
        .flash-down { animation: flash-red 0.6s ease-out; }
      `}</style>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Rechercher action, ETF, ISIN..."
            className="w-full pl-9 pr-8 py-2 bg-surface border border-border rounded-omni-sm text-sm text-foreground placeholder:text-foreground-tertiary focus:border-brand focus:ring-1 focus:ring-brand outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); fetchData(filterType, null) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-tertiary hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Type filter */}
        <div className="flex gap-1.5">
          {[
            { key: null, label: 'Tout', icon: Globe },
            { key: 'action', label: 'Actions', icon: Building2 },
            { key: 'etf', label: 'ETF', icon: Briefcase },
            { key: 'obligation', label: 'Obligations', icon: Shield },
          ].map((f) => {
            const Icon = f.icon
            return (
              <button
                key={f.key ?? 'all'}
                onClick={() => handleTypeFilter(f.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-omni-sm text-xs font-medium border transition-colors ${
                  filterType === f.key
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-border text-foreground-tertiary hover:text-foreground-secondary hover:border-foreground-tertiary'
                }`}
              >
                <Icon size={12} />
                {f.label}
              </button>
            )
          })}
        </div>

        {/* Refresh + Live indicator */}
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
            onClick={() => fetchData(filterType, searchQuery || null)}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <BarChart3 size={14} />}
          </Button>
        </div>
      </div>

      {/* Sector pills */}
      {sectors.length > 5 && !searchQuery && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setFilterSector(null)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
              !filterSector ? 'bg-brand/10 text-brand' : 'bg-surface-elevated text-foreground-tertiary hover:text-foreground-secondary'
            }`}
          >
            Tous les secteurs
          </button>
          {sectors.map(s => (
            <button
              key={s}
              onClick={() => setFilterSector(filterSector === s ? null : s)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
                filterSector === s ? 'bg-brand/10 text-brand' : 'bg-surface-elevated text-foreground-tertiary hover:text-foreground-secondary'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Results count */}
      <div className="text-xs text-foreground-tertiary">
        {items.length} instrument{items.length !== 1 ? 's' : ''}
        {filterType && ` · ${TYPE_LABELS[filterType] || filterType}`}
        {filterSector && ` · ${filterSector}`}
      </div>

      {/* Table */}
      {isLoading && items.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-2 px-3">
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-32 flex-1" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-omni-lg border border-border bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-medium text-foreground-tertiary uppercase tracking-wider">
                  <th className="text-left py-2 px-3 w-8"></th>
                  <SortHeader k="name" label="Nom" active={sortKey} asc={sortAsc} onSort={toggleSort} className="text-left" />
                  <th className="text-center py-2 px-3 hidden sm:table-cell">Type</th>
                  <SortHeader k="price" label="Prix" active={sortKey} asc={sortAsc} onSort={toggleSort} className="text-right" />
                  <SortHeader k="change_pct" label="Var." active={sortKey} asc={sortAsc} onSort={toggleSort} className="text-right" />
                  <SortHeader k="market_cap" label="Cap." active={sortKey} asc={sortAsc} onSort={toggleSort} className="text-right hidden lg:table-cell" />
                  <SortHeader k="volume" label="Volume" active={sortKey} asc={sortAsc} onSort={toggleSort} className="text-right hidden lg:table-cell" />
                  <th className="text-left py-2 px-3 hidden md:table-cell">Secteur</th>
                </tr>
              </thead>
              <tbody>
                {(filterSector ? sorted.filter(i => i.sector === filterSector) : sorted).map((item, i) => {
                  // Merge live price from WebSocket
                  const liveKey = `stock:${item.symbol}`
                  const live = livePrices.get(liveKey)
                  const displayPrice = live?.price ?? item.price
                  const displayChange = live?.change_pct_24h ?? item.change_pct

                  // Flash animation
                  const prevPrice = prevPricesRef.current.get(item.symbol) ?? (displayPrice ?? 0)
                  const flashClass = (displayPrice ?? 0) > prevPrice ? 'flash-up' : (displayPrice ?? 0) < prevPrice ? 'flash-down' : ''
                  prevPricesRef.current.set(item.symbol, displayPrice ?? 0)
                  const flashKey = `${item.symbol}-${displayPrice}`

                  return (
                  <motion.tr
                    key={item.symbol}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.015, 0.5) }}
                    onClick={() => setSelectedSymbol(item.symbol)}
                    className="border-b border-border/50 hover:bg-surface-elevated/40 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-sm">{COUNTRY_FLAGS[item.country] || ''}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-foreground-tertiary">{item.symbol}</p>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center hidden sm:table-cell">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${TYPE_COLORS[item.type] || ''}`}>
                        {TYPE_LABELS[item.type] || item.type}
                      </span>
                    </td>
                    <td key={flashKey} className={`py-2.5 px-3 text-right tabular-nums font-medium text-foreground rounded ${flashClass}`}>
                      {fmtPrice(displayPrice, item.currency)}
                    </td>
                    <td className={`py-2.5 px-3 text-right tabular-nums text-xs font-medium ${pctColor(displayChange)}`}>
                      {fmtPct(displayChange)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-xs text-foreground-secondary hidden lg:table-cell">
                      {fmtBigNumber(item.market_cap)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-xs text-foreground-secondary hidden lg:table-cell">
                      {fmtBigNumber(item.volume)}
                    </td>
                    <td className="py-2.5 px-3 text-left hidden md:table-cell">
                      <span className="text-xs text-foreground-tertiary">{item.sector}</span>
                    </td>
                  </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {selectedSymbol && (
        <StockDetailDrawer symbol={selectedSymbol} onClose={() => setSelectedSymbol(null)} />
      )}
    </div>
  )
}

function SortHeader({ k, label, active, asc, onSort, className }: { k: string; label: string; active: string; asc: boolean; onSort: (k: string) => void; className?: string }) {
  return (
    <th
      onClick={() => onSort(k)}
      className={`py-2 px-3 cursor-pointer select-none hover:text-foreground-secondary transition-colors ${className || ''}`}
    >
      <span className="flex items-center gap-1">
        {label}
        {active === k && <ChevronDown size={10} className={asc ? '' : 'rotate-180'} />}
      </span>
    </th>
  )
}
