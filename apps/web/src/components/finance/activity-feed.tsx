'use client'

import { motion } from 'framer-motion'
import {
  CreditCard,
  ArrowLeftRight,
  Receipt,
  FileCheck,
  Percent,
  Banknote,
  MoreHorizontal,
  Repeat,
  ArrowRight,
  Inbox,
} from 'lucide-react'
import {
  formatAmount,
  formatRelativeDate,
  amountColorClass,
} from '@/lib/format'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import type { Transaction } from '@/types/api'

const TYPE_ICON: Record<string, React.ElementType> = {
  card: CreditCard,
  transfer: ArrowLeftRight,
  direct_debit: Receipt,
  check: FileCheck,
  fee: Percent,
  interest: Percent,
  atm: Banknote,
  other: MoreHorizontal,
}

const CATEGORY_COLORS: Record<string, string> = {
  alimentation: 'bg-orange-500/15 text-orange-400',
  restaurant: 'bg-red-500/15 text-red-400',
  transport: 'bg-blue-500/15 text-blue-400',
  logement: 'bg-indigo-500/15 text-indigo-400',
  energie: 'bg-yellow-500/15 text-yellow-400',
  telecom: 'bg-cyan-500/15 text-cyan-400',
  assurance: 'bg-teal-500/15 text-teal-400',
  sante: 'bg-pink-500/15 text-pink-400',
  loisirs: 'bg-purple-500/15 text-purple-400',
  shopping: 'bg-fuchsia-500/15 text-fuchsia-400',
  abonnement: 'bg-violet-500/15 text-violet-400',
  frais_bancaires: 'bg-red-500/15 text-red-400',
  revenu_salaire: 'bg-emerald-500/15 text-emerald-400',
  revenu_autre: 'bg-green-500/15 text-green-400',
  transfert: 'bg-sky-500/15 text-sky-400',
}

interface ActivityFeedProps {
  transactions: Transaction[]
  isLoading?: boolean
  maxItems?: number
}

/**
 * Activity feed showing the latest transactions across all accounts.
 * Staggered fade-in animation, category colors, recurring badge.
 */
export function ActivityFeed({
  transactions,
  isLoading = false,
  maxItems = 15,
}: ActivityFeedProps) {
  // Sort by date descending, then take maxItems
  const sorted = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, maxItems)

  // Group by date
  const groups: Record<string, Transaction[]> = {}
  for (const txn of sorted) {
    const key = txn.date
    if (!groups[key]) groups[key] = []
    groups[key]!.push(txn)
  }
  const sortedDates = Object.keys(groups).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  )

  if (isLoading) {
    return (
      <div className="rounded-omni-lg border border-border bg-background-tertiary p-4">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
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
      className="rounded-omni-lg border border-border bg-background-tertiary p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-foreground">Dernières transactions</h2>
        <Link
          href="/banks"
          className="flex items-center gap-1 text-xs text-brand hover:text-brand-light transition-colors"
        >
          <span>Voir tout</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Empty state */}
      {sorted.length === 0 && (
        <div className="flex flex-col items-center py-8 text-center">
          <div className="h-12 w-12 rounded-full bg-surface flex items-center justify-center mb-3">
            <Inbox className="h-6 w-6 text-foreground-tertiary" />
          </div>
          <p className="text-sm text-foreground-secondary">Aucune transaction</p>
          <p className="text-xs text-foreground-tertiary mt-1">
            Connectez un compte pour voir vos transactions
          </p>
        </div>
      )}

      {/* Grouped transactions */}
      <div className="space-y-3">
        {sortedDates.map((date) => (
          <div key={date}>
            <p className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider mb-1.5 px-1">
              {formatRelativeDate(date)}
            </p>
            <div className="space-y-0.5">
              {groups[date]!.map((txn, i) => {
                const Icon = TYPE_ICON[txn.type] || MoreHorizontal
                const catColor = txn.category
                  ? CATEGORY_COLORS[txn.category] || 'bg-surface text-foreground-secondary'
                  : 'bg-surface text-foreground-secondary'

                return (
                  <motion.div
                    key={txn.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.2 }}
                    className="flex items-center justify-between py-2 px-2 rounded-omni-sm hover:bg-surface/50 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0 ${catColor}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm text-foreground truncate">
                            {txn.merchant || txn.label}
                          </p>
                          {txn.is_recurring && (
                            <Repeat className="h-3 w-3 text-foreground-tertiary flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-foreground-tertiary truncate">
                          {txn.category?.replace('_', ' ') || txn.type}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-sm font-medium tabular-nums flex-shrink-0 ml-2 ${amountColorClass(txn.amount)}`}
                    >
                      {txn.amount > 0 ? '+' : ''}{formatAmount(txn.amount)}
                    </span>
                  </motion.div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
