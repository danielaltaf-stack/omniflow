'use client'

import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'
import type {
  DebtSummary,
  Debt,
  AmortizationTable,
  EarlyRepaymentResult,
  InvestVsRepayResult,
  ConsolidationResult,
  DebtChartDataPoint,
} from '@/types/api'

interface DebtState {
  summary: DebtSummary | null
  isLoading: boolean
  isSaving: boolean
  error: string | null

  amortization: AmortizationTable | null
  earlyRepayment: EarlyRepaymentResult | null
  investVsRepay: InvestVsRepayResult | null
  consolidation: ConsolidationResult | null
  chartData: DebtChartDataPoint[] | null

  fetchSummary: () => Promise<void>
  createDebt: (data: Partial<Debt>) => Promise<void>
  updateDebt: (id: string, data: Partial<Debt>) => Promise<void>
  deleteDebt: (id: string) => Promise<void>
  recordPayment: (id: string, data: any) => Promise<void>

  fetchAmortization: (id: string) => Promise<void>
  fetchEarlyRepayment: (id: string, amount: number, atMonth: number) => Promise<void>
  fetchInvestVsRepay: (id: string, amount: number, returnRate: number, horizon: number) => Promise<void>
  fetchConsolidation: (extraBudget?: number) => Promise<void>
  fetchChartData: (id: string) => Promise<void>

  clearError: () => void
  clearAnalytics: () => void
}

export const useDebtStore = create<DebtState>((set, get) => ({
  summary: null,
  isLoading: false,
  isSaving: false,
  error: null,

  amortization: null,
  earlyRepayment: null,
  investVsRepay: null,
  consolidation: null,
  chartData: null,

  fetchSummary: async () => {
    set({ isLoading: true, error: null })
    try {
      const data = await apiClient.get<DebtSummary>('/api/v1/debts')
      set({ summary: data, isLoading: false })
    } catch (e: any) {
      set({ error: e.message, isLoading: false })
    }
  },

  createDebt: async (data) => {
    set({ isSaving: true, error: null })
    try {
      await apiClient.post('/api/v1/debts', data)
      await get().fetchSummary()
      set({ isSaving: false })
    } catch (e: any) {
      set({ error: e.message, isSaving: false })
      throw e
    }
  },

  updateDebt: async (id, data) => {
    set({ isSaving: true, error: null })
    try {
      await apiClient.put(`/api/v1/debts/${id}`, data)
      await get().fetchSummary()
      set({ isSaving: false })
    } catch (e: any) {
      set({ error: e.message, isSaving: false })
      throw e
    }
  },

  deleteDebt: async (id) => {
    try {
      await apiClient.delete(`/api/v1/debts/${id}`)
      await get().fetchSummary()
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  recordPayment: async (id, data) => {
    set({ isSaving: true, error: null })
    try {
      await apiClient.patch(`/api/v1/debts/${id}/payment`, data)
      await get().fetchSummary()
      set({ isSaving: false })
    } catch (e: any) {
      set({ error: e.message, isSaving: false })
      throw e
    }
  },

  fetchAmortization: async (id) => {
    try {
      const data = await apiClient.get<AmortizationTable>(`/api/v1/debts/${id}/amortization`)
      set({ amortization: data })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  fetchEarlyRepayment: async (id, amount, atMonth) => {
    try {
      const data = await apiClient.get<EarlyRepaymentResult>(
        `/api/v1/debts/${id}/simulate-early-repayment?amount=${amount}&at_month=${atMonth}`
      )
      set({ earlyRepayment: data })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  fetchInvestVsRepay: async (id, amount, returnRate, horizon) => {
    try {
      const data = await apiClient.get<InvestVsRepayResult>(
        `/api/v1/debts/${id}/invest-vs-repay?amount=${amount}&return_rate_pct=${returnRate}&horizon_months=${horizon}`
      )
      set({ investVsRepay: data })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  fetchConsolidation: async (extraBudget = 0) => {
    try {
      const data = await apiClient.get<ConsolidationResult>(
        `/api/v1/debts/consolidation?extra_budget=${extraBudget}`
      )
      set({ consolidation: data })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  fetchChartData: async (id) => {
    try {
      const data = await apiClient.get<DebtChartDataPoint[]>(`/api/v1/debts/${id}/chart-data`)
      set({ chartData: data })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  clearError: () => set({ error: null }),
  clearAnalytics: () => set({
    amortization: null,
    earlyRepayment: null,
    investVsRepay: null,
    consolidation: null,
    chartData: null,
  }),
}))
