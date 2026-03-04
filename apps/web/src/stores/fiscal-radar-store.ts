'use client'

import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'
import type {
  FiscalProfile,
  FiscalAlertList,
  FiscalAnalysis,
  FiscalExport,
  TMISimulation,
  FiscalScoreResponse,
} from '@/types/api'

interface FiscalRadarState {
  profile: FiscalProfile | null
  alerts: FiscalAlertList | null
  analysis: FiscalAnalysis | null
  fiscalExport: FiscalExport | null
  tmiSimulation: TMISimulation | null
  scoreResponse: FiscalScoreResponse | null
  isLoading: boolean
  isAnalyzing: boolean
  isSimulating: boolean
  isSaving: boolean
  error: string | null

  fetchProfile: () => Promise<void>
  updateProfile: (data: Partial<FiscalProfile>) => Promise<void>
  runAnalysis: (year?: number) => Promise<void>
  fetchAlerts: () => Promise<void>
  fetchExport: (year: number) => Promise<void>
  simulateTMI: (extraIncome: number, incomeType: string) => Promise<void>
  fetchScore: () => Promise<void>
  fetchAll: () => Promise<void>
  clearError: () => void
}

export const useFiscalRadarStore = create<FiscalRadarState>((set, get) => ({
  profile: null,
  alerts: null,
  analysis: null,
  fiscalExport: null,
  tmiSimulation: null,
  scoreResponse: null,
  isLoading: false,
  isAnalyzing: false,
  isSimulating: false,
  isSaving: false,
  error: null,

  fetchProfile: async () => {
    try {
      set({ isLoading: true, error: null })
      const data = await apiClient.get<FiscalProfile>('/api/v1/fiscal/profile')
      set({ profile: data, isLoading: false })
    } catch (e: any) {
      set({ error: e.message, isLoading: false })
    }
  },

  updateProfile: async (data) => {
    try {
      set({ isSaving: true, error: null })
      const result = await apiClient.put<FiscalProfile>('/api/v1/fiscal/profile', data)
      set({ profile: result, isSaving: false })
    } catch (e: any) {
      set({ error: e.message, isSaving: false })
    }
  },

  runAnalysis: async (year = 2026) => {
    try {
      set({ isAnalyzing: true, error: null })
      const data = await apiClient.post<FiscalAnalysis>('/api/v1/fiscal/analyze', { year })
      set({ analysis: data, isAnalyzing: false })
      // Refresh profile & alerts after analysis
      get().fetchProfile()
      get().fetchAlerts()
    } catch (e: any) {
      set({ error: e.message, isAnalyzing: false })
    }
  },

  fetchAlerts: async () => {
    try {
      const data = await apiClient.get<FiscalAlertList>('/api/v1/fiscal/alerts')
      set({ alerts: data })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  fetchExport: async (year) => {
    try {
      set({ isLoading: true, error: null })
      const data = await apiClient.get<FiscalExport>(`/api/v1/fiscal/export/${year}`)
      set({ fiscalExport: data, isLoading: false })
    } catch (e: any) {
      set({ error: e.message, isLoading: false })
    }
  },

  simulateTMI: async (extraIncome, incomeType) => {
    try {
      set({ isSimulating: true, error: null })
      const data = await apiClient.post<TMISimulation>('/api/v1/fiscal/simulate-tmi', {
        extra_income: extraIncome,
        income_type: incomeType,
      })
      set({ tmiSimulation: data, isSimulating: false })
    } catch (e: any) {
      set({ error: e.message, isSimulating: false })
    }
  },

  fetchScore: async () => {
    try {
      const data = await apiClient.get<FiscalScoreResponse>('/api/v1/fiscal/score')
      set({ scoreResponse: data })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  fetchAll: async () => {
    set({ isLoading: true, error: null })
    try {
      await Promise.all([get().fetchProfile(), get().fetchAlerts(), get().fetchScore()])
    } finally {
      set({ isLoading: false })
    }
  },

  clearError: () => set({ error: null }),
}))
