'use client'

import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  CreditCard,
  Building,
  Home,
  Shield,
  FileText,
  FileWarning,
  AlertTriangle,
  CalendarX,
  Banknote,
  X,
} from 'lucide-react'
import { formatAmount, formatDate } from '@/lib/format'
import type { AggregatedCalendarEvent } from '@/types/api'

interface EventDetailPanelProps {
  events: AggregatedCalendarEvent[]
  date: string
  onClose: () => void
}

const ICON_MAP: Record<string, typeof ArrowDownLeft> = {
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  CreditCard,
  Building,
  Home,
  Shield,
  FileText,
  FileWarning,
  AlertTriangle,
  CalendarX,
  Banknote,
}

const SOURCE_LABELS: Record<string, string> = {
  transaction: 'Transaction',
  subscription: 'Abonnement',
  subscription_trial: 'Fin d\'essai',
  debt: 'Crédit',
  dividend: 'Dividende',
  rent_income: 'Loyer',
  realestate_loan: 'Prêt immobilier',
  guarantee: 'Garantie',
  document_expiry: 'Document',
  fiscal: 'Fiscal',
  custom: 'Personnel',
}

/**
 * Detailed panel for selected day — shows all events with details.
 */
export function EventDetailPanel({ events, date, onClose }: EventDetailPanelProps) {
  const formattedDate = new Date(date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const totalIncome = useMemo(
    () => events.filter((e) => e.is_income).reduce((s, e) => s + (e.amount || 0), 0),
    [events]
  )
  const totalExpenses = useMemo(
    () => events.filter((e) => !e.is_income && e.amount).reduce((s, e) => s + (e.amount || 0), 0),
    [events]
  )

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.25 }}
      className="rounded-omni-lg border border-border bg-surface/95 backdrop-blur-xl p-5 shadow-xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground capitalize">{formattedDate}</h3>
          <p className="text-xs text-foreground-secondary mt-0.5">
            {events.length} événement{events.length > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-omni-sm hover:bg-surface-elevated transition-colors"
        >
          <X className="w-4 h-4 text-foreground-secondary" />
        </button>
      </div>

      {/* Day summary */}
      {(totalIncome > 0 || totalExpenses > 0) && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="p-2.5 rounded-omni-sm bg-gain/5 border border-gain/10">
            <p className="text-[10px] text-gain/70 uppercase tracking-wider">Entrées</p>
            <p className="text-sm font-bold text-gain">{formatAmount(totalIncome)}</p>
          </div>
          <div className="p-2.5 rounded-omni-sm bg-loss/5 border border-loss/10">
            <p className="text-[10px] text-loss/70 uppercase tracking-wider">Sorties</p>
            <p className="text-sm font-bold text-loss">{formatAmount(totalExpenses)}</p>
          </div>
        </div>
      )}

      {/* Events list */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
        <AnimatePresence>
          {events.map((event, i) => {
            const IconComponent = ICON_MAP[event.icon || ''] || CreditCard
            const urgencyBorder =
              event.urgency === 'critical'
                ? 'border-loss/40 bg-loss/5'
                : event.urgency === 'warning'
                  ? 'border-warning/40 bg-warning/5'
                  : 'border-border bg-background-tertiary'

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`p-3 rounded-omni-sm border ${urgencyBorder}`}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className="p-1.5 rounded-full flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: (event.color || '#6C5CE7') + '20' }}
                  >
                    <IconComponent
                      className="w-3.5 h-3.5"
                      style={{ color: event.color || '#6C5CE7' }}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: (event.color || '#6C5CE7') + '15',
                          color: event.color || '#6C5CE7',
                        }}
                      >
                        {SOURCE_LABELS[event.source] || event.source}
                      </span>
                      {!event.is_essential && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-foreground-secondary/10 text-foreground-secondary">
                          Non-essentiel
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-medium text-foreground">{event.title}</p>

                    {event.description && (
                      <p className="text-xs text-foreground-secondary mt-0.5 line-clamp-2">
                        {event.description}
                      </p>
                    )}

                    {/* Debt extra info */}
                    {event.source === 'debt' && event.extra?.remaining_months !== undefined && (
                      <div className="mt-2 p-2 rounded-omni-sm bg-background-tertiary text-xs space-y-1">
                        <p className="text-foreground-secondary">
                          Plus que <span className="font-semibold text-foreground">{event.extra.remaining_months}</span> mensualités
                        </p>
                        {event.extra.principal !== undefined && (
                          <div className="flex gap-3">
                            <span>Capital: <span className="font-medium text-foreground">{formatAmount(event.extra.principal)}</span></span>
                            <span>Intérêts: <span className="font-medium text-foreground">{formatAmount(event.extra.interest)}</span></span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Guarantee extra info */}
                    {event.source === 'guarantee' && event.extra?.expiry_date && (
                      <div className="mt-1.5 text-xs text-foreground-secondary">
                        Expire le {formatDate(event.extra.expiry_date)}
                        {event.extra.brand && ` — ${event.extra.brand} ${event.extra.model || ''}`}
                      </div>
                    )}
                  </div>

                  {event.amount != null && event.amount > 0 && (
                    <span
                      className={`text-sm font-semibold flex-shrink-0 ${
                        event.is_income ? 'text-gain' : 'text-loss'
                      }`}
                    >
                      {event.is_income ? '+' : '-'}{formatAmount(event.amount)}
                    </span>
                  )}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {events.length === 0 && (
          <div className="text-center py-8 text-foreground-secondary text-xs">
            Aucun événement ce jour
          </div>
        )}
      </div>
    </motion.div>
  )
}
