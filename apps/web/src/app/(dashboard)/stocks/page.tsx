'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, TrendingDown, Plus, RefreshCw, Trash2, X,
  Upload, BarChart3, AlertCircle, Search, PieChart, Calendar,
  Activity, Landmark, ShieldCheck, Globe, Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useStockStore } from '@/stores/stock-store'
import { formatAmount, amountColorClass } from '@/lib/format'
import dynamic from 'next/dynamic'

const StockMarketExplorer = dynamic(
  () => import('@/components/market/stock-market-explorer'),
  { ssr: false, loading: () => <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> }
)

const StockTradingTerminal = dynamic(
  () => import('@/components/market/stock-trading-terminal'),
  { ssr: false, loading: () => <div className="h-[600px] flex items-center justify-center"><Skeleton className="h-full w-full" /></div> }
)

type TabKey = 'portfolios' | 'market' | 'performance' | 'dividends' | 'allocation' | 'envelopes'

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'portfolios', label: 'Portefeuilles', icon: BarChart3 },
  { key: 'market', label: 'Marché', icon: Globe },
  { key: 'performance', label: 'Performance', icon: Activity },
  { key: 'dividends', label: 'Dividendes', icon: Calendar },
  { key: 'allocation', label: 'Allocation', icon: PieChart },
  { key: 'envelopes', label: 'Enveloppes', icon: Landmark },
]

const PERIOD_OPTIONS = ['1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y']
const BENCHMARK_COLORS: Record<string, string> = {
  sp500: '#3b82f6',
  cac40: '#f59e0b',
  msci_world: '#10b981',
}
const BENCHMARK_LABELS: Record<string, string> = {
  sp500: 'S&P 500',
  cac40: 'CAC 40',
  msci_world: 'MSCI World',
}
const ENVELOPE_COLORS: Record<string, string> = {
  pea: 'text-gain bg-gain/10 border-gain/30',
  pea_pme: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  cto: 'text-foreground-secondary bg-surface-elevated border-border',
  assurance_vie: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  per: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
}
const FREQ_COLORS: Record<string, string> = {
  monthly: 'bg-gain/20 text-gain',
  quarterly: 'bg-blue-400/20 text-blue-400',
  semi_annual: 'bg-amber-400/20 text-amber-400',
  annual: 'bg-foreground-tertiary/20 text-foreground-tertiary',
}
const FREQ_LABELS: Record<string, string> = {
  monthly: 'Mensuel',
  quarterly: 'Trimestriel',
  semi_annual: 'Semestriel',
  annual: 'Annuel',
}
const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

/* ── Add Position Modal ─────────────────────────────────── */
function AddPositionModal({
  isOpen,
  onClose,
  portfolioId,
}: {
  isOpen: boolean
  onClose: () => void
  portfolioId: string | null
}) {
  const { addPosition, isSyncing } = useStockStore()
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [avgPrice, setAvgPrice] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!portfolioId) return
    setError(null)
    try {
      await addPosition(portfolioId, {
        symbol: symbol.toUpperCase(),
        name: name || undefined,
        quantity: parseFloat(quantity),
        avg_buy_price: avgPrice ? Math.round(parseFloat(avgPrice) * 100) : undefined,
      })
      setSymbol('')
      setName('')
      setQuantity('')
      setAvgPrice('')
      onClose()
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (!isOpen || !portfolioId) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="w-full max-w-md mx-4 bg-surface rounded-omni-lg border border-border p-6"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-foreground">Ajouter une position</h3>
            <button onClick={onClose} className="text-foreground-tertiary hover:text-foreground">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-1.5">
                  Symbole *
                </label>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder="AAPL, MC.PA..."
                  required
                  className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none uppercase"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-1.5">
                  Nom
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Apple Inc."
                  className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-1.5">
                  Quantité *
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="10"
                  required
                  min="0"
                  step="any"
                  className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-1.5">
                  Prix moyen (€)
                </label>
                <input
                  type="number"
                  value={avgPrice}
                  onChange={(e) => setAvgPrice(e.target.value)}
                  placeholder="150.00"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-loss bg-loss/10 rounded-omni-sm p-3">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSyncing}>
              {isSyncing ? (
                <><RefreshCw size={16} className="animate-spin mr-2" />Ajout...</>
              ) : (
                'Ajouter la position'
              )}
            </Button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

/* ── CSV Import Modal ───────────────────────────────────── */
function CSVImportModal({
  isOpen,
  onClose,
  portfolioId,
}: {
  isOpen: boolean
  onClose: () => void
  portfolioId: string | null
}) {
  const { importCSV, isSyncing } = useStockStore()
  const [broker, setBroker] = useState<string>('degiro')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      setFile(droppedFile)
    } else {
      setError('Veuillez déposer un fichier CSV')
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!portfolioId || !file) return
    setError(null)
    try {
      await importCSV(portfolioId, broker, file)
      setFile(null)
      onClose()
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (!isOpen || !portfolioId) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="w-full max-w-md mx-4 bg-surface rounded-omni-lg border border-border p-6"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-foreground">Importer un CSV</h3>
            <button onClick={onClose} className="text-foreground-tertiary hover:text-foreground">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Broker selection */}
            <div>
              <label className="block text-sm font-medium text-foreground-secondary mb-1.5">
                Courtier
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'degiro', label: 'Degiro' },
                  { id: 'trade_republic', label: 'Trade Republic' },
                  { id: 'boursorama', label: 'Boursorama' },
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBroker(b.id)}
                    className={`py-2 px-2 rounded-omni-sm text-xs border transition-colors ${
                      broker === b.id
                        ? 'border-brand bg-brand/10 text-brand font-medium'
                        : 'border-border text-foreground-secondary hover:border-foreground-tertiary'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-omni-sm p-8 text-center cursor-pointer transition-colors ${
                isDragOver
                  ? 'border-brand bg-brand/5'
                  : file
                    ? 'border-gain bg-gain/5'
                    : 'border-border hover:border-foreground-tertiary'
              }`}
            >
              <Upload size={24} className={`mx-auto mb-2 ${file ? 'text-gain' : 'text-foreground-tertiary'}`} />
              {file ? (
                <p className="text-sm text-gain font-medium">{file.name}</p>
              ) : (
                <>
                  <p className="text-sm text-foreground-secondary">
                    Glissez votre fichier CSV ici
                  </p>
                  <p className="text-xs text-foreground-tertiary mt-1">
                    ou cliquez pour sélectionner
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-loss bg-loss/10 rounded-omni-sm p-3">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={!file || isSyncing}>
              {isSyncing ? (
                <><RefreshCw size={16} className="animate-spin mr-2" />Import...</>
              ) : (
                'Importer les positions'
              )}
            </Button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

/* ── Create Portfolio Modal ─────────────────────────────── */
function CreatePortfolioModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const { createPortfolio, isSyncing } = useStockStore()
  const [label, setLabel] = useState('')
  const [broker, setBroker] = useState('manual')
  const [envelopeType, setEnvelopeType] = useState('cto')
  const [managementFee, setManagementFee] = useState('')
  const [totalDeposits, setTotalDeposits] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await createPortfolio(
        label,
        broker,
        envelopeType,
        managementFee ? parseFloat(managementFee) : 0,
        totalDeposits ? Math.round(parseFloat(totalDeposits) * 100) : 0,
      )
      setLabel('')
      setBroker('manual')
      setEnvelopeType('cto')
      setManagementFee('')
      setTotalDeposits('')
      onClose()
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="w-full max-w-md mx-4 bg-surface rounded-omni-lg border border-border p-6 max-h-[90vh] overflow-y-auto"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-foreground">Nouveau portefeuille</h3>
            <button onClick={onClose} className="text-foreground-tertiary hover:text-foreground">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground-secondary mb-1.5">Nom *</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Mon PEA, CTO Degiro..."
                required
                className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground-secondary mb-1.5">Courtier</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'manual', label: 'Manuel' },
                  { id: 'degiro', label: 'Degiro' },
                  { id: 'trade_republic', label: 'Trade Republic' },
                  { id: 'boursorama', label: 'Boursorama' },
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBroker(b.id)}
                    className={`py-2 px-3 rounded-omni-sm text-sm border transition-colors ${
                      broker === b.id
                        ? 'border-brand bg-brand/10 text-brand font-medium'
                        : 'border-border text-foreground-secondary hover:border-foreground-tertiary'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Envelope type — Phase B2 */}
            <div>
              <label className="block text-sm font-medium text-foreground-secondary mb-1.5">
                <Landmark size={14} className="inline mr-1" />
                Enveloppe fiscale
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'cto', label: 'CTO' },
                  { id: 'pea', label: 'PEA' },
                  { id: 'pea_pme', label: 'PEA-PME' },
                  { id: 'assurance_vie', label: 'Assurance-Vie' },
                  { id: 'per', label: 'PER' },
                ].map((env) => (
                  <button
                    key={env.id}
                    type="button"
                    onClick={() => setEnvelopeType(env.id)}
                    className={`py-2 px-2 rounded-omni-sm text-xs border transition-colors ${
                      envelopeType === env.id
                        ? 'border-brand bg-brand/10 text-brand font-medium'
                        : 'border-border text-foreground-secondary hover:border-foreground-tertiary'
                    }`}
                  >
                    {env.label}
                  </button>
                ))}
              </div>
            </div>

            {envelopeType === 'assurance_vie' && (
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-1.5">
                  Frais de gestion annuels (%)
                </label>
                <input
                  type="number"
                  value={managementFee}
                  onChange={(e) => setManagementFee(e.target.value)}
                  placeholder="0.60"
                  min="0"
                  max="5"
                  step="0.01"
                  className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                />
              </div>
            )}

            {(envelopeType === 'pea' || envelopeType === 'pea_pme') && (
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-1.5">
                  Total versements cumulés (€)
                </label>
                <input
                  type="number"
                  value={totalDeposits}
                  onChange={(e) => setTotalDeposits(e.target.value)}
                  placeholder="50000"
                  min="0"
                  step="1"
                  className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                />
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-sm text-loss bg-loss/10 rounded-omni-sm p-3">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSyncing}>
              Créer le portefeuille
            </Button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

/* ── Main Page ──────────────────────────────────────────── */
export default function StocksPage() {
  const {
    summary, performance, dividends, allocation, envelopes,
    isLoading, isSyncing, error,
    fetchSummary, fetchPerformance, fetchDividends, fetchAllocation, fetchEnvelopes,
    refreshPrices, deletePortfolio,
  } = useStockStore()
  const [showCreatePortfolio, setShowCreatePortfolio] = useState(false)
  const [showAddPosition, setShowAddPosition] = useState(false)
  const [showCSVImport, setShowCSVImport] = useState(false)
  const [activePortfolioId, setActivePortfolioId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('portfolios')
  const [perfPeriod, setPerfPeriod] = useState('1Y')

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  // Fetch tab data when switching tabs
  useEffect(() => {
    if (activeTab === 'performance' && !performance) fetchPerformance(perfPeriod)
    if (activeTab === 'dividends' && !dividends) fetchDividends()
    if (activeTab === 'allocation' && !allocation) fetchAllocation()
    if (activeTab === 'envelopes' && !envelopes) fetchEnvelopes()
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalValue = summary?.total_value ?? 0
  const totalPnl = summary?.total_pnl ?? 0
  const totalPnlPct = summary?.total_pnl_pct ?? 0
  const totalDividends = summary?.total_dividends ?? 0
  const positions = summary?.positions ?? []
  const portfolios = summary?.portfolios ?? []

  const openAddPosition = (portfolioId: string) => {
    setActivePortfolioId(portfolioId)
    setShowAddPosition(true)
  }

  const openCSVImport = (portfolioId: string) => {
    setActivePortfolioId(portfolioId)
    setShowCSVImport(true)
  }

  const handlePeriodChange = (p: string) => {
    setPerfPeriod(p)
    fetchPerformance(p)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-border bg-background/80 px-5 backdrop-blur-lg">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-brand" />
          <h1 className="text-base font-bold text-foreground">Bourse</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => fetchSummary()} disabled={isLoading}>
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </Button>
          <Button size="sm" onClick={() => setShowCreatePortfolio(true)}>
            <Plus size={14} className="mr-1" />
            Portefeuille
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-3 sm:px-5 py-4">
        {error && (
          <div className="mb-4 flex items-center gap-2 text-sm text-loss bg-loss/10 rounded-omni-sm p-3">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Overview card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-omni-lg border border-border bg-surface p-5 mb-5"
        >
          <p className="text-sm text-foreground-secondary mb-1">Portefeuille Bourse</p>
          {isLoading ? (
            <Skeleton className="h-9 w-44" />
          ) : (
            <div className="flex items-baseline gap-3 flex-wrap">
              <h2 className="text-2xl font-bold text-foreground tabular-nums">
                {formatAmount(totalValue)}
              </h2>
              {totalPnl !== 0 && (
                <span className={`text-sm font-medium flex items-center gap-1 ${amountColorClass(totalPnl)}`}>
                  {totalPnl >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {totalPnl > 0 ? '+' : ''}{formatAmount(totalPnl)}
                  <span className="text-foreground-tertiary">
                    ({totalPnlPct > 0 ? '+' : ''}{totalPnlPct.toFixed(1)}%)
                  </span>
                </span>
              )}
            </div>
          )}
          <div className="mt-3 flex items-center gap-4 text-sm text-foreground-secondary">
            <span>{portfolios.length} portefeuille{portfolios.length !== 1 ? 's' : ''}</span>
            <span>·</span>
            <span>{positions.length} position{positions.length !== 1 ? 's' : ''}</span>
            {totalDividends > 0 && (
              <>
                <span>·</span>
                <span className="text-gain">Dividendes: {formatAmount(totalDividends)}</span>
              </>
            )}
          </div>
        </motion.div>

        {/* ── Tab Navigation ───────────────────────────────── */}
        <div className="flex gap-1 mb-5 overflow-x-auto pb-1 border-b border-border">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-omni-sm border-b-2 transition-colors whitespace-nowrap ${
                activeTab === key
                  ? 'border-brand text-brand font-medium'
                  : 'border-transparent text-foreground-tertiary hover:text-foreground-secondary'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ──────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'portfolios' && (
              <PortfoliosTab
                portfolios={portfolios}
                positions={positions}
                isLoading={isLoading}
                isSyncing={isSyncing}
                onAddPosition={openAddPosition}
                onCSVImport={openCSVImport}
                onRefresh={refreshPrices}
                onDelete={deletePortfolio}
                onCreatePortfolio={() => setShowCreatePortfolio(true)}
              />
            )}
            {activeTab === 'market' && (
              <MarketTabContent />
            )}
            {activeTab === 'performance' && (
              <PerformanceTab
                data={performance}
                isLoading={isSyncing}
                period={perfPeriod}
                onPeriodChange={handlePeriodChange}
              />
            )}
            {activeTab === 'dividends' && (
              <DividendsTab data={dividends} isLoading={isSyncing} />
            )}
            {activeTab === 'allocation' && (
              <AllocationTab data={allocation} isLoading={isSyncing} />
            )}
            {activeTab === 'envelopes' && (
              <EnvelopesTab data={envelopes} isLoading={isSyncing} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <CreatePortfolioModal
        isOpen={showCreatePortfolio}
        onClose={() => setShowCreatePortfolio(false)}
      />
      <AddPositionModal
        isOpen={showAddPosition}
        onClose={() => setShowAddPosition(false)}
        portfolioId={activePortfolioId}
      />
      <CSVImportModal
        isOpen={showCSVImport}
        onClose={() => setShowCSVImport(false)}
        portfolioId={activePortfolioId}
      />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Tab: Market — toggle between Explorer (table) and Terminal (chart)
   ══════════════════════════════════════════════════════════════ */
function MarketTabContent() {
  const [mode, setMode] = useState<'explorer' | 'terminal'>('explorer')

  return (
    <div>
      {/* Toggle bar */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setMode('explorer')}
          className={`px-3 py-1.5 rounded-omni-sm text-xs font-medium transition-colors ${
            mode === 'explorer'
              ? 'bg-brand text-white'
              : 'bg-surface-elevated text-foreground-secondary hover:text-foreground'
          }`}
        >
          <Globe size={12} className="inline mr-1.5 -mt-0.5" />
          Explorateur
        </button>
        <button
          onClick={() => setMode('terminal')}
          className={`px-3 py-1.5 rounded-omni-sm text-xs font-medium transition-colors ${
            mode === 'terminal'
              ? 'bg-brand text-white'
              : 'bg-surface-elevated text-foreground-secondary hover:text-foreground'
          }`}
        >
          <Activity size={12} className="inline mr-1.5 -mt-0.5" />
          Terminal Trading
        </button>
      </div>

      {mode === 'explorer' ? (
        <StockMarketExplorer />
      ) : (
        <div className="h-[700px] rounded-omni border border-border overflow-hidden">
          <StockTradingTerminal />
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Tab: Portfolios (original view)
   ══════════════════════════════════════════════════════════════ */
function PortfoliosTab({
  portfolios, positions, isLoading, isSyncing,
  onAddPosition, onCSVImport, onRefresh, onDelete, onCreatePortfolio,
}: any) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-omni-lg border border-border bg-surface p-5">
            <Skeleton className="h-5 w-40 mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-32 flex-1" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (portfolios.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 mx-auto">
          <BarChart3 size={32} className="text-brand" />
        </div>
        <h2 className="mt-5 text-lg font-bold text-foreground">
          Suivez vos investissements boursiers
        </h2>
        <p className="mt-2 text-sm text-foreground-secondary max-w-md mx-auto">
          Créez un portefeuille et ajoutez vos positions manuellement ou importez un fichier CSV
          depuis Degiro, Trade Republic ou Boursorama.
        </p>
        <Button onClick={onCreatePortfolio} className="mt-5">
          <Plus size={16} className="mr-2" />
          Créer un portefeuille
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {portfolios.map((portfolio: any) => {
        const portfolioPositions = positions.filter(
          (p: any) => p.portfolio_id === portfolio.id
        )
        return (
          <motion.div
            key={portfolio.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-omni-lg border border-border bg-surface overflow-hidden"
          >
            {/* Portfolio header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground">{portfolio.label}</h3>
                  {portfolio.envelope_type && portfolio.envelope_type !== 'cto' && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                      ENVELOPE_COLORS[portfolio.envelope_type] || ENVELOPE_COLORS.cto
                    }`}>
                      {portfolio.envelope_type.toUpperCase().replace('_', '-')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-foreground-tertiary">
                  {portfolio.broker} · {portfolio.positions_count} position{portfolio.positions_count !== 1 ? 's' : ''}
                  <span className="ml-2 font-medium text-foreground">
                    {formatAmount(portfolio.total_value)}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onAddPosition(portfolio.id)}
                  title="Ajouter une position"
                >
                  <Plus size={14} />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onCSVImport(portfolio.id)}
                  title="Importer CSV"
                >
                  <Upload size={14} />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onRefresh(portfolio.id)}
                  disabled={isSyncing}
                  title="Actualiser les prix"
                >
                  <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                </Button>
                <button
                  onClick={() => {
                    if (confirm(`Supprimer "${portfolio.label}" et toutes ses positions ?`))
                      onDelete(portfolio.id)
                  }}
                  className="p-1.5 text-foreground-tertiary hover:text-loss transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Positions table */}
            {portfolioPositions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs font-medium text-foreground-tertiary uppercase tracking-wider border-b border-border">
                      <th className="text-left py-2 px-4">Titre</th>
                      <th className="text-right py-2 px-4 hidden sm:table-cell">Qté</th>
                      <th className="text-right py-2 px-4 hidden md:table-cell">PRU</th>
                      <th className="text-right py-2 px-4 hidden md:table-cell">Cours</th>
                      <th className="text-right py-2 px-4">Valeur</th>
                      <th className="text-right py-2 px-4">P&L</th>
                      <th className="text-right py-2 px-4 hidden lg:table-cell">Alloc.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolioPositions.map((pos: any, i: number) => (
                      <motion.tr
                        key={pos.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="border-b border-border/50 hover:bg-surface-elevated/30 transition-colors"
                      >
                        <td className="py-2.5 px-4">
                          <p className="font-medium text-foreground">{pos.symbol}</p>
                          <p className="text-xs text-foreground-tertiary truncate max-w-[150px]">
                            {pos.name || pos.symbol}
                            {pos.country && <span className="ml-1 opacity-60">{pos.country}</span>}
                          </p>
                        </td>
                        <td className="text-right py-2.5 px-4 hidden sm:table-cell tabular-nums text-foreground">
                          {pos.quantity.toLocaleString('fr-FR', { maximumFractionDigits: 4 })}
                        </td>
                        <td className="text-right py-2.5 px-4 hidden md:table-cell tabular-nums text-foreground-secondary">
                          {pos.avg_buy_price ? formatAmount(pos.avg_buy_price) : '—'}
                        </td>
                        <td className="text-right py-2.5 px-4 hidden md:table-cell tabular-nums text-foreground">
                          {pos.current_price ? formatAmount(pos.current_price) : '—'}
                        </td>
                        <td className="text-right py-2.5 px-4 tabular-nums font-medium text-foreground">
                          {formatAmount(pos.value)}
                        </td>
                        <td className="text-right py-2.5 px-4">
                          <p className={`tabular-nums font-medium ${amountColorClass(pos.pnl)}`}>
                            {pos.pnl > 0 ? '+' : ''}{formatAmount(pos.pnl)}
                          </p>
                          <p className={`text-xs tabular-nums ${pos.pnl_pct >= 0 ? 'text-gain' : 'text-loss'}`}>
                            {pos.pnl_pct > 0 ? '+' : ''}{pos.pnl_pct.toFixed(1)}%
                          </p>
                        </td>
                        <td className="text-right py-2.5 px-4 hidden lg:table-cell text-foreground-tertiary tabular-nums">
                          {pos.allocation_pct.toFixed(1)}%
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-foreground-tertiary">
                Aucune position. Ajoutez-en manuellement ou importez un CSV.
              </div>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Tab: Performance vs Benchmark (B2.1)
   ══════════════════════════════════════════════════════════════ */
function PerformanceTab({ data, isLoading, period, onPeriodChange }: {
  data: any
  isLoading: boolean
  period: string
  onPeriodChange: (p: string) => void
}) {
  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const benchmarkEntries = Object.entries(data.benchmarks || {}) as [string, any][]

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="flex gap-1.5">
        {PERIOD_OPTIONS.map((p) => (
          <button
            key={p}
            onClick={() => onPeriodChange(p)}
            className={`px-3 py-1.5 text-xs rounded-omni-sm border transition-colors ${
              period === p
                ? 'border-brand bg-brand/10 text-brand font-medium'
                : 'border-border text-foreground-tertiary hover:text-foreground-secondary'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-omni-sm border border-border bg-surface p-3">
          <p className="text-xs text-foreground-tertiary mb-1">TWR Portefeuille</p>
          <p className={`text-lg font-bold tabular-nums ${data.portfolio_twr >= 0 ? 'text-gain' : 'text-loss'}`}>
            {data.portfolio_twr > 0 ? '+' : ''}{data.portfolio_twr.toFixed(2)}%
          </p>
        </div>
        {benchmarkEntries.slice(0, 2).map(([key, bm]: [string, any]) => (
          <div key={key} className="rounded-omni-sm border border-border bg-surface p-3">
            <p className="text-xs text-foreground-tertiary mb-1">{BENCHMARK_LABELS[key] || key}</p>
            <p className={`text-lg font-bold tabular-nums ${bm.twr >= 0 ? 'text-gain' : 'text-loss'}`}>
              {bm.twr > 0 ? '+' : ''}{bm.twr.toFixed(2)}%
            </p>
          </div>
        ))}
        <div className="rounded-omni-sm border border-border bg-surface p-3">
          <p className="text-xs text-foreground-tertiary mb-1">Alpha</p>
          <p className={`text-lg font-bold tabular-nums ${data.alpha >= 0 ? 'text-gain' : 'text-loss'}`}>
            {data.alpha > 0 ? '+' : ''}{data.alpha.toFixed(2)}%
          </p>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
            data.alpha >= 0 ? 'bg-gain/20 text-gain' : 'bg-loss/20 text-loss'
          }`}>
            {data.alpha >= 0 ? 'Surperformance' : 'Sous-performance'}
          </span>
        </div>
      </div>

      {/* Performance chart (simplified table-based visualization) */}
      <div className="rounded-omni-lg border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          <Activity size={14} className="inline mr-1.5" />
          Performance comparée (base 100)
        </h3>
        {data.portfolio_series?.length > 0 ? (
          <div className="overflow-x-auto">
            <div className="flex items-end gap-1 h-40">
              {data.portfolio_series.filter((_: any, i: number) => i % Math.max(1, Math.floor(data.portfolio_series.length / 50)) === 0).map((point: any, i: number) => {
                const height = Math.max(4, (point.value / 150) * 100)
                return (
                  <div key={i} className="flex-1 min-w-[3px] group relative">
                    <div
                      className={`w-full rounded-t transition-colors ${point.value >= 100 ? 'bg-brand' : 'bg-loss'}`}
                      style={{ height: `${Math.min(100, height)}%` }}
                    />
                    <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 bg-surface-elevated border border-border rounded px-2 py-1 text-[10px] whitespace-nowrap z-10">
                      {point.date}: {point.value.toFixed(1)}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between text-[10px] text-foreground-tertiary mt-1">
              <span>{data.portfolio_series[0]?.date}</span>
              <span>{data.portfolio_series[data.portfolio_series.length - 1]?.date}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-foreground-tertiary text-center py-8">
            Aucune donnée de performance disponible.
          </p>
        )}
      </div>

      {/* Benchmark comparison table */}
      <div className="rounded-omni-lg border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Comparaison détaillée</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs font-medium text-foreground-tertiary uppercase border-b border-border">
              <th className="text-left py-2">Indice</th>
              <th className="text-right py-2">TWR</th>
              <th className="text-right py-2">vs Portefeuille</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-2 font-medium text-brand">Mon Portefeuille</td>
              <td className="text-right tabular-nums">{data.portfolio_twr > 0 ? '+' : ''}{data.portfolio_twr.toFixed(2)}%</td>
              <td className="text-right">—</td>
            </tr>
            {benchmarkEntries.map(([key, bm]: [string, any]) => {
              const diff = data.portfolio_twr - bm.twr
              return (
                <tr key={key} className="border-b border-border/50">
                  <td className="py-2">
                    <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: BENCHMARK_COLORS[key] }}></span>
                    {BENCHMARK_LABELS[key] || key}
                  </td>
                  <td className="text-right tabular-nums">{bm.twr > 0 ? '+' : ''}{bm.twr.toFixed(2)}%</td>
                  <td className={`text-right tabular-nums font-medium ${diff >= 0 ? 'text-gain' : 'text-loss'}`}>
                    {diff > 0 ? '+' : ''}{diff.toFixed(2)}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Tab: Dividends Calendar (B2.2)
   ══════════════════════════════════════════════════════════════ */
function DividendsTab({ data, isLoading }: { data: any; isLoading: boolean }) {
  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  const maxMonthly = Math.max(...data.monthly_breakdown.map((m: any) => m.amount), 1)

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-omni-sm border border-border bg-surface p-3">
          <p className="text-xs text-foreground-tertiary mb-1">Dividendes annuels projetés</p>
          <p className="text-lg font-bold text-gain tabular-nums">{formatAmount(data.total_annual_projected)}</p>
        </div>
        <div className="rounded-omni-sm border border-border bg-surface p-3">
          <p className="text-xs text-foreground-tertiary mb-1">Rendement moyen</p>
          <p className="text-lg font-bold text-foreground tabular-nums">{data.portfolio_yield.toFixed(2)}%</p>
        </div>
        <div className="rounded-omni-sm border border-border bg-surface p-3">
          <p className="text-xs text-foreground-tertiary mb-1">Prochain versement</p>
          {data.upcoming?.[0] ? (
            <div>
              <p className="text-sm font-bold text-foreground">{data.upcoming[0].symbol}</p>
              <p className="text-xs text-foreground-tertiary">
                {new Date(data.upcoming[0].ex_date).toLocaleDateString('fr-FR')}
              </p>
            </div>
          ) : (
            <p className="text-sm text-foreground-tertiary">—</p>
          )}
        </div>
      </div>

      {/* Monthly bar chart */}
      <div className="rounded-omni-lg border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          <Calendar size={14} className="inline mr-1.5" />
          Calendrier mensuel {data.year}
        </h3>
        <div className="flex items-end gap-2 h-36">
          {data.monthly_breakdown.map((m: any) => {
            const pct = maxMonthly > 0 ? (m.amount / maxMonthly) * 100 : 0
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div
                  className={`w-full rounded-t transition-all ${m.amount > 0 ? 'bg-gain' : 'bg-border'}`}
                  style={{ height: `${Math.max(4, pct)}%` }}
                />
                <span className="text-[10px] text-foreground-tertiary">{MONTH_LABELS[m.month - 1]}</span>
                {m.amount > 0 && (
                  <div className="hidden group-hover:block absolute bottom-full mb-1 bg-surface-elevated border border-border rounded px-2 py-1 text-[10px] whitespace-nowrap z-10">
                    {formatAmount(m.amount)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* By position table */}
      <div className="rounded-omni-lg border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Dividendes par position</h3>
        {data.by_position?.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-medium text-foreground-tertiary uppercase border-b border-border">
                <th className="text-left py-2">Titre</th>
                <th className="text-right py-2">Montant annuel</th>
                <th className="text-right py-2 hidden sm:table-cell">Rendement</th>
                <th className="text-right py-2 hidden md:table-cell">Fréquence</th>
                <th className="text-right py-2 hidden lg:table-cell">Proch. ex-div</th>
              </tr>
            </thead>
            <tbody>
              {data.by_position.map((d: any) => (
                <tr key={d.symbol} className="border-b border-border/50">
                  <td className="py-2">
                    <p className="font-medium text-foreground">{d.symbol}</p>
                    <p className="text-xs text-foreground-tertiary truncate max-w-[120px]">{d.name}</p>
                  </td>
                  <td className="text-right tabular-nums font-medium text-gain">{formatAmount(d.annual_amount)}</td>
                  <td className="text-right tabular-nums hidden sm:table-cell">{d.yield_pct.toFixed(2)}%</td>
                  <td className="text-right hidden md:table-cell">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${FREQ_COLORS[d.frequency] || FREQ_COLORS.annual}`}>
                      {FREQ_LABELS[d.frequency] || d.frequency}
                    </span>
                  </td>
                  <td className="text-right text-foreground-tertiary hidden lg:table-cell">
                    {d.next_ex_date ? new Date(d.next_ex_date).toLocaleDateString('fr-FR') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-foreground-tertiary text-center py-6">Aucun dividende détecté.</p>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Tab: Allocation & Diversification (B2.3)
   ══════════════════════════════════════════════════════════════ */
function AllocationTab({ data, isLoading }: { data: any; isLoading: boolean }) {
  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  const gradeColorMap: Record<string, string> = {
    Excellent: 'text-gain',
    Bon: 'text-blue-400',
    Modéré: 'text-amber-400',
    Concentré: 'text-loss',
  }
  const gradeColor = gradeColorMap[data.diversification_grade as string] || 'text-foreground'

  return (
    <div className="space-y-5">
      {/* Diversification score card */}
      <div className="rounded-omni-lg border border-border bg-surface p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">
            <ShieldCheck size={14} className="inline mr-1.5" />
            Score de Diversification
          </h3>
          <span className={`text-lg font-bold ${gradeColor}`}>
            {data.diversification_grade}
          </span>
        </div>
        {/* Score bar */}
        <div className="w-full bg-border rounded-full h-3 mb-2">
          <div
            className={`h-3 rounded-full transition-all ${
              data.diversification_score >= 75 ? 'bg-gain' :
              data.diversification_score >= 50 ? 'bg-blue-400' :
              data.diversification_score >= 25 ? 'bg-amber-400' : 'bg-loss'
            }`}
            style={{ width: `${data.diversification_score}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-foreground-tertiary">
          <span>Concentré</span>
          <span className="font-medium">{data.diversification_score}/100 (HHI: {data.hhi_score})</span>
          <span>Diversifié</span>
        </div>
      </div>

      {/* Alerts */}
      {data.concentration_alerts?.length > 0 && (
        <div className="space-y-2">
          {data.concentration_alerts.map((alert: string, i: number) => (
            <div key={i} className="flex items-start gap-2 text-sm text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-omni-sm p-3">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              {alert}
            </div>
          ))}
        </div>
      )}

      {/* 3 allocation breakdowns side by side */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Sectors */}
        <div className="rounded-omni-lg border border-border bg-surface p-4">
          <h4 className="text-xs font-semibold text-foreground-tertiary uppercase mb-3">
            <Layers size={12} className="inline mr-1" />
            Secteurs
          </h4>
          <div className="space-y-2">
            {data.by_sector?.slice(0, 8).map((s: any) => (
              <div key={s.sector}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-foreground truncate max-w-[120px]">{s.sector}</span>
                  <span className="text-foreground-tertiary tabular-nums">{s.weight_pct}%</span>
                </div>
                <div className="w-full bg-border rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-brand" style={{ width: `${Math.min(100, s.weight_pct)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Countries */}
        <div className="rounded-omni-lg border border-border bg-surface p-4">
          <h4 className="text-xs font-semibold text-foreground-tertiary uppercase mb-3">
            <Globe size={12} className="inline mr-1" />
            Pays
          </h4>
          <div className="space-y-2">
            {data.by_country?.slice(0, 8).map((c: any) => (
              <div key={c.country}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-foreground">{c.country}</span>
                  <span className="text-foreground-tertiary tabular-nums">{c.weight_pct}%</span>
                </div>
                <div className="w-full bg-border rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-gain" style={{ width: `${Math.min(100, c.weight_pct)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Currencies */}
        <div className="rounded-omni-lg border border-border bg-surface p-4">
          <h4 className="text-xs font-semibold text-foreground-tertiary uppercase mb-3">
            Devises
          </h4>
          <div className="space-y-2">
            {data.by_currency?.slice(0, 6).map((c: any) => (
              <div key={c.currency}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-foreground">{c.currency}</span>
                  <span className="text-foreground-tertiary tabular-nums">{c.weight_pct}%</span>
                </div>
                <div className="w-full bg-border rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-amber-400" style={{ width: `${Math.min(100, c.weight_pct)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top positions */}
      <div className="rounded-omni-lg border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Top 5 positions</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs font-medium text-foreground-tertiary uppercase border-b border-border">
              <th className="text-left py-2">#</th>
              <th className="text-left py-2">Titre</th>
              <th className="text-right py-2">Poids</th>
            </tr>
          </thead>
          <tbody>
            {data.top_positions?.map((p: any, i: number) => (
              <tr key={p.symbol} className="border-b border-border/50">
                <td className="py-2 text-foreground-tertiary">{i + 1}</td>
                <td className="py-2">
                  <span className="font-medium text-foreground">{p.symbol}</span>
                  <span className="text-xs text-foreground-tertiary ml-2">{p.name}</span>
                </td>
                <td className="text-right tabular-nums font-medium">{p.weight_pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Suggestions */}
      {data.suggestions?.length > 0 && (
        <div className="rounded-omni-lg border border-brand/30 bg-brand/5 p-5">
          <h3 className="text-sm font-semibold text-brand mb-3">Suggestions de rééquilibrage</h3>
          <ul className="space-y-2">
            {data.suggestions.map((s: string, i: number) => (
              <li key={i} className="text-sm text-foreground-secondary flex items-start gap-2">
                <span className="text-brand mt-0.5">•</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Tab: Enveloppes Fiscales (B2.4)
   ══════════════════════════════════════════════════════════════ */
function EnvelopesTab({ data, isLoading }: { data: any; isLoading: boolean }) {
  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Envelope cards */}
      {data.envelopes?.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-4">
          {data.envelopes.map((env: any) => (
            <div
              key={env.type}
              className={`rounded-omni-lg border p-5 ${ENVELOPE_COLORS[env.type] || ENVELOPE_COLORS.cto}`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{env.label}</h3>
                <span className="text-xs opacity-70">
                  Flat tax: {env.tax_rate}%
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="text-xs opacity-70">Valeur totale</p>
                  <p className="text-lg font-bold tabular-nums">{formatAmount(env.total_value)}</p>
                </div>
                <div>
                  <p className="text-xs opacity-70">Plus-value</p>
                  <p className={`text-lg font-bold tabular-nums ${env.total_pnl >= 0 ? '' : 'text-loss'}`}>
                    {env.total_pnl > 0 ? '+' : ''}{formatAmount(env.total_pnl)}
                  </p>
                </div>
              </div>

              <p className="text-xs opacity-70">
                {env.positions_count} position{env.positions_count !== 1 ? 's' : ''}
                {env.portfolios?.length > 0 && ` · ${env.portfolios.join(', ')}`}
              </p>

              {/* PEA ceiling bar */}
              {env.ceiling !== null && env.ceiling_usage_pct !== null && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Plafond versements</span>
                    <span className="tabular-nums font-medium">{env.ceiling_usage_pct.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-black/10 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        env.ceiling_usage_pct >= 90 ? 'bg-loss' :
                        env.ceiling_usage_pct >= 70 ? 'bg-amber-400' : 'bg-gain'
                      }`}
                      style={{ width: `${Math.min(100, env.ceiling_usage_pct)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] opacity-60 mt-0.5">
                    <span>{formatAmount(env.total_deposits)}</span>
                    <span>{formatAmount(env.ceiling)}</span>
                  </div>
                </div>
              )}

              {/* AV management fees */}
              {env.management_fee_annual !== null && env.management_fee_annual > 0 && (
                <div className="mt-3 text-xs opacity-80">
                  Frais de gestion annuels estimés : <span className="font-medium">{formatAmount(env.management_fee_annual)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-sm text-foreground-tertiary">
          <Landmark size={32} className="mx-auto mb-3 opacity-50" />
          <p>Aucune enveloppe configurée.</p>
          <p className="text-xs mt-1">Créez un portefeuille et sélectionnez une enveloppe fiscale (PEA, CTO, AV...).</p>
        </div>
      )}

      {/* Fiscal optimization tips */}
      {data.fiscal_optimization_tips?.length > 0 && (
        <div className="rounded-omni-lg border border-gain/30 bg-gain/5 p-5">
          <h3 className="text-sm font-semibold text-gain mb-3">
            <ShieldCheck size={14} className="inline mr-1.5" />
            Optimisation fiscale
          </h3>
          <ul className="space-y-3">
            {data.fiscal_optimization_tips.map((tip: string, i: number) => (
              <li key={i} className="text-sm text-foreground-secondary">{tip}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
