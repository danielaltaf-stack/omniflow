'use client'

import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'
import type {
  FeeAnalysis,
  FeeScan,
  NegotiationLetter,
  BankAlternative,
  BankFeeSchedule,
} from '@/types/api'

interface FeeNegotiatorState {
  analysis: FeeAnalysis | null
  scan: FeeScan | null
  alternatives: BankAlternative[]
  letter: NegotiationLetter | null
  schedules: BankFeeSchedule[]
  isLoading: boolean
  isScanning: boolean
  isGenerating: boolean
  isSaving: boolean
  error: string | null

  fetchAnalysis: () => Promise<void>
  runScan: (months?: number) => Promise<void>
  fetchCompare: () => Promise<void>
  generateLetter: () => Promise<void>
  updateStatus: (status: string, resultAmount?: number) => Promise<void>
  fetchSchedules: () => Promise<void>
  fetchAll: () => Promise<void>
  clearError: () => void
}

export const useFeeNegotiatorStore = create<FeeNegotiatorState>((set, get) => ({
  analysis: null,
  scan: null,
  alternatives: [],
  letter: null,
  schedules: [],
  isLoading: false,
  isScanning: false,
  isGenerating: false,
  isSaving: false,
  error: null,

  fetchAnalysis: async () => {
    try {
      set({ isLoading: true, error: null })
      const data = await apiClient.get<FeeAnalysis>('/api/v1/fees/analysis')
      set({ analysis: data, isLoading: false })
    } catch (e: any) {
      set({ error: e.message, isLoading: false })
    }
  },

  runScan: async (months = 12) => {
    try {
      set({ isScanning: true, error: null })
      const data = await apiClient.post<FeeScan>('/api/v1/fees/scan', { months })
      set({ scan: data, isScanning: false })
      // Also refresh analysis
      get().fetchAnalysis()
    } catch (e: any) {
      set({ error: e.message, isScanning: false })
    }
  },

  fetchCompare: async () => {
    try {
      const data = await apiClient.get<{ alternatives: BankAlternative[] }>('/api/v1/fees/compare')
      set({ alternatives: data.alternatives })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  generateLetter: async () => {
    try {
      set({ isGenerating: true, error: null })
      const data = await apiClient.post<NegotiationLetter>('/api/v1/fees/negotiate', {})
      set({ letter: data, isGenerating: false })
      // Refresh analysis to get updated status
      get().fetchAnalysis()
    } catch (e: any) {
      set({ error: e.message, isGenerating: false })
    }
  },

  updateStatus: async (status, resultAmount = 0) => {
    try {
      set({ isSaving: true, error: null })
      const data = await apiClient.put<FeeAnalysis>('/api/v1/fees/negotiation-status', {
        status,
        result_amount: resultAmount,
      })
      set({ analysis: data, isSaving: false })
    } catch (e: any) {
      set({ error: e.message, isSaving: false })
    }
  },

  fetchSchedules: async () => {
    try {
      const data = await apiClient.get<{ schedules: BankFeeSchedule[]; count: number }>(
        '/api/v1/fees/schedules'
      )
      set({ schedules: data.schedules })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  fetchAll: async () => {
    set({ isLoading: true, error: null })
    try {
      await Promise.all([get().fetchAnalysis(), get().fetchSchedules()])
    } finally {
      set({ isLoading: false })
    }
  },

  clearError: () => set({ error: null }),
}))
