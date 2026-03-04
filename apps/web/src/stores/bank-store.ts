'use client'

import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'
import type {
  Account,
  Bank,
  BankConnection,
  PaginatedTransactions,
  SyncResponse,
} from '@/types/api'

interface BankState {
  // Data
  banks: Bank[]
  connections: BankConnection[]
  accounts: Account[]
  transactions: Record<string, PaginatedTransactions>

  // Loading states
  isLoadingBanks: boolean
  isLoadingConnections: boolean
  isLoadingAccounts: boolean
  isSyncing: boolean

  // Error
  error: string | null

  // Actions
  fetchBanks: () => Promise<void>
  fetchConnections: () => Promise<void>
  fetchAccounts: () => Promise<void>
  fetchTransactions: (accountId: string, page?: number) => Promise<void>
  createConnection: (data: {
    bank_module: string
    credentials: Record<string, string>
  }) => Promise<SyncResponse>
  verify2FA: (connectionId: string, code: string) => Promise<SyncResponse>
  deleteConnection: (id: string) => Promise<void>
  syncConnection: (id: string) => Promise<SyncResponse>
  clearError: () => void
}

export const useBankStore = create<BankState>((set, get) => ({
  banks: [],
  connections: [],
  accounts: [],
  transactions: {},
  isLoadingBanks: false,
  isLoadingConnections: false,
  isLoadingAccounts: false,
  isSyncing: false,
  error: null,

  fetchBanks: async () => {
    set({ isLoadingBanks: true, error: null })
    try {
      const banks = await apiClient.get<Bank[]>('/api/v1/banks')
      set({ banks, isLoadingBanks: false })
    } catch (e: any) {
      set({ error: e.message, isLoadingBanks: false })
    }
  },

  fetchConnections: async () => {
    set({ isLoadingConnections: true, error: null })
    try {
      const connections = await apiClient.get<BankConnection[]>('/api/v1/connections')
      set({ connections, isLoadingConnections: false })
    } catch (e: any) {
      set({ error: e.message, isLoadingConnections: false })
    }
  },

  fetchAccounts: async () => {
    set({ isLoadingAccounts: true, error: null })
    try {
      const accounts = await apiClient.get<Account[]>('/api/v1/accounts')
      set({ accounts, isLoadingAccounts: false })
    } catch (e: any) {
      set({ error: e.message, isLoadingAccounts: false })
    }
  },

  fetchTransactions: async (accountId: string, page = 1) => {
    try {
      const data = await apiClient.get<PaginatedTransactions>(
        `/api/v1/accounts/${accountId}/transactions?page=${page}&per_page=30`
      )
      set((state) => ({
        transactions: { ...state.transactions, [accountId]: data },
      }))
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  createConnection: async (data) => {
    set({ isSyncing: true, error: null })
    try {
      const result = await apiClient.post<SyncResponse>('/api/v1/connections', data)
      // Refresh connections and accounts after sync
      await get().fetchConnections()
      await get().fetchAccounts()
      set({ isSyncing: false })
      return result
    } catch (e: any) {
      set({ error: e.message, isSyncing: false })
      throw e
    }
  },

  verify2FA: async (connectionId: string, code: string) => {
    set({ isSyncing: true, error: null })
    try {
      const result = await apiClient.post<SyncResponse>(
        `/api/v1/connections/${connectionId}/verify-2fa`,
        { code }
      )
      await get().fetchConnections()
      await get().fetchAccounts()
      set({ isSyncing: false })
      return result
    } catch (e: any) {
      set({ error: e.message, isSyncing: false })
      throw e
    }
  },

  deleteConnection: async (id: string) => {
    try {
      await apiClient.delete(`/api/v1/connections/${id}`)
      await get().fetchConnections()
      await get().fetchAccounts()
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  syncConnection: async (id: string) => {
    set({ isSyncing: true, error: null })
    try {
      const result = await apiClient.post<SyncResponse>(
        `/api/v1/connections/${id}/sync`,
        {}
      )
      await get().fetchConnections()
      await get().fetchAccounts()
      set({ isSyncing: false })
      return result
    } catch (e: any) {
      set({ error: e.message, isSyncing: false })
      throw e
    }
  },

  clearError: () => set({ error: null }),
}))
