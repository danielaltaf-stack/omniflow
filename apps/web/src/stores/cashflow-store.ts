'use client'

import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'
import type {
  CrossAssetProjection,
  CashFlowSourcesResponse,
  CashFlowHealthScore,
} from '@/types/api'

interface CashFlowState {
  projection: CrossAssetProjection | null
  sources: CashFlowSourcesResponse | null
  health: CashFlowHealthScore | null
  isLoading: boolean
  isLoadingSources: boolean
  isLoadingHealth: boolean
  error: string | null

  fetchProjection: (months?: number) => Promise<void>
  fetchSources: () => Promise<void>
  fetchHealth: () => Promise<void>
  fetchAll: () => Promise<void>
  clearError: () => void
}

export const useCashFlowStore = create<CashFlowState>((set, get) => ({
  projection: null,
  sources: null,
  health: null,
  isLoading: false,
  isLoadingSources: false,
  isLoadingHealth: false,
  error: null,

  fetchProjection: async (months = 12) => {
    set({ isLoading: true, error: null })
    try {
      const data = await apiClient.get<CrossAssetProjection>(
        `/api/v1/cashflow/projection?months=${months}`
      )
      set({ projection: data, isLoading: false })
    } catch (e: any) {
      set({ error: e.message, isLoading: false })
    }
  },

  fetchSources: async () => {
    set({ isLoadingSources: true, error: null })
    try {
      const data = await apiClient.get<CashFlowSourcesResponse>(
        '/api/v1/cashflow/sources'
      )
      set({ sources: data, isLoadingSources: false })
    } catch (e: any) {
      set({ error: e.message, isLoadingSources: false })
    }
  },

  fetchHealth: async () => {
    set({ isLoadingHealth: true, error: null })
    try {
      const data = await apiClient.get<CashFlowHealthScore>(
        '/api/v1/cashflow/health'
      )
      set({ health: data, isLoadingHealth: false })
    } catch (e: any) {
      set({ error: e.message, isLoadingHealth: false })
    }
  },

  fetchAll: async () => {
    const { fetchProjection, fetchSources, fetchHealth } = get()
    await Promise.all([
      fetchProjection(),
      fetchSources(),
      fetchHealth(),
    ])
  },

  clearError: () => set({ error: null }),
}))
