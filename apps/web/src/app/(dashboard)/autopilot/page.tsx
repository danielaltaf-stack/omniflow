'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap,
  TrendingUp,
  Shield,
  Target,
  BarChart3,
  RefreshCw,
  ChevronRight,
  Check,
  Clock,
  Settings,
  PiggyBank,
  ArrowUpRight,
  AlertTriangle,
} from 'lucide-react'
import { useWealthAutopilotStore } from '@/stores/wealth-autopilot-store'
import type { SuggestionBreakdown, DCAItem, ScenarioProjection } from '@/types/api'

/* ───── helpers ─────────────────────────────────────────────── */

const fmt = (centimes: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
    centimes / 100
  )

const fmtPct = (pct: number) => `${pct.toFixed(1)}%`

const TABS = [
  { key: 'savings', label: 'Épargne', icon: PiggyBank },
  { key: 'dca', label: 'DCA', icon: TrendingUp },
  { key: 'history', label: 'Historique', icon: Clock },
  { key: 'simulation', label: 'Simulation', icon: BarChart3 },
  { key: 'score', label: 'Score', icon: Target },
  { key: 'config', label: 'Config', icon: Settings },
] as const

type TabKey = (typeof TABS)[number]['key']

const STATUS_COLORS: Record<string, string> = {
  suggested: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  accepted: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  executed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  skipped: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
  expired: 'bg-red-500/10 text-red-400 border-red-500/30',
}

/* ───── Score Gauge ────────────────────────────────────────── */

function ScoreGauge({ score, label }: { score: number; label?: string }) {
  const color =
    score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-blue-400' : score >= 40 ? 'text-amber-400' : 'text-red-400'
  const bg =
    score >= 80 ? 'stroke-emerald-400' : score >= 60 ? 'stroke-blue-400' : score >= 40 ? 'stroke-amber-400' : 'stroke-red-400'
  const circumference = 2 * Math.PI * 54
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="relative flex flex-col items-center justify-center">
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
        <span className="text-xs text-zinc-500">{label || '/100'}</span>
      </div>
    </div>
  )
}

/* ───── Allocation Bar ─────────────────────────────────────── */

function AllocationBar({ breakdowns }: { breakdowns: SuggestionBreakdown[] }) {
  const total = breakdowns.reduce((s, b) => s + b.amount, 0)
  if (total === 0) return null

  const COLORS = [
    'bg-emerald-500', 'bg-blue-500', 'bg-amber-500',
    'bg-purple-500', 'bg-rose-500', 'bg-cyan-500',
  ]

  return (
    <div className="space-y-2">
      <div className="h-3 rounded-full bg-white/5 overflow-hidden flex">
        {breakdowns.map((b, i) => (
          <motion.div
            key={i}
            className={`h-full ${COLORS[i % COLORS.length]}`}
            initial={{ width: 0 }}
            animate={{ width: `${(b.amount / total) * 100}%` }}
            transition={{ duration: 0.8, delay: i * 0.1 }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {breakdowns.map((b, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <div className={`w-2 h-2 rounded-full ${COLORS[i % COLORS.length]}`} />
            <span className="text-zinc-400">{b.allocation_label}</span>
            <span className="font-semibold">{fmt(b.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ───── DCA Card ───────────────────────────────────────────── */

function DCACard({ item }: { item: DCAItem }) {
  const progress = item.target_monthly > 0 ? ((item.target_monthly - item.remaining) / item.target_monthly) * 100 : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-sm">{item.label}</h4>
        <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-zinc-400">{item.type.replace('dca_', '').toUpperCase()}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <div>
          <div className="text-lg font-bold">{fmt(item.target_monthly)}</div>
          <div className="text-[10px] text-zinc-500">Objectif / mois</div>
        </div>
        <div>
          <div className="text-lg font-bold text-emerald-400">{fmt(item.actual_this_month)}</div>
          <div className="text-[10px] text-zinc-500">Investi ce mois</div>
        </div>
        <div>
          <div className="text-lg font-bold text-amber-400">{fmt(item.remaining)}</div>
          <div className="text-[10px] text-zinc-500">Restant</div>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-2">
        <motion.div
          className="h-full rounded-full bg-emerald-400"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, progress)}%` }}
          transition={{ duration: 0.8 }}
        />
      </div>
      <p className="text-xs text-zinc-400">{item.suggestion}</p>
    </motion.div>
  )
}

/* ───── Scenario Card ──────────────────────────────────────── */

function ScenarioCard({ title, data, color }: { title: string; data: ScenarioProjection; color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
    >
      <h4 className={`font-semibold text-sm mb-3 ${color}`}>{title}</h4>
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-zinc-400">6 mois</span>
          <span className="font-semibold">{fmt(data.total_savings_6m)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-zinc-400">12 mois</span>
          <span className="font-semibold">{fmt(data.total_savings_12m)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-zinc-400">24 mois</span>
          <span className="font-semibold">{fmt(data.total_savings_24m)}</span>
        </div>
        <div className="border-t border-white/5 pt-2 mt-2">
          {data.safety_cushion_full_months !== null && (
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Matelas rempli dans</span>
              <span className="font-semibold text-emerald-400">{data.safety_cushion_full_months} mois</span>
            </div>
          )}
          <div className="flex justify-between text-xs mt-1">
            <span className="text-zinc-400">Patrimoine projeté 12m</span>
            <span className="font-semibold">{fmt(data.patrimoine_projected)}</span>
          </div>
        </div>
        {data.projects_reached.length > 0 && (
          <div className="border-t border-white/5 pt-2 mt-2">
            <div className="text-[10px] text-zinc-500 uppercase mb-1">Projets</div>
            {data.projects_reached.map((p, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-zinc-400">{p.name}</span>
                <span className="font-semibold">{p.months_remaining != null ? `${p.months_remaining} mois` : '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

/* ───── Score Component ────────────────────────────────────── */

function ScoreBar({ label, score, max }: { label: string; score: number; max: number }) {
  const pct = max > 0 ? (score / max) * 100 : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className="font-semibold">{score}/{max}</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${
            pct >= 80 ? 'bg-emerald-400' : pct >= 60 ? 'bg-blue-400' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400'
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8 }}
        />
      </div>
    </div>
  )
}

/* ───── Main Page ──────────────────────────────────────────── */

export default function WealthAutopilotPage() {
  const [tab, setTab] = useState<TabKey>('savings')
  const {
    config,
    computeResult,
    simulation,
    scoreResponse,
    history,
    isLoading,
    isComputing,
    isSaving,
    isSimulating,
    error,
    fetchAll,
    fetchConfig,
    updateConfig,
    compute,
    acceptSuggestion,
    fetchHistory,
    simulate,
    fetchScore,
    clearError,
  } = useWealthAutopilotStore()

  useEffect(() => {
    fetchAll()
  }, [])

  /* ─── Config Form State ─── */
  const [incomeInput, setIncomeInput] = useState('')
  const [otherIncomeInput, setOtherIncomeInput] = useState('')
  const [cushionMonths, setCushionMonths] = useState('3')

  useEffect(() => {
    if (config) {
      setIncomeInput(String(config.monthly_income / 100))
      setOtherIncomeInput(String(config.other_income / 100))
      setCushionMonths(String(config.safety_cushion_months))
    }
  }, [config])

  const handleSaveConfig = async () => {
    await updateConfig({
      monthly_income: Math.round(parseFloat(incomeInput || '0') * 100),
      other_income: Math.round(parseFloat(otherIncomeInput || '0') * 100),
      safety_cushion_months: parseFloat(cushionMonths || '3'),
    })
  }

  const score = scoreResponse?.breakdown?.overall_score ?? config?.autopilot_score ?? 0

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto space-y-6">
      {/* ─── Header ─── */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="text-amber-400" size={28} />
            Wealth Autopilot
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Épargne automatique intelligente — calcul quotidien optimisé</p>
        </div>
        <div className="flex items-center gap-3">
          <ScoreGauge score={score} />
          <div className="text-right">
            <div className="text-sm font-medium text-zinc-400">Score Autopilot</div>
            <div className="text-xs text-zinc-500">
              Taux d&apos;épargne : {fmtPct(config?.savings_rate_pct ?? 0)}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Épargne disponible', value: fmt(config?.last_available ?? 0), color: 'text-emerald-400', icon: PiggyBank },
          { label: 'Dernier montant suggéré', value: fmt(computeResult?.suggestion?.suggested_amount ?? (config?.last_suggestion as any)?.suggested_amount ?? 0), color: 'text-blue-400', icon: ArrowUpRight },
          { label: 'Taux d\'épargne', value: fmtPct(config?.savings_rate_pct ?? 0), color: 'text-amber-400', icon: TrendingUp },
          { label: 'Suggestions acceptées', value: `${history?.acceptance_rate?.toFixed(0) ?? 0}%`, color: 'text-purple-400', icon: Check },
        ].map((kpi, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon size={16} className="text-zinc-500" />
              <span className="text-xs text-zinc-500">{kpi.label}</span>
            </div>
            <div className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</div>
          </motion.div>
        ))}
      </div>

      {/* ─── Tabs ─── */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-white/5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors whitespace-nowrap ${
              tab === t.key
                ? 'bg-white/5 text-white border-b-2 border-amber-400'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]'
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── Error ─── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertTriangle size={16} />
              {error}
            </div>
            <button onClick={clearError} className="text-red-400 text-xs hover:underline">Fermer</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Loading ─── */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={32} className="animate-spin text-zinc-500" />
        </div>
      )}

      {/* ─── Tab Content ─── */}
      {!isLoading && (
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* ══════ Savings Tab ══════ */}
            {tab === 'savings' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Calcul épargne disponible</h2>
                  <button
                    onClick={compute}
                    disabled={isComputing}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400 transition-colors disabled:opacity-50"
                  >
                    {isComputing ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                    Calculer
                  </button>
                </div>

                {computeResult ? (
                  <div className="space-y-4">
                    {/* Snapshot */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {[
                        { label: 'Solde comptes courants', value: fmt(computeResult.checking_balance) },
                        { label: 'Solde épargne', value: fmt(computeResult.savings_balance) },
                        { label: 'Dépenses moy. / mois', value: fmt(computeResult.monthly_expenses_avg) },
                        { label: 'Débits prévus 7j', value: fmt(computeResult.upcoming_debits) },
                      ].map((item, i) => (
                        <div key={i} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                          <div className="text-[10px] text-zinc-500 uppercase">{item.label}</div>
                          <div className="text-sm font-bold mt-1">{item.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Safety cushion */}
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Shield size={16} className="text-emerald-400" />
                          <span className="font-semibold text-sm">Matelas de sécurité</span>
                        </div>
                        <span className="text-xs text-zinc-500">
                          {fmt(computeResult.safety_cushion_current)} / {fmt(computeResult.safety_cushion_target)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-emerald-400"
                          initial={{ width: 0 }}
                          animate={{
                            width: `${
                              computeResult.safety_cushion_target > 0
                                ? Math.min(100, (computeResult.safety_cushion_current / computeResult.safety_cushion_target) * 100)
                                : 0
                            }%`,
                          }}
                          transition={{ duration: 0.8 }}
                        />
                      </div>
                      {computeResult.safety_gap > 0 && (
                        <p className="text-xs text-amber-400 mt-2">
                          Il manque {fmt(computeResult.safety_gap)} pour atteindre votre matelas de sécurité
                        </p>
                      )}
                    </div>

                    {/* Suggestion */}
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold flex items-center gap-2">
                          <Zap size={16} className="text-amber-400" />
                          Suggestion
                        </h3>
                        {computeResult.suggestion.status === 'suggested' && (
                          <button
                            onClick={() => acceptSuggestion(computeResult.suggestion.suggestion_id)}
                            disabled={isSaving}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-400 transition-colors disabled:opacity-50"
                          >
                            <Check size={12} />
                            Accepter
                          </button>
                        )}
                      </div>
                      <p className="text-sm mb-3">{computeResult.suggestion.message}</p>
                      <div className="text-2xl font-bold text-amber-400 mb-3">
                        {fmt(computeResult.suggestion.suggested_amount)}
                      </div>
                      <AllocationBar breakdowns={computeResult.suggestion.breakdown} />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-12 text-center">
                    <PiggyBank size={48} className="text-zinc-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Aucun calcul effectué</h3>
                    <p className="text-sm text-zinc-500 mb-4">
                      Cliquez sur &ldquo;Calculer&rdquo; pour analyser votre capacité d&apos;épargne
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ══════ DCA Tab ══════ */}
            {tab === 'dca' && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">DCA — Dollar Cost Averaging</h2>
                {computeResult?.dca_items?.length ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {computeResult.dca_items.map((item, i) => (
                      <DCACard key={i} item={item} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-12 text-center">
                    <TrendingUp size={48} className="text-zinc-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Aucun DCA configuré</h3>
                    <p className="text-sm text-zinc-500">
                      Ajoutez des allocations DCA dans l&apos;onglet Configuration, puis lancez un calcul.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ══════ History Tab ══════ */}
            {tab === 'history' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Historique des suggestions</h2>
                  <button onClick={fetchHistory} className="text-xs text-zinc-500 hover:text-white flex items-center gap-1">
                    <RefreshCw size={12} /> Actualiser
                  </button>
                </div>
                {history && (
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-center">
                      <div className="text-[10px] text-zinc-500 uppercase">Total suggéré</div>
                      <div className="text-lg font-bold mt-1">{fmt(history.total_suggested)}</div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-center">
                      <div className="text-[10px] text-zinc-500 uppercase">Total accepté</div>
                      <div className="text-lg font-bold text-emerald-400 mt-1">{fmt(history.total_accepted)}</div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-center">
                      <div className="text-[10px] text-zinc-500 uppercase">Taux d&apos;acceptation</div>
                      <div className="text-lg font-bold text-blue-400 mt-1">{fmtPct(history.acceptance_rate)}</div>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  {history?.history?.length ? (
                    history.history.slice().reverse().map((h, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="rounded-lg border border-white/10 bg-white/[0.02] p-3 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-sm font-semibold">{fmt(h.suggested_amount)}</div>
                          <div className="text-[10px] text-zinc-500">{h.created_at ? new Date(h.created_at).toLocaleDateString('fr-FR') : '—'}</div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[h.status] || STATUS_COLORS.suggested}`}>
                          {h.status}
                        </span>
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-zinc-500 text-sm">Aucun historique disponible</div>
                  )}
                </div>
              </div>
            )}

            {/* ══════ Simulation Tab ══════ */}
            {tab === 'simulation' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Simulation — 3 scénarios</h2>
                  <button
                    onClick={simulate}
                    disabled={isSimulating}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white font-semibold text-sm hover:bg-blue-400 transition-colors disabled:opacity-50"
                  >
                    {isSimulating ? <RefreshCw size={14} className="animate-spin" /> : <BarChart3 size={14} />}
                    Simuler
                  </button>
                </div>
                {simulation ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <ScenarioCard title="🐢 Prudent" data={simulation.prudent} color="text-zinc-400" />
                    <ScenarioCard title="⚖️ Modéré" data={simulation.moderate} color="text-blue-400" />
                    <ScenarioCard title="🚀 Ambitieux" data={simulation.ambitious} color="text-emerald-400" />
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-12 text-center">
                    <BarChart3 size={48} className="text-zinc-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Aucune simulation</h3>
                    <p className="text-sm text-zinc-500">Lancez un calcul d&apos;épargne d&apos;abord, puis simulez vos scénarios.</p>
                  </div>
                )}
              </div>
            )}

            {/* ══════ Score Tab ══════ */}
            {tab === 'score' && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Score Autopilot</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center justify-center">
                    <ScoreGauge score={scoreResponse?.breakdown?.overall_score ?? 0} label="Score global" />
                  </div>
                  <div className="space-y-4">
                    {scoreResponse?.breakdown && (
                      <>
                        <ScoreBar label="Taux d'épargne" score={scoreResponse.breakdown.savings_rate_score} max={30} />
                        <ScoreBar label="Matelas de sécurité" score={scoreResponse.breakdown.safety_cushion_score} max={25} />
                        <ScoreBar label="Régularité" score={scoreResponse.breakdown.regularity_score} max={20} />
                        <ScoreBar label="Diversification DCA" score={scoreResponse.breakdown.diversification_score} max={15} />
                        <ScoreBar label="Projets actifs" score={scoreResponse.breakdown.projects_score} max={10} />
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ══════ Config Tab ══════ */}
            {tab === 'config' && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Configuration Autopilot</h2>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 space-y-5 max-w-xl">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Revenus mensuels nets (€)</label>
                    <input
                      type="number"
                      value={incomeInput}
                      onChange={(e) => setIncomeInput(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                      placeholder="2500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Autres revenus mensuels (€)</label>
                    <input
                      type="number"
                      value={otherIncomeInput}
                      onChange={(e) => setOtherIncomeInput(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Matelas de sécurité (mois de charges)</label>
                    <select
                      value={cushionMonths}
                      onChange={(e) => setCushionMonths(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                    >
                      {[1, 2, 3, 4, 5, 6, 9, 12].map((m) => (
                        <option key={m} value={m}>{m} mois</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-zinc-400">Autopilot activé</label>
                    <button
                      onClick={() => updateConfig({ is_enabled: !config?.is_enabled })}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        config?.is_enabled ? 'bg-emerald-500' : 'bg-zinc-600'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                          config?.is_enabled ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                  <button
                    onClick={handleSaveConfig}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                    Sauvegarder
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}
