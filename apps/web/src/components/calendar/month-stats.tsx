'use client'

import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, ArrowRightLeft, Wallet } from 'lucide-react'
import { formatAmount } from '@/lib/format'

interface MonthStatsProps {
  totalIncome: number // centimes
  totalExpenses: number // centimes
  net: number // centimes
}

/**
 * Month-level summary stats bar.
 */
export function MonthStats({ totalIncome, totalExpenses, net }: MonthStatsProps) {
  const stats = [
    {
      label: 'Entrées',
      value: totalIncome,
      color: 'text-gain',
      bg: 'bg-gain/10',
      icon: TrendingUp,
      iconColor: 'text-gain',
    },
    {
      label: 'Sorties',
      value: totalExpenses,
      color: 'text-loss',
      bg: 'bg-loss/10',
      icon: TrendingDown,
      iconColor: 'text-loss',
    },
    {
      label: 'Solde net',
      value: Math.abs(net),
      color: net >= 0 ? 'text-gain' : 'text-loss',
      bg: net >= 0 ? 'bg-gain/10' : 'bg-loss/10',
      icon: ArrowRightLeft,
      iconColor: net >= 0 ? 'text-gain' : 'text-loss',
      prefix: net >= 0 ? '+' : '-',
    },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="rounded-omni border border-border bg-surface/80 backdrop-blur-xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-1 rounded-omni-sm ${stat.bg}`}>
              <stat.icon className={`w-3.5 h-3.5 ${stat.iconColor}`} />
            </div>
            <span className="text-xs font-medium text-foreground-secondary">{stat.label}</span>
          </div>
          <p className={`text-lg font-bold ${stat.color}`}>
            {stat.prefix || ''}{formatAmount(stat.value)}
          </p>
        </motion.div>
      ))}
    </div>
  )
}
