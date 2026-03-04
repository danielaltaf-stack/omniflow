'use client'

import { motion } from 'framer-motion'
import {
  Wallet,
  PiggyBank,
  TrendingUp,
  Landmark,
  CreditCard,
  Bitcoin,
  Circle,
} from 'lucide-react'
import { formatAmount, accountTypeLabel, amountColorClass } from '@/lib/format'
import type { Account } from '@/types/api'

const ICON_MAP: Record<string, React.ElementType> = {
  checking: Wallet,
  savings: PiggyBank,
  investment: TrendingUp,
  loan: Landmark,
  credit_card: CreditCard,
  crypto: Bitcoin,
  other: Circle,
}

const COLOR_MAP: Record<string, string> = {
  checking: 'bg-blue-500/10 text-blue-400',
  savings: 'bg-emerald-500/10 text-emerald-400',
  investment: 'bg-violet-500/10 text-violet-400',
  loan: 'bg-orange-500/10 text-orange-400',
  credit_card: 'bg-rose-500/10 text-rose-400',
  crypto: 'bg-amber-500/10 text-amber-400',
  other: 'bg-gray-500/10 text-gray-400',
}

interface AccountCardProps {
  account: Account
  onClick?: () => void
  index?: number
}

export function AccountCard({ account, onClick, index = 0 }: AccountCardProps) {
  const Icon = ICON_MAP[account.type] || Circle
  const colorClass = COLOR_MAP[account.type] || COLOR_MAP.other

  return (
    <motion.button
      className="w-full text-left rounded-omni-lg border border-border bg-background-tertiary p-5 hover:border-border-active transition-all group"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -2 }}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${colorClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{account.label}</p>
          <p className="text-xs text-foreground-tertiary">
            {account.bank_name} · {accountTypeLabel(account.type)}
          </p>
        </div>
      </div>
      <p className={`mt-3 text-xl font-bold tabular-nums ${amountColorClass(account.balance)}`}>
        {formatAmount(account.balance, account.currency)}
      </p>
    </motion.button>
  )
}
