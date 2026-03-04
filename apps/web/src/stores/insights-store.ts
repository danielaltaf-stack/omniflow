'use client'

import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'
import type {
  ForecastData,
  AnomalyResponse,
  TipsResponse,
  BudgetCurrentResponse,
  BudgetAutoGenerateResponse,
} from '@/types/api'

interface InsightsState {
  // Data
  forecast: ForecastData | null
  anomalies: AnomalyResponse | null
  tips: TipsResponse | null
  budgetCurrent: BudgetCurrentResponse | null
  budgetGenerated: BudgetAutoGenerateResponse | null

  // Loading states
  isLoadingForecast: boolean
  isLoadingAnomalies: boolean
  isLoadingTips: boolean
  isLoadingBudget: boolean
  isGeneratingBudget: boolean

  error: string | null

  // Actions
  fetchForecast: (days?: number) => Promise<void>
  fetchAnomalies: () => Promise<void>
  fetchTips: () => Promise<void>
  fetchCurrentBudget: (month?: string) => Promise<void>
  generateBudget: (level?: string, months?: number) => Promise<void>
  dismissInsight: (id: string) => Promise<void>
  clearError: () => void
}

export const useInsightsStore = create<InsightsState>((set, get) => ({
  forecast: null,
  anomalies: null,
  tips: null,
  budgetCurrent: null,
  budgetGenerated: null,

  isLoadingForecast: false,
  isLoadingAnomalies: false,
  isLoadingTips: false,
  isLoadingBudget: false,
  isGeneratingBudget: false,

  error: null,

  fetchForecast: async (days = 30) => {
    set({ isLoadingForecast: true, error: null })
    try {
      const data = await apiClient.get<ForecastData>(
        `/api/v1/insights/forecast?days=${days}`
      )
      set({ forecast: data, isLoadingForecast: false })
    } catch (e: any) {
      set({ error: e.message, isLoadingForecast: false })
    }
  },

  fetchAnomalies: async () => {
    set({ isLoadingAnomalies: true, error: null })
    try {
      const data = await apiClient.get<AnomalyResponse>(
        '/api/v1/insights/anomalies'
      )
      set({ anomalies: data, isLoadingAnomalies: false })
    } catch (e: any) {
      set({ error: e.message, isLoadingAnomalies: false })
    }
  },

  fetchTips: async () => {
    set({ isLoadingTips: true, error: null })
    try {
      const data = await apiClient.get<TipsResponse>(
        '/api/v1/insights/tips'
      )
      set({ tips: data, isLoadingTips: false })
    } catch (e: any) {
      set({ error: e.message, isLoadingTips: false })
    }
  },

  fetchCurrentBudget: async (month?: string) => {
    set({ isLoadingBudget: true, error: null })
    try {
      const url = month
        ? `/api/v1/budget/current?month=${month}`
        : '/api/v1/budget/current'
      const data = await apiClient.get<BudgetCurrentResponse>(url)
      set({ budgetCurrent: data, isLoadingBudget: false })
    } catch (e: any) {
      set({ error: e.message, isLoadingBudget: false })
    }
  },

  generateBudget: async (level = 'optimized', months = 3) => {
    set({ isGeneratingBudget: true, error: null })
    try {
      const data = await apiClient.get<BudgetAutoGenerateResponse>(
        `/api/v1/budget/auto-generate?level=${level}&months=${months}&save=true`
      )
      set({ budgetGenerated: data, isGeneratingBudget: false })
      // Refresh current budget after generation
      await get().fetchCurrentBudget()
    } catch (e: any) {
      set({ error: e.message, isGeneratingBudget: false })
    }
  },

  dismissInsight: async (id: string) => {
    try {
      await apiClient.patch(`/api/v1/insights/${id}/dismiss`, {})
      // Remove from local anomalies list
      const current = get().anomalies
      if (current) {
        set({
          anomalies: {
            ...current,
            anomalies: current.anomalies.filter((a) => a.id !== id),
            count: current.count - 1,
          },
        })
      }
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  clearError: () => set({ error: null }),
}))
