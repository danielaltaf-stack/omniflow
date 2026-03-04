'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  AlertTriangle,
  TrendingUp,
  FileText,
  Calculator,
  RefreshCw,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Clock,
  Target,
  Zap,
  Download,
} from 'lucide-react'
import { useFiscalRadarStore } from '@/stores/fiscal-radar-store'
import type { FiscalAlertItem, DomainAnalysis } from '@/types/api'

/* ───── helpers ─────────────────────────────────────────────── */

const fmt = (centimes: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
    centimes / 100
  )

const fmtPct = (pct: number) => `${pct.toFixed(1)}%`

const TABS = [
  { key: 'alerts', label: 'Alertes', icon: AlertTriangle },
  { key: 'analysis', label: 'Analyse', icon: TrendingUp },
  { key: 'profile', label: 'Profil Fiscal', icon: Shield },
  { key: 'export', label: 'Export', icon: FileText },
  { key: 'simulator', label: 'Simulation TMI', icon: Calculator },
] as const

type TabKey = (typeof TABS)[number]['key']

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-500/10 text-red-400 border-red-500/30',
  high: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
}

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgent',
  high: 'Important',
  info: 'Info',
}

const STATUS_COLORS: Record<string, string> = {
  optimal: 'text-emerald-400',
  good: 'text-blue-400',
  improvable: 'text-amber-400',
  critical: 'text-red-400',
}

const DOMAIN_LABELS: Record<string, string> = {
  pea: 'PEA',
  crypto: 'Crypto-actifs',
  immobilier: 'Immobilier',
  per: 'PER',
  av: 'Assurance-Vie',
  cto: 'CTO / Dividendes',
  ir: 'Barème IR',
}

const HOUSEHOLD_OPTIONS = [
  { value: 'single', label: 'Célibataire' },
  { value: 'couple', label: 'Couple' },
  { value: 'family', label: 'Famille' },
]

const TMI_OPTIONS = [0, 11, 30, 41, 45]

const INCOME_TYPE_OPTIONS = [
  { value: 'salaire', label: 'Salaire' },
  { value: 'foncier', label: 'Revenus fonciers' },
  { value: 'dividendes', label: 'Dividendes' },
  { value: 'crypto', label: 'Plus-values crypto' },
  { value: 'per_deduction', label: 'Déduction PER' },
]

/* ───── Score Gauge ────────────────────────────────────────── */

function ScoreGauge({ score }: { score: number }) {
  const color =
    score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-blue-400' : score >= 40 ? 'text-amber-400' : 'text-red-400'
  const bg =
    score >= 80 ? 'stroke-emerald-400' : score >= 60 ? 'stroke-blue-400' : score >= 40 ? 'stroke-amber-400' : 'stroke-red-400'
  const circumference = 2 * Math.PI * 54
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="relative flex items-center justify-center">
      <svg width="140" height="140" className="-rotate-90">
        <circle cx="70" cy="70" r="54" fill="none" stroke="currentColor" strokeWidth="10" className="text-white/5" />
        <motion.circle
          cx="70" cy="70" r="54" fill="none" strokeWidth="10"
          className={bg}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-3xl font-bold ${color}`}>{score}</span>
        <span className="text-xs text-zinc-500">/100</span>
      </div>
    </div>
  )
}

/* ───── Alert Card ─────────────────────────────────────────── */

function AlertCard({ alert }: { alert: FiscalAlertItem }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-4 ${PRIORITY_COLORS[alert.priority] || PRIORITY_COLORS.info}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-white/10">
              {PRIORITY_LABELS[alert.priority]}
            </span>
            <span className="text-[10px] text-zinc-500 uppercase">{DOMAIN_LABELS[alert.domain] || alert.domain}</span>
            {alert.deadline && (
              <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                <Clock size={10} /> {alert.deadline}
              </span>
            )}
          </div>
          <h4 className="font-semibold text-sm mb-1">{alert.title}</h4>
          <p className="text-xs leading-relaxed opacity-80">{alert.message}</p>
        </div>
        {alert.economy_estimate > 0 && (
          <div className="text-right shrink-0">
            <div className="text-lg font-bold text-emerald-400">{fmt(alert.economy_estimate)}</div>
            <div className="text-[10px] text-zinc-500">économie estimée</div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

/* ───── Domain Score Card ──────────────────────────────────── */

function DomainCard({ domain }: { domain: DomainAnalysis }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm">{domain.label}</span>
        <span className={`text-xs font-semibold uppercase ${STATUS_COLORS[domain.status]}`}>{domain.status}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold">{domain.score}</span>
        <span className="text-xs text-zinc-500 mb-1">/100</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${
            domain.score >= 80 ? 'bg-emerald-400' : domain.score >= 60 ? 'bg-blue-400' : domain.score >= 40 ? 'bg-amber-400' : 'bg-red-400'
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${domain.score}%` }}
          transition={{ duration: 0.8 }}
        />
      </div>
    </div>
  )
}

/* ───── Main Page ──────────────────────────────────────────── */

export default function FiscalRadarPage() {
  const [tab, setTab] = useState<TabKey>('alerts')
  const {
    profile,
    alerts,
    analysis,
    fiscalExport,
    tmiSimulation,
    scoreResponse,
    isLoading,
    isAnalyzing,
    isSimulating,
    isSaving,
    error,
    fetchAll,
    fetchProfile,
    updateProfile,
    runAnalysis,
    fetchAlerts,
    fetchExport,
    simulateTMI,
    fetchScore,
    clearError,
  } = useFiscalRadarStore()

  // Profile form state
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [simAmount, setSimAmount] = useState(100000) // 1000€ default
  const [simType, setSimType] = useState('salaire')
  const [exportYear, setExportYear] = useState(2026)

  useEffect(() => {
    fetchAll()
  }, [])

  useEffect(() => {
    if (profile) {
      setFormData({
        tax_household: profile.tax_household,
        parts_fiscales: profile.parts_fiscales,
        tmi_rate: profile.tmi_rate,
        revenu_fiscal_ref: profile.revenu_fiscal_ref,
        pea_open_date: profile.pea_open_date || '',
        pea_total_deposits: profile.pea_total_deposits,
        per_annual_deposits: profile.per_annual_deposits,
        per_plafond: profile.per_plafond,
        av_open_date: profile.av_open_date || '',
        av_total_deposits: profile.av_total_deposits,
        total_revenus_fonciers: profile.total_revenus_fonciers,
        total_charges_deductibles: profile.total_charges_deductibles,
        deficit_foncier_reportable: profile.deficit_foncier_reportable,
        crypto_pv_annuelle: profile.crypto_pv_annuelle,
        crypto_mv_annuelle: profile.crypto_mv_annuelle,
        dividendes_bruts_annuels: profile.dividendes_bruts_annuels,
        pv_cto_annuelle: profile.pv_cto_annuelle,
      })
    }
  }, [profile])

  const handleSaveProfile = async () => {
    const cleaned: Record<string, any> = { ...formData }
    // Convert empty strings to null for dates
    if (cleaned.pea_open_date === '') cleaned.pea_open_date = null
    if (cleaned.av_open_date === '') cleaned.av_open_date = null
    await updateProfile(cleaned)
  }

  const handleRunAnalysis = async () => {
    await runAnalysis(2026)
  }

  const handleSimulate = async () => {
    await simulateTMI(simAmount, simType)
  }

  const handleExport = async () => {
    await fetchExport(exportYear)
  }

  const score = profile?.fiscal_score ?? scoreResponse?.breakdown?.overall_score ?? 0
  const totalEconomy = alerts?.total_economy ?? 0
  const alertCount = alerts?.count ?? 0

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <Shield className="text-indigo-400" size={28} />
          <h1 className="text-2xl font-bold">Fiscal Radar</h1>
          <span className="ml-2 rounded-full bg-indigo-500/20 px-3 py-0.5 text-xs font-medium text-indigo-300">
            Optimisation fiscale FR
          </span>
        </div>
        <p className="text-sm text-zinc-500">
          Surveillance proactive de votre situation fiscale — 7 domaines analysés, alertes temps réel, export CERFA.
        </p>
      </motion.div>

      {/* ── Top Summary Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 flex items-center gap-5"
        >
          <ScoreGauge score={score} />
          <div>
            <div className="text-sm text-zinc-500 mb-1">Score Fiscal</div>
            <div className="text-lg font-semibold">
              {score >= 80 ? 'Excellente optimisation' : score >= 60 ? 'Bonne optimisation' : score >= 40 ? 'Améliorable' : 'Actions requises'}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
        >
          <div className="text-sm text-zinc-500 mb-2">Économies identifiées</div>
          <div className="text-3xl font-bold text-emerald-400">{fmt(totalEconomy)}</div>
          <div className="text-xs text-zinc-500 mt-1">{alertCount} alerte{alertCount !== 1 ? 's' : ''} active{alertCount !== 1 ? 's' : ''}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
        >
          <div className="text-sm text-zinc-500 mb-2">TMI actuel</div>
          <div className="text-3xl font-bold">{fmtPct(profile?.tmi_rate ?? 30)}</div>
          <div className="text-xs text-zinc-500 mt-1">
            Foyer : {HOUSEHOLD_OPTIONS.find(h => h.value === profile?.tax_household)?.label ?? 'Célibataire'} — {profile?.parts_fiscales ?? 1} part{(profile?.parts_fiscales ?? 1) > 1 ? 's' : ''}
          </div>
        </motion.div>
      </div>

      {/* ── Error Banner ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-400 flex justify-between"
          >
            <span>{error}</span>
            <button onClick={clearError} className="underline">Fermer</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tabs ── */}
      <div className="flex gap-1 rounded-xl bg-white/[0.03] p-1 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap ${
                active ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={16} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* ── Tab Content ── */}
      <AnimatePresence mode="wait">
        {/* ─── ALERTS TAB ─── */}
        {tab === 'alerts' && (
          <motion.div key="alerts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Alertes Proactives</h2>
              <button
                onClick={handleRunAnalysis}
                disabled={isAnalyzing}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 transition"
              >
                <RefreshCw size={14} className={isAnalyzing ? 'animate-spin' : ''} />
                {isAnalyzing ? 'Analyse…' : 'Lancer l\'analyse'}
              </button>
            </div>

            {alerts && alerts.alerts.length > 0 ? (
              <div className="space-y-3">
                {alerts.alerts.map((a, i) => (
                  <AlertCard key={`${a.alert_type}-${i}`} alert={a} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-10 text-center">
                <Shield className="mx-auto text-emerald-400 mb-3" size={40} />
                <p className="text-zinc-400">Aucune alerte — votre situation fiscale est bien optimisée !</p>
                <p className="text-xs text-zinc-600 mt-1">Configurez votre profil fiscal pour activer les alertes.</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ─── ANALYSIS TAB ─── */}
        {tab === 'analysis' && (
          <motion.div key="analysis" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Analyse par Domaine</h2>
              <button
                onClick={handleRunAnalysis}
                disabled={isAnalyzing}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 transition"
              >
                <RefreshCw size={14} className={isAnalyzing ? 'animate-spin' : ''} />
                {isAnalyzing ? 'Analyse…' : 'Actualiser'}
              </button>
            </div>

            {/* Domain score cards */}
            {scoreResponse?.breakdown?.domain_scores && scoreResponse.breakdown.domain_scores.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {scoreResponse.breakdown.domain_scores.map(d => (
                  <DomainCard key={d.domain} domain={d} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-10 text-center">
                <TrendingUp className="mx-auto text-zinc-600 mb-3" size={40} />
                <p className="text-zinc-400">Lancez une analyse pour voir les scores par domaine.</p>
              </div>
            )}

            {/* Optimizations */}
            {analysis?.optimizations && analysis.optimizations.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-zinc-400 uppercase tracking-wide">Optimisations suggérées</h3>
                {analysis.optimizations.map((opt, i) => (
                  <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-zinc-500 uppercase">{DOMAIN_LABELS[opt.domain] || opt.domain}</span>
                      </div>
                      <p className="text-sm">{opt.recommendation}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold text-emerald-400">{fmt(opt.economy)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ─── PROFILE TAB ─── */}
        {tab === 'profile' && (
          <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            <h2 className="text-lg font-semibold">Profil Fiscal</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Situation */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
                <h3 className="font-semibold text-sm text-indigo-400 uppercase tracking-wide">Situation fiscale</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Foyer fiscal</label>
                    <select
                      value={formData.tax_household || 'single'}
                      onChange={e => setFormData({ ...formData, tax_household: e.target.value })}
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm"
                    >
                      {HOUSEHOLD_OPTIONS.map(h => (
                        <option key={h.value} value={h.value}>{h.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Parts fiscales</label>
                    <input
                      type="number" step="0.5" min="1" max="10"
                      value={formData.parts_fiscales ?? 1}
                      onChange={e => setFormData({ ...formData, parts_fiscales: parseFloat(e.target.value) || 1 })}
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">TMI (%)</label>
                    <select
                      value={formData.tmi_rate ?? 30}
                      onChange={e => setFormData({ ...formData, tmi_rate: parseFloat(e.target.value) })}
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm"
                    >
                      {TMI_OPTIONS.map(t => (
                        <option key={t} value={t}>{t}%</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Revenu fiscal réf. (€)</label>
                    <input
                      type="number" min="0"
                      value={(formData.revenu_fiscal_ref ?? 0) / 100}
                      onChange={e => setFormData({ ...formData, revenu_fiscal_ref: Math.round(parseFloat(e.target.value || '0') * 100) })}
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Enveloppes */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
                <h3 className="font-semibold text-sm text-indigo-400 uppercase tracking-wide">Enveloppes</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Date ouverture PEA</label>
                    <input
                      type="date"
                      value={formData.pea_open_date || ''}
                      onChange={e => setFormData({ ...formData, pea_open_date: e.target.value || null })}
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Versements PEA (€)</label>
                    <input
                      type="number" min="0"
                      value={(formData.pea_total_deposits ?? 0) / 100}
                      onChange={e => setFormData({ ...formData, pea_total_deposits: Math.round(parseFloat(e.target.value || '0') * 100) })}
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Date ouverture AV</label>
                    <input
                      type="date"
                      value={formData.av_open_date || ''}
                      onChange={e => setFormData({ ...formData, av_open_date: e.target.value || null })}
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Versements AV (€)</label>
                    <input
                      type="number" min="0"
                      value={(formData.av_total_deposits ?? 0) / 100}
                      onChange={e => setFormData({ ...formData, av_total_deposits: Math.round(parseFloat(e.target.value || '0') * 100) })}
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Versements PER année (€)</label>
                    <input
                      type="number" min="0"
                      value={(formData.per_annual_deposits ?? 0) / 100}
                      onChange={e => setFormData({ ...formData, per_annual_deposits: Math.round(parseFloat(e.target.value || '0') * 100) })}
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Plafond PER (€)</label>
                    <input
                      type="number" min="0"
                      value={(formData.per_plafond ?? 0) / 100}
                      onChange={e => setFormData({ ...formData, per_plafond: Math.round(parseFloat(e.target.value || '0') * 100) })}
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Revenus */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
                <h3 className="font-semibold text-sm text-indigo-400 uppercase tracking-wide">Revenus & Plus-Values</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Revenus fonciers bruts (€/an)</label>
                    <input
                      type="number" min="0"
                      value={(formData.total_revenus_fonciers ?? 0) / 100}
                      onChange={e => setFormData({ ...formData, total_revenus_fonciers: Math.round(parseFloat(e.target.value || '0') * 100) })}
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Charges déductibles (€/an)</label>
                    <input
                      type="number" min="0"
                      value={(formData.total_charges_deductibles ?? 0) / 100}
                      onChange={e => setFormData({ ...formData, total_charges_deductibles: Math.round(parseFloat(e.target.value || '0') * 100) })}
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">PV crypto année (€)</label>
                    <input
                      type="number" min="0"
                      value={(formData.crypto_pv_annuelle ?? 0) / 100}
                      onChange={e => setFormData({ ...formData, crypto_pv_annuelle: Math.round(parseFloat(e.target.value || '0') * 100) })}
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">MV crypto année (€)</label>
                    <input
                      type="number" min="0"
                      value={(formData.crypto_mv_annuelle ?? 0) / 100}
                      onChange={e => setFormData({ ...formData, crypto_mv_annuelle: Math.round(parseFloat(e.target.value || '0') * 100) })}
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Dividendes bruts (€/an)</label>
                    <input
                      type="number" min="0"
                      value={(formData.dividendes_bruts_annuels ?? 0) / 100}
                      onChange={e => setFormData({ ...formData, dividendes_bruts_annuels: Math.round(parseFloat(e.target.value || '0') * 100) })}
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">PV CTO année (€)</label>
                    <input
                      type="number" min="0"
                      value={(formData.pv_cto_annuelle ?? 0) / 100}
                      onChange={e => setFormData({ ...formData, pv_cto_annuelle: Math.round(parseFloat(e.target.value || '0') * 100) })}
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Déficit foncier */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
                <h3 className="font-semibold text-sm text-indigo-400 uppercase tracking-wide">Déficit Foncier</h3>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Déficit foncier reportable (€)</label>
                  <input
                    type="number" min="0"
                    value={(formData.deficit_foncier_reportable ?? 0) / 100}
                    onChange={e => setFormData({ ...formData, deficit_foncier_reportable: Math.round(parseFloat(e.target.value || '0') * 100) })}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Save */}
            <div className="flex justify-end">
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 transition"
              >
                {isSaving ? 'Enregistrement…' : 'Enregistrer le profil'}
              </button>
            </div>
          </motion.div>
        )}

        {/* ─── EXPORT TAB ─── */}
        {tab === 'export' && (
          <motion.div key="export" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Export Fiscal Annuel</h2>
              <div className="flex items-center gap-3">
                <select
                  value={exportYear}
                  onChange={e => setExportYear(parseInt(e.target.value))}
                  className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm"
                >
                  {[2024, 2025, 2026].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <button
                  onClick={handleExport}
                  disabled={isLoading}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 transition"
                >
                  <Download size={14} />
                  Générer l'export
                </button>
              </div>
            </div>

            {fiscalExport ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Revenus fonciers */}
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
                  <h3 className="font-semibold text-sm text-indigo-400">Revenus Fonciers</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-zinc-500">Brut</span><span>{fmt(fiscalExport.revenus_fonciers.brut)}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Régime</span><span className="capitalize">{fiscalExport.revenus_fonciers.regime.replace('_', '-')}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Net imposable</span><span>{fmt(fiscalExport.revenus_fonciers.revenu_net_foncier)}</span></div>
                    {fiscalExport.revenus_fonciers.deficit_foncier > 0 && (
                      <div className="flex justify-between"><span className="text-zinc-500">Déficit foncier</span><span className="text-amber-400">{fmt(fiscalExport.revenus_fonciers.deficit_foncier)}</span></div>
                    )}
                    <div className="border-t border-white/5 pt-2 mt-2">
                      <div className="text-xs text-zinc-600">Cases CERFA : {Object.entries(fiscalExport.revenus_fonciers.cases_cerfa).map(([k, v]) => `${k}: ${v}€`).join(', ')}</div>
                    </div>
                  </div>
                </div>

                {/* PV Mobilières */}
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
                  <h3 className="font-semibold text-sm text-indigo-400">Plus-Values Mobilières</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-zinc-500">PV CTO nette</span><span>{fmt(fiscalExport.plus_values_mobilieres.pv_nette_cto)}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Dividendes bruts</span><span>{fmt(fiscalExport.plus_values_mobilieres.dividendes_bruts)}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Option</span><span className="uppercase text-xs">{fiscalExport.plus_values_mobilieres.option_retenue}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Impôt estimé</span><span className="text-red-400">{fmt(fiscalExport.plus_values_mobilieres.impot_estime)}</span></div>
                    <div className="border-t border-white/5 pt-2 mt-2">
                      <div className="text-xs text-zinc-600">Cases CERFA : {Object.entries(fiscalExport.plus_values_mobilieres.cases_cerfa).map(([k, v]) => `${k}: ${v}€`).join(', ')}</div>
                    </div>
                  </div>
                </div>

                {/* Crypto */}
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
                  <h3 className="font-semibold text-sm text-indigo-400">Crypto-actifs</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-zinc-500">PV nette</span><span>{fmt(fiscalExport.crypto_actifs.pv_nette)}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Abattement 305€</span><span className="text-emerald-400">{fmt(fiscalExport.crypto_actifs.abattement_305)}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Base imposable</span><span>{fmt(fiscalExport.crypto_actifs.base_imposable)}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Flat tax estimée</span><span className="text-red-400">{fmt(fiscalExport.crypto_actifs.flat_tax_estime)}</span></div>
                    <div className="border-t border-white/5 pt-2 mt-2">
                      <div className="text-xs text-zinc-600">Cases CERFA : {Object.entries(fiscalExport.crypto_actifs.cases_cerfa).map(([k, v]) => `${k}: ${v}€`).join(', ')}</div>
                    </div>
                  </div>
                </div>

                {/* PER */}
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
                  <h3 className="font-semibold text-sm text-indigo-400">Déductions PER</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-zinc-500">Versements</span><span>{fmt(fiscalExport.per_deductions.versements)}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Plafond utilisé</span><span>{fmt(fiscalExport.per_deductions.plafond_utilise)}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Économie IR</span><span className="text-emerald-400">{fmt(fiscalExport.per_deductions.economie_ir)}</span></div>
                    <div className="border-t border-white/5 pt-2 mt-2">
                      <div className="text-xs text-zinc-600">Cases CERFA : {Object.entries(fiscalExport.per_deductions.cases_cerfa).map(([k, v]) => `${k}: ${v}€`).join(', ')}</div>
                    </div>
                  </div>
                </div>

                {/* Synthèse */}
                <div className="col-span-1 md:col-span-2 rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-5">
                  <h3 className="font-semibold text-sm text-indigo-400 mb-3">Synthèse</h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-red-400">{fmt(fiscalExport.synthese.total_impot_estime)}</div>
                      <div className="text-xs text-zinc-500">Impôt total estimé</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-emerald-400">{fmt(fiscalExport.synthese.economies_realisees)}</div>
                      <div className="text-xs text-zinc-500">Économies réalisées</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{fiscalExport.synthese.score_fiscal}/100</div>
                      <div className="text-xs text-zinc-500">Score fiscal</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-10 text-center">
                <FileText className="mx-auto text-zinc-600 mb-3" size={40} />
                <p className="text-zinc-400">Cliquez sur "Générer l'export" pour calculer votre récapitulatif fiscal.</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ─── TMI SIMULATOR TAB ─── */}
        {tab === 'simulator' && (
          <motion.div key="simulator" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            <h2 className="text-lg font-semibold">Simulation Impact TMI</h2>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
              <p className="text-sm text-zinc-400">
                Simulez l'impact fiscal de revenus supplémentaires sur votre taux marginal d'imposition.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Montant supplémentaire (€)</label>
                  <input
                    type="number" min="0"
                    value={simAmount / 100}
                    onChange={e => setSimAmount(Math.round(parseFloat(e.target.value || '0') * 100))}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Type de revenu</label>
                  <select
                    value={simType}
                    onChange={e => setSimType(e.target.value)}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm"
                  >
                    {INCOME_TYPE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleSimulate}
                    disabled={isSimulating}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 transition"
                  >
                    <Calculator size={14} />
                    {isSimulating ? 'Calcul…' : 'Simuler'}
                  </button>
                </div>
              </div>
            </div>

            {tmiSimulation && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center">
                    <div className="text-xs text-zinc-500 mb-1">TMI actuel</div>
                    <div className="text-2xl font-bold">{fmtPct(tmiSimulation.current_tmi)}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center">
                    <div className="text-xs text-zinc-500 mb-1">Nouveau TMI</div>
                    <div className={`text-2xl font-bold ${tmiSimulation.new_tmi > tmiSimulation.current_tmi ? 'text-red-400' : 'text-emerald-400'}`}>
                      {fmtPct(tmiSimulation.new_tmi)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center">
                    <div className="text-xs text-zinc-500 mb-1">IR supplémentaire</div>
                    <div className="text-2xl font-bold text-red-400">{fmt(tmiSimulation.marginal_tax)}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center">
                    <div className="text-xs text-zinc-500 mb-1">Taux effectif marginal</div>
                    <div className="text-2xl font-bold text-amber-400">{fmtPct(tmiSimulation.marginal_rate_effective)}</div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex items-start gap-3">
                  <Info size={16} className="text-blue-400 mt-0.5 shrink-0" />
                  <div className="text-sm text-zinc-400">
                    {tmiSimulation.new_tmi > tmiSimulation.current_tmi
                      ? `Attention : l'ajout de ${fmt(tmiSimulation.extra_income)} de ${tmiSimulation.income_type} vous fait passer dans la tranche ${fmtPct(tmiSimulation.new_tmi)}.`
                      : `L'ajout de ${fmt(tmiSimulation.extra_income)} reste dans la tranche ${fmtPct(tmiSimulation.current_tmi)}. Taux effectif : ${fmtPct(tmiSimulation.marginal_rate_effective)}.`
                    }
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
