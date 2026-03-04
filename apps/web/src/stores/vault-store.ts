'use client'

import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'
import type {
  TangibleAsset,
  TangibleAssetCreate,
  TangibleAssetUpdate,
  NFTAsset,
  NFTAssetCreate,
  NFTAssetUpdate,
  CardWallet,
  CardWalletCreate,
  CardWalletUpdate,
  CardRecommendation,
  LoyaltyProgram,
  LoyaltyProgramCreate,
  LoyaltyProgramUpdate,
  Subscription,
  SubscriptionCreate,
  SubscriptionUpdate,
  SubscriptionAnalytics,
  VaultDocument,
  VaultDocumentCreate,
  VaultDocumentUpdate,
  PeerDebt,
  PeerDebtCreate,
  PeerDebtUpdate,
  PeerDebtSettle,
  PeerDebtAnalytics,
  VaultSummary,
} from '@/types/api'

/* ── Types ───────────────────────────────────────────── */

interface VaultState {
  // Data
  assets: TangibleAsset[]
  nfts: NFTAsset[]
  cards: CardWallet[]
  loyalty: LoyaltyProgram[]
  subscriptions: Subscription[]
  documents: VaultDocument[]
  peerDebts: PeerDebt[]
  summary: VaultSummary | null
  subAnalytics: SubscriptionAnalytics | null
  debtAnalytics: PeerDebtAnalytics | null
  cardRecommendation: CardRecommendation | null

  // Loading
  isLoading: boolean
  isLoadingSummary: boolean
  error: string | null

  // Tangible Assets
  fetchAssets: () => Promise<void>
  createAsset: (data: TangibleAssetCreate) => Promise<TangibleAsset>
  updateAsset: (id: string, data: TangibleAssetUpdate) => Promise<void>
  deleteAsset: (id: string) => Promise<void>
  revalueAsset: (id: string) => Promise<void>

  // NFTs
  fetchNFTs: () => Promise<void>
  createNFT: (data: NFTAssetCreate) => Promise<NFTAsset>
  updateNFT: (id: string, data: NFTAssetUpdate) => Promise<void>
  deleteNFT: (id: string) => Promise<void>

  // Cards
  fetchCards: () => Promise<void>
  createCard: (data: CardWalletCreate) => Promise<CardWallet>
  updateCard: (id: string, data: CardWalletUpdate) => Promise<void>
  deleteCard: (id: string) => Promise<void>
  recommendCard: (amount: number, category: string, currency?: string) => Promise<void>

  // Loyalty
  fetchLoyalty: () => Promise<void>
  createLoyalty: (data: LoyaltyProgramCreate) => Promise<LoyaltyProgram>
  updateLoyalty: (id: string, data: LoyaltyProgramUpdate) => Promise<void>
  deleteLoyalty: (id: string) => Promise<void>

  // Subscriptions
  fetchSubscriptions: (activeOnly?: boolean) => Promise<void>
  createSubscription: (data: SubscriptionCreate) => Promise<Subscription>
  updateSubscription: (id: string, data: SubscriptionUpdate) => Promise<void>
  deleteSubscription: (id: string) => Promise<void>
  fetchSubAnalytics: () => Promise<void>

  // Documents
  fetchDocuments: () => Promise<void>
  createDocument: (data: VaultDocumentCreate) => Promise<VaultDocument>
  updateDocument: (id: string, data: VaultDocumentUpdate) => Promise<void>
  deleteDocument: (id: string) => Promise<void>

  // Peer Debts
  fetchPeerDebts: (includeSettled?: boolean) => Promise<void>
  createPeerDebt: (data: PeerDebtCreate) => Promise<PeerDebt>
  updatePeerDebt: (id: string, data: PeerDebtUpdate) => Promise<void>
  deletePeerDebt: (id: string) => Promise<void>
  settlePeerDebt: (id: string, data: PeerDebtSettle) => Promise<void>
  fetchDebtAnalytics: () => Promise<void>

  // Summary
  fetchSummary: () => Promise<void>
}

/* ── Store ───────────────────────────────────────────── */

export const useVaultStore = create<VaultState>((set, get) => ({
  assets: [],
  nfts: [],
  cards: [],
  loyalty: [],
  subscriptions: [],
  documents: [],
  peerDebts: [],
  summary: null,
  subAnalytics: null,
  debtAnalytics: null,
  cardRecommendation: null,
  isLoading: false,
  isLoadingSummary: false,
  error: null,

  // ── Tangible Assets ──────────────────────────────────

  fetchAssets: async () => {
    set({ isLoading: true, error: null })
    try {
      const data = await apiClient.get<TangibleAsset[]>('/api/v1/vault/assets')
      set({ assets: data, isLoading: false })
    } catch (e: any) {
      set({ error: e?.message || 'Erreur chargement biens', isLoading: false })
    }
  },

  createAsset: async (data: TangibleAssetCreate) => {
    const asset = await apiClient.post<TangibleAsset>('/api/v1/vault/assets', data)
    set((s) => ({ assets: [asset, ...s.assets] }))
    return asset
  },

  updateAsset: async (id: string, data: TangibleAssetUpdate) => {
    const updated = await apiClient.put<TangibleAsset>(`/api/v1/vault/assets/${id}`, data)
    set((s) => ({ assets: s.assets.map((a) => (a.id === id ? updated : a)) }))
  },

  deleteAsset: async (id: string) => {
    await apiClient.delete(`/api/v1/vault/assets/${id}`)
    set((s) => ({ assets: s.assets.filter((a) => a.id !== id) }))
  },

  revalueAsset: async (id: string) => {
    const updated = await apiClient.post<TangibleAsset>(`/api/v1/vault/assets/${id}/revalue`)
    set((s) => ({ assets: s.assets.map((a) => (a.id === id ? updated : a)) }))
  },

  // ── NFTs ─────────────────────────────────────────────

  fetchNFTs: async () => {
    set({ isLoading: true, error: null })
    try {
      const data = await apiClient.get<NFTAsset[]>('/api/v1/vault/nfts')
      set({ nfts: data, isLoading: false })
    } catch (e: any) {
      set({ error: e?.message || 'Erreur chargement NFTs', isLoading: false })
    }
  },

  createNFT: async (data: NFTAssetCreate) => {
    const nft = await apiClient.post<NFTAsset>('/api/v1/vault/nfts', data)
    set((s) => ({ nfts: [nft, ...s.nfts] }))
    return nft
  },

  updateNFT: async (id: string, data: NFTAssetUpdate) => {
    const updated = await apiClient.put<NFTAsset>(`/api/v1/vault/nfts/${id}`, data)
    set((s) => ({ nfts: s.nfts.map((n) => (n.id === id ? updated : n)) }))
  },

  deleteNFT: async (id: string) => {
    await apiClient.delete(`/api/v1/vault/nfts/${id}`)
    set((s) => ({ nfts: s.nfts.filter((n) => n.id !== id) }))
  },

  // ── Cards ────────────────────────────────────────────

  fetchCards: async () => {
    set({ isLoading: true, error: null })
    try {
      const data = await apiClient.get<CardWallet[]>('/api/v1/vault/cards')
      set({ cards: data, isLoading: false })
    } catch (e: any) {
      set({ error: e?.message || 'Erreur chargement cartes', isLoading: false })
    }
  },

  createCard: async (data: CardWalletCreate) => {
    const card = await apiClient.post<CardWallet>('/api/v1/vault/cards', data)
    set((s) => ({ cards: [card, ...s.cards] }))
    return card
  },

  updateCard: async (id: string, data: CardWalletUpdate) => {
    const updated = await apiClient.put<CardWallet>(`/api/v1/vault/cards/${id}`, data)
    set((s) => ({ cards: s.cards.map((c) => (c.id === id ? updated : c)) }))
  },

  deleteCard: async (id: string) => {
    await apiClient.delete(`/api/v1/vault/cards/${id}`)
    set((s) => ({ cards: s.cards.filter((c) => c.id !== id) }))
  },

  recommendCard: async (amount: number, category: string, currency?: string) => {
    const data = await apiClient.post<CardRecommendation>('/api/v1/vault/cards/recommend', {
      amount,
      category,
      currency: currency || 'EUR',
    })
    set({ cardRecommendation: data })
  },

  // ── Loyalty Programs ─────────────────────────────────

  fetchLoyalty: async () => {
    set({ isLoading: true, error: null })
    try {
      const data = await apiClient.get<LoyaltyProgram[]>('/api/v1/vault/loyalty')
      set({ loyalty: data, isLoading: false })
    } catch (e: any) {
      set({ error: e?.message || 'Erreur chargement fidélité', isLoading: false })
    }
  },

  createLoyalty: async (data: LoyaltyProgramCreate) => {
    const program = await apiClient.post<LoyaltyProgram>('/api/v1/vault/loyalty', data)
    set((s) => ({ loyalty: [program, ...s.loyalty] }))
    return program
  },

  updateLoyalty: async (id: string, data: LoyaltyProgramUpdate) => {
    const updated = await apiClient.put<LoyaltyProgram>(`/api/v1/vault/loyalty/${id}`, data)
    set((s) => ({ loyalty: s.loyalty.map((l) => (l.id === id ? updated : l)) }))
  },

  deleteLoyalty: async (id: string) => {
    await apiClient.delete(`/api/v1/vault/loyalty/${id}`)
    set((s) => ({ loyalty: s.loyalty.filter((l) => l.id !== id) }))
  },

  // ── Subscriptions ────────────────────────────────────

  fetchSubscriptions: async (activeOnly?: boolean) => {
    set({ isLoading: true, error: null })
    try {
      const params = activeOnly ? '?active_only=true' : ''
      const data = await apiClient.get<Subscription[]>(`/api/v1/vault/subscriptions${params}`)
      set({ subscriptions: data, isLoading: false })
    } catch (e: any) {
      set({ error: e?.message || 'Erreur chargement abonnements', isLoading: false })
    }
  },

  createSubscription: async (data: SubscriptionCreate) => {
    const sub = await apiClient.post<Subscription>('/api/v1/vault/subscriptions', data)
    set((s) => ({ subscriptions: [sub, ...s.subscriptions] }))
    return sub
  },

  updateSubscription: async (id: string, data: SubscriptionUpdate) => {
    const updated = await apiClient.put<Subscription>(`/api/v1/vault/subscriptions/${id}`, data)
    set((s) => ({
      subscriptions: s.subscriptions.map((sub) => (sub.id === id ? updated : sub)),
    }))
  },

  deleteSubscription: async (id: string) => {
    await apiClient.delete(`/api/v1/vault/subscriptions/${id}`)
    set((s) => ({ subscriptions: s.subscriptions.filter((sub) => sub.id !== id) }))
  },

  fetchSubAnalytics: async () => {
    try {
      const data = await apiClient.get<SubscriptionAnalytics>('/api/v1/vault/subscriptions/analytics')
      set({ subAnalytics: data })
    } catch { /* silent */ }
  },

  // ── Documents ────────────────────────────────────────

  fetchDocuments: async () => {
    set({ isLoading: true, error: null })
    try {
      const data = await apiClient.get<VaultDocument[]>('/api/v1/vault/documents')
      set({ documents: data, isLoading: false })
    } catch (e: any) {
      set({ error: e?.message || 'Erreur chargement documents', isLoading: false })
    }
  },

  createDocument: async (data: VaultDocumentCreate) => {
    const doc = await apiClient.post<VaultDocument>('/api/v1/vault/documents', data)
    set((s) => ({ documents: [doc, ...s.documents] }))
    return doc
  },

  updateDocument: async (id: string, data: VaultDocumentUpdate) => {
    const updated = await apiClient.put<VaultDocument>(`/api/v1/vault/documents/${id}`, data)
    set((s) => ({ documents: s.documents.map((d) => (d.id === id ? updated : d)) }))
  },

  deleteDocument: async (id: string) => {
    await apiClient.delete(`/api/v1/vault/documents/${id}`)
    set((s) => ({ documents: s.documents.filter((d) => d.id !== id) }))
  },

  // ── Peer Debts ───────────────────────────────────────

  fetchPeerDebts: async (includeSettled?: boolean) => {
    set({ isLoading: true, error: null })
    try {
      const params = includeSettled === false ? '?include_settled=false' : ''
      const data = await apiClient.get<PeerDebt[]>(`/api/v1/vault/peer-debts${params}`)
      set({ peerDebts: data, isLoading: false })
    } catch (e: any) {
      set({ error: e?.message || 'Erreur chargement dettes P2P', isLoading: false })
    }
  },

  createPeerDebt: async (data: PeerDebtCreate) => {
    const debt = await apiClient.post<PeerDebt>('/api/v1/vault/peer-debts', data)
    set((s) => ({ peerDebts: [debt, ...s.peerDebts] }))
    return debt
  },

  updatePeerDebt: async (id: string, data: PeerDebtUpdate) => {
    const updated = await apiClient.put<PeerDebt>(`/api/v1/vault/peer-debts/${id}`, data)
    set((s) => ({ peerDebts: s.peerDebts.map((d) => (d.id === id ? updated : d)) }))
  },

  deletePeerDebt: async (id: string) => {
    await apiClient.delete(`/api/v1/vault/peer-debts/${id}`)
    set((s) => ({ peerDebts: s.peerDebts.filter((d) => d.id !== id) }))
  },

  settlePeerDebt: async (id: string, data: PeerDebtSettle) => {
    const updated = await apiClient.post<PeerDebt>(`/api/v1/vault/peer-debts/${id}/settle`, data)
    set((s) => ({ peerDebts: s.peerDebts.map((d) => (d.id === id ? updated : d)) }))
  },

  fetchDebtAnalytics: async () => {
    try {
      const data = await apiClient.get<PeerDebtAnalytics>('/api/v1/vault/peer-debts/analytics')
      set({ debtAnalytics: data })
    } catch { /* silent */ }
  },

  // ── Summary ──────────────────────────────────────────

  fetchSummary: async () => {
    set({ isLoadingSummary: true })
    try {
      const data = await apiClient.get<VaultSummary>('/api/v1/vault/summary')
      set({ summary: data, isLoadingSummary: false })
    } catch (e: any) {
      set({ error: e?.message || 'Erreur chargement résumé', isLoadingSummary: false })
    }
  },
}))
