'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { apiClient } from '@/lib/api-client'
import type { AuthResponse, LoginPayload, RegisterPayload, User } from '@/types/api'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  register: (payload: RegisterPayload) => Promise<void>
  login: (payload: LoginPayload) => Promise<void>
  logout: () => void
  setError: (error: string | null) => void
  hydrate: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      register: async (payload) => {
        set({ isLoading: true, error: null })
        try {
          const data = await apiClient.post<AuthResponse>(
            '/api/v1/auth/register',
            payload
          )
          apiClient.setToken(data.tokens.access_token)
          apiClient.setRefreshToken(data.tokens.refresh_token)
          set({
            user: data.user,
            accessToken: data.tokens.access_token,
            refreshToken: data.tokens.refresh_token,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Erreur inconnue'
          set({ error: message, isLoading: false })
          throw err
        }
      },

      login: async (payload) => {
        set({ isLoading: true, error: null })
        try {
          const data = await apiClient.post<AuthResponse>(
            '/api/v1/auth/login',
            payload
          )
          apiClient.setToken(data.tokens.access_token)
          apiClient.setRefreshToken(data.tokens.refresh_token)
          set({
            user: data.user,
            accessToken: data.tokens.access_token,
            refreshToken: data.tokens.refresh_token,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Erreur inconnue'
          set({ error: message, isLoading: false })
          throw err
        }
      },

      logout: () => {
        apiClient.setToken(null)
        apiClient.setRefreshToken(null)
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null,
        })
      },

      setError: (error) => set({ error }),

      hydrate: () => {
        const { accessToken, refreshToken } = get()
        if (accessToken) {
          apiClient.setToken(accessToken)
        }
        if (refreshToken) {
          apiClient.setRefreshToken(refreshToken)
        }
        // Register auto-refresh callbacks
        apiClient.onRefresh(
          (newAccess, newRefresh) => {
            set({ accessToken: newAccess, refreshToken: newRefresh })
          },
          () => {
            // Refresh failed — force logout
            get().logout()
          }
        )
      },
    }),
    {
      name: 'omniflow-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.hydrate()
      },
    }
  )
)
