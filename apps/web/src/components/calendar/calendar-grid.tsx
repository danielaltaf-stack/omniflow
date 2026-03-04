'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { formatAmount } from '@/lib/format'
import type { DaySummary, AggregatedCalendarEvent } from '@/types/api'
import { useCalendarStore } from '@/stores/calendar-store'

interface CalendarGridProps {
  days: DaySummary[]
  year: number
  month: number // 1-12
  onDayClick: (date: string) => void
  selectedDate: string | null
}

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const SOURCE_DOTS: Record<string, string> = {
  transaction: '#6C5CE7',
  subscription: '#FECA57',
  subscription_trial: '#FF4757',
  debt: '#A29BFE',
  dividend: '#00D68F',
  rent_income: '#00D68F',
  realestate_loan: '#A29BFE',
  guarantee: '#FECA57',
  document_expiry: '#54A0FF',
  fiscal: '#FF6B6B',
  custom: '#6C5CE7',
}

/**
 * Monthly calendar grid with event dots, green-day indicators,
 * and alert coloring when projected balance goes under threshold.
 */
export function CalendarGrid({ days, year, month, onDayClick, selectedDate }: CalendarGridProps) {
  const { activeFilters, showEssentialOnly } = useCalendarStore()

  // Compute first day offset (Monday = 0)
  const firstDayDate = new Date(year, month - 1, 1)
  let firstDayOfWeek = firstDayDate.getDay() - 1 // getDay: 0=Sun, so Mon=0
  if (firstDayOfWeek < 0) firstDayOfWeek = 6 // Sunday → last

  const daysInMonth = new Date(year, month, 0).getDate()
  const today = new Date().toISOString().split('T')[0] || ''

  // Build a map: date string → DaySummary
  const dayMap = useMemo(() => {
    const m: Record<string, DaySummary> = {}
    for (const d of days) {
      m[d.date] = d
    }
    return m
  }, [days])

  // Filter events by active filters
  const filterEvents = (events: AggregatedCalendarEvent[]) => {
    return events.filter((e) => {
      if (!activeFilters.has(e.source)) return false
      if (showEssentialOnly && !e.is_essential) return false
      return true
    })
  }

  // Get unique source types for dots (max 5)
  const getSourceDots = (events: AggregatedCalendarEvent[]): string[] => {
    const filtered = filterEvents(events)
    const sources = new Set<string>()
    for (const e of filtered) {
      sources.add(e.source)
      if (sources.size >= 5) break
    }
    return Array.from(sources).map((s) => SOURCE_DOTS[s] || '#6C5CE7')
  }

  return (
    <div className="rounded-omni-lg border border-border bg-surface/80 backdrop-blur-xl overflow-hidden">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="py-2.5 text-center text-xs font-semibold text-foreground-secondary uppercase tracking-wider"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {/* Empty cells before month start */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[90px] border-b border-r border-border/50 bg-background-tertiary/30" />
        ))}

        {/* Actual days */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayNum = i + 1
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
          const daySummary = dayMap[dateStr]
          const isToday = dateStr === today
          const isSelected = dateStr === selectedDate
          const events = daySummary?.events || []
          const filteredEvents = filterEvents(events)
          const dots = getSourceDots(events)
          const isGreen = daySummary?.is_green_day ?? true
          const alertLevel = daySummary?.alert_level || 'ok'
          const hasIncome = filteredEvents.some((e) => e.is_income && e.amount)
          const hasExpense = filteredEvents.some((e) => !e.is_income && e.amount)

          const bgClass =
            alertLevel === 'danger'
              ? 'bg-loss/8 hover:bg-loss/12'
              : alertLevel === 'warning'
                ? 'bg-warning/5 hover:bg-warning/10'
                : isSelected
                  ? 'bg-brand/8 hover:bg-brand/12'
                  : 'hover:bg-surface-elevated'

          return (
            <motion.button
              key={dateStr}
              whileTap={{ scale: 0.97 }}
              onClick={() => onDayClick(dateStr)}
              className={`
                relative min-h-[90px] p-1.5 border-b border-r border-border/50
                text-left transition-colors cursor-pointer
                ${bgClass}
                ${isSelected ? 'ring-1 ring-brand/40' : ''}
              `}
            >
              {/* Day number */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`
                    text-xs font-medium inline-flex items-center justify-center
                    w-6 h-6 rounded-full transition-all
                    ${isToday
                      ? 'bg-brand text-white font-bold'
                      : 'text-foreground-secondary'
                    }
                  `}
                >
                  {dayNum}
                </span>

                {/* Green day indicator */}
                {daySummary && dateStr <= today && (
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isGreen ? 'bg-gain shadow-sm shadow-gain/30' : 'bg-loss/50'
                    }`}
                    title={isGreen ? 'Jour vert ✓' : 'Dépense non-essentielle'}
                  />
                )}
              </div>

              {/* Amount indicators */}
              {(hasIncome || hasExpense) && (
                <div className="space-y-0.5 mb-1">
                  {hasIncome && (
                    <p className="text-[10px] font-medium text-gain truncate">
                      +{formatAmount(
                        filteredEvents.filter((e) => e.is_income).reduce((s, e) => s + (e.amount || 0), 0)
                      )}
                    </p>
                  )}
                  {hasExpense && (
                    <p className="text-[10px] font-medium text-loss truncate">
                      -{formatAmount(
                        filteredEvents.filter((e) => !e.is_income && e.amount).reduce((s, e) => s + (e.amount || 0), 0)
                      )}
                    </p>
                  )}
                </div>
              )}

              {/* Event preview (first 2 events) */}
              <div className="space-y-0.5">
                {filteredEvents.slice(0, 2).map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center gap-1 min-w-0"
                  >
                    <span
                      className="w-1 h-1 rounded-full flex-shrink-0"
                      style={{ backgroundColor: ev.color || '#6C5CE7' }}
                    />
                    <span className="text-[9px] text-foreground-secondary truncate leading-tight">
                      {ev.title.replace(/^[^\w\s]+ /, '').substring(0, 20)}
                    </span>
                  </div>
                ))}
                {filteredEvents.length > 2 && (
                  <span className="text-[9px] text-foreground-secondary/60">
                    +{filteredEvents.length - 2} autres
                  </span>
                )}
              </div>

              {/* Source dots at bottom */}
              {dots.length > 0 && (
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                  {dots.map((color, j) => (
                    <span
                      key={j}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              )}

              {/* Alert pulse for danger days */}
              {alertLevel === 'danger' && (
                <motion.div
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 border-2 border-loss/30 rounded-sm pointer-events-none"
                />
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
