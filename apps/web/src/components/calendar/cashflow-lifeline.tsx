'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatAmount } from '@/lib/format'
import type { CashflowLifelinePoint } from '@/types/api'
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'

interface CashflowLifelineProps {
  data: CashflowLifelinePoint[]
  alertThreshold?: number // centimes
}

/**
 * "Ligne de Vie" — 30-day cashflow projection curve.
 * Shows projected balance with alert zones.
 */
export function CashflowLifeline({ data, alertThreshold = 0 }: CashflowLifelineProps) {
  const chartData = useMemo(() => {
    return data.map((p) => ({
      date: new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
      rawDate: p.date,
      balance: p.projected_balance / 100,
      income: p.day_income / 100,
      expenses: p.day_expenses / 100,
      alert: p.alert,
    }))
  }, [data])

  const minBalance = useMemo(() => Math.min(...chartData.map((d) => d.balance)), [chartData])
  const maxBalance = useMemo(() => Math.max(...chartData.map((d) => d.balance)), [chartData])
  const hasAlert = useMemo(() => chartData.some((d) => d.alert), [chartData])

  const startBalance = chartData[0]?.balance ?? 0
  const endBalance = chartData[chartData.length - 1]?.balance ?? 0
  const trend = endBalance - startBalance

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null
    const d = payload[0].payload
    return (
      <div className="rounded-omni-sm border border-border bg-surface-elevated p-3 shadow-xl">
        <p className="text-xs text-foreground-secondary mb-1">{d.date}</p>
        <p className={`text-sm font-semibold ${d.alert ? 'text-loss' : 'text-foreground'}`}>
          Solde : {formatAmount(d.balance * 100)}
        </p>
        {d.income > 0 && (
          <p className="text-xs text-gain mt-0.5">+ {formatAmount(d.income * 100)}</p>
        )}
        {d.expenses > 0 && (
          <p className="text-xs text-loss mt-0.5">- {formatAmount(d.expenses * 100)}</p>
        )}
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-omni-lg border border-border bg-surface/80 backdrop-blur-xl p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-omni-sm ${hasAlert ? 'bg-loss/10' : 'bg-brand/10'}`}>
            {hasAlert ? (
              <AlertTriangle className="w-4 h-4 text-loss" />
            ) : trend >= 0 ? (
              <TrendingUp className="w-4 h-4 text-gain" />
            ) : (
              <TrendingDown className="w-4 h-4 text-loss" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Ligne de Vie — Trésorerie</h3>
            <p className="text-xs text-foreground-secondary">Projection 30 jours</p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-lg font-bold text-foreground">{formatAmount(endBalance * 100)}</p>
          <p className={`text-xs font-medium ${trend >= 0 ? 'text-gain' : 'text-loss'}`}>
            {trend >= 0 ? '+' : ''}{formatAmount(trend * 100)}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={hasAlert ? '#FF4757' : '#6C5CE7'} stopOpacity={0.3} />
                <stop offset="100%" stopColor={hasAlert ? '#FF4757' : '#6C5CE7'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'var(--foreground-secondary)' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--foreground-secondary)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            {alertThreshold !== undefined && (
              <ReferenceLine
                y={alertThreshold / 100}
                stroke="#FF4757"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
                label={{ value: 'Seuil', fill: '#FF4757', fontSize: 10, position: 'right' }}
              />
            )}
            <Area
              type="monotone"
              dataKey="balance"
              stroke={hasAlert ? '#FF4757' : '#6C5CE7'}
              strokeWidth={2.5}
              fill="url(#balanceGradient)"
              dot={false}
              activeDot={{
                r: 4,
                fill: hasAlert ? '#FF4757' : '#6C5CE7',
                stroke: '#fff',
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Alert banner */}
      {hasAlert && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3 p-2.5 rounded-omni-sm bg-loss/10 border border-loss/20 flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 text-loss flex-shrink-0" />
          <p className="text-xs text-loss">
            Attention — Votre solde pourrait passer sous le seuil d'alerte dans les 30 prochains jours.
          </p>
        </motion.div>
      )}
    </motion.div>
  )
}
