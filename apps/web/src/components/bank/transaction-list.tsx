'use client'

import { motion } from 'framer-motion'
import {
  CreditCard,
  ArrowLeftRight,
  FileCheck,
  Receipt,
  Percent,
  Banknote,
  MoreHorizontal,
} from 'lucide-react'
import {
  formatAmount,
  formatRelativeDate,
  amountColorClass,
  transactionTypeLabel,
} from '@/lib/format'
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

interface TransactionListProps {
  transactions: Transaction[]
  showDate?: boolean
}

export function TransactionList({ transactions, showDate = true }: TransactionListProps) {
  // Group transactions by date
  const groups: Record<string, Transaction[]> = {}
  for (const txn of transactions) {
    const key = txn.date
    if (!groups[key]) groups[key] = []
    groups[key]!.push(txn)
  }

  const sortedDates = Object.keys(groups).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  )

  return (
    <div className="space-y-4">
      {sortedDates.map((date) => (
        <div key={date}>
          {showDate && (
            <p className="text-xs font-medium text-foreground-tertiary uppercase tracking-wider mb-2 px-1">
              {formatRelativeDate(date)}
            </p>
          )}
          <div className="space-y-1">
            {groups[date]!.map((txn, i) => (
              <TransactionRow key={txn.id} transaction={txn} index={i} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function TransactionRow({ transaction, index }: { transaction: Transaction; index: number }) {
  const Icon = TYPE_ICON[transaction.type] || MoreHorizontal

  return (
    <motion.div
      className="flex items-center justify-between py-2.5 px-3 rounded-omni-sm hover:bg-surface/50 transition-colors"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02 }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-foreground-secondary flex-shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-foreground truncate">{transaction.label}</p>
          <p className="text-xs text-foreground-tertiary">
            {transaction.category || transactionTypeLabel(transaction.type)}
            {transaction.merchant && ` · ${transaction.merchant}`}
          </p>
        </div>
      </div>
      <p
        className={`text-sm font-medium tabular-nums flex-shrink-0 ml-3 ${amountColorClass(
          transaction.amount
        )}`}
      >
        {transaction.amount > 0 ? '+' : ''}
        {formatAmount(transaction.amount)}
      </p>
    </motion.div>
  )
}
