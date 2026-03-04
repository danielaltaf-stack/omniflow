'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Home, AlertTriangle, CheckCircle, Clock, Phone } from 'lucide-react'
import { formatAmount } from '@/lib/format'
import type { RentTrackerEntry } from '@/types/api'

interface RentTrackerProps {
  entries: RentTrackerEntry[]
}

/**
 * Rental income tracker — shows expected rents with overdue detection.
 * Blinks orange/red when a rent is overdue > 3 days.
 */
export function RentTracker({ entries }: RentTrackerProps) {
  if (entries.length === 0) return null

  const statusConfig = {
    received: { icon: CheckCircle, color: 'text-gain', bg: 'bg-gain/10', label: 'Reçu' },
    pending: { icon: Clock, color: 'text-warning', bg: 'bg-warning/10', label: 'En attente' },
    overdue: { icon: AlertTriangle, color: 'text-loss', bg: 'bg-loss/10', label: 'En retard' },
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="rounded-omni-lg border border-border bg-surface/80 backdrop-blur-xl p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-omni-sm bg-cat-realestate/10">
          <Home className="w-4 h-4 text-cat-realestate" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Suivi des Loyers</h3>
          <p className="text-xs text-foreground-secondary">Revenus locatifs attendus</p>
        </div>
      </div>

      <div className="space-y-2.5">
        <AnimatePresence>
          {entries.map((entry, i) => {
            const config = statusConfig[entry.status]
            const Icon = config.icon

            return (
              <motion.div
                key={entry.property_id + entry.expected_date}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`
                  flex items-center justify-between p-3 rounded-omni-sm border
                  ${entry.status === 'overdue'
                    ? 'border-loss/30 bg-loss/5 animate-pulse-soft'
                    : 'border-border bg-background-tertiary'
                  }
                `}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`p-1.5 rounded-full ${config.bg}`}>
                    <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {entry.property_name}
                    </p>
                    <p className="text-xs text-foreground-secondary">
                      {new Date(entry.expected_date).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                      })}
                      {entry.status === 'overdue' && (
                        <span className="text-loss ml-1">
                          — {entry.days_overdue}j de retard
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${entry.status === 'received' ? 'text-gain' : 'text-foreground'}`}>
                    {formatAmount(entry.expected_amount)}
                  </span>
                  {entry.status === 'overdue' && (
                    <button
                      className="p-1.5 rounded-omni-sm bg-loss/10 hover:bg-loss/20 transition-colors"
                      title="Relancer le locataire"
                    >
                      <Phone className="w-3 h-3 text-loss" />
                    </button>
                  )}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
