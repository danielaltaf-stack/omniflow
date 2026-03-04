'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3,
  Flame,
  PieChart,
  RefreshCw,
  Settings,
  Sliders,
  Sunset,
  Target,
  TrendingUp,
  Zap,
  Shield,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useRetirementStore } from '@/stores/retirement-store'
import { formatAmount } from '@/lib/format'
import type {
  YearProjection,
  OptimizationLever,
} from '@/types/api'

// ── Tabs ─────────────────────────────────────────────────────

type TabKey = 'simulation' | 'fire' | 'optimize' | 'settings'

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'simulation', label: 'Monte-Carlo', icon: BarChart3 },
  { key: 'fire', label: 'FIRE', icon: Flame },
  { key: 'optimize', label: 'Optimiser', icon: Sliders },
  { key: 'settings', label: 'Profil', icon: Settings },
]

// ── Helpers ──────────────────────────────────────────────────

function formatEur(centimes: number): string {
  return formatAmount(centimes)
}

function progressColor(pct: number): string {
  if (pct >= 100) return 'bg-emerald-500'
  if (pct >= 75) return 'bg-green-500'
  if (pct >= 50) return 'bg-amber-500'
  if (pct >= 25) return 'bg-orange-500'
  return 'bg-red-500'
}

function successColor(rate: number): string {
  if (rate >= 90) return 'text-emerald-400'
  if (rate >= 75) return 'text-green-400'
  if (rate >= 50) return 'text-amber-400'
  return 'text-red-400'
}

// ── Main Page ────────────────────────────────────────────────

export default function RetirementPage() {
  const {
    profile,
    simulation,
    optimization,
    fireDashboard,
    patrimoine,
    isLoading,
    isSimulating,
    isOptimizing,
    isSaving,
    error,
    fetchAll,
    updateProfile,
    runSimulation,
    runOptimization,
    clearError,
  } = useRetirementStore()

  const [activeTab, setActiveTab] = useState<TabKey>('simulation')

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ── Profile form state ────────────────────────────────────
  const [form, setForm] = useState({
    birth_year: 1990,
    target_retirement_age: 64,
    current_monthly_income: 0,
    current_monthly_expenses: 0,
    monthly_savings: 0,
    pension_quarters_acquired: 0,
    target_lifestyle_pct: 80,
    inflation_rate_pct: 2.0,
    life_expectancy: 90,
  })

  useEffect(() => {
    if (profile) {
      setForm({
        birth_year: profile.birth_year,
        target_retirement_age: profile.target_retirement_age,
        current_monthly_income: profile.current_monthly_income / 100,
        current_monthly_expenses: profile.current_monthly_expenses / 100,
        monthly_savings: profile.monthly_savings / 100,
        pension_quarters_acquired: profile.pension_quarters_acquired,
        target_lifestyle_pct: profile.target_lifestyle_pct,
        inflation_rate_pct: profile.inflation_rate_pct,
        life_expectancy: profile.life_expectancy,
      })
    }
  }, [profile])

  const handleSaveProfile = async () => {
    try {
      await updateProfile({
        birth_year: form.birth_year,
        target_retirement_age: form.target_retirement_age,
        current_monthly_income: Math.round(form.current_monthly_income * 100),
        current_monthly_expenses: Math.round(form.current_monthly_expenses * 100),
        monthly_savings: Math.round(form.monthly_savings * 100),
        pension_quarters_acquired: form.pension_quarters_acquired,
        target_lifestyle_pct: form.target_lifestyle_pct,
        inflation_rate_pct: form.inflation_rate_pct,
        life_expectancy: form.life_expectancy,
      })
      await runSimulation()
    } catch {}
  }

  // ── Chart data (simplified bar representation) ─────────────
  const chartData = useMemo(() => {
    if (!simulation?.serie_by_age) return []
    // Sample every 2 years for readability
    return simulation.serie_by_age.filter((_, i) => i % 2 === 0)
  }, [simulation])

  const maxP90 = useMemo(() => {
    if (!chartData.length) return 1
    return Math.max(...chartData.map((d) => d.p90), 1)
  }, [chartData])

  if (isLoading && !simulation) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20">
            <Sunset className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Simulateur Retraite & FIRE</h1>
            <p className="text-sm text-muted-foreground">
              Monte-Carlo · Pension CNAV · FIRE Number · Optimisation
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => fetchAll()}
          disabled={isSimulating}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isSimulating ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-400 text-sm"
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
            <button onClick={clearError} className="ml-auto underline">
              Fermer
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPI Cards */}
      {simulation && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            label="Taux de Succès"
            value={`${simulation.success_rate_pct}%`}
            icon={<Shield className="w-5 h-5" />}
            color={successColor(simulation.success_rate_pct)}
          />
          <KPICard
            label="FIRE Number"
            value={formatEur(simulation.fire_number)}
            icon={<Flame className="w-5 h-5" />}
            sub={`Progression: ${simulation.fire_progress_pct}%`}
          />
          <KPICard
            label="Âge FIRE médian"
            value={simulation.median_fire_age ? `${simulation.median_fire_age} ans` : '—'}
            icon={<Target className="w-5 h-5" />}
            sub={simulation.fire_age_p10 && simulation.fire_age_p90
              ? `P10: ${simulation.fire_age_p10} — P90: ${simulation.fire_age_p90}`
              : undefined}
          />
          <KPICard
            label="Patrimoine retraite"
            value={formatEur(simulation.patrimoine_at_retirement_p50)}
            icon={<TrendingUp className="w-5 h-5" />}
            sub={`SWR: ${simulation.swr_recommended_pct}%`}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-alt rounded-lg p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key)
              if (tab.key === 'optimize' && !optimization) {
                runOptimization()
              }
            }}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium
              transition-colors flex-1 justify-center
              ${activeTab === tab.key
                ? 'bg-surface text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'}
            `}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'simulation' && simulation && (
          <motion.div
            key="sim"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            {/* Monte-Carlo Projection Chart (Bar) */}
            <div className="bg-surface rounded-xl p-6 border border-border">
              <h3 className="text-lg font-semibold mb-4">Projection Monte-Carlo ({simulation.num_simulations} simulations)</h3>
              <div className="overflow-x-auto">
                <div className="flex items-end gap-[2px] h-64 min-w-[600px]">
                  {chartData.map((dp, i) => {
                    const h90 = (dp.p90 / maxP90) * 100
                    const h50 = (dp.p50 / maxP90) * 100
                    const h10 = (dp.p10 / maxP90) * 100
                    return (
                      <div key={i} className="flex flex-col items-center flex-1 relative group">
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 hidden group-hover:block bg-surface-alt border border-border rounded-lg p-2 text-xs z-10 whitespace-nowrap shadow-lg">
                          <div className="font-semibold">{dp.age} ans ({dp.year})</div>
                          <div>P90: {formatEur(dp.p90)}</div>
                          <div>P50: {formatEur(dp.p50)}</div>
                          <div>P10: {formatEur(dp.p10)}</div>
                          {!dp.is_accumulation && <div className="text-amber-400">Pension: {formatEur(dp.pension_income)}/an</div>}
                        </div>
                        {/* Bar stack */}
                        <div className="w-full flex flex-col items-center justify-end h-full">
                          <div
                            className="w-full rounded-t-sm bg-emerald-500/20 relative"
                            style={{ height: `${h90}%` }}
                          >
                            <div
                              className="absolute bottom-0 w-full bg-emerald-500/40 rounded-t-sm"
                              style={{ height: `${h90 > 0 ? (h50 / h90) * 100 : 0}%` }}
                            >
                              <div
                                className={`absolute bottom-0 w-full rounded-t-sm ${dp.is_accumulation ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                style={{ height: `${h50 > 0 ? (h10 / h50) * 100 : 0}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        {/* Label */}
                        {i % 3 === 0 && (
                          <span className="text-[10px] text-muted-foreground mt-1">{dp.age}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> P10 (pessimiste)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500/40 inline-block" /> P50 (médian)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500/20 inline-block" /> P90 (optimiste)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" /> Décumulation</span>
              </div>
            </div>

            {/* Pension + SWR Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface rounded-xl p-5 border border-border">
                <h4 className="text-sm font-semibold text-muted-foreground mb-3">Pension CNAV estimée</h4>
                <div className="text-2xl font-bold">{formatEur(simulation.pension_estimate_used)}<span className="text-sm text-muted-foreground">/mois</span></div>
                <p className="text-xs text-muted-foreground mt-1">Base + complémentaire AGIRC-ARRCO</p>
              </div>
              <div className="bg-surface rounded-xl p-5 border border-border">
                <h4 className="text-sm font-semibold text-muted-foreground mb-3">Retrait mensuel recommandé (SWR)</h4>
                <div className="text-2xl font-bold">{formatEur(simulation.monthly_withdrawal_recommended)}<span className="text-sm text-muted-foreground">/mois</span></div>
                <p className="text-xs text-muted-foreground mt-1">Taux: {simulation.swr_recommended_pct}% — dynamique selon âge et volatilité</p>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'fire' && fireDashboard && (
          <motion.div
            key="fire"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            {/* FIRE Progress Bar */}
            <div className="bg-surface rounded-xl p-6 border border-border">
              <h3 className="text-lg font-semibold mb-2">Progression FIRE</h3>
              <div className="flex items-center gap-4 mb-2">
                <span className="text-sm text-muted-foreground">Patrimoine actuel</span>
                <span className="font-bold">{formatEur(fireDashboard.patrimoine_total)}</span>
                <span className="text-sm text-muted-foreground">/ FIRE Number</span>
                <span className="font-bold">{formatEur(fireDashboard.fire_number)}</span>
              </div>
              <div className="w-full h-4 bg-surface-alt rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${progressColor(fireDashboard.fire_progress_pct)}`}
                  style={{ width: `${Math.min(fireDashboard.fire_progress_pct, 100)}%` }}
                />
              </div>
              <div className="text-right text-sm font-medium mt-1">{fireDashboard.fire_progress_pct}%</div>
            </div>

            {/* FIRE Variants */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FireCard title="Lean FIRE" amount={fireDashboard.lean_fire} description="60% lifestyle frugal" icon="🌿" />
              <FireCard title="FIRE Standard" amount={fireDashboard.fire_number} description="Règle des 4%" icon="🔥" />
              <FireCard title="Fat FIRE" amount={fireDashboard.fat_fire} description="120% lifestyle confortable" icon="💎" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface rounded-xl p-5 border border-border">
                <h4 className="font-semibold mb-1">Coast FIRE</h4>
                <div className="text-2xl font-bold">{formatEur(fireDashboard.coast_fire)}</div>
                <p className="text-xs text-muted-foreground mt-1">Montant nécessaire maintenant pour arrêter d&apos;épargner et laisser les intérêts composés faire le travail</p>
              </div>
              <div className="bg-surface rounded-xl p-5 border border-border">
                <h4 className="font-semibold mb-1">Revenus passifs mensuels</h4>
                <div className="text-2xl font-bold">{formatEur(fireDashboard.passive_income_monthly)}</div>
                <p className="text-xs text-muted-foreground mt-1">Dividendes + loyers + staking estimés</p>
              </div>
            </div>

            {/* Patrimoine Breakdown */}
            {patrimoine && (
              <div className="bg-surface rounded-xl p-6 border border-border">
                <h3 className="text-lg font-semibold mb-4">Répartition du patrimoine</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <AssetBar label="Actions" value={patrimoine.stocks} pct={patrimoine.stocks_pct} color="bg-blue-500" />
                  <AssetBar label="Obligations" value={patrimoine.bonds} pct={patrimoine.bonds_pct} color="bg-sky-500" />
                  <AssetBar label="Immobilier" value={patrimoine.real_estate} pct={patrimoine.real_estate_pct} color="bg-emerald-500" />
                  <AssetBar label="Crypto" value={patrimoine.crypto} pct={patrimoine.crypto_pct} color="bg-orange-500" />
                  <AssetBar label="Épargne" value={patrimoine.savings} pct={patrimoine.savings_pct} color="bg-violet-500" />
                  <AssetBar label="Liquidités" value={patrimoine.cash} pct={patrimoine.cash_pct} color="bg-slate-500" />
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'optimize' && (
          <motion.div
            key="opt"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            {isOptimizing ? (
              <div className="space-y-4">
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
              </div>
            ) : optimization ? (
              <>
                <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 rounded-xl p-5 border border-orange-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-5 h-5 text-orange-400" />
                    <h3 className="font-semibold">Recommandation</h3>
                  </div>
                  <p className="text-sm">{optimization.summary}</p>
                </div>

                <div className="space-y-3">
                  {optimization.levers.map((lever, i) => (
                    <LeverCard key={i} lever={lever} isBest={lever.lever_name === optimization.best_lever} />
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Sliders className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Lancez l&apos;optimisation pour voir les leviers</p>
                <Button className="mt-4" onClick={() => runOptimization()}>
                  Analyser les leviers
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'settings' && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div className="bg-surface rounded-xl p-6 border border-border max-w-2xl">
              <h3 className="text-lg font-semibold mb-4">Profil retraite</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Année de naissance" value={form.birth_year} onChange={(v) => setForm({ ...form, birth_year: Number(v) })} type="number" />
                <FormField label="Âge cible retraite" value={form.target_retirement_age} onChange={(v) => setForm({ ...form, target_retirement_age: Number(v) })} type="number" />
                <FormField label="Revenus mensuels (€)" value={form.current_monthly_income} onChange={(v) => setForm({ ...form, current_monthly_income: Number(v) })} type="number" />
                <FormField label="Dépenses mensuelles (€)" value={form.current_monthly_expenses} onChange={(v) => setForm({ ...form, current_monthly_expenses: Number(v) })} type="number" />
                <FormField label="Épargne mensuelle (€)" value={form.monthly_savings} onChange={(v) => setForm({ ...form, monthly_savings: Number(v) })} type="number" />
                <FormField label="Trimestres acquis" value={form.pension_quarters_acquired} onChange={(v) => setForm({ ...form, pension_quarters_acquired: Number(v) })} type="number" />
                <FormField label="Lifestyle cible (%)" value={form.target_lifestyle_pct} onChange={(v) => setForm({ ...form, target_lifestyle_pct: Number(v) })} type="number" />
                <FormField label="Inflation (%)" value={form.inflation_rate_pct} onChange={(v) => setForm({ ...form, inflation_rate_pct: Number(v) })} type="number" step="0.1" />
                <FormField label="Espérance de vie" value={form.life_expectancy} onChange={(v) => setForm({ ...form, life_expectancy: Number(v) })} type="number" />
              </div>
              <div className="mt-6 flex justify-end">
                <Button onClick={handleSaveProfile} disabled={isSaving}>
                  {isSaving ? 'Enregistrement…' : 'Enregistrer & Simuler'}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────

function KPICard({ label, value, icon, color, sub }: {
  label: string; value: string; icon: React.ReactNode; color?: string; sub?: string
}) {
  return (
    <div className="bg-surface rounded-xl p-4 border border-border">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className={`text-xl font-bold ${color || ''}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  )
}

function FireCard({ title, amount, description, icon }: {
  title: string; amount: number; description: string; icon: string
}) {
  return (
    <div className="bg-surface rounded-xl p-5 border border-border text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <h4 className="font-semibold text-sm">{title}</h4>
      <div className="text-xl font-bold mt-1">{formatEur(amount)}</div>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
  )
}

function AssetBar({ label, value, pct, color }: {
  label: string; value: number; pct: number; color: string
}) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="text-muted-foreground">{pct}%</span>
      </div>
      <div className="w-full h-2 bg-surface-alt rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">{formatEur(value)}</div>
    </div>
  )
}

function LeverCard({ lever, isBest }: { lever: OptimizationLever; isBest: boolean }) {
  return (
    <div className={`bg-surface rounded-xl p-4 border ${isBest ? 'border-orange-500/50 bg-orange-500/5' : 'border-border'}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            {isBest && <CheckCircle className="w-4 h-4 text-orange-400" />}
            <h4 className="font-semibold">{lever.lever_name}</h4>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{lever.description}</p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-emerald-400">
            {lever.years_gained > 0 ? `−${lever.years_gained} ans` : '—'}
          </div>
          <div className="text-xs text-muted-foreground">
            Succès: {lever.new_success_rate}%
          </div>
        </div>
      </div>
    </div>
  )
}

function FormField({ label, value, onChange, type = 'text', step }: {
  label: string; value: string | number; onChange: (v: string) => void; type?: string; step?: string
}) {
  return (
    <div>
      <label className="text-sm text-muted-foreground block mb-1">{label}</label>
      <input
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
    </div>
  )
}
