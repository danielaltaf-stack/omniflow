'use client'

import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'
import type {
  CryptoPortfolio,
  CryptoWallet,
  CryptoTaxSummary,
  CryptoStakingSummary,
  CryptoTransactionList,
  CryptoTransaction,
  CryptoPMPA,
  SupportedChain,
} from '@/types/api'

interface CryptoState {
  portfolio: CryptoPortfolio | null
  taxSummary: CryptoTaxSummary | null
  stakingSummary: CryptoStakingSummary | null
  transactions: CryptoTransactionList | null
  supportedChains: SupportedChain[]
  isLoading: boolean
  isSyncing: boolean
  error: string | null

  fetchPortfolio: () => Promise<void>
  createWallet: (data: {
    platform: string
    label: string
    api_key?: string
    api_secret?: string
    address?: string
    chain?: string
  }) => Promise<void>
  syncWallet: (walletId: string) => Promise<void>
  deleteWallet: (walletId: string) => Promise<void>
  // B4
  fetchTaxSummary: (year: number) => Promise<void>
  fetchStakingSummary: () => Promise<void>
  fetchTransactions: (walletId?: string, limit?: number, offset?: number) => Promise<void>
  addTransaction: (data: {
    wallet_id: string
    tx_type: string
    token_symbol: string
    quantity: number
    price_eur: number
    fee_eur?: number
    counterpart?: string
    tx_hash?: string
    executed_at: string
  }) => Promise<void>
  exportCerfa: (year: number) => Promise<void>
  fetchPMPA: (symbol: string) => Promise<CryptoPMPA>
  fetchSupportedChains: () => Promise<void>
  clearError: () => void
}

export const useCryptoStore = create<CryptoState>((set, get) => ({
  portfolio: null,
  taxSummary: null,
  stakingSummary: null,
  transactions: null,
  supportedChains: [],
  isLoading: false,
  isSyncing: false,
  error: null,

  fetchPortfolio: async () => {
    set({ isLoading: true, error: null })
    try {
      const data = await apiClient.get<CryptoPortfolio>('/api/v1/crypto')
      set({ portfolio: data, isLoading: false })
    } catch (e: any) {
      set({ error: e.message, isLoading: false })
    }
  },

  createWallet: async (data) => {
    set({ isSyncing: true, error: null })
    try {
      await apiClient.post('/api/v1/crypto/wallets', data)
      await get().fetchPortfolio()
      set({ isSyncing: false })
    } catch (e: any) {
      set({ error: e.message, isSyncing: false })
      throw e
    }
  },

  syncWallet: async (walletId: string) => {
    set({ isSyncing: true, error: null })
    try {
      await apiClient.post(`/api/v1/crypto/wallets/${walletId}/sync`, {})
      await get().fetchPortfolio()
      set({ isSyncing: false })
    } catch (e: any) {
      set({ error: e.message, isSyncing: false })
    }
  },

  deleteWallet: async (walletId: string) => {
    try {
      await apiClient.delete(`/api/v1/crypto/wallets/${walletId}`)
      await get().fetchPortfolio()
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  // ── B4: Tax ───────────────────────────────────────────

  fetchTaxSummary: async (year: number) => {
    set({ isLoading: true, error: null })
    try {
      const data = await apiClient.get<CryptoTaxSummary>(`/api/v1/crypto/tax/summary?year=${year}`)
      set({ taxSummary: data, isLoading: false })
    } catch (e: any) {
      set({ error: e.message, isLoading: false })
    }
  },

  fetchTransactions: async (walletId?: string, limit = 50, offset = 0) => {
    set({ isLoading: true, error: null })
    try {
      let url = `/api/v1/crypto/transactions?limit=${limit}&offset=${offset}`
      if (walletId) url += `&wallet_id=${walletId}`
      const data = await apiClient.get<CryptoTransactionList>(url)
      set({ transactions: data, isLoading: false })
    } catch (e: any) {
      set({ error: e.message, isLoading: false })
    }
  },

  addTransaction: async (data) => {
    set({ isSyncing: true, error: null })
    try {
      await apiClient.post('/api/v1/crypto/transactions', data)
      set({ isSyncing: false })
      // Refresh transactions
      await get().fetchTransactions()
    } catch (e: any) {
      set({ error: e.message, isSyncing: false })
      throw e
    }
  },

  exportCerfa: async (year: number) => {
    try {
      const response = await fetch(`/api/v1/crypto/tax/export-csv?year=${year}`, {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Erreur export CSV')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cerfa_2086_${year}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  fetchPMPA: async (symbol: string) => {
    const data = await apiClient.get<CryptoPMPA>(`/api/v1/crypto/tax/pmpa/${symbol}`)
    return data
  },

  // ── B4: Staking ───────────────────────────────────────

  fetchStakingSummary: async () => {
    set({ isLoading: true, error: null })
    try {
      const data = await apiClient.get<CryptoStakingSummary>('/api/v1/crypto/staking/summary')
      set({ stakingSummary: data, isLoading: false })
    } catch (e: any) {
      set({ error: e.message, isLoading: false })
    }
  },

  // ── B4: Multi-chain ───────────────────────────────────

  fetchSupportedChains: async () => {
    try {
      const data = await apiClient.get<SupportedChain[]>('/api/v1/crypto/chains')
      set({ supportedChains: data })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  clearError: () => set({ error: null }),
}))
