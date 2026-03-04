'use client'

import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'
import type {
  CalendarMonthResponse,
  CalendarEvent,
  CalendarEventCreate,
  CalendarEventUpdate,
  AggregatedCalendarEvent,
  DaySummary,
} from '@/types/api'

interface CalendarState {
  // Data
  monthData: CalendarMonthResponse | null
  customEvents: CalendarEvent[]
  selectedDate: string | null // "YYYY-MM-DD"
  currentYear: number
  currentMonth: number // 1-12

  // UI
  isLoading: boolean
  isSaving: boolean
  error: string | null

  // Filters
  activeFilters: Set<string>
  showEssentialOnly: boolean

  // Actions
  fetchMonth: (year: number, month: number) => Promise<void>
  fetchCustomEvents: (year: number, month: number) => Promise<void>
  createEvent: (data: CalendarEventCreate) => Promise<void>
  updateEvent: (id: string, data: CalendarEventUpdate) => Promise<void>
  deleteEvent: (id: string) => Promise<void>
  setSelectedDate: (date: string | null) => void
  navigateMonth: (delta: number) => void
  toggleFilter: (source: string) => void
  setShowEssentialOnly: (v: boolean) => void
  clearError: () => void

  // Computed helpers
  getEventsForDate: (date: string) => AggregatedCalendarEvent[]
  getDaySummary: (date: string) => DaySummary | null
}

const now = new Date()

export const useCalendarStore = create<CalendarState>((set, get) => ({
  monthData: null,
  customEvents: [],
  selectedDate: null,
  currentYear: now.getFullYear(),
  currentMonth: now.getMonth() + 1,
  isLoading: false,
  isSaving: false,
  error: null,
  activeFilters: new Set<string>([
    'transaction',
    'subscription',
    'subscription_trial',
    'debt',
    'dividend',
    'rent_income',
    'realestate_loan',
    'guarantee',
    'document_expiry',
    'fiscal',
    'custom',
  ]),
  showEssentialOnly: false,

  fetchMonth: async (year, month) => {
    set({ isLoading: true, error: null, currentYear: year, currentMonth: month })
    try {
      const data = await apiClient.get<CalendarMonthResponse>(
        `/api/v1/calendar/month?year=${year}&month=${month}`
      )
      set({ monthData: data, isLoading: false })
    } catch (e: any) {
      set({ error: e.message, isLoading: false })
    }
  },

  fetchCustomEvents: async (year, month) => {
    try {
      const data = await apiClient.get<CalendarEvent[]>(
        `/api/v1/calendar/events?year=${year}&month=${month}`
      )
      set({ customEvents: data })
    } catch {
      // silent
    }
  },

  createEvent: async (data) => {
    set({ isSaving: true, error: null })
    try {
      await apiClient.post('/api/v1/calendar/events', data)
      set({ isSaving: false })
      const { currentYear, currentMonth, fetchMonth, fetchCustomEvents } = get()
      await fetchMonth(currentYear, currentMonth)
      await fetchCustomEvents(currentYear, currentMonth)
    } catch (e: any) {
      set({ error: e.message, isSaving: false })
    }
  },

  updateEvent: async (id, data) => {
    set({ isSaving: true, error: null })
    try {
      await apiClient.put(`/api/v1/calendar/events/${id}`, data)
      set({ isSaving: false })
      const { currentYear, currentMonth, fetchMonth, fetchCustomEvents } = get()
      await fetchMonth(currentYear, currentMonth)
      await fetchCustomEvents(currentYear, currentMonth)
    } catch (e: any) {
      set({ error: e.message, isSaving: false })
    }
  },

  deleteEvent: async (id) => {
    set({ isSaving: true, error: null })
    try {
      await apiClient.delete(`/api/v1/calendar/events/${id}`)
      set({ isSaving: false })
      const { currentYear, currentMonth, fetchMonth, fetchCustomEvents } = get()
      await fetchMonth(currentYear, currentMonth)
      await fetchCustomEvents(currentYear, currentMonth)
    } catch (e: any) {
      set({ error: e.message, isSaving: false })
    }
  },

  setSelectedDate: (date) => set({ selectedDate: date }),

  navigateMonth: (delta) => {
    const { currentYear, currentMonth, fetchMonth, fetchCustomEvents } = get()
    let newMonth = currentMonth + delta
    let newYear = currentYear
    if (newMonth > 12) {
      newMonth = 1
      newYear++
    } else if (newMonth < 1) {
      newMonth = 12
      newYear--
    }
    fetchMonth(newYear, newMonth)
    fetchCustomEvents(newYear, newMonth)
  },

  toggleFilter: (source) => {
    const { activeFilters } = get()
    const next = new Set(activeFilters)
    if (next.has(source)) {
      next.delete(source)
    } else {
      next.add(source)
    }
    set({ activeFilters: next })
  },

  setShowEssentialOnly: (v) => set({ showEssentialOnly: v }),

  clearError: () => set({ error: null }),

  getEventsForDate: (date) => {
    const { monthData, activeFilters, showEssentialOnly } = get()
    if (!monthData) return []
    const day = monthData.days.find((d) => d.date === date)
    if (!day) return []
    return day.events.filter((e) => {
      if (!activeFilters.has(e.source)) return false
      if (showEssentialOnly && !e.is_essential) return false
      return true
    })
  },

  getDaySummary: (date) => {
    const { monthData } = get()
    if (!monthData) return null
    return monthData.days.find((d) => d.date === date) || null
  },
}))
