'use client'

import { useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { formatAmount } from '@/lib/format'

interface PatrimoineChartProps {
  data: { date: string; total: number }[]
  isLoading?: boolean
}

const PERIODS = [
  { key: '3M', label: '3M', months: 3 },
  { key: '6M', label: '6M', months: 6 },
  { key: '1A', label: '1A', months: 12 },
  { key: 'ALL', label: 'Tout', months: 999 },
] as const

/**
 * Patrimoine evolution line chart with period toggle.
 */
export function PatrimoineChart({ data, isLoading }: PatrimoineChartProps) {
  const [period, setPeriod] = useState<string>('6M')

  if (isLoading) {
    return (
      <div className="rounded-omni-lg border border-border bg-surface p-5 animate-pulse">
        <div className="h-4 w-40 bg-surface-elevated rounded mb-4" />
        <div className="h-48 bg-surface-elevated rounded" />
      </div>
    )
  }

  if (!data.length) return null

  // Filter by period
  const now = new Date()
  const selectedPeriod = PERIODS.find((p) => p.key === period) || PERIODS[1]
  const cutoff = new Date(now)
  cutoff.setMonth(cutoff.getMonth() - selectedPeriod.months)

  const filtered = selectedPeriod.key === 'ALL'
    ? data
    : data.filter((d) => new Date(d.date) >= cutoff)

  const chartData = filtered.map((d) => ({
    date: new Intl.DateTimeFormat('fr-FR', {
      month: 'short',
      year: filtered.length > 12 ? '2-digit' : undefined,
      day: filtered.length <= 7 ? 'numeric' : undefined,
    }).format(new Date(d.date)),
    rawDate: d.date,
    total: d.total / 100, // centimes → euros
  }))

  const minVal = Math.min(...chartData.map((d) => d.total))
  const maxVal = Math.max(...chartData.map((d) => d.total))
  const yMin = Math.floor(minVal * 0.97)
  const yMax = Math.ceil(maxVal * 1.03)

  return (
    <div className="rounded-omni-lg border border-border bg-surface p-3 sm:p-5">
      <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
        <h3 className="text-xs sm:text-sm font-semibold text-foreground">Évolution du patrimoine</h3>
        <div className="flex bg-surface-elevated rounded-omni-sm p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-2.5 py-1 text-xs rounded-omni-sm transition-colors ${
                period === p.key
                  ? 'bg-brand text-white font-medium'
                  : 'text-foreground-tertiary hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <defs>
            <linearGradient id="patrimoine-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.5} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: 'var(--color-foreground-tertiary)' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 10, fill: 'var(--color-foreground-tertiary)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
            width={40}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null
              const val = payload[0].value as number
              return (
                <div className="bg-surface border border-border rounded-omni-sm px-3 py-2 shadow-lg">
                  <p className="text-xs text-foreground-tertiary">{payload[0].payload.rawDate}</p>
                  <p className="text-sm font-bold text-foreground">{formatAmount(Math.round(val * 100))}</p>
                </div>
              )
            }}
          />
          <Line
            type="monotone"
            dataKey="total"
            stroke="var(--color-brand)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, fill: 'var(--color-brand)' }}
            isAnimationActive={true}
            animationDuration={800}
            animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
