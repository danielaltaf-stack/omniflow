'use client'

import { motion } from 'framer-motion'
import { useCalendarStore } from '@/stores/calendar-store'

interface CalendarFiltersProps {}

const FILTER_SOURCES = [
  { key: 'transaction', label: 'Transactions', color: '#6C5CE7', icon: '💳' },
  { key: 'subscription', label: 'Abonnements', color: '#FECA57', icon: '🔄' },
  { key: 'subscription_trial', label: 'Fin d\'essai', color: '#FF4757', icon: '⚠️' },
  { key: 'debt', label: 'Crédits', color: '#A29BFE', icon: '🏦' },
  { key: 'dividend', label: 'Dividendes', color: '#00D68F', icon: '📈' },
  { key: 'rent_income', label: 'Loyers', color: '#00D68F', icon: '🏠' },
  { key: 'realestate_loan', label: 'Prêt immo', color: '#A29BFE', icon: '🏗️' },
  { key: 'guarantee', label: 'Garanties', color: '#FECA57', icon: '🛡️' },
  { key: 'document_expiry', label: 'Documents', color: '#54A0FF', icon: '📄' },
  { key: 'fiscal', label: 'Fiscal', color: '#FF6B6B', icon: '📋' },
  { key: 'custom', label: 'Personnalisés', color: '#6C5CE7', icon: '✏️' },
]

/**
 * Filter bar for the calendar — let the user toggle event types.
 */
export function CalendarFilters({}: CalendarFiltersProps) {
  const { activeFilters, toggleFilter, showEssentialOnly, setShowEssentialOnly } = useCalendarStore()

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="rounded-omni-lg border border-border bg-surface/80 backdrop-blur-xl p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
          Filtres
        </h4>
        <button
          onClick={() => setShowEssentialOnly(!showEssentialOnly)}
          className={`
            text-xs px-2.5 py-1 rounded-full border transition-all
            ${showEssentialOnly
              ? 'border-brand bg-brand/10 text-brand'
              : 'border-border bg-transparent text-foreground-secondary hover:bg-surface-elevated'
            }
          `}
        >
          Essentiels uniquement
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTER_SOURCES.map((src) => {
          const isActive = activeFilters.has(src.key)
          return (
            <motion.button
              key={src.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => toggleFilter(src.key)}
              className={`
                flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border transition-all
                ${isActive
                  ? 'border-transparent text-white'
                  : 'border-border text-foreground-secondary hover:bg-surface-elevated opacity-50'
                }
              `}
              style={isActive ? { backgroundColor: src.color + 'CC' } : {}}
            >
              <span className="text-[10px]">{src.icon}</span>
              {src.label}
            </motion.button>
          )
        })}
      </div>
    </motion.div>
  )
}
