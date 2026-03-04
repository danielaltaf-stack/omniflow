'use client'

/**
 * OmniFlow — Stock Watchlist (localStorage-persisted, groupable, live prices)
 * Features: custom groups, search autocomplete, drag reorder, live WS updates.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Plus, X, Star, ChevronDown, ChevronRight,
  MoreHorizontal, Edit3, Trash2, FolderPlus, Loader2,
} from 'lucide-react'
import { useThrottledMarket } from '@/lib/use-throttled-market'
import { type TickData } from '@/lib/useMarketWebSocket'
import { apiClient } from '@/lib/api-client'

// ── Types ─────────────────────────────────────────────

interface WatchlistGroup {
  name: string
  symbols: string[]
}

interface WatchlistData {
  groups: WatchlistGroup[]
}

interface SearchResult {
  symbol: string
  name: string
  exchange: string
  type: string
}

const STORAGE_KEY = 'omniflow_watchlist'

const DEFAULT_DATA: WatchlistData = {
  groups: [
    { name: 'Favoris', symbols: ['AAPL', 'MSFT', 'NVDA', 'MC.PA'] },
    { name: 'Tech US', symbols: ['GOOGL', 'AMZN', 'META', 'TSLA'] },
    { name: 'Dividendes FR', symbols: ['TTE.PA', 'BNP.PA', 'SAN.PA'] },
    { name: 'ETF Core', symbols: ['CW8.PA', 'ESE.PA', 'PANX.PA'] },
  ],
}

// ── Helpers ───────────────────────────────────────────

function loadWatchlist(): WatchlistData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return DEFAULT_DATA
}

function saveWatchlist(data: WatchlistData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function fmtPrice(v: number | undefined): string {
  if (v == null) return '—'
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPct(v: number | undefined): string {
  if (v == null) return ''
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`
}

// ── Component ─────────────────────────────────────────

export default function StockWatchlist({
  onSelectSymbol,
}: {
  onSelectSymbol?: (symbol: string) => void
}) {
  const [data, setData] = useState<WatchlistData>(() => loadWatchlist())
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(data.groups.map(g => g.name)))
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null)
  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const [newGroupName, setNewGroupName] = useState('')
  const [showNewGroup, setShowNewGroup] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()

  // Collect all symbols for WS subscription
  const allSymbols = useMemo(() => {
    const symbols = new Set<string>()
    data.groups.forEach(g => g.symbols.forEach(s => symbols.add(s)))
    return Array.from(symbols)
  }, [data])

  const wsChannels = useMemo(
    () => allSymbols.map(s => s.startsWith('^') ? `index:${s}` : `stock:${s}`),
    [allSymbols],
  )

  const { prices: livePrices } = useThrottledMarket(wsChannels)

  // Save on change
  useEffect(() => {
    saveWatchlist(data)
  }, [data])

  // Search autocomplete
  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q)
    clearTimeout(searchTimer.current)
    if (!q.trim()) {
      setSearchResults([])
      return
    }
    searchTimer.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await apiClient.get<{ results: SearchResult[] }>(
          `/api/v1/market/stocks/search?q=${encodeURIComponent(q)}`
        )
        setSearchResults(res.results || [])
      } catch {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)
  }, [])

  // Add symbol to group
  const addSymbol = (groupName: string, symbol: string) => {
    setData(prev => ({
      groups: prev.groups.map(g =>
        g.name === groupName && !g.symbols.includes(symbol)
          ? { ...g, symbols: [...g.symbols, symbol] }
          : g
      ),
    }))
    setSearchQuery('')
    setSearchResults([])
    setAddingToGroup(null)
  }

  // Remove symbol from group
  const removeSymbol = (groupName: string, symbol: string) => {
    setData(prev => ({
      groups: prev.groups.map(g =>
        g.name === groupName
          ? { ...g, symbols: g.symbols.filter(s => s !== symbol) }
          : g
      ),
    }))
  }

  // Group CRUD
  const addGroup = (name: string) => {
    if (!name.trim()) return
    setData(prev => ({
      groups: [...prev.groups, { name: name.trim(), symbols: [] }],
    }))
    setExpandedGroups(prev => new Set(Array.from(prev).concat(name.trim())))
    setShowNewGroup(false)
    setNewGroupName('')
  }

  const renameGroup = (oldName: string, newName: string) => {
    if (!newName.trim()) return
    setData(prev => ({
      groups: prev.groups.map(g =>
        g.name === oldName ? { ...g, name: newName.trim() } : g
      ),
    }))
    setEditingGroup(null)
  }

  const deleteGroup = (name: string) => {
    setData(prev => ({
      groups: prev.groups.filter(g => g.name !== name),
    }))
  }

  const toggleGroup = (name: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-1.5">
          <Star size={14} className="text-brand" />
          <span className="text-xs font-semibold text-foreground">Watchlist</span>
          <span className="text-[10px] text-foreground-tertiary">({allSymbols.length})</span>
        </div>
        <button
          onClick={() => setShowNewGroup(!showNewGroup)}
          className="p-1 rounded hover:bg-surface-elevated text-foreground-tertiary hover:text-foreground-secondary transition-colors"
          title="Nouveau groupe"
        >
          <FolderPlus size={14} />
        </button>
      </div>

      {/* New group input */}
      <AnimatePresence>
        {showNewGroup && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-border/30"
          >
            <div className="flex items-center gap-1.5 px-3 py-1.5">
              <input
                autoFocus
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addGroup(newGroupName)}
                placeholder="Nom du groupe..."
                className="flex-1 px-2 py-0.5 text-[11px] bg-surface border border-border/50 rounded text-foreground focus:border-brand outline-none"
              />
              <button onClick={() => addGroup(newGroupName)} className="text-brand hover:text-brand/80">
                <Plus size={14} />
              </button>
              <button onClick={() => { setShowNewGroup(false); setNewGroupName('') }} className="text-foreground-tertiary">
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Groups */}
      <div className="flex-1 overflow-y-auto">
        {data.groups.map((group) => {
          const isExpanded = expandedGroups.has(group.name)
          return (
            <div key={group.name} className="border-b border-border/20">
              {/* Group header */}
              <div className="flex items-center gap-1 px-2 py-1.5 hover:bg-surface-elevated/30 transition-colors">
                <button onClick={() => toggleGroup(group.name)} className="p-0.5">
                  {isExpanded ? <ChevronDown size={12} className="text-foreground-tertiary" /> : <ChevronRight size={12} className="text-foreground-tertiary" />}
                </button>

                {editingGroup === group.name ? (
                  <input
                    autoFocus
                    defaultValue={group.name}
                    onBlur={(e) => renameGroup(group.name, e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && renameGroup(group.name, (e.target as HTMLInputElement).value)}
                    className="flex-1 px-1 py-0 text-[11px] font-medium bg-surface border border-brand rounded text-foreground outline-none"
                  />
                ) : (
                  <span
                    onClick={() => toggleGroup(group.name)}
                    className="flex-1 text-[11px] font-medium text-foreground-secondary cursor-pointer"
                  >
                    {group.name}
                    <span className="text-foreground-tertiary ml-1">({group.symbols.length})</span>
                  </span>
                )}

                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => setAddingToGroup(addingToGroup === group.name ? null : group.name)}
                    className="p-0.5 rounded hover:bg-surface-elevated text-foreground-tertiary hover:text-brand transition-colors"
                    title="Ajouter un titre"
                  >
                    <Plus size={12} />
                  </button>
                  <button
                    onClick={() => setEditingGroup(group.name)}
                    className="p-0.5 rounded hover:bg-surface-elevated text-foreground-tertiary hover:text-foreground-secondary transition-colors"
                    title="Renommer"
                  >
                    <Edit3 size={10} />
                  </button>
                  <button
                    onClick={() => deleteGroup(group.name)}
                    className="p-0.5 rounded hover:bg-surface-elevated text-foreground-tertiary hover:text-loss transition-colors"
                    title="Supprimer le groupe"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>

              {/* Add symbol search */}
              <AnimatePresence>
                {addingToGroup === group.name && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 py-1 relative">
                      <div className="relative">
                        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-foreground-tertiary" />
                        <input
                          autoFocus
                          value={searchQuery}
                          onChange={(e) => handleSearch(e.target.value)}
                          placeholder="Rechercher un titre..."
                          className="w-full pl-7 pr-2 py-1 text-[11px] bg-surface border border-border/50 rounded text-foreground focus:border-brand outline-none"
                        />
                        {isSearching && <Loader2 size={10} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-foreground-tertiary" />}
                      </div>
                      {searchResults.length > 0 && (
                        <div className="mt-0.5 border border-border/50 rounded bg-surface shadow-lg max-h-[120px] overflow-y-auto">
                          {searchResults.map((r) => (
                            <button
                              key={r.symbol}
                              onClick={() => addSymbol(group.name, r.symbol)}
                              className="w-full flex items-center gap-2 px-2 py-1 text-[11px] hover:bg-surface-elevated transition-colors text-left"
                            >
                              <span className="font-medium text-foreground">{r.symbol}</span>
                              <span className="text-foreground-tertiary truncate">{r.name}</span>
                              <span className="text-[9px] text-foreground-tertiary ml-auto">{r.exchange}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Symbols list */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    {group.symbols.length === 0 ? (
                      <div className="px-3 py-2 text-[10px] text-foreground-tertiary italic">
                        Aucun titre — cliquez + pour ajouter
                      </div>
                    ) : (
                      group.symbols.map((sym) => {
                        const channel = sym.startsWith('^') ? `index:${sym}` : `stock:${sym}`
                        const tick = livePrices.get(channel)
                        const isUp = (tick?.change_pct_24h ?? 0) >= 0

                        return (
                          <div
                            key={sym}
                            onClick={() => onSelectSymbol?.(sym)}
                            className="flex items-center justify-between px-3 py-1 hover:bg-surface-elevated/30 cursor-pointer transition-colors group"
                          >
                            <span className="text-[11px] font-medium text-foreground-secondary">{sym}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] tabular-nums text-foreground">{fmtPrice(tick?.price)}</span>
                              {tick?.change_pct_24h != null && (
                                <span className={`text-[10px] tabular-nums font-medium ${isUp ? 'text-gain' : 'text-loss'}`}>
                                  {fmtPct(tick.change_pct_24h)}
                                </span>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); removeSymbol(group.name, sym) }}
                                className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-loss/10 text-foreground-tertiary hover:text-loss transition-all"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}
