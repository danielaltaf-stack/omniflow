'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  Plus,
  Trash2,
  Pencil,
  History,
  Lightbulb,
  X,
  Check,
  Pause,
  Play,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Home,
  Activity,
  Zap,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react'
import { useAlertStore } from '@/stores/alert-store'
import type {
  UserAlert,
  AlertCreateRequest,
  AlertAssetType,
  AlertCondition,
  AlertHistoryEntry,
  AlertSuggestion,
} from '@/types/api'

/* ── Helpers ─────────────────────────────────────────── */

const ASSET_TYPE_LABELS: Record<AlertAssetType, string> = {
  stock: 'Actions',
  crypto: 'Crypto',
  realestate: 'Immobilier',
  index: 'Indices',
}

const ASSET_TYPE_ICONS: Record<AlertAssetType, React.ElementType> = {
  stock: BarChart3,
  crypto: Activity,
  realestate: Home,
  index: TrendingUp,
}

const ASSET_TYPE_COLORS: Record<AlertAssetType, string> = {
  stock: 'text-blue-400 bg-blue-400/10',
  crypto: 'text-amber-400 bg-amber-400/10',
  realestate: 'text-emerald-400 bg-emerald-400/10',
  index: 'text-purple-400 bg-purple-400/10',
}

const CONDITION_LABELS: Record<AlertCondition, string> = {
  price_above: 'Prix au-dessus de',
  price_below: 'Prix en dessous de',
  pct_change_24h_above: 'Hausse 24h supérieure à',
  pct_change_24h_below: 'Baisse 24h supérieure à',
  volume_spike: 'Volume supérieur à',
}

const CONDITION_ICONS: Record<AlertCondition, React.ElementType> = {
  price_above: TrendingUp,
  price_below: TrendingDown,
  pct_change_24h_above: TrendingUp,
  pct_change_24h_below: TrendingDown,
  volume_spike: BarChart3,
}

function formatThreshold(condition: AlertCondition, threshold: number): string {
  if (condition.includes('pct_change')) return `${threshold}%`
  if (condition === 'volume_spike') return `${threshold}M`
  return threshold.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
}

function formatRelative(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "À l'instant"
  if (diffMin < 60) return `Il y a ${diffMin}min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `Il y a ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  return `Il y a ${diffD}j`
}

/* ── Create Modal ────────────────────────────────────── */

function AlertCreateModal({
  onClose,
  onCreated,
  prefill,
}: {
  onClose: () => void
  onCreated: () => void
  prefill?: Partial<AlertCreateRequest>
}) {
  const { createAlert } = useAlertStore()
  const [form, setForm] = useState<AlertCreateRequest>({
    name: prefill?.name || '',
    asset_type: prefill?.asset_type || 'crypto',
    symbol: prefill?.symbol || '',
    condition: prefill?.condition || 'price_above',
    threshold: prefill?.threshold || 0,
    cooldown_minutes: 60,
    notify_in_app: true,
    notify_push: false,
    notify_email: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.symbol.trim() || form.threshold <= 0) {
      setError('Veuillez remplir tous les champs obligatoires.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await createAlert(form)
      onCreated()
      onClose()
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de la création')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-surface border border-border rounded-omni shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Bell size={18} className="text-brand" />
            Nouvelle alerte
          </h3>
          <button onClick={onClose} className="text-foreground-tertiary hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-foreground-secondary mb-1">Nom de l&apos;alerte</label>
            <input
              type="text"
              className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-omni-sm text-sm text-foreground placeholder:text-foreground-disabled focus:outline-none focus:ring-1 focus:ring-brand"
              placeholder="Ex: BTC au-dessus de $100k"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          {/* Asset type + symbol */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground-secondary mb-1">Type d&apos;actif</label>
              <select
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-omni-sm text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
                value={form.asset_type}
                onChange={(e) => setForm({ ...form, asset_type: e.target.value as AlertAssetType })}
              >
                <option value="crypto">Crypto</option>
                <option value="stock">Actions</option>
                <option value="index">Indices</option>
                <option value="realestate">Immobilier</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground-secondary mb-1">Symbole</label>
              <input
                type="text"
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-omni-sm text-sm text-foreground placeholder:text-foreground-disabled focus:outline-none focus:ring-1 focus:ring-brand uppercase"
                placeholder="BTC, AAPL, ^FCHI..."
                value={form.symbol}
                onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
              />
            </div>
          </div>

          {/* Condition + threshold */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground-secondary mb-1">Condition</label>
              <select
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-omni-sm text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
                value={form.condition}
                onChange={(e) => setForm({ ...form, condition: e.target.value as AlertCondition })}
              >
                <option value="price_above">Prix au-dessus de</option>
                <option value="price_below">Prix en dessous de</option>
                <option value="pct_change_24h_above">Hausse 24h &gt;</option>
                <option value="pct_change_24h_below">Baisse 24h &gt;</option>
                <option value="volume_spike">Volume spike &gt;</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground-secondary mb-1">
                Seuil {form.condition.includes('pct') ? '(%)' : form.condition === 'volume_spike' ? '(M)' : ''}
              </label>
              <input
                type="number"
                step="any"
                min="0"
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-omni-sm text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
                value={form.threshold || ''}
                onChange={(e) => setForm({ ...form, threshold: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          {/* Cooldown */}
          <div>
            <label className="block text-xs font-medium text-foreground-secondary mb-1">Cooldown (minutes)</label>
            <input
              type="number"
              min="1"
              max="10080"
              className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-omni-sm text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
              value={form.cooldown_minutes}
              onChange={(e) => setForm({ ...form, cooldown_minutes: parseInt(e.target.value) || 60 })}
            />
            <p className="text-[10px] text-foreground-tertiary mt-1">Délai minimum entre deux déclenchements (1 min — 7 jours)</p>
          </div>

          {/* Notification channels */}
          <div>
            <label className="block text-xs font-medium text-foreground-secondary mb-2">Canaux de notification</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs text-foreground-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.notify_in_app}
                  onChange={(e) => setForm({ ...form, notify_in_app: e.target.checked })}
                  className="rounded border-border text-brand focus:ring-brand"
                />
                In-app
              </label>
              <label className="flex items-center gap-2 text-xs text-foreground-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.notify_push}
                  onChange={(e) => setForm({ ...form, notify_push: e.target.checked })}
                  className="rounded border-border text-brand focus:ring-brand"
                />
                Push
              </label>
              <label className="flex items-center gap-2 text-xs text-foreground-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.notify_email}
                  onChange={(e) => setForm({ ...form, notify_email: e.target.checked })}
                  className="rounded border-border text-brand focus:ring-brand"
                />
                Email
              </label>
            </div>
          </div>

          {error && (
            <p className="text-xs text-loss">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-foreground-secondary hover:text-foreground transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 bg-brand hover:bg-brand-light text-white text-sm font-medium rounded-omni-sm transition-colors disabled:opacity-50"
          >
            {submitting ? 'Création...' : 'Créer l\'alerte'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ── Alert Card ──────────────────────────────────────── */

function AlertCard({
  alert,
  onToggle,
  onDelete,
}: {
  alert: UserAlert
  onToggle: (id: string, active: boolean) => void
  onDelete: (id: string) => void
}) {
  const Icon = ASSET_TYPE_ICONS[alert.asset_type] || Activity
  const CondIcon = CONDITION_ICONS[alert.condition] || TrendingUp
  const colorClass = ASSET_TYPE_COLORS[alert.asset_type] || 'text-gray-400 bg-gray-400/10'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`group flex items-center gap-4 px-4 py-3 bg-surface border border-border rounded-omni hover:border-brand/30 transition-all ${
        !alert.is_active ? 'opacity-60' : ''
      }`}
    >
      {/* Icon */}
      <div className={`flex-shrink-0 w-10 h-10 rounded-omni-sm flex items-center justify-center ${colorClass}`}>
        <Icon size={18} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground truncate">{alert.name}</p>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold ${
            alert.is_active
              ? 'bg-gain/10 text-gain'
              : 'bg-foreground-disabled/10 text-foreground-disabled'
          }`}>
            {alert.is_active ? 'Active' : 'Pause'}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <CondIcon size={11} className="text-foreground-tertiary" />
          <p className="text-xs text-foreground-secondary">
            {alert.symbol} — {CONDITION_LABELS[alert.condition]} {formatThreshold(alert.condition, alert.threshold)}
          </p>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[10px] text-foreground-tertiary">
            {ASSET_TYPE_LABELS[alert.asset_type]}
          </span>
          {alert.trigger_count > 0 && (
            <span className="text-[10px] text-foreground-tertiary flex items-center gap-1">
              <Zap size={9} />
              {alert.trigger_count} déclenchement{alert.trigger_count > 1 ? 's' : ''}
            </span>
          )}
          {alert.last_triggered_at && (
            <span className="text-[10px] text-foreground-disabled">
              Dernière: {formatRelative(alert.last_triggered_at)}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onToggle(alert.id, !alert.is_active)}
          className="p-1.5 rounded-omni-sm hover:bg-surface-elevated text-foreground-tertiary hover:text-foreground transition-colors"
          title={alert.is_active ? 'Mettre en pause' : 'Activer'}
        >
          {alert.is_active ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button
          onClick={() => onDelete(alert.id)}
          className="p-1.5 rounded-omni-sm hover:bg-loss/10 text-foreground-tertiary hover:text-loss transition-colors"
          title="Supprimer"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </motion.div>
  )
}

/* ── History Panel ───────────────────────────────────── */

function HistoryPanel({ history }: { history: AlertHistoryEntry[] }) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-foreground-tertiary">
        <History size={24} className="mb-2 opacity-40" />
        <p className="text-xs">Aucun déclenchement pour le moment</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {history.map((h) => {
        const colorClass = ASSET_TYPE_COLORS[h.asset_type] || 'text-gray-400 bg-gray-400/10'
        return (
          <div key={h.id} className="flex items-start gap-3 px-3 py-2 bg-surface-elevated/50 rounded-omni-sm">
            <div className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center mt-0.5 ${colorClass}`}>
              <Zap size={12} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground">{h.message}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] text-foreground-tertiary">
                  {new Date(h.triggered_at).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="text-[10px] text-foreground-disabled">
                  Prix: {h.price_at_trigger.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Suggestions Panel ───────────────────────────────── */

function SuggestionsPanel({
  suggestions,
  isLoading,
  onAccept,
}: {
  suggestions: AlertSuggestion[]
  isLoading: boolean
  onAccept: (s: AlertSuggestion) => void
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="animate-spin w-5 h-5 border-2 border-brand border-t-transparent rounded-full" />
      </div>
    )
  }

  if (suggestions.length === 0) {
    return (
      <div className="flex flex-col items-center py-6 text-foreground-tertiary">
        <Lightbulb size={20} className="mb-2 opacity-40" />
        <p className="text-xs">Ajoutez des actifs pour recevoir des suggestions</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {suggestions.map((s, i) => (
        <div
          key={i}
          className="flex items-start gap-3 px-3 py-3 bg-brand/5 border border-brand/20 rounded-omni-sm"
        >
          <Lightbulb size={14} className="text-brand mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground">{s.name}</p>
            <p className="text-[10px] text-foreground-secondary mt-1">{s.reason}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-foreground-tertiary">
                {s.symbol} — {CONDITION_LABELS[s.condition]} {formatThreshold(s.condition, s.threshold)}
              </span>
            </div>
          </div>
          <button
            onClick={() => onAccept(s)}
            className="flex-shrink-0 px-3 py-1.5 bg-brand hover:bg-brand-light text-white text-[10px] font-medium rounded-omni-sm transition-colors"
          >
            Accepter
          </button>
        </div>
      ))}
    </div>
  )
}

/* ── Page ─────────────────────────────────────────────── */

export default function AlertsPage() {
  const {
    alerts,
    history,
    suggestions,
    isLoading,
    isLoadingHistory,
    isLoadingSuggestions,
    fetchAlerts,
    fetchHistory,
    fetchSuggestions,
    toggleAlert,
    deleteAlert,
  } = useAlertStore()

  const [showCreate, setShowCreate] = useState(false)
  const [prefill, setPrefill] = useState<Partial<AlertCreateRequest> | undefined>()
  const [filterType, setFilterType] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<'alerts' | 'history' | 'suggestions'>('alerts')

  useEffect(() => {
    fetchAlerts()
    fetchHistory()
    fetchSuggestions()
  }, [fetchAlerts, fetchHistory, fetchSuggestions])

  const filteredAlerts = filterType === 'all'
    ? alerts
    : alerts.filter((a) => a.asset_type === filterType)

  const activeCount = alerts.filter((a) => a.is_active).length
  const todayTriggers = history.filter((h) => {
    const d = new Date(h.triggered_at)
    const now = new Date()
    return d.toDateString() === now.toDateString()
  }).length

  const handleAcceptSuggestion = (s: AlertSuggestion) => {
    setPrefill({
      name: s.name,
      asset_type: s.asset_type,
      symbol: s.symbol,
      condition: s.condition,
      threshold: s.threshold,
    })
    setShowCreate(true)
  }

  const handleCreated = () => {
    fetchAlerts()
    setPrefill(undefined)
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Bell size={24} className="text-brand" />
            OmniAlert
          </h1>
          <p className="text-sm text-foreground-secondary mt-1">
            Système d&apos;alertes unifiées cross-assets — Actions, Crypto, Immobilier, Indices
          </p>
        </div>
        <button
          onClick={() => { setPrefill(undefined); setShowCreate(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-light text-white text-sm font-medium rounded-omni-sm transition-colors"
        >
          <Plus size={16} />
          Nouvelle alerte
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Alertes actives', value: activeCount, color: 'text-gain' },
          { label: 'En pause', value: alerts.length - activeCount, color: 'text-foreground-secondary' },
          { label: "Aujourd'hui", value: todayTriggers, color: 'text-brand' },
          { label: 'Total historique', value: history.length, color: 'text-foreground-secondary' },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface border border-border rounded-omni px-4 py-3">
            <p className="text-[10px] text-foreground-tertiary uppercase tracking-wider">{stat.label}</p>
            <p className={`text-xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {[
          { key: 'alerts' as const, label: 'Mes alertes', icon: Bell, count: alerts.length },
          { key: 'history' as const, label: 'Historique', icon: History, count: history.length },
          { key: 'suggestions' as const, label: 'Suggestions IA', icon: Lightbulb, count: suggestions.length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-brand text-brand'
                : 'border-transparent text-foreground-tertiary hover:text-foreground-secondary'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
            {tab.count > 0 && (
              <span className="text-[10px] bg-surface-elevated px-1.5 py-0.5 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'alerts' && (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filter sidebar */}
          <div className="lg:w-48 flex-shrink-0">
            <h4 className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider mb-3">
              Filtrer par type
            </h4>
            <div className="space-y-1">
              {[
                { key: 'all', label: 'Tous', count: alerts.length },
                { key: 'crypto', label: 'Crypto', count: alerts.filter((a) => a.asset_type === 'crypto').length },
                { key: 'stock', label: 'Actions', count: alerts.filter((a) => a.asset_type === 'stock').length },
                { key: 'index', label: 'Indices', count: alerts.filter((a) => a.asset_type === 'index').length },
                { key: 'realestate', label: 'Immobilier', count: alerts.filter((a) => a.asset_type === 'realestate').length },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilterType(f.key)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-omni-sm text-xs transition-colors ${
                    filterType === f.key
                      ? 'bg-brand/10 text-brand font-medium'
                      : 'text-foreground-secondary hover:bg-surface-elevated'
                  }`}
                >
                  <span>{f.label}</span>
                  <span className="text-[10px]">{f.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Alert list */}
          <div className="flex-1 space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-6 h-6 border-2 border-brand border-t-transparent rounded-full" />
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-foreground-tertiary">
                <Bell size={32} className="mb-3 opacity-30" />
                <p className="text-sm">Aucune alerte</p>
                <p className="text-xs mt-1">Créez votre première alerte pour surveiller vos actifs</p>
                <button
                  onClick={() => { setPrefill(undefined); setShowCreate(true) }}
                  className="mt-4 px-4 py-2 bg-brand hover:bg-brand-light text-white text-xs font-medium rounded-omni-sm transition-colors"
                >
                  <Plus size={14} className="inline mr-1" />
                  Créer une alerte
                </button>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredAlerts.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    onToggle={toggleAlert}
                    onDelete={deleteAlert}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <HistoryPanel history={history} />
      )}

      {activeTab === 'suggestions' && (
        <SuggestionsPanel
          suggestions={suggestions}
          isLoading={isLoadingSuggestions}
          onAccept={handleAcceptSuggestion}
        />
      )}

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <AlertCreateModal
            onClose={() => { setShowCreate(false); setPrefill(undefined) }}
            onCreated={handleCreated}
            prefill={prefill}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
