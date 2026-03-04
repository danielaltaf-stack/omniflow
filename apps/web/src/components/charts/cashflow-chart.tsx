'use client'

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
import { formatAmount } from '@/lib/format'
import type { CashFlowPeriod } from '@/types/api'

interface CashFlowChartProps {
  periods: CashFlowPeriod[]
  isLoading?: boolean
}

/**
 * Cash flow area chart: income vs expenses overlaid.
 */
export function CashFlowChart({ periods, isLoading }: CashFlowChartProps) {
  if (isLoading) {
    return (
      <div className="rounded-omni-lg border border-border bg-surface p-5 animate-pulse">
        <div className="h-4 w-32 bg-surface-elevated rounded mb-4" />
        <div className="h-48 bg-surface-elevated rounded" />
      </div>
    )
  }

  if (!periods.length) return null

  const chartData = periods.map((p) => ({
    date: p.date
      ? new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit' }).format(new Date(p.date))
      : '?',
    income: p.income / 100,
    expenses: Math.abs(p.expenses) / 100,
    net: p.net / 100,
    savings_rate: p.savings_rate,
  }))

  return (
    <div className="rounded-omni-lg border border-border bg-surface p-3 sm:p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Cash Flow</h3>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <defs>
            <linearGradient id="income-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="expense-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.5} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: 'var(--color-foreground-tertiary)' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--color-foreground-tertiary)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
            width={40}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0]?.payload
              return (
                <div className="bg-surface border border-border rounded-omni-sm px-3 py-2 shadow-lg">
                  <p className="text-xs text-foreground-tertiary mb-1">{d?.date}</p>
                  <div className="space-y-0.5 text-xs">
                    <p className="text-gain">Revenus: {formatAmount(Math.round((d?.income ?? 0) * 100))}</p>
                    <p className="text-loss">Dépenses: {formatAmount(Math.round((d?.expenses ?? 0) * 100))}</p>
                    <p className="font-medium text-foreground">Net: {formatAmount(Math.round((d?.net ?? 0) * 100))}</p>
                    {d?.savings_rate > 0 && (
                      <p className="text-foreground-secondary">Épargne: {d.savings_rate.toFixed(0)}%</p>
                    )}
                  </div>
                </div>
              )
            }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            iconSize={8}
            formatter={(value: string) => (
              <span className="text-xs text-foreground-secondary">{value}</span>
            )}
          />
          <Area
            type="monotone"
            dataKey="income"
            name="Revenus"
            stroke="#22c55e"
            fill="url(#income-gradient)"
            strokeWidth={2}
            isAnimationActive={true}
            animationDuration={800}
            animationEasing="ease-out"
          />
          <Area
            type="monotone"
            dataKey="expenses"
            name="Dépenses"
            stroke="#ef4444"
            fill="url(#expense-gradient)"
            strokeWidth={2}
            isAnimationActive={true}
            animationDuration={800}
            animationBegin={200}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
