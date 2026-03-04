'use client'

/**
 * OmniFlow — Stock Screener (multi-criteria filter panel)
 * Filters on sector, cap, P/E, dividend yield, performance, volume.
 * Results rendered in a sortable table inline.
 */

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Filter, ChevronDown, ChevronUp, X, RotateCcw,
  TrendingUp, Building2, Briefcase, Shield, Globe,
  Search, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api-client'

// ── Types ─────────────────────────────────────────────

interface ScreenerItem {
  symbol: string
  name: string
  type: string
  sector: string
  country: string
  price: number | null
  change_pct: number | null
  market_cap: number | null
  pe_ratio: number | null
  dividend_yield: number | null
  volume: number | null
  currency: string
}

interface ScreenerResult {
  results: ScreenerItem[]
  total: number
}

// ── Constants ─────────────────────────────────────────

const SECTORS = [
  'Technologie', 'Finance', 'Santé', 'Énergie', 'Industrie',
  'Luxe', 'Consommation', 'Semi-conducteurs', 'Automobile',
  'Assurance', 'Aérospatiale', 'Construction', 'E-commerce',
]

const CAP_FILTERS = [
  { label: 'Tout', min: undefined, max: undefined },
  { label: 'Mega >200B', min: 200e9, max: undefined },
  { label: 'Large 10-200B', min: 10e9, max: 200e9 },
  { label: 'Mid 2-10B', min: 2e9, max: 10e9 },
  { label: 'Small <2B', min: undefined, max: 2e9 },
]

const DIV_FILTERS = [
  { label: 'Tout', value: undefined },
  { label: '>0%', value: 0 },
  { label: '>2%', value: 2 },
  { label: '>4%', value: 4 },
  { label: '>6%', value: 6 },
]

// ── Helpers ───────────────────────────────────────────

function fmtPrice(v: number | null, currency = 'EUR'): string {
  if (v == null) return '—'
  return v.toLocaleString('fr-FR', { style: 'currency', currency, minimumFractionDigits: 2 })
}

function fmtPct(v: number | null): string {
  if (v == null) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`
}

function fmtBig(v: number | null): string {
  if (v == null) return '—'
  if (v >= 1e12) return `${(v / 1e12).toFixed(1)}T`
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`
  return v.toLocaleString('fr-FR')
}

function pctColor(v: number | null): string {
  if (v == null) return 'text-foreground-tertiary'
  return v >= 0 ? 'text-gain' : 'text-loss'
}

// ── Component ─────────────────────────────────────────

export default function StockScreener({
  onSelectSymbol,
}: {
  onSelectSymbol?: (symbol: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<ScreenerItem[]>([])
  const [total, setTotal] = useState(0)

  // Filter state
  const [sector, setSector] = useState<string | null>(null)
  const [assetType, setAssetType] = useState<string | null>(null)
  const [capIndex, setCapIndex] = useState(0)
  const [maxPe, setMaxPe] = useState<number | undefined>(undefined)
  const [divIndex, setDivIndex] = useState(0)
  const [sortBy, setSortBy] = useState('market_cap')
  const [sortDir, setSortDir] = useState('desc')

  const fetchResults = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (sector) params.append('sector', sector)
      if (assetType) params.append('asset_type', assetType)
      const cap = CAP_FILTERS[capIndex]
      if (cap?.min != null) params.append('min_cap', String(cap.min))
      if (cap?.max != null) params.append('max_cap', String(cap.max))
      if (maxPe != null) params.append('max_pe', String(maxPe))
      const div = DIV_FILTERS[divIndex]
      if (div?.value != null) params.append('min_dividend_yield', String(div.value))
      params.append('sort_by', sortBy)
      params.append('sort_dir', sortDir)
      params.append('limit', '50')

      const data = await apiClient.get<ScreenerResult>(`/api/v1/market/stocks/screen?${params.toString()}`)
      setResults(data.results || [])
      setTotal(data.total || 0)
    } catch {
      setResults([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }, [sector, assetType, capIndex, maxPe, divIndex, sortBy, sortDir])

  // Auto-fetch when filter changes
  useEffect(() => {
    if (isOpen) fetchResults()
  }, [isOpen, fetchResults])

  const resetFilters = () => {
    setSector(null)
    setAssetType(null)
    setCapIndex(0)
    setMaxPe(undefined)
    setDivIndex(0)
    setSortBy('market_cap')
    setSortDir('desc')
  }

  const toggleSort = (key: string) => {
    if (sortBy === key) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    else { setSortBy(key); setSortDir('desc') }
  }

  return (
    <div className="border-t border-border/50">
      {/* Toggle bar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-surface-elevated/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-foreground-tertiary" />
          <span className="text-xs font-medium text-foreground-secondary">
            Screener
            {total > 0 && <span className="ml-1.5 text-foreground-tertiary">({total} résultats)</span>}
          </span>
        </div>
        {isOpen ? <ChevronDown size={14} className="text-foreground-tertiary" /> : <ChevronUp size={14} className="text-foreground-tertiary" />}
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
            {/* Filters */}
            <div className="px-3 pb-2 space-y-2">
              {/* Type pills */}
              <div className="flex flex-wrap gap-1">
                <span className="text-[10px] text-foreground-tertiary mr-1 self-center">Type:</span>
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
                      onClick={() => setAssetType(f.key)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                        assetType === f.key
                          ? 'border-brand bg-brand/10 text-brand'
                          : 'border-border/50 text-foreground-tertiary hover:text-foreground-secondary'
                      }`}
                    >
                      <Icon size={10} />
                      {f.label}
                    </button>
                  )
                })}
              </div>

              {/* Cap pills */}
              <div className="flex flex-wrap gap-1">
                <span className="text-[10px] text-foreground-tertiary mr-1 self-center">Cap:</span>
                {CAP_FILTERS.map((f, i) => (
                  <button
                    key={i}
                    onClick={() => setCapIndex(i)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                      capIndex === i
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-border/50 text-foreground-tertiary hover:text-foreground-secondary'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Dividend pills */}
              <div className="flex flex-wrap gap-1">
                <span className="text-[10px] text-foreground-tertiary mr-1 self-center">Div:</span>
                {DIV_FILTERS.map((f, i) => (
                  <button
                    key={i}
                    onClick={() => setDivIndex(i)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                      divIndex === i
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-border/50 text-foreground-tertiary hover:text-foreground-secondary'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Sector pills (scrollable) */}
              <div className="flex gap-1 overflow-x-auto scrollbar-none pb-0.5">
                <span className="text-[10px] text-foreground-tertiary mr-1 self-center shrink-0">Secteur:</span>
                <button
                  onClick={() => setSector(null)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap border transition-colors shrink-0 ${
                    !sector ? 'border-brand bg-brand/10 text-brand' : 'border-border/50 text-foreground-tertiary hover:text-foreground-secondary'
                  }`}
                >
                  Tout
                </button>
                {SECTORS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSector(sector === s ? null : s)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap border transition-colors shrink-0 ${
                      sector === s ? 'border-brand bg-brand/10 text-brand' : 'border-border/50 text-foreground-tertiary hover:text-foreground-secondary'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* P/E max + reset */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-foreground-tertiary">P/E max:</span>
                <input
                  type="number"
                  value={maxPe ?? ''}
                  onChange={(e) => setMaxPe(e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="—"
                  className="w-16 px-2 py-0.5 text-[11px] bg-surface border border-border/50 rounded text-foreground tabular-nums focus:border-brand outline-none"
                />
                <button
                  onClick={resetFilters}
                  className="ml-auto flex items-center gap-1 px-2 py-0.5 text-[10px] text-foreground-tertiary hover:text-foreground-secondary transition-colors"
                >
                  <RotateCcw size={10} />
                  Réinitialiser
                </button>
              </div>
            </div>

            {/* Results table */}
            <div className="max-h-[280px] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 size={16} className="animate-spin text-foreground-tertiary" />
                </div>
              ) : results.length === 0 ? (
                <div className="text-center py-6 text-xs text-foreground-tertiary">Aucun résultat</div>
              ) : (
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-surface">
                    <tr className="border-b border-border/50 text-foreground-tertiary">
                      <SortTH k="name" label="Nom" active={sortBy} dir={sortDir} onSort={toggleSort} className="text-left pl-3" />
                      <SortTH k="price" label="Prix" active={sortBy} dir={sortDir} onSort={toggleSort} className="text-right" />
                      <SortTH k="change_pct" label="Var%" active={sortBy} dir={sortDir} onSort={toggleSort} className="text-right" />
                      <SortTH k="market_cap" label="Cap" active={sortBy} dir={sortDir} onSort={toggleSort} className="text-right hidden sm:table-cell" />
                      <SortTH k="pe_ratio" label="P/E" active={sortBy} dir={sortDir} onSort={toggleSort} className="text-right hidden md:table-cell" />
                      <SortTH k="dividend_yield" label="Div%" active={sortBy} dir={sortDir} onSort={toggleSort} className="text-right hidden md:table-cell" />
                      <th className="text-left px-2 hidden lg:table-cell">Secteur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((item) => (
                      <tr
                        key={item.symbol}
                        onClick={() => onSelectSymbol?.(item.symbol)}
                        className="border-b border-border/30 hover:bg-surface-elevated/40 cursor-pointer transition-colors"
                      >
                        <td className="py-1.5 pl-3">
                          <div>
                            <span className="font-medium text-foreground">{item.name}</span>
                            <span className="text-foreground-tertiary ml-1">{item.symbol}</span>
                          </div>
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums font-medium text-foreground">
                          {fmtPrice(item.price, item.currency)}
                        </td>
                        <td className={`py-1.5 px-2 text-right tabular-nums font-medium ${pctColor(item.change_pct)}`}>
                          {fmtPct(item.change_pct)}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums text-foreground-secondary hidden sm:table-cell">
                          {fmtBig(item.market_cap)}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums text-foreground-secondary hidden md:table-cell">
                          {item.pe_ratio != null ? item.pe_ratio.toFixed(1) : '—'}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums text-foreground-secondary hidden md:table-cell">
                          {item.dividend_yield != null ? `${(item.dividend_yield * 100).toFixed(2)}%` : '—'}
                        </td>
                        <td className="py-1.5 px-2 text-left text-foreground-tertiary hidden lg:table-cell">
                          {item.sector}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SortTH({
  k, label, active, dir, onSort, className,
}: {
  k: string; label: string; active: string; dir: string; onSort: (k: string) => void; className?: string
}) {
  return (
    <th
      onClick={() => onSort(k)}
      className={`py-1 px-2 cursor-pointer select-none hover:text-foreground-secondary transition-colors ${className || ''}`}
    >
      <span className="flex items-center gap-0.5">
        {label}
        {active === k && <ChevronDown size={8} className={dir === 'asc' ? 'rotate-180' : ''} />}
      </span>
    </th>
  )
}
