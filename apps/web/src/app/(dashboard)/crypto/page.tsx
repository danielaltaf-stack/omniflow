'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bitcoin, Plus, RefreshCw, Trash2, X,
  TrendingUp, TrendingDown, Wallet, AlertCircle, Search,
  FileText, Download, Coins, Receipt, ArrowDownUp,
  Layers, Zap, CircleDollarSign, Shield, Globe, Activity,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCryptoStore } from '@/stores/crypto-store'
import { formatAmount, amountColorClass } from '@/lib/format'
import dynamic from 'next/dynamic'

const CryptoMarketExplorer = dynamic(
  () => import('@/components/market/crypto-market-explorer'),
  { ssr: false, loading: () => <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> }
)

const CryptoTradingTerminal = dynamic(
  () => import('@/components/market/crypto-trading-terminal'),
  { ssr: false, loading: () => <div className="h-[600px] flex items-center justify-center"><Skeleton className="h-full w-full" /></div> }
)

type Tab = 'portfolio' | 'market' | 'tax' | 'staking'

const PLATFORMS = [
  { id: 'binance', label: 'Binance' },
  { id: 'kraken', label: 'Kraken' },
  { id: 'etherscan', label: 'On-chain (ETH)' },
  { id: 'polygon', label: 'Polygon' },
  { id: 'arbitrum', label: 'Arbitrum' },
  { id: 'optimism', label: 'Optimism' },
  { id: 'bsc', label: 'BSC (BNB)' },
  { id: 'manual', label: 'Manuel' },
]

const CHAIN_PLATFORMS = new Set(['etherscan', 'polygon', 'arbitrum', 'optimism', 'bsc'])

const TX_TYPES = [
  { id: 'buy', label: 'Achat' },
  { id: 'sell', label: 'Vente' },
  { id: 'swap', label: 'Swap' },
  { id: 'transfer_in', label: 'Transfert entrant' },
  { id: 'transfer_out', label: 'Transfert sortant' },
  { id: 'staking_reward', label: 'Récompense staking' },
  { id: 'airdrop', label: 'Airdrop' },
]

/* ── Add Wallet Modal ───────────────────────────────────── */
function AddWalletModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const { createWallet, isSyncing } = useCryptoStore()
  const [platform, setPlatform] = useState<string>('binance')
  const [label, setLabel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState<string | null>(null)

  const needsKeys = platform === 'binance' || platform === 'kraken'
  const needsAddress = CHAIN_PLATFORMS.has(platform)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await createWallet({
        platform,
        label: label || `Mon ${platform}`,
        ...(needsKeys ? { api_key: apiKey, api_secret: apiSecret } : {}),
        ...(needsAddress ? { address, chain: platform === 'etherscan' ? 'ethereum' : platform } : {}),
      })
      setLabel('')
      setApiKey('')
      setApiSecret('')
      setAddress('')
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
            <h3 className="text-lg font-bold text-foreground">Ajouter un wallet</h3>
            <button onClick={onClose} className="text-foreground-tertiary hover:text-foreground">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Platform */}
            <div>
              <label className="block text-sm font-medium text-foreground-secondary mb-1.5">
                Plateforme
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlatform(p.id)}
                    className={`py-2 px-3 rounded-omni-sm text-sm border transition-colors ${
                      platform === p.id
                        ? 'border-brand bg-brand/10 text-brand font-medium'
                        : 'border-border text-foreground-secondary hover:border-foreground-tertiary'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Label */}
            <div>
              <label className="block text-sm font-medium text-foreground-secondary mb-1.5">
                Nom (optionnel)
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={`Mon ${platform}`}
                className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none"
              />
            </div>

            {/* API Keys (Binance/Kraken) */}
            {needsKeys && (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground-secondary mb-1.5">
                    Clé API (lecture seule)
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Votre clé API..."
                    required
                    className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-secondary mb-1.5">
                    Secret API
                  </label>
                  <input
                    type="password"
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                    placeholder="Votre secret..."
                    required
                    className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                  />
                </div>
                <p className="text-xs text-foreground-tertiary">
                  ⚠️ Utilisez une clé API <strong>lecture seule</strong>. Vos clés sont chiffrées AES-256 côté serveur.
                </p>
              </>
            )}

            {/* Address (on-chain wallets) */}
            {needsAddress && (
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-1.5">
                  Adresse publique (0x...)
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="0x..."
                  required
                  pattern="^0x[a-fA-F0-9]{40}$"
                  className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm font-mono focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                />
                <p className="text-xs text-foreground-tertiary mt-1">
                  {platform === 'etherscan' ? 'Ethereum Mainnet' :
                   platform === 'polygon' ? 'Polygon / Matic' :
                   platform === 'arbitrum' ? 'Arbitrum One' :
                   platform === 'optimism' ? 'Optimism Mainnet' :
                   platform === 'bsc' ? 'BNB Smart Chain' : ''}
                </p>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-sm text-loss bg-loss/10 rounded-omni-sm p-3">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSyncing}>
              {isSyncing ? (
                <>
                  <RefreshCw size={16} className="animate-spin mr-2" />
                  Connexion...
                </>
              ) : (
                'Connecter le wallet'
              )}
            </Button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

/* ── Add Transaction Modal ──────────────────────────────── */
function AddTransactionModal({
  isOpen,
  onClose,
  wallets,
}: {
  isOpen: boolean
  onClose: () => void
  wallets: { id: string; label: string }[]
}) {
  const { addTransaction, isSyncing } = useCryptoStore()
  const [walletId, setWalletId] = useState(wallets[0]?.id || '')
  const [txType, setTxType] = useState('buy')
  const [tokenSymbol, setTokenSymbol] = useState('')
  const [quantity, setQuantity] = useState('')
  const [priceEur, setPriceEur] = useState('')
  const [feeEur, setFeeEur] = useState('')
  const [counterpart, setCounterpart] = useState('')
  const [txHash, setTxHash] = useState('')
  const [executedAt, setExecutedAt] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await addTransaction({
        wallet_id: walletId,
        tx_type: txType,
        token_symbol: tokenSymbol.toUpperCase(),
        quantity: parseFloat(quantity),
        price_eur: Math.round(parseFloat(priceEur) * 100),
        fee_eur: feeEur ? Math.round(parseFloat(feeEur) * 100) : 0,
        counterpart: counterpart || undefined,
        tx_hash: txHash || undefined,
        executed_at: new Date(executedAt).toISOString(),
      })
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
          className="w-full max-w-lg mx-4 bg-surface rounded-omni-lg border border-border p-6 max-h-[90vh] overflow-y-auto"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-foreground">Ajouter une transaction</h3>
            <button onClick={onClose} className="text-foreground-tertiary hover:text-foreground">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-1.5">Wallet</label>
                <select
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm"
                >
                  {wallets.map(w => (
                    <option key={w.id} value={w.id}>{w.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-1.5">Type</label>
                <select
                  value={txType}
                  onChange={(e) => setTxType(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm"
                >
                  {TX_TYPES.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-1.5">Token</label>
                <input
                  type="text"
                  value={tokenSymbol}
                  onChange={(e) => setTokenSymbol(e.target.value)}
                  placeholder="BTC, ETH..."
                  required
                  className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-1.5">Quantité</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  step="any"
                  min="0"
                  required
                  className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-1.5">Prix unitaire (€)</label>
                <input
                  type="number"
                  value={priceEur}
                  onChange={(e) => setPriceEur(e.target.value)}
                  step="0.01"
                  min="0"
                  required
                  className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-1.5">Frais (€)</label>
                <input
                  type="number"
                  value={feeEur}
                  onChange={(e) => setFeeEur(e.target.value)}
                  step="0.01"
                  min="0"
                  placeholder="0"
                  className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground-secondary mb-1.5">Date d'exécution</label>
              <input
                type="datetime-local"
                value={executedAt}
                onChange={(e) => setExecutedAt(e.target.value)}
                required
                className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm"
              />
            </div>

            {txType === 'swap' && (
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-1.5">Token échangé (swap)</label>
                <input
                  type="text"
                  value={counterpart}
                  onChange={(e) => setCounterpart(e.target.value)}
                  placeholder="USDT, ETH..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground-secondary mb-1.5">Hash de transaction (optionnel)</label>
              <input
                type="text"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm font-mono text-xs"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-loss bg-loss/10 rounded-omni-sm p-3">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSyncing}>
              {isSyncing ? (
                <>
                  <RefreshCw size={16} className="animate-spin mr-2" />
                  Enregistrement...
                </>
              ) : (
                'Ajouter la transaction'
              )}
            </Button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

/* ── Token Row ──────────────────────────────────────────── */
function TokenRow({
  holding,
  index,
}: {
  holding: {
    token_symbol: string
    token_name: string
    quantity: number
    current_price: number
    value: number
    pnl: number
    pnl_pct: number
    change_24h: number
    allocation_pct: number
    is_staked?: boolean
    staking_apy?: number
  }
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex items-center gap-4 py-3 px-4 hover:bg-surface-elevated/50 rounded-omni-sm transition-colors"
    >
      {/* Token icon placeholder */}
      <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center text-xs font-bold text-brand shrink-0 relative">
        {holding.token_symbol.slice(0, 2)}
        {holding.is_staked && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-warning rounded-full flex items-center justify-center">
            <Zap size={7} className="text-white" />
          </div>
        )}
      </div>

      {/* Name & symbol */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-foreground truncate">{holding.token_name}</p>
          {holding.is_staked && (
            <span className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded-full font-medium">
              {holding.staking_apy ? `${(holding.staking_apy * 100).toFixed(1)}% APY` : 'Staked'}
            </span>
          )}
        </div>
        <p className="text-xs text-foreground-tertiary">{holding.token_symbol}</p>
      </div>

      {/* Quantity */}
      <div className="text-right hidden sm:block">
        <p className="text-sm text-foreground tabular-nums">
          {holding.quantity < 0.0001
            ? holding.quantity.toExponential(2)
            : holding.quantity.toLocaleString('fr-FR', { maximumFractionDigits: 6 })}
        </p>
        <p className="text-xs text-foreground-tertiary">
          {formatAmount(holding.current_price)} / unité
        </p>
      </div>

      {/* Value */}
      <div className="text-right min-w-[90px]">
        <p className="text-sm font-semibold text-foreground tabular-nums">
          {formatAmount(holding.value)}
        </p>
        <p className="text-xs text-foreground-tertiary">
          {holding.allocation_pct.toFixed(1)}%
        </p>
      </div>

      {/* P&L */}
      <div className="text-right min-w-[80px] hidden md:block">
        <p className={`text-sm font-medium tabular-nums ${amountColorClass(holding.pnl)}`}>
          {holding.pnl > 0 ? '+' : ''}{formatAmount(holding.pnl)}
        </p>
        <p className={`text-xs tabular-nums ${holding.pnl_pct >= 0 ? 'text-gain' : 'text-loss'}`}>
          {holding.pnl_pct > 0 ? '+' : ''}{holding.pnl_pct.toFixed(1)}%
        </p>
      </div>

      {/* 24h change */}
      <div className="text-right min-w-[60px]">
        <div className={`flex items-center justify-end gap-0.5 text-sm ${holding.change_24h >= 0 ? 'text-gain' : 'text-loss'}`}>
          {holding.change_24h >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <span className="tabular-nums text-xs font-medium">
            {holding.change_24h > 0 ? '+' : ''}{holding.change_24h.toFixed(1)}%
          </span>
        </div>
      </div>
    </motion.div>
  )
}

/* ── Crypto Market Tab Content (toggle Explorer / Terminal) ── */
function CryptoMarketTabContent() {
  const [mode, setMode] = useState<'explorer' | 'terminal'>('explorer')

  return (
    <div>
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
        <CryptoMarketExplorer />
      ) : (
        <div className="h-[700px] rounded-omni border border-border overflow-hidden">
          <CryptoTradingTerminal />
        </div>
      )}
    </div>
  )
}

/* ── Tax Panel ──────────────────────────────────────────── */
function TaxPanel() {
  const {
    taxSummary, transactions, isLoading, fetchTaxSummary,
    fetchTransactions, exportCerfa,
  } = useCryptoStore()
  const [year, setYear] = useState(new Date().getFullYear())

  useEffect(() => {
    fetchTaxSummary(year)
    fetchTransactions()
  }, [year, fetchTaxSummary, fetchTransactions])

  return (
    <div className="space-y-5">
      {/* Year selector + Export */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText size={18} className="text-brand" />
          <h3 className="text-base font-bold text-foreground">Fiscalité Crypto</h3>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="px-3 py-1.5 bg-background border border-border rounded-omni-sm text-sm text-foreground"
          >
            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <Button variant="secondary" size="sm" onClick={() => exportCerfa(year)}>
          <Download size={14} className="mr-1" />
          Cerfa 2086
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : taxSummary ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-omni-lg border border-border bg-surface p-4">
              <p className="text-xs text-foreground-tertiary mb-1">Plus-values réalisées</p>
              <p className={`text-lg font-bold tabular-nums ${taxSummary.realized_pv > 0 ? 'text-gain' : 'text-foreground'}`}>
                {formatAmount(taxSummary.realized_pv)}
              </p>
            </div>
            <div className="rounded-omni-lg border border-border bg-surface p-4">
              <p className="text-xs text-foreground-tertiary mb-1">Moins-values réalisées</p>
              <p className={`text-lg font-bold tabular-nums ${taxSummary.realized_mv < 0 ? 'text-loss' : 'text-foreground'}`}>
                {formatAmount(taxSummary.realized_mv)}
              </p>
            </div>
            <div className="rounded-omni-lg border border-border bg-surface p-4">
              <p className="text-xs text-foreground-tertiary mb-1">PV nette imposable</p>
              <p className={`text-lg font-bold tabular-nums ${amountColorClass(taxSummary.taxable_pv)}`}>
                {formatAmount(taxSummary.taxable_pv)}
              </p>
              {!taxSummary.seuil_305_atteint && (
                <p className="text-[10px] text-gain mt-0.5">Sous le seuil de 305 €</p>
              )}
            </div>
            <div className="rounded-omni-lg border border-border bg-surface p-4">
              <p className="text-xs text-foreground-tertiary mb-1">Flat Tax 30%</p>
              <p className="text-lg font-bold tabular-nums text-foreground">
                {formatAmount(taxSummary.flat_tax_30)}
              </p>
            </div>
          </div>

          {/* Plus-values latentes */}
          <div className="rounded-omni-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-foreground-secondary">Plus-values latentes (non-réalisées)</p>
              <p className={`text-base font-bold tabular-nums ${amountColorClass(taxSummary.unrealized_total)}`}>
                {taxSummary.unrealized_total > 0 ? '+' : ''}{formatAmount(taxSummary.unrealized_total)}
              </p>
            </div>
            <p className="text-xs text-foreground-tertiary">
              Estimation de la plus-value si vous vendiez tous vos crypto-actifs au cours actuel.
            </p>
          </div>

          {/* Disposals table */}
          {taxSummary.disposals.length > 0 && (
            <div className="rounded-omni-lg border border-border bg-surface overflow-hidden">
              <div className="p-4 border-b border-border">
                <h4 className="text-sm font-semibold text-foreground">
                  Détail des cessions ({taxSummary.disposals_count})
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-foreground-tertiary">
                      <th className="text-left py-2 px-4">Date</th>
                      <th className="text-left py-2 px-4">Token</th>
                      <th className="text-right py-2 px-4">Qty</th>
                      <th className="text-right py-2 px-4">Prix cession</th>
                      <th className="text-right py-2 px-4">PMPA</th>
                      <th className="text-right py-2 px-4">+/- value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taxSummary.disposals.map((d, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-surface-elevated/30">
                        <td className="py-2 px-4 tabular-nums">{d.date}</td>
                        <td className="py-2 px-4 font-medium">{d.token}</td>
                        <td className="py-2 px-4 text-right tabular-nums">{d.quantity.toLocaleString('fr-FR', { maximumFractionDigits: 6 })}</td>
                        <td className="py-2 px-4 text-right tabular-nums">{formatAmount(d.prix_cession)}</td>
                        <td className="py-2 px-4 text-right tabular-nums">{formatAmount(d.prix_acquisition_pmpa)}</td>
                        <td className={`py-2 px-4 text-right tabular-nums font-medium ${amountColorClass(d.plus_ou_moins_value)}`}>
                          {d.plus_ou_moins_value > 0 ? '+' : ''}{formatAmount(d.plus_ou_moins_value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Transactions list */}
          {transactions && transactions.transactions.length > 0 && (
            <div className="rounded-omni-lg border border-border bg-surface overflow-hidden">
              <div className="p-4 border-b border-border">
                <h4 className="text-sm font-semibold text-foreground">
                  Transactions ({transactions.total})
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-foreground-tertiary">
                      <th className="text-left py-2 px-4">Date</th>
                      <th className="text-left py-2 px-4">Type</th>
                      <th className="text-left py-2 px-4">Token</th>
                      <th className="text-right py-2 px-4">Qty</th>
                      <th className="text-right py-2 px-4">Prix</th>
                      <th className="text-right py-2 px-4">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.transactions.slice(0, 20).map((tx) => (
                      <tr key={tx.id} className="border-b border-border/50 hover:bg-surface-elevated/30">
                        <td className="py-2 px-4 tabular-nums text-xs">
                          {new Date(tx.executed_at).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="py-2 px-4">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                            tx.tx_type === 'buy' ? 'bg-gain/10 text-gain' :
                            tx.tx_type === 'sell' ? 'bg-loss/10 text-loss' :
                            tx.tx_type === 'staking_reward' ? 'bg-warning/10 text-warning' :
                            'bg-brand/10 text-brand'
                          }`}>
                            {TX_TYPES.find(t => t.id === tx.tx_type)?.label ?? tx.tx_type}
                          </span>
                        </td>
                        <td className="py-2 px-4 font-medium">{tx.token_symbol}</td>
                        <td className="py-2 px-4 text-right tabular-nums">{tx.quantity.toLocaleString('fr-FR', { maximumFractionDigits: 6 })}</td>
                        <td className="py-2 px-4 text-right tabular-nums">{formatAmount(tx.price_eur)}</td>
                        <td className="py-2 px-4 text-right tabular-nums font-medium">{formatAmount(tx.total_eur)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <Receipt size={32} className="mx-auto text-foreground-tertiary mb-3" />
          <p className="text-foreground-secondary text-sm">
            Ajoutez des transactions pour calculer vos plus-values
          </p>
        </div>
      )}
    </div>
  )
}

/* ── Staking Panel ──────────────────────────────────────── */
function StakingPanel() {
  const { stakingSummary, isLoading, fetchStakingSummary } = useCryptoStore()

  useEffect(() => {
    fetchStakingSummary()
  }, [fetchStakingSummary])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Coins size={18} className="text-warning" />
        <h3 className="text-base font-bold text-foreground">Staking & DeFi</h3>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : stakingSummary ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-omni-lg border border-border bg-surface p-4">
              <p className="text-xs text-foreground-tertiary mb-1">Total en staking</p>
              <p className="text-lg font-bold tabular-nums text-foreground">
                {formatAmount(stakingSummary.total_staked_value)}
              </p>
            </div>
            <div className="rounded-omni-lg border border-border bg-surface p-4">
              <p className="text-xs text-foreground-tertiary mb-1">Récompenses projetées (12 mois)</p>
              <p className="text-lg font-bold tabular-nums text-gain">
                +{formatAmount(stakingSummary.projected_annual_rewards)}
              </p>
            </div>
          </div>

          {/* Staking positions */}
          {stakingSummary.positions.length > 0 ? (
            <div className="rounded-omni-lg border border-border bg-surface overflow-hidden">
              <div className="p-4 border-b border-border">
                <h4 className="text-sm font-semibold text-foreground">
                  Positions en staking ({stakingSummary.positions.length})
                </h4>
              </div>
              {stakingSummary.positions.map((pos, i) => (
                <div
                  key={`${pos.token_symbol}-${i}`}
                  className="flex items-center gap-4 py-3 px-4 border-b border-border/50 last:border-0"
                >
                  <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center text-xs font-bold text-warning shrink-0">
                    <Zap size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{pos.token_name}</p>
                    <p className="text-xs text-foreground-tertiary">
                      {pos.token_symbol} · {pos.source}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-foreground tabular-nums">
                      {pos.quantity.toLocaleString('fr-FR', { maximumFractionDigits: 6 })}
                    </p>
                    <p className="text-xs text-foreground-tertiary">{formatAmount(pos.value)}</p>
                  </div>
                  <div className="text-right min-w-[80px]">
                    <p className="text-sm font-medium text-warning tabular-nums">
                      {(pos.apy * 100).toFixed(1)}% APY
                    </p>
                    <p className="text-xs text-gain tabular-nums">
                      +{formatAmount(pos.projected_annual_reward)}/an
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Coins size={32} className="mx-auto text-foreground-tertiary mb-3" />
              <p className="text-foreground-secondary text-sm">
                Aucune position en staking détectée
              </p>
              <p className="text-foreground-tertiary text-xs mt-1">
                Le staking est détecté automatiquement via Binance Earn et Kraken Staking.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <Coins size={32} className="mx-auto text-foreground-tertiary mb-3" />
          <p className="text-foreground-secondary text-sm">
            Connectez un wallet avec du staking pour voir vos positions
          </p>
        </div>
      )}
    </div>
  )
}

/* ── Main Page ──────────────────────────────────────────── */
export default function CryptoPage() {
  const { portfolio, isLoading, isSyncing, error, fetchPortfolio, syncWallet, deleteWallet } =
    useCryptoStore()
  const [showAddWallet, setShowAddWallet] = useState(false)
  const [showAddTx, setShowAddTx] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('portfolio')

  useEffect(() => {
    fetchPortfolio()
  }, [fetchPortfolio])

  const totalValue = portfolio?.total_value ?? 0
  const change24h = portfolio?.change_24h ?? 0
  const holdings = portfolio?.holdings ?? []
  const wallets = portfolio?.wallets ?? []

  const tabs: { id: Tab; label: string; icon: typeof Bitcoin }[] = [
    { id: 'portfolio', label: 'Portefeuille', icon: Wallet },
    { id: 'market', label: 'Marché', icon: Globe },
    { id: 'tax', label: 'Fiscalité', icon: FileText },
    { id: 'staking', label: 'Staking', icon: Coins },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-border bg-background/80 px-5 backdrop-blur-lg">
        <div className="flex items-center gap-2">
          <Bitcoin size={18} className="text-brand" />
          <h1 className="text-base font-bold text-foreground">Crypto</h1>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'tax' && wallets.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => setShowAddTx(true)}>
              <Receipt size={14} className="mr-1" />
              Transaction
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => fetchPortfolio()} disabled={isLoading}>
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </Button>
          <Button size="sm" onClick={() => setShowAddWallet(true)}>
            <Plus size={14} className="mr-1" />
            Wallet
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-3 sm:px-5 py-4">
        {/* Error */}
        {error && (
          <div className="mb-4 flex items-center gap-2 text-sm text-loss bg-loss/10 rounded-omni-sm p-3">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Portfolio overview card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-omni-lg border border-border bg-surface p-5 mb-5"
        >
          <p className="text-sm text-foreground-secondary mb-1">Portefeuille Crypto</p>
          {isLoading ? (
            <Skeleton className="h-9 w-44" />
          ) : (
            <div className="flex items-baseline gap-3">
              <h2 className="text-2xl font-bold text-foreground tabular-nums">
                {formatAmount(totalValue)}
              </h2>
              {change24h !== 0 && (
                <span className={`text-sm font-medium flex items-center gap-1 ${change24h >= 0 ? 'text-gain' : 'text-loss'}`}>
                  {change24h >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {change24h > 0 ? '+' : ''}{change24h.toFixed(1)}% (24h)
                </span>
              )}
            </div>
          )}
          <div className="mt-3 flex items-center gap-3 text-sm text-foreground-secondary">
            <Wallet size={14} />
            <span>{wallets.length} wallet{wallets.length !== 1 ? 's' : ''}</span>
            <span>·</span>
            <span>{holdings.length} token{holdings.length !== 1 ? 's' : ''}</span>
            {wallets.some(w => w.chain !== 'ethereum') && (
              <>
                <span>·</span>
                <Layers size={14} />
                <span>{new Set(wallets.map(w => w.chain)).size} chaîne{new Set(wallets.map(w => w.chain)).size !== 1 ? 's' : ''}</span>
              </>
            )}
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-5 bg-surface border border-border rounded-omni-sm p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-omni-sm text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-brand/10 text-brand'
                  : 'text-foreground-tertiary hover:text-foreground-secondary'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'portfolio' && (
          <>
            {/* Wallets list */}
            {wallets.length > 0 && (
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-foreground-secondary mb-3">Wallets connectés</h3>
                <div className="flex flex-wrap gap-2">
                  {wallets.map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center gap-2 bg-surface border border-border rounded-omni-sm px-3 py-2 text-sm"
                    >
                      <span className={`w-2 h-2 rounded-full ${
                        w.status === 'active' ? 'bg-gain' : w.status === 'error' ? 'bg-loss' : 'bg-warning'
                      }`} />
                      <span className="text-foreground font-medium">{w.label}</span>
                      <span className="text-foreground-tertiary text-xs">{w.platform}</span>
                      {w.chain !== 'ethereum' && (
                        <span className="text-[10px] bg-brand/10 text-brand px-1.5 py-0.5 rounded-full font-medium">
                          {w.chain}
                        </span>
                      )}
                      <span className="text-foreground-tertiary text-xs">·</span>
                      <span className="text-foreground tabular-nums text-xs">
                        {formatAmount(w.total_value)}
                      </span>
                      <button
                        onClick={() => syncWallet(w.id)}
                        disabled={isSyncing}
                        className="ml-1 text-foreground-tertiary hover:text-brand transition-colors"
                        title="Synchroniser"
                      >
                        <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Supprimer le wallet "${w.label}" ?`)) deleteWallet(w.id)
                        }}
                        className="text-foreground-tertiary hover:text-loss transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Token list */}
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4 py-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-14" />
                    </div>
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : holdings.length > 0 ? (
              <div className="rounded-omni-lg border border-border bg-surface overflow-hidden">
                {/* Table header */}
                <div className="flex items-center gap-4 py-2 px-4 border-b border-border text-xs font-medium text-foreground-tertiary uppercase tracking-wider">
                  <div className="w-8" />
                  <div className="flex-1">Token</div>
                  <div className="text-right hidden sm:block min-w-[100px]">Quantité</div>
                  <div className="text-right min-w-[90px]">Valeur</div>
                  <div className="text-right hidden md:block min-w-[80px]">P&L</div>
                  <div className="text-right min-w-[60px]">24h</div>
                </div>
                {holdings.map((h, i) => (
                  <TokenRow key={`${h.token_symbol}-${h.wallet_id}`} holding={h} index={i} />
                ))}
              </div>
            ) : wallets.length > 0 ? (
              <div className="text-center py-12">
                <RefreshCw size={32} className="mx-auto text-foreground-tertiary mb-3" />
                <p className="text-foreground-secondary text-sm">
                  Synchronisez vos wallets pour voir vos holdings
                </p>
              </div>
            ) : (
              /* Empty state */
              <div className="text-center py-16">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 mx-auto">
                  <Bitcoin size={32} className="text-brand" />
                </div>
                <h2 className="mt-5 text-lg font-bold text-foreground">
                  Suivez vos crypto-actifs
                </h2>
                <p className="mt-2 text-sm text-foreground-secondary max-w-md mx-auto">
                  Connectez Binance, Kraken ou une adresse on-chain (Ethereum, Polygon, Arbitrum, Optimism, BSC)
                  pour agréger tous vos crypto-actifs avec les prix en temps réel.
                </p>
                <Button onClick={() => setShowAddWallet(true)} className="mt-5">
                  <Plus size={16} className="mr-2" />
                  Connecter un wallet
                </Button>
              </div>
            )}
          </>
        )}

        {activeTab === 'market' && <CryptoMarketTabContent />}
        {activeTab === 'tax' && <TaxPanel />}
        {activeTab === 'staking' && <StakingPanel />}
      </main>

      <AddWalletModal isOpen={showAddWallet} onClose={() => setShowAddWallet(false)} />
      <AddTransactionModal
        isOpen={showAddTx}
        onClose={() => setShowAddTx(false)}
        wallets={wallets.map(w => ({ id: w.id, label: w.label }))}
      />
    </div>
  )
}
