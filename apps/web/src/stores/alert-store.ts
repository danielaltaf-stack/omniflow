'use client'

import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'
import type {
  UserAlert,
  AlertCreateRequest,
  AlertUpdateRequest,
  AlertHistoryEntry,
  AlertSuggestion,
} from '@/types/api'

/* ── Types ───────────────────────────────────────────── */

interface AlertState {
  alerts: UserAlert[]
  history: AlertHistoryEntry[]
  suggestions: AlertSuggestion[]
  isLoading: boolean
  isLoadingHistory: boolean
  isLoadingSuggestions: boolean
  error: string | null

  fetchAlerts: (assetType?: string) => Promise<void>
  fetchHistory: () => Promise<void>
  fetchSuggestions: () => Promise<void>
  createAlert: (data: AlertCreateRequest) => Promise<UserAlert>
  updateAlert: (id: string, data: AlertUpdateRequest) => Promise<void>
  deleteAlert: (id: string) => Promise<void>
  toggleAlert: (id: string, isActive: boolean) => Promise<void>
}

/* ── Store ───────────────────────────────────────────── */

export const useAlertStore = create<AlertState>((set, get) => ({
  alerts: [],
  history: [],
  suggestions: [],
  isLoading: false,
  isLoadingHistory: false,
  isLoadingSuggestions: false,
  error: null,

  fetchAlerts: async (assetType?: string) => {
    set({ isLoading: true, error: null })
    try {
      const params = assetType ? `?asset_type=${assetType}` : ''
      const data = await apiClient.get<UserAlert[]>(`/api/v1/alerts${params}`)
      set({ alerts: data, isLoading: false })
    } catch (e: any) {
      set({ error: e?.message || 'Erreur chargement alertes', isLoading: false })
    }
  },

  fetchHistory: async () => {
    set({ isLoadingHistory: true })
    try {
      const data = await apiClient.get<AlertHistoryEntry[]>('/api/v1/alerts/history')
      set({ history: data, isLoadingHistory: false })
    } catch {
      set({ isLoadingHistory: false })
    }
  },

  fetchSuggestions: async () => {
    set({ isLoadingSuggestions: true })
    try {
      const resp = await apiClient.post<{ suggestions: AlertSuggestion[] }>('/api/v1/alerts/suggestions')
      set({ suggestions: resp.suggestions || [], isLoadingSuggestions: false })
    } catch {
      set({ isLoadingSuggestions: false })
    }
  },

  createAlert: async (data: AlertCreateRequest) => {
    const alert = await apiClient.post<UserAlert>('/api/v1/alerts', data)
    set((s) => ({ alerts: [alert, ...s.alerts] }))
    return alert
  },

  updateAlert: async (id: string, data: AlertUpdateRequest) => {
    const updated = await apiClient.put<UserAlert>(`/api/v1/alerts/${id}`, data)
    set((s) => ({
      alerts: s.alerts.map((a) => (a.id === id ? updated : a)),
    }))
  },

  deleteAlert: async (id: string) => {
    await apiClient.delete(`/api/v1/alerts/${id}`)
    set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) }))
  },

  toggleAlert: async (id: string, isActive: boolean) => {
    await get().updateAlert(id, { is_active: isActive })
  },
}))
