'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Bell, ChevronRight } from 'lucide-react'
import { formatAmount, formatDate } from '@/lib/format'
import type { AggregatedCalendarEvent } from '@/types/api'

interface UpcomingAlertsProps {
  alerts: AggregatedCalendarEvent[]
}

/**
 * Upcoming alerts widget — urgent events in the next 7 days.
 */
export function UpcomingAlerts({ alerts }: UpcomingAlertsProps) {
  if (alerts.length === 0) return null

  const criticals = alerts.filter((a) => a.urgency === 'critical')
  const warnings = alerts.filter((a) => a.urgency === 'warning')

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="rounded-omni-lg border border-loss/20 bg-loss/5 backdrop-blur-xl p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <motion.div
          animate={{ rotate: [0, -10, 10, -10, 0] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 3 }}
          className="p-1.5 rounded-omni-sm bg-loss/10"
        >
          <Bell className="w-4 h-4 text-loss" />
        </motion.div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Alertes à venir</h3>
          <p className="text-xs text-foreground-secondary">
            {criticals.length > 0 && (
              <span className="text-loss font-medium">{criticals.length} critique{criticals.length > 1 ? 's' : ''}</span>
            )}
            {criticals.length > 0 && warnings.length > 0 && ' · '}
            {warnings.length > 0 && (
              <span className="text-warning font-medium">{warnings.length} avertissement{warnings.length > 1 ? 's' : ''}</span>
            )}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <AnimatePresence>
          {alerts.slice(0, 5).map((alert, i) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`
                flex items-center gap-2.5 p-2.5 rounded-omni-sm border
                ${alert.urgency === 'critical'
                  ? 'border-loss/30 bg-loss/10'
                  : 'border-warning/30 bg-warning/5'
                }
              `}
            >
              <AlertTriangle
                className={`w-3.5 h-3.5 flex-shrink-0 ${
                  alert.urgency === 'critical' ? 'text-loss' : 'text-warning'
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{alert.title}</p>
                <p className="text-[10px] text-foreground-secondary">
                  {formatDate(alert.date)}
                  {alert.amount != null && alert.amount > 0 && ` · ${formatAmount(alert.amount)}`}
                </p>
              </div>
              <ChevronRight className="w-3 h-3 text-foreground-secondary flex-shrink-0" />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
