'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'
import { formatAmount } from '@/lib/format'

interface NetWorthHeroProps {
  total: number       // centimes
  currency?: string
  change?: {
    absolute: number  // centimes
    percentage: number
    period: string
  }
  breakdown?: Record<string, number>
  isLoading?: boolean
}

/**
 * Animated net worth hero component.
 * CountUp animation from 0 to actual value.
 */
export function NetWorthHero({
  total,
  currency = 'EUR',
  change,
  breakdown,
  isLoading,
}: NetWorthHeroProps) {
  const [displayValue, setDisplayValue] = useState(0)

  // CountUp animation
  useEffect(() => {
    if (isLoading) return
    const duration = 1200 // ms
    const steps = 60
    const increment = total / steps
    let current = 0
    let step = 0

    const timer = setInterval(() => {
      step++
      // Ease-out: decelerate
      const t = step / steps
      const eased = 1 - Math.pow(1 - t, 3)
      current = Math.round(total * eased)
      setDisplayValue(current)

      if (step >= steps) {
        setDisplayValue(total)
        clearInterval(timer)
      }
    }, duration / steps)

    return () => clearInterval(timer)
  }, [total, isLoading])

  const changeDirection = change
    ? change.absolute > 0 ? 'up' : change.absolute < 0 ? 'down' : 'stable'
    : 'stable'

  const changeColor = {
    up: 'text-gain',
    down: 'text-loss',
    stable: 'text-foreground-tertiary',
  }[changeDirection]

  const ChangeIcon = {
    up: TrendingUp,
    down: TrendingDown,
    stable: Minus,
  }[changeDirection]

  // Breakdown bar colors
  const breakdownColors: Record<string, string> = {
    'Liquidités': 'bg-blue-500',
    'Épargne': 'bg-indigo-500',
    'Investissements': 'bg-emerald-500',
    'Crypto': 'bg-amber-500',
    'Bourse': 'bg-violet-500',
    'Immobilier': 'bg-cyan-500',
    'Dettes': 'bg-red-500',
    'Autres': 'bg-gray-400',
  }

  const totalAbs = breakdown
    ? Object.values(breakdown).reduce((s, v) => s + Math.abs(v), 0)
    : 0

  if (isLoading) {
    return (
      <div className="bg-surface rounded-omni-lg p-5 border border-border animate-pulse">
        <div className="h-4 w-24 bg-surface-elevated rounded mb-2" />
        <div className="h-9 w-44 bg-surface-elevated rounded mb-3" />
        <div className="h-3 w-full bg-surface-elevated rounded" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-surface/80 backdrop-blur-xl rounded-omni-lg p-3.5 sm:p-5 border border-border hover:border-brand/20 transition-colors"
    >
      <p className="text-xs sm:text-sm text-foreground-secondary mb-1">Patrimoine Net</p>

      {/* Main amount */}
      <div className="flex flex-wrap items-baseline gap-2 sm:gap-3">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
          {formatAmount(displayValue, currency)}
        </h1>

        {change && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.2, duration: 0.3 }}
            className={`flex items-center gap-1 text-sm font-medium ${changeColor}`}
          >
            <ChangeIcon size={14} />
            <span>
              {change.percentage > 0 ? '+' : ''}
              {change.percentage.toFixed(1)}%
            </span>
            <span className="text-foreground-tertiary text-xs">
              ({change.period === '30d' ? '30j' : change.period})
            </span>
          </motion.div>
        )}
      </div>

      {/* Breakdown bar */}
      {breakdown && totalAbs > 0 && (
        <div className="mt-4">
          <div className="flex h-2 rounded-full overflow-hidden bg-surface-elevated">
            {Object.entries(breakdown)
              .filter(([, val]) => val > 0)
              .map(([key, val]) => (
                <motion.div
                  key={key}
                  initial={{ width: 0 }}
                  animate={{ width: `${(Math.abs(val) / totalAbs) * 100}%` }}
                  transition={{ delay: 0.8, duration: 0.6, ease: 'easeOut' }}
                  className={`${breakdownColors[key] || 'bg-gray-400'}`}
                  title={`${key}: ${formatAmount(val)}`}
                />
              ))}
          </div>

          {/* Labels */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {Object.entries(breakdown).map(([key, val]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs text-foreground-secondary">
                <div className={`w-2 h-2 rounded-full ${breakdownColors[key] || 'bg-gray-400'}`} />
                <span>{key}</span>
                <span className="font-medium text-foreground">{formatAmount(Math.abs(val))}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}
