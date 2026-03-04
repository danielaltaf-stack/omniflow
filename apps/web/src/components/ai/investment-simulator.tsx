'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp,
  Calculator,
  Target,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import { useAdvisorStore } from '@/stores/advisor-store'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/ui/glass-card'

// ── Scenario selector ───────────────────────────────────

const SCENARIOS = [
  {
    key: 'conservative',
    label: 'Prudent',
    icon: '🛡️',
    return_pct: '3%',
    description: 'Fonds euros, obligations',
    color: '#06b6d4',
  },
  {
    key: 'moderate',
    label: 'Équilibré',
    icon: '⚖️',
    return_pct: '7%',
    description: 'ETF diversifiés',
    color: '#8b5cf6',
  },
  {
    key: 'aggressive',
    label: 'Dynamique',
    icon: '🚀',
    return_pct: '12%',
    description: 'Actions, crypto',
    color: '#f59e0b',
  },
]

function formatAmount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M€`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k€`
  return `${Math.round(n)}€`
}

function formatFullAmount(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

export function InvestmentSimulator() {
  const { simulation, isLoadingSimulation, runSimulation } = useAdvisorStore()

  const [initialAmount, setInitialAmount] = useState(5000)
  const [monthlyContribution, setMonthlyContribution] = useState(200)
  const [years, setYears] = useState(15)
  const [scenario, setScenario] = useState('moderate')
  const [showInflation, setShowInflation] = useState(false)

  const handleSimulate = useCallback(() => {
    runSimulation({
      initial_amount: initialAmount,
      monthly_contribution: monthlyContribution,
      years,
      scenario,
    })
  }, [initialAmount, monthlyContribution, years, scenario, runSimulation])

  // Auto-simulate on first load
  useEffect(() => {
    handleSimulate()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Build chart data from Monte Carlo result
  const chartData = simulation
    ? simulation.monte_carlo.months.map((month, i) => ({
        month,
        label: month >= 12 ? `${Math.round(month / 12)}a` : `${month}m`,
        p10: Math.round(simulation.monte_carlo.percentiles.p10[i] ?? 0),
        p25: Math.round(simulation.monte_carlo.percentiles.p25[i] ?? 0),
        p50: Math.round(simulation.monte_carlo.percentiles.p50[i] ?? 0),
        p75: Math.round(simulation.monte_carlo.percentiles.p75[i] ?? 0),
        p90: Math.round(simulation.monte_carlo.percentiles.p90[i] ?? 0),
        invested:
          simulation.projection.nominal.find((p) => p.month === month)
            ?.invested ?? 0,
      }))
    : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            background:
              'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(6, 182, 212, 0.1))',
          }}
        >
          <Calculator size={20} className="text-violet-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">
            Simulateur d&apos;investissement
          </h2>
          <p className="text-[13px] text-foreground-secondary">
            Monte-Carlo · 1000 scénarios · Inflation ajustée
          </p>
        </div>
      </div>

      {/* Controls */}
      <GlassCard className="p-5 space-y-5">
        {/* Initial amount slider */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-[13px] font-medium text-foreground">
              Capital initial
            </label>
            <span className="text-sm font-semibold text-violet-400">
              {formatFullAmount(initialAmount)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100000}
            step={500}
            value={initialAmount}
            onChange={(e) => setInitialAmount(Number(e.target.value))}
            className="w-full accent-violet-500 h-1.5"
          />
          <div className="flex justify-between text-[10px] text-foreground-secondary mt-1">
            <span>0€</span>
            <span>100 000€</span>
          </div>
        </div>

        {/* Monthly contribution slider */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-[13px] font-medium text-foreground">
              Versement mensuel
            </label>
            <span className="text-sm font-semibold text-cyan-400">
              {formatFullAmount(monthlyContribution)}/mois
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={5000}
            step={50}
            value={monthlyContribution}
            onChange={(e) => setMonthlyContribution(Number(e.target.value))}
            className="w-full accent-cyan-500 h-1.5"
          />
          <div className="flex justify-between text-[10px] text-foreground-secondary mt-1">
            <span>0€</span>
            <span>5 000€/m</span>
          </div>
        </div>

        {/* Horizon slider */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-[13px] font-medium text-foreground">
              Horizon d&apos;investissement
            </label>
            <span className="text-sm font-semibold text-amber-400">
              {years} ans
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={40}
            step={1}
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
            className="w-full accent-amber-500 h-1.5"
          />
          <div className="flex justify-between text-[10px] text-foreground-secondary mt-1">
            <span>1 an</span>
            <span>40 ans</span>
          </div>
        </div>

        {/* Scenario selector */}
        <div>
          <label className="text-[13px] font-medium text-foreground mb-2 block">
            Profil de risque
          </label>
          <div className="grid grid-cols-3 gap-2">
            {SCENARIOS.map((sc) => (
              <button
                key={sc.key}
                onClick={() => setScenario(sc.key)}
                className={cn(
                  'flex flex-col items-center gap-1 p-3 rounded-xl border transition-all duration-200',
                  scenario === sc.key
                    ? 'border-violet-500/50 bg-violet-500/5 shadow-sm'
                    : 'border-border bg-surface-elevated hover:border-violet-500/20'
                )}
              >
                <span className="text-xl">{sc.icon}</span>
                <span className="text-[12px] font-semibold text-foreground">
                  {sc.label}
                </span>
                <span className="text-[11px] font-medium" style={{ color: sc.color }}>
                  {sc.return_pct}/an
                </span>
                <span className="text-[10px] text-foreground-secondary">
                  {sc.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Simulate button */}
        <button
          onClick={handleSimulate}
          disabled={isLoadingSimulation}
          className={cn(
            'w-full py-2.5 rounded-xl font-medium text-[13px] flex items-center justify-center gap-2 transition-all',
            'bg-gradient-to-r from-violet-600 to-cyan-600 text-white',
            'hover:from-violet-500 hover:to-cyan-500',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isLoadingSimulation ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Sparkles size={16} />
            </motion.div>
          ) : (
            <TrendingUp size={16} />
          )}
          {isLoadingSimulation ? 'Simulation en cours...' : 'Lancer la simulation'}
        </button>
      </GlassCard>

      {/* Results */}
      {simulation && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-5"
        >
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard
              label="Total investi"
              value={formatFullAmount(simulation.summary.total_invested)}
              color="#64748b"
              icon={<Target size={16} />}
            />
            <SummaryCard
              label="Valeur finale"
              value={formatFullAmount(simulation.summary.final_value_nominal)}
              color="#8b5cf6"
              icon={<TrendingUp size={16} />}
              subtext={`+${simulation.summary.gain_pct}%`}
            />
            <SummaryCard
              label="Gains estimés"
              value={formatFullAmount(simulation.summary.total_gain_nominal)}
              color="#22c55e"
              icon={<Sparkles size={16} />}
            />
            <SummaryCard
              label="Valeur réelle"
              value={formatFullAmount(simulation.summary.final_value_real)}
              color="#06b6d4"
              icon={<Info size={16} />}
              subtext="Ajusté inflation"
            />
          </div>

          {/* Monte Carlo chart */}
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">
                Projection Monte-Carlo
              </h3>
              <div className="flex items-center gap-3 text-[10px] text-foreground-secondary">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-violet-500/20" /> Zone 25-75%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-violet-500/40" /> Zone 10-90%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-violet-400" /> Médiane
                </span>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="mcWideBand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="mcNarrowBand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  opacity={0.3}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: 'var(--color-foreground-secondary)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--color-foreground-secondary)' }}
                  tickFormatter={formatAmount}
                  tickLine={false}
                  axisLine={false}
                  width={55}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-surface-elevated)',
                    borderColor: 'var(--color-border)',
                    borderRadius: '12px',
                    fontSize: '12px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                  }}
                  formatter={(value: number | undefined, name: string | undefined) => [
                    formatFullAmount(value ?? 0),
                    name === 'p90'
                      ? 'Optimiste (90%)'
                      : name === 'p75'
                        ? 'Favorable (75%)'
                        : name === 'p50'
                          ? 'Médiane'
                          : name === 'p25'
                            ? 'Défavorable (25%)'
                            : name === 'p10'
                              ? 'Pessimiste (10%)'
                              : name === 'invested'
                                ? 'Investi'
                                : name,
                  ]}
                  labelFormatter={(label: any) => `Après ${label}`}
                />
                {/* Wide band: p10-p90 */}
                <Area
                  dataKey="p90"
                  stroke="none"
                  fill="url(#mcWideBand)"
                  fillOpacity={1}
                  type="monotone"
                />
                <Area
                  dataKey="p10"
                  stroke="none"
                  fill="var(--color-background)"
                  fillOpacity={1}
                  type="monotone"
                />
                {/* Narrow band: p25-p75 */}
                <Area
                  dataKey="p75"
                  stroke="none"
                  fill="url(#mcNarrowBand)"
                  fillOpacity={1}
                  type="monotone"
                />
                <Area
                  dataKey="p25"
                  stroke="none"
                  fill="var(--color-background)"
                  fillOpacity={1}
                  type="monotone"
                />
                {/* Median line */}
                <Area
                  dataKey="p50"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="none"
                  type="monotone"
                  dot={false}
                />
                {/* Invested line */}
                <Area
                  dataKey="invested"
                  stroke="#64748b"
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  fill="none"
                  type="monotone"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </GlassCard>

          {/* Scenario comparison */}
          <GlassCard className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Comparaison des scénarios
            </h3>
            <div className="space-y-3">
              {Object.entries(simulation.scenarios).map(([key, sc]) => {
                const pct =
                  (sc.final_nominal / Math.max(1, sc.total_invested)) * 100 - 100
                return (
                  <div
                    key={key}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border transition-all',
                      key === scenario
                        ? 'border-violet-500/30 bg-violet-500/5'
                        : 'border-border'
                    )}
                  >
                    <div
                      className="w-1 h-10 rounded-full"
                      style={{ backgroundColor: sc.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-foreground">
                          {sc.label}
                        </span>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{
                            backgroundColor: sc.color + '15',
                            color: sc.color,
                          }}
                        >
                          {sc.annual_return_pct}%/an
                        </span>
                      </div>
                      <p className="text-[11px] text-foreground-secondary">
                        {sc.description}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">
                        {formatFullAmount(sc.final_nominal)}
                      </p>
                      <p className="text-[11px] font-medium text-green-400">
                        +{formatFullAmount(sc.total_gain_nominal)} ({pct.toFixed(0)}%)
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </GlassCard>

          {/* Monte Carlo stats */}
          <GlassCard className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Analyse probabiliste
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                <p className="text-[10px] text-foreground-secondary mb-1">
                  Pire cas (10%)
                </p>
                <p className="text-sm font-bold text-red-400">
                  {formatFullAmount(simulation.summary.monte_carlo_worst_case)}
                </p>
              </div>
              <div className="text-center p-3 rounded-xl bg-violet-500/5 border border-violet-500/10">
                <p className="text-[10px] text-foreground-secondary mb-1">
                  Médiane (50%)
                </p>
                <p className="text-sm font-bold text-violet-400">
                  {formatFullAmount(simulation.summary.monte_carlo_median)}
                </p>
              </div>
              <div className="text-center p-3 rounded-xl bg-green-500/5 border border-green-500/10">
                <p className="text-[10px] text-foreground-secondary mb-1">
                  Meilleur cas (90%)
                </p>
                <p className="text-sm font-bold text-green-400">
                  {formatFullAmount(simulation.summary.monte_carlo_best_case)}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-foreground-secondary text-center mt-3">
              Basé sur {simulation.monte_carlo.paths_count} simulations Monte-Carlo avec distribution log-normale
            </p>
          </GlassCard>
        </motion.div>
      )}
    </div>
  )
}

// ── Summary card component ──────────────────────────────

function SummaryCard({
  label,
  value,
  color,
  icon,
  subtext,
}: {
  label: string
  value: string
  color: string
  icon: React.ReactNode
  subtext?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 rounded-xl border border-border bg-surface-elevated"
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span style={{ color }}>{icon}</span>
        <span className="text-[11px] text-foreground-secondary">{label}</span>
      </div>
      <p className="text-sm font-bold text-foreground">{value}</p>
      {subtext && (
        <p className="text-[10px] font-medium mt-0.5" style={{ color }}>
          {subtext}
        </p>
      )}
    </motion.div>
  )
}
