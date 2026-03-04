'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts'
import { formatAmount } from '@/lib/format'

interface TopCategory {
  category: string
  total: number // centimes
  count: number
  percentage: number
}

interface ExpensesBarChartProps {
  categories: TopCategory[]
  isLoading?: boolean
}

const BAR_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#06b6d4', '#6366f1', '#a855f7', '#ec4899',
]

/**
 * Horizontal bar chart showing top 10 expense categories.
 */
export function ExpensesBarChart({ categories, isLoading }: ExpensesBarChartProps) {
  if (isLoading) {
    return (
      <div className="rounded-omni-lg border border-border bg-surface p-5 animate-pulse">
        <div className="h-4 w-36 bg-surface-elevated rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-6 bg-surface-elevated rounded" style={{ width: `${100 - i * 10}%` }} />
          ))}
        </div>
      </div>
    )
  }

  if (!categories.length) return null

  const chartData = categories.slice(0, 10).map((c) => ({
    name: c.category || 'Non catégorisé',
    total: Math.abs(c.total) / 100, // to euros (positive)
    totalCentimes: Math.abs(c.total),
    count: c.count,
    pct: c.percentage,
  }))

  return (
    <div className="rounded-omni-lg border border-border bg-surface p-3 sm:p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Top dépenses par catégorie</h3>

      <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 36)}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 5, left: 5, bottom: 0 }}
        >
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: 'var(--color-foreground-tertiary)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: 'var(--color-foreground-secondary)' }}
            tickLine={false}
            axisLine={false}
            width={100}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null
              const d = payload[0].payload
              return (
                <div className="bg-surface border border-border rounded-omni-sm px-3 py-2 shadow-lg">
                  <p className="text-xs font-medium text-foreground">{d.name}</p>
                  <p className="text-sm text-loss font-bold mt-0.5">
                    {formatAmount(d.totalCentimes)}
                  </p>
                  <p className="text-[10px] text-foreground-tertiary">
                    {d.count} transaction{d.count > 1 ? 's' : ''} · {d.pct.toFixed(1)}%
                  </p>
                </div>
              )
            }}
          />
          <Bar
            dataKey="total"
            radius={[0, 4, 4, 0]}
            maxBarSize={24}
            isAnimationActive={true}
            animationDuration={800}
            animationEasing="ease-out"
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
