'use client'

import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'
import type {
  RetirementProfile,
  RetirementProfileUpdate,
  SimulationResponse,
  OptimizationResponse,
  FireDashboard,
  PatrimoineSnapshot,
} from '@/types/api'

interface RetirementState {
  profile: RetirementProfile | null
  simulation: SimulationResponse | null
  optimization: OptimizationResponse | null
  fireDashboard: FireDashboard | null
  patrimoine: PatrimoineSnapshot | null

  isLoading: boolean
  isSimulating: boolean
  isOptimizing: boolean
  isSaving: boolean
  error: string | null

  fetchProfile: () => Promise<void>
  updateProfile: (data: RetirementProfileUpdate) => Promise<void>
  runSimulation: (extraSavings?: number, numSim?: number) => Promise<void>
  runOptimization: () => Promise<void>
  fetchFireDashboard: () => Promise<void>
  fetchPatrimoine: () => Promise<void>
  fetchAll: () => Promise<void>

  runWhatIf: (overrides: Record<string, any>) => Promise<SimulationResponse>

  clearError: () => void
}

export const useRetirementStore = create<RetirementState>((set, get) => ({
  profile: null,
  simulation: null,
  optimization: null,
  fireDashboard: null,
  patrimoine: null,

  isLoading: false,
  isSimulating: false,
  isOptimizing: false,
  isSaving: false,
  error: null,

  fetchProfile: async () => {
    set({ isLoading: true, error: null })
    try {
      const data = await apiClient.get<RetirementProfile>('/api/v1/retirement/profile')
      set({ profile: data, isLoading: false })
    } catch (e: any) {
      set({ error: e.message, isLoading: false })
    }
  },

  updateProfile: async (data) => {
    set({ isSaving: true, error: null })
    try {
      const updated = await apiClient.put<RetirementProfile>('/api/v1/retirement/profile', data)
      set({ profile: updated, isSaving: false })
    } catch (e: any) {
      set({ error: e.message, isSaving: false })
      throw e
    }
  },

  runSimulation: async (extraSavings = 0, numSim = 1000) => {
    set({ isSimulating: true, error: null })
    try {
      const data = await apiClient.post<SimulationResponse>('/api/v1/retirement/simulate', {
        extra_monthly_savings: extraSavings,
        num_simulations: numSim,
      })
      set({ simulation: data, isSimulating: false })
    } catch (e: any) {
      set({ error: e.message, isSimulating: false })
    }
  },

  runOptimization: async () => {
    set({ isOptimizing: true, error: null })
    try {
      const data = await apiClient.post<OptimizationResponse>('/api/v1/retirement/optimize', {})
      set({ optimization: data, isOptimizing: false })
    } catch (e: any) {
      set({ error: e.message, isOptimizing: false })
    }
  },

  fetchFireDashboard: async () => {
    try {
      const data = await apiClient.get<FireDashboard>('/api/v1/retirement/fire-dashboard')
      set({ fireDashboard: data })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  fetchPatrimoine: async () => {
    try {
      const data = await apiClient.get<PatrimoineSnapshot>('/api/v1/retirement/patrimoine')
      set({ patrimoine: data })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  fetchAll: async () => {
    set({ isLoading: true, error: null })
    try {
      await Promise.all([
        get().fetchProfile(),
        get().fetchFireDashboard(),
        get().fetchPatrimoine(),
      ])
      // Run simulation after profile is loaded
      await get().runSimulation()
      set({ isLoading: false })
    } catch (e: any) {
      set({ error: e.message, isLoading: false })
    }
  },

  runWhatIf: async (overrides) => {
    const data = await apiClient.post<SimulationResponse>('/api/v1/retirement/what-if', overrides)
    return data
  },

  clearError: () => set({ error: null }),
}))
