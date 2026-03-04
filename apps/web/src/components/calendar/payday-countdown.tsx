'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Wallet, ArrowRight, Sparkles } from 'lucide-react'
import { formatAmount } from '@/lib/format'
import type { PaydayCountdown as PaydayCountdownType } from '@/types/api'

interface PaydayCountdownProps {
  data: PaydayCountdownType
}

/**
 * Payday countdown with daily budget indicator.
 * Shows how many days until next salary and the daily spending allowance.
 */
export function PaydayCountdown({ data }: PaydayCountdownProps) {
  if (!data.next_payday) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-omni-lg border border-border bg-surface/80 backdrop-blur-xl p-5"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-omni-sm bg-foreground-secondary/10">
            <Clock className="w-4 h-4 text-foreground-secondary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Prochain Salaire</h3>
        </div>
        <p className="text-xs text-foreground-secondary">
          Pas encore détecté — Synchronisez vos comptes pour activer le compte à rebours.
        </p>
      </motion.div>
    )
  }

  const pctElapsed = data.payday_amount > 0
    ? Math.max(0, Math.min(100, ((data.payday_amount - data.remaining_budget) / data.payday_amount) * 100))
    : 0

  const paydayDate = new Date(data.next_payday)
  const paydayLabel = paydayDate.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const budgetHealth = data.daily_budget > 5000 ? 'good' : data.daily_budget > 2000 ? 'ok' : 'tight'
  const healthColor = {
    good: 'text-gain',
    ok: 'text-warning',
    tight: 'text-loss',
  }[budgetHealth]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="rounded-omni-lg border border-border bg-surface/80 backdrop-blur-xl p-5 overflow-hidden relative"
    >
      {/* Subtle animated background */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-brand blur-3xl" />
      </div>

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-omni-sm bg-brand/10">
              <Clock className="w-4 h-4 text-brand" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Prochain Salaire</h3>
              <p className="text-xs text-foreground-secondary capitalize">{paydayLabel}</p>
            </div>
          </div>
        </div>

        {/* Countdown */}
        <div className="flex items-end gap-1 mb-4">
          <motion.span
            key={data.days_remaining}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-4xl font-black text-foreground tabular-nums"
          >
            {data.days_remaining}
          </motion.span>
          <span className="text-sm text-foreground-secondary mb-1.5">
            jour{data.days_remaining > 1 ? 's' : ''} restant{data.days_remaining > 1 ? 's' : ''}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full bg-border/40 overflow-hidden mb-4">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pctElapsed}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="h-full rounded-full bg-gradient-to-r from-brand to-brand/60"
          />
        </div>

        {/* Daily budget */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-omni-sm bg-background-tertiary">
            <div className="flex items-center gap-1.5 mb-1">
              <Wallet className="w-3.5 h-3.5 text-foreground-secondary" />
              <span className="text-xs text-foreground-secondary">Budget / jour</span>
            </div>
            <p className={`text-sm font-bold ${healthColor}`}>
              {formatAmount(data.daily_budget)}
            </p>
          </div>
          <div className="p-3 rounded-omni-sm bg-background-tertiary">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-foreground-secondary" />
              <span className="text-xs text-foreground-secondary">Salaire attendu</span>
            </div>
            <p className="text-sm font-bold text-gain">
              {formatAmount(data.payday_amount)}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
