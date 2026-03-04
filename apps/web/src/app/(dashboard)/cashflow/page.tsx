'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  BarChart3,
  Building2,
  Bitcoin,
  CreditCard,
  Heart,
  Lightbulb,
  PieChart,
  RefreshCw,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useCashFlowStore } from '@/stores/cashflow-store'
import { formatAmount, amountColorClass } from '@/lib/format'
import type {
  MonthlyProjection,
  CashFlowSource,
  HealthScoreComponent,
} from '@/types/api'

type TabKey = 'projection' | 'sources' | 'health'

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'projection', label: 'Projection', icon: BarChart3 },
  { key: 'sources', label: 'Sources', icon: PieChart },
  { key: 'health', label: 'Santé', icon: Heart },
]

const SOURCE_ICONS: Record<string, any> = {
  salary: Wallet,
  rent: Building2,
  dividends: BarChart3,
  staking: Bitcoin,
  interest: TrendingUp,
  other_recurring: ArrowUpRight,
  fixed_charges: CreditCard,
  debt_payment: CreditCard,
  re_charges: Building2,
  re_tax: Building2,
  project_saving: Target,
  budget_limit: PieChart,
}

const SOURCE_LABELS: Record<string, string> = {
  salary: 'Salaire',
  rent: 'Loyers',
  dividends: 'Dividendes',
  staking: 'Staking',
  interest: 'Intérêts',
  other_recurring: 'Autres récurrents',
  fixed_charges: 'Charges fixes',
  debt_payment: 'Mensualités dettes',
  re_charges: 'Charges immobilières',
  re_tax: 'Taxe foncière',
  project_saving: 'Épargne projets',
  budget_limit: 'Budget catégories',
}

const GRADE_COLORS: Record<string, string> = {
  'A+': 'text-emerald-400',
  A: 'text-emerald-400',
  'B+': 'text-green-400',
  B: 'text-green-400',
  C: 'text-amber-400',
  D: 'text-orange-400',
  F: 'text-red-400',
}

export default function CashFlowPage() {
  const {
    projection,
    sources,
    health,
    isLoading,
    isLoadingSources,
    isLoadingHealth,
    error,
    fetchAll,
    clearError,
  } = useCashFlowStore()

  const [activeTab, setActiveTab] = useState<TabKey>('projection')

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return (
    <div className="min-h-screen bg-background">
      {/* ── Sticky header ─────────────────────────────── */}
      <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-border bg-background/80 px-5 backdrop-blur-lg">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-brand" />
          <h1 className="text-sm font-semibold text-foreground">
            Cash-Flow Cross-Assets
          </h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchAll}
          disabled={isLoading}
          className="h-8 px-2"
        >
          <RefreshCw
            size={14}
            className={isLoading ? 'animate-spin' : ''}
          />
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-3 sm:px-5 py-4">
        {/* ── Error banner ────────────────────────────── */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-omni-md bg-loss/10 border border-loss/20 px-4 py-3 text-sm text-loss flex items-center justify-between"
          >
            <span>{error}</span>
            <button onClick={clearError} className="text-xs underline">
              Fermer
            </button>
          </motion.div>
        )}

        {/* ── Summary cards ───────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-omni-md" />
            ))}
          </div>
        ) : projection ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <SummaryCard
              label="Revenus (12m)"
              value={projection.annual_summary.total_income}
              icon={<ArrowUpRight size={16} className="text-gain" />}
              color="text-gain"
            />
            <SummaryCard
              label="Dépenses (12m)"
              value={projection.annual_summary.total_expenses}
              icon={<ArrowDownRight size={16} className="text-loss" />}
              color="text-loss"
              negate
            />
            <SummaryCard
              label="Solde net (12m)"
              value={projection.annual_summary.total_net}
              icon={
                projection.annual_summary.total_net >= 0 ? (
                  <TrendingUp size={16} className="text-gain" />
                ) : (
                  <TrendingDown size={16} className="text-loss" />
                )
              }
            />
            <SummaryCard
              label="Score santé"
              customValue={
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={`text-xl font-bold ${
                      GRADE_COLORS[projection.health_score.grade] ||
                      'text-foreground'
                    }`}
                  >
                    {projection.health_score.grade}
                  </span>
                  <span className="text-xs text-foreground-secondary">
                    {projection.health_score.score}/100
                  </span>
                </div>
              }
              icon={<Heart size={16} className="text-brand" />}
            />
          </div>
        ) : null}

        {/* ── Tab bar ─────────────────────────────────── */}
        <div className="flex gap-1 mb-5 border-b border-border">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-brand text-brand'
                    : 'border-transparent text-foreground-secondary hover:text-foreground'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* ── Tab content ─────────────────────────────── */}
        <AnimatePresence mode="wait">
          {activeTab === 'projection' && (
            <motion.div
              key="projection"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              <ProjectionTab
                projection={projection}
                isLoading={isLoading}
              />
            </motion.div>
          )}
          {activeTab === 'sources' && (
            <motion.div
              key="sources"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              <SourcesTab
                sources={sources}
                isLoading={isLoadingSources}
              />
            </motion.div>
          )}
          {activeTab === 'health' && (
            <motion.div
              key="health"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              <HealthTab
                health={health}
                projection={projection}
                isLoading={isLoadingHealth}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}

// ── Summary Card ─────────────────────────────────────────

function SummaryCard({
  label,
  value,
  customValue,
  icon,
  color,
  negate,
}: {
  label: string
  value?: number
  customValue?: React.ReactNode
  icon: React.ReactNode
  color?: string
  negate?: boolean
}) {
  return (
    <div className="rounded-omni-md bg-surface border border-border p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-foreground-secondary">{label}</span>
        {icon}
      </div>
      {customValue ? (
        customValue
      ) : (
        <p
          className={`text-lg font-semibold ${
            color || amountColorClass(value || 0)
          }`}
        >
          {formatAmount(negate ? -(value || 0) : (value || 0))}
        </p>
      )}
    </div>
  )
}

// ── Projection Tab ───────────────────────────────────────

function ProjectionTab({
  projection,
  isLoading,
}: {
  projection: any
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-omni-md" />
        ))}
      </div>
    )
  }

  if (!projection) {
    return (
      <div className="rounded-omni-md bg-surface border border-border p-8 text-center">
        <Zap size={32} className="mx-auto mb-3 text-foreground-tertiary" />
        <p className="text-sm text-foreground-secondary">
          Aucune donnée de projection disponible.
        </p>
        <p className="text-xs text-foreground-tertiary mt-1">
          Ajoutez des comptes bancaires, investissements ou biens immobiliers pour activer la projection.
        </p>
      </div>
    )
  }

  const months: MonthlyProjection[] = projection.monthly_projection
  const maxIncome = Math.max(...months.map((m: MonthlyProjection) => m.income), 1)
  const maxExpense = Math.max(...months.map((m: MonthlyProjection) => m.expenses), 1)
  const maxBar = Math.max(maxIncome, maxExpense)

  return (
    <div className="space-y-4">
      {/* Alerts */}
      {projection.deficit_alerts.length > 0 && (
        <div className="rounded-omni-md bg-loss/5 border border-loss/20 p-4 space-y-2">
          <div className="flex items-center gap-2 text-loss text-sm font-medium">
            <AlertTriangle size={16} />
            {projection.deficit_alerts.length} alerte{projection.deficit_alerts.length > 1 ? 's' : ''} de déficit
          </div>
          {projection.deficit_alerts.map((a: any, i: number) => (
            <p key={i} className="text-xs text-foreground-secondary pl-6">
              {a.recommendation}
            </p>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {projection.surplus_suggestions.length > 0 && (
        <div className="rounded-omni-md bg-gain/5 border border-gain/20 p-4 space-y-2">
          <div className="flex items-center gap-2 text-gain text-sm font-medium">
            <Lightbulb size={16} />
            {projection.surplus_suggestions.length} suggestion{projection.surplus_suggestions.length > 1 ? 's' : ''} d&apos;allocation
          </div>
          {projection.surplus_suggestions.slice(0, 3).map((s: any, i: number) => (
            <p key={i} className="text-xs text-foreground-secondary pl-6">
              {s.message}
            </p>
          ))}
        </div>
      )}

      {/* Monthly bars */}
      <div className="rounded-omni-md bg-surface border border-border p-4">
        <h3 className="text-sm font-medium text-foreground mb-4">
          Projection mensuelle
        </h3>
        <div className="space-y-2">
          {months.map((m: MonthlyProjection) => {
            const monthName = new Intl.DateTimeFormat('fr-FR', {
              month: 'short',
              year: '2-digit',
            }).format(new Date(m.date))

            const incomeW = (m.income / maxBar) * 100
            const expenseW = (m.expenses / maxBar) * 100

            return (
              <div key={m.month} className="group">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[11px] font-medium text-foreground-secondary w-14 capitalize">
                    {monthName}
                  </span>
                  <div className="flex-1 flex gap-1 h-5">
                    <div
                      className="bg-gain/60 rounded-r h-full transition-all"
                      style={{ width: `${incomeW}%` }}
                    />
                    <div
                      className="bg-loss/60 rounded-r h-full transition-all"
                      style={{ width: `${expenseW}%` }}
                    />
                  </div>
                  <span
                    className={`text-[11px] font-mono w-20 text-right ${amountColorClass(m.net)}`}
                  >
                    {m.net >= 0 ? '+' : ''}
                    {formatAmount(m.net)}
                  </span>
                </div>
                {/* Expanded detail on hover */}
                <div className="hidden group-hover:flex gap-4 ml-16 text-[10px] text-foreground-tertiary pb-1">
                  <span>
                    Revenus : {formatAmount(m.income)}
                  </span>
                  <span>
                    Dépenses : {formatAmount(m.expenses)}
                  </span>
                  <span>
                    Cumulé : {formatAmount(m.cumulative)}
                  </span>
                  {m.alerts.length > 0 && (
                    <span className="text-loss">⚠ Alerte</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex gap-4 mt-4 text-[10px] text-foreground-tertiary">
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 bg-gain/60 rounded" />
            Revenus
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 bg-loss/60 rounded" />
            Dépenses
          </div>
        </div>
      </div>

      {/* Cumulative chart (text-based) */}
      <div className="rounded-omni-md bg-surface border border-border p-4">
        <h3 className="text-sm font-medium text-foreground mb-3">
          Trésorerie cumulée
        </h3>
        <div className="space-y-1.5">
          {months.map((m: MonthlyProjection) => {
            const monthName = new Intl.DateTimeFormat('fr-FR', {
              month: 'short',
            }).format(new Date(m.date))

            return (
              <div key={m.month} className="flex items-center gap-2">
                <span className="text-[11px] text-foreground-secondary w-10 capitalize">
                  {monthName}
                </span>
                <div className="flex-1 bg-border/30 rounded-full h-2.5">
                  {m.cumulative >= 0 ? (
                    <div
                      className="bg-brand/70 h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          (m.cumulative /
                            Math.max(
                              ...months.map((x: MonthlyProjection) =>
                                Math.abs(x.cumulative)
                              ),
                              1
                            )) *
                            100,
                          100
                        )}%`,
                      }}
                    />
                  ) : (
                    <div
                      className="bg-loss/70 h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          (Math.abs(m.cumulative) /
                            Math.max(
                              ...months.map((x: MonthlyProjection) =>
                                Math.abs(x.cumulative)
                              ),
                              1
                            )) *
                            100,
                          100
                        )}%`,
                      }}
                    />
                  )}
                </div>
                <span
                  className={`text-[11px] font-mono w-20 text-right ${amountColorClass(
                    m.cumulative
                  )}`}
                >
                  {formatAmount(m.cumulative)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Sources Tab ──────────────────────────────────────────

function SourcesTab({
  sources,
  isLoading,
}: {
  sources: any
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-omni-md" />
        ))}
      </div>
    )
  }

  if (!sources) {
    return (
      <div className="rounded-omni-md bg-surface border border-border p-8 text-center">
        <PieChart size={32} className="mx-auto mb-3 text-foreground-tertiary" />
        <p className="text-sm text-foreground-secondary">
          Aucune source détectée.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="rounded-omni-md bg-surface border border-border p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-foreground-tertiary">Solde mensuel net</p>
          <p className={`text-lg font-semibold ${amountColorClass(sources.net_monthly)}`}>
            {sources.net_monthly >= 0 ? '+' : ''}{formatAmount(sources.net_monthly)}
          </p>
        </div>
        <div className="flex gap-6">
          <div className="text-right">
            <p className="text-[10px] text-foreground-tertiary">Revenus</p>
            <p className="text-sm font-medium text-gain">
              {formatAmount(sources.total_monthly_income)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-foreground-tertiary">Dépenses</p>
            <p className="text-sm font-medium text-loss">
              {formatAmount(sources.total_monthly_expenses)}
            </p>
          </div>
        </div>
      </div>

      {/* Income sources */}
      <SourceList
        title="Sources de revenus"
        sources={sources.income_sources}
        total={sources.total_monthly_income}
        color="gain"
      />

      {/* Expense sources */}
      <SourceList
        title="Sources de dépenses"
        sources={sources.expense_sources}
        total={sources.total_monthly_expenses}
        color="loss"
      />
    </div>
  )
}

function SourceList({
  title,
  sources,
  total,
  color,
}: {
  title: string
  sources: CashFlowSource[]
  total: number
  color: 'gain' | 'loss'
}) {
  if (!sources || sources.length === 0) {
    return (
      <div className="rounded-omni-md bg-surface border border-border p-4">
        <h3 className="text-sm font-medium text-foreground mb-2">{title}</h3>
        <p className="text-xs text-foreground-tertiary">Aucune source détectée.</p>
      </div>
    )
  }

  return (
    <div className="rounded-omni-md bg-surface border border-border p-4">
      <h3 className="text-sm font-medium text-foreground mb-3">{title}</h3>
      <div className="space-y-2">
        {sources.map((src, i) => {
          const Icon = SOURCE_ICONS[src.source_type] || Wallet
          const pct = total > 0 ? ((src.amount_monthly / total) * 100).toFixed(1) : '0'

          return (
            <div key={i} className="flex items-center gap-3">
              <div
                className={`w-7 h-7 rounded-omni-sm flex items-center justify-center ${
                  color === 'gain' ? 'bg-gain/10' : 'bg-loss/10'
                }`}
              >
                <Icon
                  size={14}
                  className={color === 'gain' ? 'text-gain' : 'text-loss'}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-foreground truncate">
                  {src.label}
                </p>
                <p className="text-[10px] text-foreground-tertiary">
                  {SOURCE_LABELS[src.source_type] || src.source_type} · {pct}%
                </p>
              </div>
              <span
                className={`text-[13px] font-mono font-medium ${
                  color === 'gain' ? 'text-gain' : 'text-loss'
                }`}
              >
                {formatAmount(src.amount_monthly)}/mois
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Health Tab ───────────────────────────────────────────

function HealthTab({
  health,
  projection,
  isLoading,
}: {
  health: any
  projection: any
  isLoading: boolean
}) {
  // Prefer projection.health_score if available, otherwise use standalone
  const score = projection?.health_score || health

  if (isLoading && !score) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-40 rounded-omni-md" />
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-omni-md" />
        ))}
      </div>
    )
  }

  if (!score) {
    return (
      <div className="rounded-omni-md bg-surface border border-border p-8 text-center">
        <Heart size={32} className="mx-auto mb-3 text-foreground-tertiary" />
        <p className="text-sm text-foreground-secondary">
          Score non disponible. Ajoutez des données financières.
        </p>
      </div>
    )
  }

  const components = score.components || {}

  return (
    <div className="space-y-4">
      {/* Main score card */}
      <div className="rounded-omni-md bg-surface border border-border p-6 text-center">
        <div className="inline-flex flex-col items-center">
          <span
            className={`text-5xl font-bold ${
              GRADE_COLORS[score.grade] || 'text-foreground'
            }`}
          >
            {score.grade}
          </span>
          <div className="mt-2 flex items-center gap-2">
            <div className="w-32 bg-border/30 rounded-full h-2.5">
              <div
                className="bg-brand h-full rounded-full transition-all"
                style={{
                  width: `${(score.score / score.max_score) * 100}%`,
                }}
              />
            </div>
            <span className="text-sm text-foreground-secondary">
              {score.score}/{score.max_score}
            </span>
          </div>
          <p className="mt-2 text-xs text-foreground-tertiary">
            Score de santé cash-flow cross-assets
          </p>
        </div>
      </div>

      {/* Components breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Object.entries(components).map(([key, comp]) => {
          const c = comp as HealthScoreComponent
          const pct = c.max > 0 ? (c.score / c.max) * 100 : 0
          const barColor =
            pct >= 80
              ? 'bg-gain'
              : pct >= 50
              ? 'bg-amber-400'
              : 'bg-loss'

          return (
            <div
              key={key}
              className="rounded-omni-md bg-surface border border-border p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-medium text-foreground">
                  {c.label}
                </span>
                <span className="text-[13px] font-mono text-foreground-secondary">
                  {c.score}/{c.max}
                </span>
              </div>
              <div className="w-full bg-border/30 rounded-full h-2 mb-2">
                <div
                  className={`${barColor} h-full rounded-full transition-all`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {c.value !== undefined && c.value !== null && (
                <p className="text-[10px] text-foreground-tertiary">
                  Actuel : {c.value}%
                  {c.target !== undefined && c.target !== null
                    ? ` · Cible : ${c.target}%`
                    : ''}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Passive income ratio */}
      {projection?.annual_summary && (
        <div className="rounded-omni-md bg-surface border border-border p-4">
          <h3 className="text-sm font-medium text-foreground mb-3">
            Revenus passifs
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="w-full bg-border/30 rounded-full h-3">
                <div
                  className="bg-brand h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      projection.annual_summary.passive_income_ratio,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
            <span className="text-sm font-medium text-foreground">
              {projection.annual_summary.passive_income_ratio}%
            </span>
          </div>
          <p className="text-[10px] text-foreground-tertiary mt-2">
            Part des revenus passifs (loyers + dividendes + staking + intérêts) sur le total des revenus projetés.
            Cible : ≥ 30%.
          </p>
        </div>
      )}
    </div>
  )
}
