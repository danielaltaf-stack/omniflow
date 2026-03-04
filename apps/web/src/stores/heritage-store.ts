'use client'

import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'
import type {
  HeritageProfile,
  HeritageProfileUpdate,
  SuccessionSimulation,
  DonationOptimization,
  HeritageTimeline,
} from '@/types/api'

interface HeritageState {
  profile: HeritageProfile | null
  simulation: SuccessionSimulation | null
  donationOptimization: DonationOptimization | null
  timeline: HeritageTimeline | null

  isLoading: boolean
  isSimulating: boolean
  isOptimizing: boolean
  isSaving: boolean
  error: string | null

  fetchProfile: () => Promise<void>
  updateProfile: (data: HeritageProfileUpdate) => Promise<void>
  runSimulation: (overrides?: Record<string, any>) => Promise<void>
  runDonationOptimization: () => Promise<void>
  fetchTimeline: (years?: number, inflation?: number) => Promise<void>
  fetchAll: () => Promise<void>

  clearError: () => void
}

export const useHeritageStore = create<HeritageState>((set, get) => ({
  profile: null,
  simulation: null,
  donationOptimization: null,
  timeline: null,

  isLoading: false,
  isSimulating: false,
  isOptimizing: false,
  isSaving: false,
  error: null,

  fetchProfile: async () => {
    set({ isLoading: true, error: null })
    try {
      const data = await apiClient.get<HeritageProfile>('/api/v1/heritage/profile')
      set({ profile: data, isLoading: false })
    } catch (e: any) {
      set({ error: e.message, isLoading: false })
    }
  },

  updateProfile: async (data) => {
    set({ isSaving: true, error: null })
    try {
      const updated = await apiClient.put<HeritageProfile>('/api/v1/heritage/profile', data)
      set({ profile: updated, isSaving: false })
    } catch (e: any) {
      set({ error: e.message, isSaving: false })
      throw e
    }
  },

  runSimulation: async (overrides) => {
    set({ isSimulating: true, error: null })
    try {
      const data = await apiClient.post<SuccessionSimulation>(
        '/api/v1/heritage/simulate',
        overrides || {},
      )
      set({ simulation: data, isSimulating: false })
    } catch (e: any) {
      set({ error: e.message, isSimulating: false })
    }
  },

  runDonationOptimization: async () => {
    set({ isOptimizing: true, error: null })
    try {
      const data = await apiClient.post<DonationOptimization>(
        '/api/v1/heritage/optimize-donations',
        {},
      )
      set({ donationOptimization: data, isOptimizing: false })
    } catch (e: any) {
      set({ error: e.message, isOptimizing: false })
    }
  },

  fetchTimeline: async (years = 30, inflation = 2.0) => {
    try {
      const data = await apiClient.get<HeritageTimeline>(
        `/api/v1/heritage/timeline?years=${years}&inflation=${inflation}`,
      )
      set({ timeline: data })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  fetchAll: async () => {
    set({ isLoading: true, error: null })
    try {
      await get().fetchProfile()
      await Promise.all([
        get().runSimulation(),
        get().fetchTimeline(),
      ])
      set({ isLoading: false })
    } catch (e: any) {
      set({ error: e.message, isLoading: false })
    }
  },

  clearError: () => set({ error: null }),
}))
