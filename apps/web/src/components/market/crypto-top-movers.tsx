'use client'

/**
 * OmniFlow — Crypto Top Movers + Treemap Heatmap (F1.3)
 * Tabs: Gainers / Losers / Volume Leaders
 * Views: List (sortable table) / Treemap (CSS-grid heatmap like Coin360)
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, TrendingDown, BarChart3, LayoutGrid, List, Loader2, RefreshCw } from 'lucide-react'
import { apiClient } from '@/lib/api-client'

interface CoinItem {
  id: string
  symbol: string
  name: string
  image: string
  price: number | null
  market_cap: number | null
  volume: number | null
  change_1h: number | null
  change_24h: number | null
  change_7d: number | null
  sparkline: number[]
}

interface TopMoversData {
  gainers: CoinItem[]
  losers: CoinItem[]
  volume_leaders: CoinItem[]
  treemap: CoinItem[]
  updated_at: number
}

type TabKey = 'gainers' | 'losers' | 'volume'
type ViewMode = 'list' | 'treemap'

const TABS: { key: TabKey; label: string; icon: typeof TrendingUp }[] = [
  { key: 'gainers', label: '🚀 Gainers', icon: TrendingUp },
  { key: 'losers', label: '📉 Losers', icon: TrendingDown },
  { key: 'volume', label: '💰 Volume', icon: BarChart3 },
]

function fmtPrice(v: number | null): string {
  if (v == null) return '—'
  if (v >= 1000) return `€${v.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}`
  if (v >= 1) return `€${v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return `€${v.toLocaleString('fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`
}

function fmtPct(v: number | null): string {
  if (v == null) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`
}

function fmtBig(v: number | null): string {
  if (v == null) return '—'
  if (v >= 1e12) return `€${(v / 1e12).toFixed(1)}T`
  if (v >= 1e9) return `€${(v / 1e9).toFixed(1)}Md`
  if (v >= 1e6) return `€${(v / 1e6).toFixed(0)}M`
  return `€${v.toLocaleString('fr-FR')}`
}

// Treemap color: green for positive, red for negative change
function changeColor(change: number | null): string {
  if (change == null) return '#333333'
  if (change >= 10) return '#15803d'
  if (change >= 5) return '#22c55e'
  if (change >= 2) return '#4ade80'
  if (change >= 0) return '#374151'
  if (change >= -2) return '#374151'
  if (change >= -5) return '#f87171'
  if (change >= -10) return '#ef4444'
  return '#b91c1c'
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 60
  const h = 20
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-[60px] h-[20px]">
      <polyline fill="none" stroke={color} strokeWidth="1.2" points={pts} />
    </svg>
  )
}

export default function CryptoTopMovers({
  onSelectSymbol,
}: {
  onSelectSymbol?: (symbol: string) => void
}) {
  const [data, setData] = useState<TopMoversData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('gainers')
  const [view, setView] = useState<ViewMode>('treemap')
  const [isOpen, setIsOpen] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const d = await apiClient.get<TopMoversData>('/api/v1/market/crypto/top-movers?limit=50')
      setData(d)
    } catch {
      // silent
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const iv = setInterval(fetchData, 30000)
    return () => clearInterval(iv)
  }, [fetchData])

  const items = data
    ? tab === 'gainers' ? data.gainers : tab === 'losers' ? data.losers : data.volume_leaders
    : []

  return (
    <div className="border-t border-border/50">
      {/* Toggle header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface-elevated/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">Top Movers</span>
          {data && (
            <span className="text-[9px] text-foreground-tertiary">
              (maj {new Date((data.updated_at || 0) * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})
            </span>
          )}
        </div>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-foreground-tertiary"
        >
          ▾
        </motion.span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 py-1 border-t border-border/30">
              <div className="flex gap-1">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      tab === t.key
                        ? 'bg-brand text-white'
                        : 'text-foreground-tertiary hover:text-foreground'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setView('list')}
                  className={`p-1 rounded ${view === 'list' ? 'text-brand' : 'text-foreground-tertiary hover:text-foreground'}`}
                >
                  <List size={12} />
                </button>
                <button
                  onClick={() => setView('treemap')}
                  className={`p-1 rounded ${view === 'treemap' ? 'text-brand' : 'text-foreground-tertiary hover:text-foreground'}`}
                >
                  <LayoutGrid size={12} />
                </button>
                <button
                  onClick={() => { setIsLoading(true); fetchData() }}
                  className="p-1 rounded text-foreground-tertiary hover:text-foreground"
                >
                  <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {isLoading && !data ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={16} className="animate-spin text-foreground-tertiary" />
              </div>
            ) : view === 'treemap' ? (
              <TreemapView coins={data?.treemap ?? []} onSelect={onSelectSymbol} />
            ) : (
              <ListView items={items} onSelect={onSelectSymbol} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Treemap View ──────────────────────────────────────── */

function TreemapView({
  coins,
  onSelect,
}: {
  coins: CoinItem[]
  onSelect?: (symbol: string) => void
}) {
  if (coins.length === 0) return null

  // Compute total market cap for sizing
  const totalCap = coins.reduce((s, c) => s + (c.market_cap ?? 0), 0)

  return (
    <div className="p-2">
      <div className="flex flex-wrap gap-[2px] min-h-[180px]">
        {coins.slice(0, 60).map((coin) => {
          const pct = totalCap > 0 ? ((coin.market_cap ?? 0) / totalCap) * 100 : 1
          // Min width 40px, proportional to market cap
          const flexBasis = Math.max(40, pct * 8)
          return (
            <button
              key={coin.id}
              onClick={() => onSelect?.(coin.symbol)}
              className="relative rounded-sm overflow-hidden transition-all hover:ring-1 hover:ring-white/30 group"
              style={{
                flexGrow: Math.max(1, Math.round(pct * 10)),
                flexBasis: `${flexBasis}px`,
                minHeight: pct > 5 ? '60px' : pct > 2 ? '45px' : '30px',
                backgroundColor: changeColor(coin.change_24h),
              }}
              title={`${coin.name} (${coin.symbol})\n${fmtPrice(coin.price)}\n${fmtPct(coin.change_24h)}`}
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center p-0.5 text-white">
                <span className="text-[10px] font-bold leading-tight drop-shadow-sm">{coin.symbol}</span>
                {pct > 1.5 && (
                  <span className={`text-[9px] font-medium leading-tight ${
                    (coin.change_24h ?? 0) >= 0 ? 'text-white/90' : 'text-white/90'
                  }`}>
                    {fmtPct(coin.change_24h)}
                  </span>
                )}
                {pct > 4 && (
                  <span className="text-[8px] text-white/60 leading-tight">{fmtPrice(coin.price)}</span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ── List View ─────────────────────────────────────────── */

function ListView({
  items,
  onSelect,
}: {
  items: CoinItem[]
  onSelect?: (symbol: string) => void
}) {
  return (
    <div className="max-h-[250px] overflow-y-auto">
      <table className="w-full text-[10px]">
        <thead className="sticky top-0 bg-surface z-10 border-b border-border/30">
          <tr className="text-foreground-tertiary">
            <th className="text-left px-2 py-1 font-medium">Nom</th>
            <th className="text-right px-2 py-1 font-medium">Prix</th>
            <th className="text-right px-2 py-1 font-medium">1h%</th>
            <th className="text-right px-2 py-1 font-medium">24h%</th>
            <th className="text-right px-2 py-1 font-medium hidden md:table-cell">7j%</th>
            <th className="text-right px-2 py-1 font-medium hidden lg:table-cell">Cap</th>
            <th className="text-right px-2 py-1 font-medium hidden lg:table-cell">Volume</th>
            <th className="text-center px-1 py-1 font-medium hidden md:table-cell">7j</th>
          </tr>
        </thead>
        <tbody>
          {items.map((coin) => (
            <tr
              key={coin.id}
              onClick={() => onSelect?.(coin.symbol)}
              className="border-b border-border/20 hover:bg-surface-elevated/50 cursor-pointer transition-colors"
            >
              <td className="px-2 py-1">
                <div className="flex items-center gap-1.5">
                  {coin.image && (
                    <img src={coin.image} alt="" className="w-4 h-4 rounded-full" />
                  )}
                  <span className="font-medium text-foreground">{coin.symbol}</span>
                  <span className="text-foreground-tertiary truncate max-w-[80px] hidden sm:inline">{coin.name}</span>
                </div>
              </td>
              <td className="px-2 py-1 text-right text-foreground tabular-nums">{fmtPrice(coin.price)}</td>
              <td className={`px-2 py-1 text-right tabular-nums ${(coin.change_1h ?? 0) >= 0 ? 'text-gain' : 'text-loss'}`}>
                {fmtPct(coin.change_1h)}
              </td>
              <td className={`px-2 py-1 text-right tabular-nums ${(coin.change_24h ?? 0) >= 0 ? 'text-gain' : 'text-loss'}`}>
                {fmtPct(coin.change_24h)}
              </td>
              <td className={`px-2 py-1 text-right tabular-nums hidden md:table-cell ${(coin.change_7d ?? 0) >= 0 ? 'text-gain' : 'text-loss'}`}>
                {fmtPct(coin.change_7d)}
              </td>
              <td className="px-2 py-1 text-right text-foreground-tertiary tabular-nums hidden lg:table-cell">
                {fmtBig(coin.market_cap)}
              </td>
              <td className="px-2 py-1 text-right text-foreground-tertiary tabular-nums hidden lg:table-cell">
                {fmtBig(coin.volume)}
              </td>
              <td className="px-1 py-1 hidden md:table-cell">
                <MiniSparkline
                  data={coin.sparkline ?? []}
                  color={(coin.change_7d ?? 0) >= 0 ? '#22c55e' : '#ef4444'}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
