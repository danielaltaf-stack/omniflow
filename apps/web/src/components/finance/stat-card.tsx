'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Sparkline } from '@/components/charts/sparkline'
import { formatAmount } from '@/lib/format'
import { Skeleton } from '@/components/ui/skeleton'

interface StatCardProps {
  title: string
  amount: number           // centimes
  currency?: string
  change?: {
    absolute: number       // centimes
    percentage: number
  }
  icon: LucideIcon
  iconColor?: string
  iconBg?: string
  sparklineData?: number[]
  onClick?: () => void
  isLoading?: boolean
  index?: number           // for stagger animation
}

/**
 * Versatile metric tile with CountUp animation, variation badge, and sparkline.
 * Used for: Liquidités, Crypto, Bourse, Immobilier.
 */
export function StatCard({
  title,
  amount,
  currency = 'EUR',
  change,
  icon: Icon,
  iconColor = 'text-brand',
  iconBg = 'bg-brand/10',
  sparklineData,
  onClick,
  isLoading = false,
  index = 0,
}: StatCardProps) {
  const [displayValue, setDisplayValue] = useState(0)

  // CountUp animation
  useEffect(() => {
    if (isLoading) return
    const duration = 800
    const steps = 40
    let step = 0

    const timer = setInterval(() => {
      step++
      const t = step / steps
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      setDisplayValue(Math.round(amount * eased))

      if (step >= steps) {
        setDisplayValue(amount)
        clearInterval(timer)
      }
    }, duration / steps)

    return () => clearInterval(timer)
  }, [amount, isLoading])

  if (isLoading) {
    return (
      <div className="rounded-omni-lg border border-border bg-background-tertiary p-3.5">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="mt-3 h-7 w-28" />
        <Skeleton className="mt-2 h-3 w-16" />
      </div>
    )
  }

  const changeDirection = change
    ? change.percentage > 0 ? 'up' : change.percentage < 0 ? 'down' : 'stable'
    : 'stable'

  const ChangeIcon = { up: TrendingUp, down: TrendingDown, stable: Minus }[changeDirection]
  const changeColor = { up: 'text-gain', down: 'text-loss', stable: 'text-foreground-tertiary' }[changeDirection]
  const changeBg = { up: 'bg-gain/10', down: 'bg-loss/10', stable: 'bg-surface' }[changeDirection]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.3, ease: 'easeOut' }}
      whileHover={{ y: -2, transition: { duration: 0.15, type: 'spring', stiffness: 400 } }}
      onClick={onClick}
      className={`
        relative rounded-omni-lg border border-border bg-background-tertiary p-2.5 sm:p-3.5
        hover:border-brand/20 hover:shadow-lg hover:shadow-brand/5
        transition-colors duration-150 overflow-hidden
        ${onClick ? 'cursor-pointer' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          <div className={`h-7 w-7 sm:h-9 sm:w-9 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}>
            <Icon className={`h-3.5 w-3.5 sm:h-4.5 sm:w-4.5 ${iconColor}`} />
          </div>
          <span className="text-xs sm:text-sm font-medium text-foreground-secondary truncate">{title}</span>
        </div>

        {/* Sparkline top-right */}
        {sparklineData && sparklineData.length >= 2 && (
          <div className="hidden sm:block">
            <Sparkline data={sparklineData} width={56} height={20} />
          </div>
        )}
      </div>

      {/* Amount */}
      <p className="mt-1.5 sm:mt-2.5 text-base sm:text-lg font-bold text-foreground tabular-nums tracking-tight truncate">
        {formatAmount(displayValue, currency)}
      </p>

      {/* Variation badge */}
      {change && (
        <div className="mt-1 sm:mt-1.5 flex items-center gap-1 sm:gap-1.5 flex-wrap">
          <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium ${changeColor} ${changeBg}`}>
            <ChangeIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            <span>{change.percentage > 0 ? '+' : ''}{change.percentage.toFixed(1)}%</span>
          </div>
          <span className="text-[10px] sm:text-[11px] text-foreground-tertiary hidden sm:inline">vs mois dernier</span>
        </div>
      )}
    </motion.div>
  )
}
