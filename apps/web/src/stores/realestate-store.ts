'use client'

import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'
import type {
  RealEstateSummary,
  RealEstateProperty,
  ValuationHistory,
  DVFRefreshResult,
  CashFlowProjection,
} from '@/types/api'

interface RealEstateState {
  summary: RealEstateSummary | null
  isLoading: boolean
  isSaving: boolean
  error: string | null

  // B3 analytics
  valuations: ValuationHistory | null
  cashflow: CashFlowProjection | null
  dvfRefresh: DVFRefreshResult | null
  isLoadingAnalytics: boolean

  fetchSummary: () => Promise<void>
  createProperty: (data: Partial<RealEstateProperty>) => Promise<void>
  updateProperty: (id: string, data: Partial<RealEstateProperty>) => Promise<void>
  deleteProperty: (id: string) => Promise<void>
  clearError: () => void

  // B3 actions
  fetchValuations: (propertyId: string) => Promise<void>
  refreshDVF: (propertyId: string) => Promise<DVFRefreshResult | null>
  fetchCashflow: (propertyId: string, months?: number) => Promise<void>
  clearAnalytics: () => void
}

export const useRealEstateStore = create<RealEstateState>((set, get) => ({
  summary: null,
  isLoading: false,
  isSaving: false,
  error: null,
  valuations: null,
  cashflow: null,
  dvfRefresh: null,
  isLoadingAnalytics: false,

  fetchSummary: async () => {
    set({ isLoading: true, error: null })
    try {
      const data = await apiClient.get<RealEstateSummary>('/api/v1/realestate')
      set({ summary: data, isLoading: false })
    } catch (e: any) {
      set({ error: e.message, isLoading: false })
    }
  },

  createProperty: async (data) => {
    set({ isSaving: true, error: null })
    try {
      await apiClient.post('/api/v1/realestate', data)
      await get().fetchSummary()
      set({ isSaving: false })
    } catch (e: any) {
      set({ error: e.message, isSaving: false })
      throw e
    }
  },

  updateProperty: async (id, data) => {
    set({ isSaving: true, error: null })
    try {
      await apiClient.put(`/api/v1/realestate/${id}`, data)
      await get().fetchSummary()
      set({ isSaving: false })
    } catch (e: any) {
      set({ error: e.message, isSaving: false })
      throw e
    }
  },

  deleteProperty: async (id) => {
    try {
      await apiClient.delete(`/api/v1/realestate/${id}`)
      await get().fetchSummary()
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  clearError: () => set({ error: null }),

  // ── B3: Analytics ──────────────────────────────────────
  fetchValuations: async (propertyId) => {
    set({ isLoadingAnalytics: true, error: null })
    try {
      const data = await apiClient.get<ValuationHistory>(
        `/api/v1/realestate/${propertyId}/valuations`
      )
      set({ valuations: data, isLoadingAnalytics: false })
    } catch (e: any) {
      set({ error: e.message, isLoadingAnalytics: false })
    }
  },

  refreshDVF: async (propertyId) => {
    set({ isLoadingAnalytics: true, error: null })
    try {
      const data = await apiClient.post<DVFRefreshResult>(
        `/api/v1/realestate/${propertyId}/refresh-dvf`,
        {}
      )
      set({ dvfRefresh: data, isLoadingAnalytics: false })
      // Refresh valuations & summary after DVF refresh
      await get().fetchValuations(propertyId)
      await get().fetchSummary()
      return data
    } catch (e: any) {
      set({ error: e.message, isLoadingAnalytics: false })
      return null
    }
  },

  fetchCashflow: async (propertyId, months) => {
    set({ isLoadingAnalytics: true, error: null })
    try {
      const qs = months ? `?months=${months}` : ''
      const data = await apiClient.get<CashFlowProjection>(
        `/api/v1/realestate/${propertyId}/cashflow${qs}`
      )
      set({ cashflow: data, isLoadingAnalytics: false })
    } catch (e: any) {
      set({ error: e.message, isLoadingAnalytics: false })
    }
  },

  clearAnalytics: () => set({ valuations: null, cashflow: null, dvfRefresh: null }),
}))
