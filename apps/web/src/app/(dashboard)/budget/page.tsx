'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  PieChart,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  Wallet,
  ShoppingCart,
  DollarSign,
  Calendar,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { formatAmount } from '@/lib/format'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import type { CashFlowData, CashFlowPeriod } from '@/types/api'

type Period = '1m' | '3m' | '6m'

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
  revenu_salaire: 'Salaire',
  revenu_autre: 'Autres revenus',
  transfert: 'Virements',
  autre: 'Autre',
}

export default function BudgetPage() {
  const { isAuthenticated } = useAuthStore()
  const [period, setPeriod] = useState<Period>('3m')
  const [cashFlowData, setCashFlowData] = useState<CashFlowData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const monthsMap: Record<Period, number> = { '1m': 1, '3m': 3, '6m': 6 }

  useEffect(() => {
    if (!isAuthenticated) return
    setIsLoading(true)
    apiClient
      .get<CashFlowData>(`/api/v1/cashflow?period=monthly&months=${monthsMap[period]}`)
      .then(setCashFlowData)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [isAuthenticated, period])

  const summary = cashFlowData?.summary
  const topCategories = cashFlowData?.top_categories ?? []
  const trends = cashFlowData?.trends

  // Savings rate as percentage
  const savingsRate = summary ? Math.round(summary.avg_savings_rate) : 0
  const savingsRateColor = savingsRate >= 20 ? 'text-gain' : savingsRate >= 10 ? 'text-warning' : 'text-loss'

  // Max category total for bar width scaling
  const maxCategoryTotal = topCategories.length > 0
    ? Math.max(...topCategories.map((c) => Math.abs(c.total)))
    : 1

  const trendIcon = (trend: string) => {
    if (trend === 'increasing') return <TrendingUp className="h-3.5 w-3.5 text-loss" />
    if (trend === 'decreasing') return <TrendingDown className="h-3.5 w-3.5 text-gain" />
    return <Minus className="h-3.5 w-3.5 text-foreground-tertiary" />
  }

  return (
    <div className="mx-auto max-w-5xl px-3 sm:px-5 py-4 sm:py-5">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div>
          <h1 className="text-xl font-bold text-foreground">Budget</h1>
          <p className="text-sm text-foreground-secondary mt-1">
            Analyse automatique de vos dépenses et revenus.
          </p>
        </div>

        {/* Period toggle */}
        <div className="flex items-center gap-1 p-1 rounded-full bg-surface border border-border">
          {(['1m', '3m', '6m'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`
                px-3 py-1.5 rounded-full text-xs font-medium transition-all
                ${period === p ? 'bg-brand text-white' : 'text-foreground-secondary hover:text-foreground'}
              `}
            >
              {p === '1m' ? '1 mois' : p === '3m' ? '3 mois' : '6 mois'}
            </button>
          ))}
        </div>
      </motion.div>

      {isLoading ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-omni-lg border border-border bg-background-tertiary p-5">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-32" />
              </div>
            ))}
          </div>
          <div className="rounded-omni-lg border border-border bg-background-tertiary p-5">
            <Skeleton className="h-5 w-40 mb-4" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 mb-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      ) : !summary ? (
        <motion.div
          className="mt-16 flex flex-col items-center text-center py-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="h-16 w-16 rounded-full bg-brand/10 flex items-center justify-center">
            <PieChart className="h-8 w-8 text-brand" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-foreground">Pas encore de données</h2>
          <p className="mt-2 text-sm text-foreground-secondary max-w-md">
            Connectez un compte bancaire pour voir l&apos;analyse automatique de vos dépenses.
          </p>
        </motion.div>
      ) : (
        <div className="mt-5 space-y-4">
          {/* Summary cards */}
          <div className="grid gap-2.5 sm:grid-cols-3">
            <SummaryCard
              title="Revenus"
              amount={summary.avg_income}
              icon={DollarSign}
              color="text-gain"
              bgColor="bg-gain/10"
              trend={trends?.income_trend}
              trendPct={trends?.income_change_pct}
              index={0}
            />
            <SummaryCard
              title="Dépenses"
              amount={summary.avg_expenses}
              icon={ShoppingCart}
              color="text-loss"
              bgColor="bg-loss/10"
              trend={trends?.expense_trend}
              trendPct={trends?.expense_change_pct}
              index={1}
            />
            <SummaryCard
              title="Épargne nette"
              amount={summary.avg_net}
              icon={Wallet}
              color="text-brand"
              bgColor="bg-brand/10"
              index={2}
            />
          </div>

          {/* Revenus vs Dépenses bar */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-omni-lg border border-border bg-background-tertiary p-5"
          >
            <h3 className="text-base font-semibold text-foreground mb-4">Revenus vs Dépenses</h3>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-foreground-secondary">Revenus (moy.)</span>
                  <span className="text-sm font-medium text-gain tabular-nums">{formatAmount(summary.avg_income)}</span>
                </div>
                <div className="h-3 rounded-full bg-surface overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min(100, (summary.avg_income / Math.max(summary.avg_income, summary.avg_expenses)) * 100)}%`,
                    }}
                    transition={{ delay: 0.3, duration: 0.6, ease: 'easeOut' }}
                    className="h-full bg-gain rounded-full"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-foreground-secondary">Dépenses (moy.)</span>
                  <span className="text-sm font-medium text-loss tabular-nums">{formatAmount(summary.avg_expenses)}</span>
                </div>
                <div className="h-3 rounded-full bg-surface overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min(100, (summary.avg_expenses / Math.max(summary.avg_income, summary.avg_expenses)) * 100)}%`,
                    }}
                    transition={{ delay: 0.4, duration: 0.6, ease: 'easeOut' }}
                    className="h-full bg-loss rounded-full"
                  />
                </div>
              </div>
            </div>

            {/* Savings rate gauge */}
            <div className="mt-6 flex items-center gap-4">
              <div className="relative h-16 w-16 flex-shrink-0">
                <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                  <circle
                    cx="18" cy="18" r="15.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-surface"
                  />
                  <motion.circle
                    cx="18" cy="18" r="15.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${Math.max(0, savingsRate)} ${100 - Math.max(0, savingsRate)}`}
                    className={savingsRateColor}
                    initial={{ strokeDasharray: '0 100' }}
                    animate={{ strokeDasharray: `${Math.max(0, Math.min(100, savingsRate))} ${100 - Math.max(0, Math.min(100, savingsRate))}` }}
                    transition={{ delay: 0.5, duration: 0.8, ease: 'easeOut' }}
                  />
                </svg>
                <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${savingsRateColor}`}>
                  {savingsRate}%
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Taux d&apos;épargne</p>
                <p className="text-xs text-foreground-tertiary">
                  {savingsRate >= 20 ? 'Excellent ! Vous épargnez régulièrement.' :
                   savingsRate >= 10 ? 'Correct, mais il y a de la marge.' :
                   'Attention, essayez d\'épargner au moins 10% de vos revenus.'}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Category breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-omni-lg border border-border bg-background-tertiary p-5"
          >
            <h3 className="text-base font-semibold text-foreground mb-4">Dépenses par catégorie</h3>
            {topCategories.length === 0 ? (
              <p className="text-sm text-foreground-tertiary text-center py-4">
                Pas assez de données pour cette période.
              </p>
            ) : (
              <div className="space-y-3">
                {topCategories.map((cat, i) => {
                  const barColor = CATEGORY_COLORS[cat.category] || 'bg-gray-400'
                  const label = CATEGORY_LABELS[cat.category] || cat.category
                  const widthPct = (Math.abs(cat.total) / maxCategoryTotal) * 100

                  return (
                    <motion.div
                      key={cat.category}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25 + i * 0.04, duration: 0.2 }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-foreground">{label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-foreground-tertiary tabular-nums">
                            {cat.percentage.toFixed(0)}%
                          </span>
                          <span className="text-sm font-medium text-foreground tabular-nums">
                            {formatAmount(Math.abs(cat.total))}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-surface overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${widthPct}%` }}
                          transition={{ delay: 0.3 + i * 0.04, duration: 0.5, ease: 'easeOut' }}
                          className={`h-full rounded-full ${barColor}`}
                        />
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </motion.div>

          {/* Trend indicators */}
          {trends && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="grid gap-3 sm:grid-cols-2"
            >
              <div className="rounded-omni-lg border border-border bg-background-tertiary p-4">
                <div className="flex items-center gap-2 mb-1">
                  {trendIcon(trends.income_trend)}
                  <span className="text-sm font-medium text-foreground">Tendance revenus</span>
                </div>
                <p className="text-xs text-foreground-tertiary">
                  {trends.income_trend === 'increasing' ? 'En hausse' :
                   trends.income_trend === 'decreasing' ? 'En baisse' : 'Stable'}
                  {trends.income_change_pct !== 0 && (
                    <span className={trends.income_change_pct > 0 ? 'text-gain' : 'text-loss'}>
                      {' '}({trends.income_change_pct > 0 ? '+' : ''}{trends.income_change_pct.toFixed(1)}%)
                    </span>
                  )}
                </p>
              </div>
              <div className="rounded-omni-lg border border-border bg-background-tertiary p-4">
                <div className="flex items-center gap-2 mb-1">
                  {trendIcon(trends.expense_trend)}
                  <span className="text-sm font-medium text-foreground">Tendance dépenses</span>
                </div>
                <p className="text-xs text-foreground-tertiary">
                  {trends.expense_trend === 'increasing' ? 'En hausse' :
                   trends.expense_trend === 'decreasing' ? 'En baisse' : 'Stable'}
                  {trends.expense_change_pct !== 0 && (
                    <span className={trends.expense_change_pct > 0 ? 'text-loss' : 'text-gain'}>
                      {' '}({trends.expense_change_pct > 0 ? '+' : ''}{trends.expense_change_pct.toFixed(1)}%)
                    </span>
                  )}
                </p>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Helper Components ─────────────────────────────────────

function SummaryCard({
  title,
  amount,
  icon: Icon,
  color,
  bgColor,
  trend,
  trendPct,
  index = 0,
}: {
  title: string
  amount: number
  icon: React.ElementType
  color: string
  bgColor: string
  trend?: string
  trendPct?: number
  index?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
      className="rounded-omni-lg border border-border bg-background-tertiary p-4"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${bgColor}`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <span className="text-sm text-foreground-secondary">{title}</span>
      </div>
      <p className={`text-lg font-bold tabular-nums ${color}`}>
        {formatAmount(Math.abs(amount))}
      </p>
      {trend && trendPct !== undefined && trendPct !== 0 && (
        <p className="text-xs text-foreground-tertiary mt-1">
          {trend === 'increasing' ? '↗' : trend === 'decreasing' ? '↘' : '→'}{' '}
          {trendPct > 0 ? '+' : ''}{trendPct.toFixed(1)}% vs période précédente
        </p>
      )}
    </motion.div>
  )
}
