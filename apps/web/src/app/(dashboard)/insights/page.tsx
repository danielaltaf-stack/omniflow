'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Lightbulb,
  Target,
  AlertTriangle,
  CheckCircle,
  Info,
  X,
  Zap,
  ArrowRight,
  Calendar,
  RefreshCw,
  Loader2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { formatAmount, formatDate } from '@/lib/format'
import { useInsightsStore } from '@/stores/insights-store'
import { useAuthStore } from '@/stores/auth-store'
import type { Anomaly, InsightTip, BudgetItem, ForecastPoint, ForecastData, BudgetCurrentResponse } from '@/types/api'

// ── Category labels (French) ────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  alimentation: 'Alimentation',
  restaurant: 'Restaurant',
  transport: 'Transport',
  logement: 'Logement',
  energie: 'Énergie',
  telecom: 'Télécom',
  assurance: 'Assurance',
  sante: 'Santé',
  loisirs: 'Loisirs',
  shopping: 'Shopping',
  abonnement: 'Abonnements',
  frais_bancaires: 'Frais bancaires',
  impots: 'Impôts',
  epargne: 'Épargne',
  investissement: 'Investissement',
  autre: 'Autre',
}

const CATEGORY_COLORS: Record<string, string> = {
  alimentation: 'bg-orange-500',
  restaurant: 'bg-red-500',
  transport: 'bg-blue-500',
  logement: 'bg-indigo-500',
  energie: 'bg-yellow-500',
  telecom: 'bg-cyan-500',
  assurance: 'bg-teal-500',
  sante: 'bg-pink-500',
  loisirs: 'bg-purple-500',
  shopping: 'bg-fuchsia-500',
  abonnement: 'bg-violet-500',
  frais_bancaires: 'bg-red-400',
  impots: 'bg-gray-500',
  autre: 'bg-gray-400',
}

type ForecastDays = 7 | 14 | 30 | 60
type BudgetLevel = 'comfortable' | 'optimized' | 'aggressive'

export default function InsightsPage() {
  const { isAuthenticated } = useAuthStore()
  const {
    forecast,
    anomalies,
    tips,
    budgetCurrent,
    isLoadingForecast,
    isLoadingAnomalies,
    isLoadingTips,
    isLoadingBudget,
    isGeneratingBudget,
    fetchForecast,
    fetchAnomalies,
    fetchTips,
    fetchCurrentBudget,
    generateBudget,
    dismissInsight,
  } = useInsightsStore()

  const [forecastDays, setForecastDays] = useState<ForecastDays>(30)
  const [budgetLevel, setBudgetLevel] = useState<BudgetLevel>('optimized')
  const [showAllBudgets, setShowAllBudgets] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) return
    fetchForecast(forecastDays)
    fetchAnomalies()
    fetchTips()
    fetchCurrentBudget()
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    fetchForecast(forecastDays)
  }, [forecastDays])

  const handleGenerateBudget = async () => {
    await generateBudget(budgetLevel, 3)
  }

  const isLoading = isLoadingForecast && isLoadingAnomalies && isLoadingTips && isLoadingBudget

  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-5 py-4 sm:py-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-brand/10 flex items-center justify-center">
            <Brain className="h-5 w-5 text-brand" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Intelligence IA</h1>
            <p className="text-sm text-foreground-secondary">
              Prévisions, anomalies et conseils personnalisés
            </p>
          </div>
        </div>
      </motion.div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <div className="space-y-5">
          {/* ── Anomalies Alert Banner ──────────────────── */}
          {anomalies && anomalies.count > 0 && (
            <AnomalySection
              anomalies={anomalies.anomalies}
              onDismiss={dismissInsight}
            />
          )}

          {/* ── Forecast Section ───────────────────────── */}
          <ForecastSection
            forecast={forecast}
            isLoading={isLoadingForecast}
            days={forecastDays}
            onDaysChange={setForecastDays}
          />

          {/* ── Budget Progress Section ────────────────── */}
          <BudgetSection
            budgetCurrent={budgetCurrent}
            isLoading={isLoadingBudget}
            isGenerating={isGeneratingBudget}
            level={budgetLevel}
            onLevelChange={setBudgetLevel}
            onGenerate={handleGenerateBudget}
            showAll={showAllBudgets}
            onToggleShowAll={() => setShowAllBudgets(!showAllBudgets)}
          />

          {/* ── Insights & Tips Section ────────────────── */}
          {tips && tips.count > 0 && (
            <TipsSection tips={tips.tips} isLoading={isLoadingTips} />
          )}

          {/* Empty state */}
          {!anomalies?.count && !tips?.count && !budgetCurrent?.budgets?.length && !forecast?.forecast?.length && (
            <EmptyState />
          )}
        </div>
      )}
    </div>
  )
}

// ── Anomaly Section ─────────────────────────────────────────

function AnomalySection({
  anomalies,
  onDismiss,
}: {
  anomalies: Anomaly[]
  onDismiss: (id: string) => void
}) {
  const criticals = anomalies.filter((a) => a.severity === 'critical')
  const warnings = anomalies.filter((a) => a.severity === 'warning')
  const infos = anomalies.filter((a) => a.severity === 'info')

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert className="h-4.5 w-4.5 text-warning" />
        <h2 className="text-base font-semibold text-foreground">
          Anomalies détectées ({anomalies.length})
        </h2>
      </div>

      <div className="space-y-2.5">
        {[...criticals, ...warnings, ...infos].map((anomaly, i) => (
          <AnomalyCard
            key={anomaly.id}
            anomaly={anomaly}
            index={i}
            onDismiss={() => onDismiss(anomaly.id)}
          />
        ))}
      </div>
    </motion.div>
  )
}

function AnomalyCard({
  anomaly,
  index,
  onDismiss,
}: {
  anomaly: Anomaly
  index: number
  onDismiss: () => void
}) {
  const severityConfig = {
    critical: {
      border: 'border-loss/30',
      bg: 'bg-loss/5',
      icon: AlertTriangle,
      iconColor: 'text-loss',
      badge: 'bg-loss/10 text-loss',
      label: 'Critique',
    },
    warning: {
      border: 'border-warning/30',
      bg: 'bg-warning/5',
      icon: AlertTriangle,
      iconColor: 'text-warning',
      badge: 'bg-warning/10 text-warning',
      label: 'Attention',
    },
    info: {
      border: 'border-info/30',
      bg: 'bg-info/5',
      icon: Info,
      iconColor: 'text-info',
      badge: 'bg-info/10 text-info',
      label: 'Info',
    },
  }

  const config = severityConfig[anomaly.severity] || severityConfig.info
  const Icon = config.icon

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={{ delay: index * 0.05 }}
      className={`rounded-omni-lg border ${config.border} ${config.bg} p-4 flex items-start gap-3`}
    >
      <div className={`mt-0.5 h-8 w-8 rounded-full flex items-center justify-center ${config.bg}`}>
        <Icon className={`h-4 w-4 ${config.iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${config.badge}`}>
            {config.label}
          </span>
          {anomaly.confidence < 1.0 && (
            <span className="text-[10px] text-foreground-tertiary">
              {Math.round(anomaly.confidence * 100)}% confiance
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-foreground">{anomaly.title}</p>
        <p className="text-xs text-foreground-secondary mt-0.5 line-clamp-2">
          {anomaly.description}
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="p-1.5 rounded-omni-sm hover:bg-surface-elevated text-foreground-tertiary hover:text-foreground transition-colors flex-shrink-0"
        title="Ignorer"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  )
}

// ── Forecast Section ────────────────────────────────────────

function ForecastSection({
  forecast,
  isLoading,
  days,
  onDaysChange,
}: {
  forecast: ForecastData | null
  isLoading: boolean
  days: ForecastDays
  onDaysChange: (d: ForecastDays) => void
}) {
  if (isLoading) {
    return (
      <div className="rounded-omni-lg border border-border bg-background-tertiary p-5">
        <Skeleton className="h-5 w-48 mb-4" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!forecast || !forecast.forecast?.length) {
    return null
  }

  // Prepare chart data
  const chartData = forecast.forecast.map((p) => ({
    date: new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
    rawDate: p.date,
    predicted: p.predicted / 100,
    lower: p.lower_bound / 100,
    upper: p.upper_bound / 100,
  }))

  const expectedNet = (forecast.expected_income - forecast.expected_expenses) / 100

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-omni-lg border border-border bg-background-tertiary p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4.5 w-4.5 text-brand" />
          <h2 className="text-base font-semibold text-foreground">
            Prévision de solde
          </h2>
        </div>
        {/* Period selector */}
        <div className="flex items-center gap-1 p-0.5 rounded-full bg-surface border border-border">
          {([7, 14, 30, 60] as ForecastDays[]).map((d) => (
            <button
              key={d}
              onClick={() => onDaysChange(d)}
              className={`
                px-2.5 py-1 rounded-full text-[11px] font-medium transition-all
                ${days === d ? 'bg-brand text-white' : 'text-foreground-secondary hover:text-foreground'}
              `}
            >
              {d}j
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <MiniStat
          label="Solde actuel"
          value={formatAmount(forecast.current_balance)}
          color="text-foreground"
        />
        <MiniStat
          label="Revenus prévus"
          value={formatAmount(forecast.expected_income)}
          color="text-gain"
        />
        <MiniStat
          label="Dépenses prévues"
          value={formatAmount(forecast.expected_expenses)}
          color="text-loss"
        />
        <MiniStat
          label="Flux net prévu"
          value={formatAmount(Math.abs(forecast.expected_income - forecast.expected_expenses))}
          color={expectedNet >= 0 ? 'text-gain' : 'text-loss'}
          prefix={expectedNet >= 0 ? '+' : '-'}
        />
      </div>

      {/* Overdraft warning */}
      {forecast.overdraft_risk && (
        <div className="flex items-center gap-2 p-2.5 rounded-omni-sm bg-loss/5 border border-loss/20 mb-4">
          <AlertTriangle className="h-4 w-4 text-loss flex-shrink-0" />
          <p className="text-xs text-loss">
            Risque de découvert détecté
            {forecast.overdraft_date && (
              <> le <span className="font-semibold">{formatDate(forecast.overdraft_date)}</span></>
            )}
          </p>
        </div>
      )}

      {/* Chart */}
      <div className="h-56 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6C5CE7" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#6C5CE7" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6C5CE7" stopOpacity={0.08} />
                <stop offset="100%" stopColor="#6C5CE7" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) =>
                v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`
              }
              width={45}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value: number | undefined) => [
                `${(value ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`,
                '',
              ]}
            />
            {/* Confidence band */}
            <Area
              type="monotone"
              dataKey="upper"
              stroke="none"
              fill="confidenceGradient"
              fillOpacity={1}
            />
            <Area
              type="monotone"
              dataKey="lower"
              stroke="none"
              fill="var(--bg-tertiary)"
              fillOpacity={1}
            />
            {/* Predicted line */}
            <Area
              type="monotone"
              dataKey="predicted"
              stroke="#6C5CE7"
              strokeWidth={2}
              fill="forecastGradient"
              fillOpacity={1}
              dot={false}
              activeDot={{ r: 4, fill: '#6C5CE7' }}
            />
            <ReferenceLine
              y={0}
              stroke="var(--border)"
              strokeDasharray="4 4"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Recurring transactions */}
      {forecast.recurring && forecast.recurring.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs font-medium text-foreground-secondary mb-2">
            Prochaines dépenses récurrentes détectées
          </p>
          <div className="flex flex-wrap gap-2">
            {forecast.recurring.slice(0, 5).map((r, i) => (
              <span
                key={i}
                className="text-[11px] px-2.5 py-1 rounded-full bg-surface border border-border text-foreground-secondary"
              >
                {r.merchant} · {formatAmount(Math.abs(r.avg_amount))}
                <span className="text-foreground-tertiary ml-1">
                  → {new Date(r.next_expected).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

function MiniStat({
  label,
  value,
  color,
  prefix,
}: {
  label: string
  value: string
  color: string
  prefix?: string
}) {
  return (
    <div>
      <p className="text-[11px] text-foreground-tertiary mb-0.5">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${color}`}>
        {prefix}{value}
      </p>
    </div>
  )
}

// ── Budget Section ──────────────────────────────────────────

function BudgetSection({
  budgetCurrent,
  isLoading,
  isGenerating,
  level,
  onLevelChange,
  onGenerate,
  showAll,
  onToggleShowAll,
}: {
  budgetCurrent: BudgetCurrentResponse | null
  isLoading: boolean
  isGenerating: boolean
  level: BudgetLevel
  onLevelChange: (l: BudgetLevel) => void
  onGenerate: () => void
  showAll: boolean
  onToggleShowAll: () => void
}) {
  if (isLoading) {
    return (
      <div className="rounded-omni-lg border border-border bg-background-tertiary p-5">
        <Skeleton className="h-5 w-48 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    )
  }

  const budgets = budgetCurrent?.budgets ?? []
  const summary = budgetCurrent?.summary
  const displayBudgets = showAll ? budgets : budgets.slice(0, 5)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="rounded-omni-lg border border-border bg-background-tertiary p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="h-4.5 w-4.5 text-brand" />
          <h2 className="text-base font-semibold text-foreground">
            Budgets intelligents
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Level selector */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-full bg-surface border border-border">
            {(['comfortable', 'optimized', 'aggressive'] as BudgetLevel[]).map((l) => (
              <button
                key={l}
                onClick={() => onLevelChange(l)}
                className={`
                  px-2 py-1 rounded-full text-[10px] font-medium transition-all
                  ${level === l ? 'bg-brand text-white' : 'text-foreground-secondary hover:text-foreground'}
                `}
              >
                {l === 'comfortable' ? 'Confort' : l === 'optimized' ? 'Optimisé' : 'Agressif'}
              </button>
            ))}
          </div>
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-brand text-white hover:bg-brand-dark transition-colors disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            Générer
          </button>
        </div>
      </div>

      {/* Summary bar if we have budgets */}
      {summary && budgets.length > 0 && (
        <div className="flex items-center gap-4 p-3 rounded-omni-sm bg-surface mb-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-foreground-secondary">
                Budget global ({summary.days_remaining}j restants)
              </span>
              <span className="text-xs font-medium tabular-nums">
                {formatAmount(summary.total_spent)} / {formatAmount(summary.total_limit)}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-background overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, summary.total_progress_pct)}%` }}
                transition={{ delay: 0.2, duration: 0.6, ease: 'easeOut' }}
                className={`h-full rounded-full ${
                  summary.total_progress_pct > 100
                    ? 'bg-loss'
                    : summary.total_progress_pct > 80
                      ? 'bg-warning'
                      : 'bg-gain'
                }`}
              />
            </div>
          </div>
          <div className="text-right">
            <p className={`text-lg font-bold tabular-nums ${
              summary.total_progress_pct > 100 ? 'text-loss' : 'text-gain'
            }`}>
              {summary.total_progress_pct.toFixed(0)}%
            </p>
          </div>
        </div>
      )}

      {/* Budget categories */}
      {budgets.length > 0 ? (
        <div className="space-y-3">
          {displayBudgets.map((b, i) => (
            <BudgetProgressRow key={b.category} budget={b} index={i} />
          ))}

          {budgets.length > 5 && (
            <button
              onClick={onToggleShowAll}
              className="flex items-center gap-1 text-xs text-brand hover:text-brand-light transition-colors mx-auto"
            >
              {showAll ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Voir moins
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Voir les {budgets.length - 5} autres
                </>
              )}
            </button>
          )}
        </div>
      ) : (
        <div className="text-center py-6">
          <Target className="h-10 w-10 text-foreground-tertiary mx-auto mb-3" />
          <p className="text-sm text-foreground-secondary">
            Aucun budget configuré.
          </p>
          <p className="text-xs text-foreground-tertiary mt-1">
            Cliquez sur &quot;Générer&quot; pour créer des budgets automatiques basés sur vos habitudes.
          </p>
        </div>
      )}
    </motion.div>
  )
}

function BudgetProgressRow({
  budget,
  index,
}: {
  budget: BudgetItem
  index: number
}) {
  const pct = budget.progress_pct
  const barColor =
    pct > 100 ? 'bg-loss' : pct > 80 ? 'bg-warning' : 'bg-gain'
  const colorClass = CATEGORY_COLORS[budget.category] || 'bg-gray-400'
  const label = CATEGORY_LABELS[budget.category] || budget.category

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${colorClass}`} />
          <span className="text-sm text-foreground">{label}</span>
          {budget.is_auto && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-brand/10 text-brand font-medium">
              Auto
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground-tertiary tabular-nums">
            {formatAmount(budget.spent)} / {formatAmount(budget.limit)}
          </span>
          <span className={`text-xs font-semibold tabular-nums ${
            pct > 100 ? 'text-loss' : pct > 80 ? 'text-warning' : 'text-gain'
          }`}>
            {pct.toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-surface overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, pct)}%` }}
          transition={{ delay: 0.15 + index * 0.04, duration: 0.5, ease: 'easeOut' }}
          className={`h-full rounded-full ${barColor}`}
        />
      </div>
      {budget.remaining > 0 && budget.daily_available > 0 && (
        <p className="text-[10px] text-foreground-tertiary mt-0.5">
          {formatAmount(budget.daily_available)}/jour restant
        </p>
      )}
    </motion.div>
  )
}

// ── Tips Section ────────────────────────────────────────────

function TipsSection({
  tips,
  isLoading,
}: {
  tips: InsightTip[]
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="rounded-omni-lg border border-border bg-background-tertiary p-5">
        <Skeleton className="h-5 w-48 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="h-4.5 w-4.5 text-warning" />
        <h2 className="text-base font-semibold text-foreground">
          Conseils personnalisés
        </h2>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {tips.map((tip, i) => (
          <TipCard key={i} tip={tip} index={i} />
        ))}
      </div>
    </motion.div>
  )
}

function TipCard({ tip, index }: { tip: InsightTip; index: number }) {
  const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
    spending_trend: { icon: TrendingDown, color: 'text-info', bg: 'bg-info/10' },
    savings_opportunity: { icon: Zap, color: 'text-gain', bg: 'bg-gain/10' },
    achievement: { icon: CheckCircle, color: 'text-gain', bg: 'bg-gain/10' },
    warning: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
    tip: { icon: Lightbulb, color: 'text-brand', bg: 'bg-brand/10' },
  }

  const config = typeConfig[tip.type] || typeConfig.tip!
  const Icon = config!.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 + index * 0.06 }}
      className="rounded-omni-lg border border-border bg-background-tertiary p-4 flex items-start gap-3"
    >
      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${config.bg} flex-shrink-0`}>
        <Icon className={`h-4 w-4 ${config.color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{tip.title}</p>
        <p className="text-xs text-foreground-secondary mt-0.5 line-clamp-3">
          {tip.description}
        </p>
      </div>
    </motion.div>
  )
}

// ── Empty State ─────────────────────────────────────────────

function EmptyState() {
  return (
    <motion.div
      className="flex flex-col items-center text-center py-16"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="h-16 w-16 rounded-full bg-brand/10 flex items-center justify-center">
        <Brain className="h-8 w-8 text-brand" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-foreground">
        Pas encore assez de données
      </h2>
      <p className="mt-2 text-sm text-foreground-secondary max-w-md">
        L&apos;intelligence artificielle a besoin de quelques semaines de transactions
        pour générer des prévisions, détecter des anomalies et vous donner des conseils personnalisés.
      </p>
    </motion.div>
  )
}

// ── Loading Skeleton ────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      <div className="rounded-omni-lg border border-border bg-background-tertiary p-5">
        <Skeleton className="h-5 w-48 mb-4" />
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <Skeleton className="h-3 w-16 mb-1" />
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </div>
        <Skeleton className="h-56 w-full" />
      </div>

      <div className="rounded-omni-lg border border-border bg-background-tertiary p-5">
        <Skeleton className="h-5 w-40 mb-4" />
        <Skeleton className="h-10 w-full mb-3" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-2 w-full" />
          </div>
        ))}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-omni-lg border border-border bg-background-tertiary p-4">
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
