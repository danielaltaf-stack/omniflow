'use client'

import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'
import type {
  StockSummary,
  PerformanceData,
  DividendCalendar,
  AllocationAnalysis,
  EnvelopeSummary,
} from '@/types/api'

interface StockState {
  summary: StockSummary | null
  performance: PerformanceData | null
  dividends: DividendCalendar | null
  allocation: AllocationAnalysis | null
  envelopes: EnvelopeSummary | null
  isLoading: boolean
  isSyncing: boolean
  error: string | null

  fetchSummary: () => Promise<void>
  fetchPerformance: (period?: string) => Promise<void>
  fetchDividends: (year?: number) => Promise<void>
  fetchAllocation: () => Promise<void>
  fetchEnvelopes: () => Promise<void>
  createPortfolio: (label: string, broker?: string, envelope_type?: string, management_fee_pct?: number, total_deposits?: number) => Promise<any>
  addPosition: (portfolioId: string, data: {
    symbol: string
    name?: string
    quantity: number
    avg_buy_price?: number
  }) => Promise<void>
  importCSV: (portfolioId: string, broker: string, file: File) => Promise<void>
  refreshPrices: (portfolioId: string) => Promise<void>
  deletePortfolio: (portfolioId: string) => Promise<void>
  clearError: () => void
}

export const useStockStore = create<StockState>((set, get) => ({
  summary: null,
  performance: null,
  dividends: null,
  allocation: null,
  envelopes: null,
  isLoading: false,
  isSyncing: false,
  error: null,

  fetchSummary: async () => {
    set({ isLoading: true, error: null })
    try {
      const data = await apiClient.get<StockSummary>('/api/v1/stocks')
      set({ summary: data, isLoading: false })
    } catch (e: any) {
      set({ error: e.message, isLoading: false })
    }
  },

  fetchPerformance: async (period = '1Y') => {
    set({ isSyncing: true, error: null })
    try {
      const data = await apiClient.get<PerformanceData>(`/api/v1/stocks/performance?period=${period}`)
      set({ performance: data, isSyncing: false })
    } catch (e: any) {
      set({ error: e.message, isSyncing: false })
    }
  },

  fetchDividends: async (year) => {
    set({ isSyncing: true, error: null })
    try {
      const url = year
        ? `/api/v1/stocks/dividends?year=${year}`
        : '/api/v1/stocks/dividends'
      const data = await apiClient.get<DividendCalendar>(url)
      set({ dividends: data, isSyncing: false })
    } catch (e: any) {
      set({ error: e.message, isSyncing: false })
    }
  },

  fetchAllocation: async () => {
    set({ isSyncing: true, error: null })
    try {
      const data = await apiClient.get<AllocationAnalysis>('/api/v1/stocks/allocation')
      set({ allocation: data, isSyncing: false })
    } catch (e: any) {
      set({ error: e.message, isSyncing: false })
    }
  },

  fetchEnvelopes: async () => {
    set({ isSyncing: true, error: null })
    try {
      const data = await apiClient.get<EnvelopeSummary>('/api/v1/stocks/envelopes')
      set({ envelopes: data, isSyncing: false })
    } catch (e: any) {
      set({ error: e.message, isSyncing: false })
    }
  },

  createPortfolio: async (label, broker = 'manual', envelope_type = 'cto', management_fee_pct = 0, total_deposits = 0) => {
    set({ isSyncing: true, error: null })
    try {
      const result = await apiClient.post('/api/v1/stocks/portfolios', {
        label, broker, envelope_type,
        management_fee_pct,
        total_deposits,
      })
      await get().fetchSummary()
      set({ isSyncing: false })
      return result
    } catch (e: any) {
      set({ error: e.message, isSyncing: false })
      throw e
    }
  },

  addPosition: async (portfolioId, data) => {
    set({ isSyncing: true, error: null })
    try {
      await apiClient.post(`/api/v1/stocks/portfolios/${portfolioId}/positions`, data)
      await get().fetchSummary()
      set({ isSyncing: false })
    } catch (e: any) {
      set({ error: e.message, isSyncing: false })
      throw e
    }
  },

  importCSV: async (portfolioId, broker, file) => {
    set({ isSyncing: true, error: null })
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('broker', broker)

      const resp = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/stocks/portfolios/${portfolioId}/import`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiClient.getToken()}`,
          },
          body: formData,
        }
      )
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: 'Erreur import CSV' }))
        throw new Error(err.detail)
      }
      await get().fetchSummary()
      set({ isSyncing: false })
    } catch (e: any) {
      set({ error: e.message, isSyncing: false })
      throw e
    }
  },

  refreshPrices: async (portfolioId) => {
    set({ isSyncing: true, error: null })
    try {
      await apiClient.post(`/api/v1/stocks/portfolios/${portfolioId}/refresh`, {})
      await get().fetchSummary()
      set({ isSyncing: false })
    } catch (e: any) {
      set({ error: e.message, isSyncing: false })
    }
  },

  deletePortfolio: async (portfolioId) => {
    try {
      await apiClient.delete(`/api/v1/stocks/portfolios/${portfolioId}`)
      await get().fetchSummary()
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  clearError: () => set({ error: null }),
}))
