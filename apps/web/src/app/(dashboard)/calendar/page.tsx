'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar as CalIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useCalendarStore } from '@/stores/calendar-store'
import { CashflowLifeline } from '@/components/calendar/cashflow-lifeline'
import { GreenDayTracker } from '@/components/calendar/green-day-tracker'
import { PaydayCountdown } from '@/components/calendar/payday-countdown'
import { RentTracker } from '@/components/calendar/rent-tracker'
import { CalendarGrid } from '@/components/calendar/calendar-grid'
import { CalendarFilters } from '@/components/calendar/calendar-filters'
import { EventDetailPanel } from '@/components/calendar/event-detail-panel'
import { UpcomingAlerts } from '@/components/calendar/upcoming-alerts'
import { MonthStats } from '@/components/calendar/month-stats'
import { AddEventModal } from '@/components/calendar/add-event-modal'

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

export default function CalendarPage() {
  const {
    monthData,
    isLoading,
    isSaving,
    error,
    currentYear,
    currentMonth,
    selectedDate,
    fetchMonth,
    fetchCustomEvents,
    createEvent,
    navigateMonth,
    setSelectedDate,
    getEventsForDate,
  } = useCalendarStore()

  const [showAddModal, setShowAddModal] = useState(false)

  // Initial fetch
  useEffect(() => {
    fetchMonth(currentYear, currentMonth)
    fetchCustomEvents(currentYear, currentMonth)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Selected day events
  const selectedEvents = useMemo(() => {
    if (!selectedDate) return []
    return getEventsForDate(selectedDate)
  }, [selectedDate, monthData, getEventsForDate])

  // Green days array for tracker
  const greenDays = useMemo(() => {
    if (!monthData) return []
    return monthData.days.map((d) => d.is_green_day)
  }, [monthData])

  const handleRefresh = () => {
    fetchMonth(currentYear, currentMonth)
    fetchCustomEvents(currentYear, currentMonth)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen pb-24 md:pb-8"
    >
      {/* Page Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-omni-sm bg-brand/10">
                <CalIcon className="w-5 h-5 text-brand" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Calendrier Financier</h1>
                <p className="text-xs text-foreground-secondary">
                  Dépenses, rentrées & échéances — Tout au même endroit
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                isLoading={isLoading}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowAddModal(true)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Événement
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 py-5 space-y-5">
        {/* Error banner */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-omni-sm bg-loss/10 border border-loss/20 text-xs text-loss"
          >
            {error}
          </motion.div>
        )}

        {isLoading && !monthData ? (
          /* Skeleton loader */
          <div className="space-y-4">
            <Skeleton className="h-52 rounded-omni-lg" />
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-20 rounded-omni" />
              <Skeleton className="h-20 rounded-omni" />
              <Skeleton className="h-20 rounded-omni" />
            </div>
            <Skeleton className="h-96 rounded-omni-lg" />
          </div>
        ) : monthData ? (
          <>
            {/* 1. Cashflow Lifeline */}
            <CashflowLifeline data={monthData.lifeline} />

            {/* 2. Month Stats */}
            <MonthStats
              totalIncome={monthData.total_income}
              totalExpenses={monthData.total_expenses}
              net={monthData.net}
            />

            {/* 3. Filters */}
            <CalendarFilters />

            {/* Month Navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => navigateMonth(-1)}
                className="p-2 rounded-omni-sm hover:bg-surface-elevated transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-foreground-secondary" />
              </button>
              <div className="text-center">
                <h2 className="text-base font-bold text-foreground">
                  {MONTH_NAMES[currentMonth - 1]} {currentYear}
                </h2>
                <p className="text-xs text-foreground-secondary">
                  {monthData.days.length} jours · {monthData.days.reduce((s, d) => s + d.events.length, 0)} événements
                </p>
              </div>
              <button
                onClick={() => navigateMonth(1)}
                className="p-2 rounded-omni-sm hover:bg-surface-elevated transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-foreground-secondary" />
              </button>
            </div>

            {/* 4. Calendar Grid + Side Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Calendar */}
              <div className="lg:col-span-2">
                <CalendarGrid
                  days={monthData.days}
                  year={currentYear}
                  month={currentMonth}
                  onDayClick={(date) => setSelectedDate(date === selectedDate ? null : date)}
                  selectedDate={selectedDate}
                />
              </div>

              {/* Side Panel */}
              <div className="space-y-4">
                {/* Selected day detail */}
                <AnimatePresence mode="wait">
                  {selectedDate && (
                    <EventDetailPanel
                      key={selectedDate}
                      events={selectedEvents}
                      date={selectedDate}
                      onClose={() => setSelectedDate(null)}
                    />
                  )}
                </AnimatePresence>

                {/* Upcoming Alerts */}
                <UpcomingAlerts alerts={monthData.upcoming_alerts} />

                {/* 5. Green Day Tracker */}
                <GreenDayTracker
                  streak={monthData.green_streak}
                  daysInMonth={monthData.days.length}
                  greenDays={greenDays}
                />

                {/* 6. Payday Countdown */}
                <PaydayCountdown data={monthData.payday} />

                {/* 7. Rent Tracker */}
                <RentTracker entries={monthData.rent_tracker} />
              </div>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="text-center py-20">
            <div className="inline-flex p-4 rounded-full bg-brand/10 mb-4">
              <CalIcon className="w-8 h-8 text-brand" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Calendrier Financier</h3>
            <p className="text-sm text-foreground-secondary max-w-sm mx-auto">
              Synchronisez vos comptes bancaires pour voir apparaître vos dépenses,
              rentrées d'argent et échéances sur le calendrier.
            </p>
            <Button
              variant="primary"
              size="sm"
              className="mt-4"
              onClick={handleRefresh}
            >
              <Sparkles className="w-4 h-4 mr-1" />
              Charger le calendrier
            </Button>
          </div>
        )}
      </div>

      {/* Add Event Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddEventModal
            isOpen={showAddModal}
            onClose={() => setShowAddModal(false)}
            onSubmit={async (data) => {
              await createEvent(data)
              setShowAddModal(false)
            }}
            isSaving={isSaving}
            defaultDate={selectedDate || undefined}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
