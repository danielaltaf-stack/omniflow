'use client'

import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'
import type { Profile, JointAccount } from '@/types/api'

interface ProfileState {
  profiles: Profile[]
  jointAccounts: JointAccount[]
  isLoading: boolean
  error: string | null

  fetchProfiles: () => Promise<void>
  createProfile: (data: { name: string; type: string; avatar_color: string }) => Promise<Profile>
  updateProfile: (id: string, data: { name?: string; type?: string; avatar_color?: string }) => Promise<void>
  deleteProfile: (id: string) => Promise<void>
  linkAccount: (profileId: string, accountId: string, sharePct?: number) => Promise<void>
  unlinkAccount: (profileId: string, accountId: string) => Promise<void>
  fetchJointAccounts: () => Promise<void>
  clearError: () => void
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: [],
  jointAccounts: [],
  isLoading: false,
  error: null,

  fetchProfiles: async () => {
    set({ isLoading: true, error: null })
    try {
      const profiles = await apiClient.get<Profile[]>('/api/v1/profiles')
      set({ profiles, isLoading: false })
    } catch (e: any) {
      set({ error: e.message, isLoading: false })
    }
  },

  createProfile: async (data) => {
    try {
      const profile = await apiClient.post<Profile>('/api/v1/profiles', data)
      await get().fetchProfiles()
      return profile
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  updateProfile: async (id, data) => {
    try {
      await apiClient.put(`/api/v1/profiles/${id}`, data)
      await get().fetchProfiles()
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  deleteProfile: async (id) => {
    try {
      await apiClient.delete(`/api/v1/profiles/${id}`)
      await get().fetchProfiles()
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  linkAccount: async (profileId, accountId, sharePct = 100) => {
    try {
      await apiClient.post(`/api/v1/profiles/${profileId}/accounts`, {
        account_id: accountId,
        share_pct: sharePct,
      })
      await get().fetchProfiles()
      await get().fetchJointAccounts()
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  unlinkAccount: async (profileId, accountId) => {
    try {
      await apiClient.delete(`/api/v1/profiles/${profileId}/accounts/${accountId}`)
      await get().fetchProfiles()
      await get().fetchJointAccounts()
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  fetchJointAccounts: async () => {
    try {
      const jointAccounts = await apiClient.get<JointAccount[]>('/api/v1/profiles/joint-accounts')
      set({ jointAccounts })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  clearError: () => set({ error: null }),
}))
