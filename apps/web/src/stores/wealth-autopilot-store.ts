'use client'

import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'
import type {
  AutopilotConfig,
  ComputeResponse,
  SimulateResponse,
  AutopilotScoreResponse,
  SuggestionHistoryResponse,
} from '@/types/api'

interface WealthAutopilotState {
  config: AutopilotConfig | null
  computeResult: ComputeResponse | null
  simulation: SimulateResponse | null
  scoreResponse: AutopilotScoreResponse | null
  history: SuggestionHistoryResponse | null
  isLoading: boolean
  isComputing: boolean
  isSaving: boolean
  isSimulating: boolean
  error: string | null

  fetchConfig: () => Promise<void>
  updateConfig: (data: Partial<AutopilotConfig>) => Promise<void>
  compute: () => Promise<void>
  acceptSuggestion: (suggestionId: string) => Promise<void>
  fetchHistory: () => Promise<void>
  simulate: () => Promise<void>
  fetchScore: () => Promise<void>
  fetchAll: () => Promise<void>
  clearError: () => void
}

export const useWealthAutopilotStore = create<WealthAutopilotState>((set, get) => ({
  config: null,
  computeResult: null,
  simulation: null,
  scoreResponse: null,
  history: null,
  isLoading: false,
  isComputing: false,
  isSaving: false,
  isSimulating: false,
  error: null,

  fetchConfig: async () => {
    try {
      set({ isLoading: true, error: null })
      const data = await apiClient.get<AutopilotConfig>('/api/v1/autopilot/config')
      set({ config: data, isLoading: false })
    } catch (e: any) {
      set({ error: e.message, isLoading: false })
    }
  },

  updateConfig: async (data) => {
    try {
      set({ isSaving: true, error: null })
      const result = await apiClient.put<AutopilotConfig>('/api/v1/autopilot/config', data)
      set({ config: result, isSaving: false })
    } catch (e: any) {
      set({ error: e.message, isSaving: false })
    }
  },

  compute: async () => {
    try {
      set({ isComputing: true, error: null })
      const data = await apiClient.post<ComputeResponse>('/api/v1/autopilot/compute', {})
      set({ computeResult: data, isComputing: false })
      // Refresh config & score after compute
      get().fetchConfig()
      get().fetchScore()
    } catch (e: any) {
      set({ error: e.message, isComputing: false })
    }
  },

  acceptSuggestion: async (suggestionId) => {
    try {
      set({ isSaving: true, error: null })
      await apiClient.post('/api/v1/autopilot/accept', { suggestion_id: suggestionId })
      set({ isSaving: false })
      get().fetchConfig()
      get().fetchHistory()
      get().fetchScore()
    } catch (e: any) {
      set({ error: e.message, isSaving: false })
    }
  },

  fetchHistory: async () => {
    try {
      const data = await apiClient.get<SuggestionHistoryResponse>('/api/v1/autopilot/history')
      set({ history: data })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  simulate: async () => {
    try {
      set({ isSimulating: true, error: null })
      const data = await apiClient.post<SimulateResponse>('/api/v1/autopilot/simulate', {})
      set({ simulation: data, isSimulating: false })
    } catch (e: any) {
      set({ error: e.message, isSimulating: false })
    }
  },

  fetchScore: async () => {
    try {
      const data = await apiClient.get<AutopilotScoreResponse>('/api/v1/autopilot/score')
      set({ scoreResponse: data })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  fetchAll: async () => {
    set({ isLoading: true, error: null })
    try {
      await Promise.all([get().fetchConfig(), get().fetchScore(), get().fetchHistory()])
    } finally {
      set({ isLoading: false })
    }
  },

  clearError: () => set({ error: null }),
}))
