'use client'

import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'

/* ── Types ───────────────────────────────────────────── */
export interface MarketCoin {
  id: string
  symbol: string
  name: string
  image: string
  current_price: number
  market_cap: number
  market_cap_rank: number
  total_volume: number
  price_change_percentage_1h_in_currency: number | null
  price_change_percentage_24h: number | null
  price_change_percentage_7d_in_currency: number | null
  price_change_percentage_30d_in_currency: number | null
  circulating_supply: number
  total_supply: number | null
  max_supply: number | null
  ath: number
  ath_change_percentage: number
  ath_date: string
  atl: number
  high_24h: number
  low_24h: number
  sparkline_in_7d: { price: number[] } | null
  fully_diluted_valuation: number | null
}

export interface CoinDetail {
  id: string
  symbol: string
  name: string
  image: string | null
  description: string
  categories: string[]
  links: {
    homepage: string | null
    blockchain_site: string[]
    twitter: string | null
    reddit: string | null
  }
  market_data: {
    current_price_eur: number
    market_cap_eur: number
    total_volume_eur: number
    high_24h_eur: number
    low_24h_eur: number
    price_change_24h: number
    price_change_percentage_24h: number
    price_change_percentage_7d: number
    price_change_percentage_30d: number
    price_change_percentage_1y: number | null
    ath_eur: number
    ath_change_percentage: number
    ath_date: string
    atl_eur: number
    circulating_supply: number
    total_supply: number | null
    max_supply: number | null
    fully_diluted_valuation_eur: number | null
    sparkline_7d: number[]
  }
  genesis_date: string | null
  sentiment_votes_up_percentage: number | null
  sentiment_votes_down_percentage: number | null
}

export interface ChartData {
  prices: [number, number][]
  volumes: [number, number][]
  market_caps: [number, number][]
}

export interface GlobalData {
  active_cryptocurrencies: number
  total_market_cap_eur: number
  total_volume_eur: number
  market_cap_change_percentage_24h: number
  btc_dominance: number
  eth_dominance: number
}

export interface TrendingCoin {
  id: string
  symbol: string
  name: string
  thumb: string
  market_cap_rank: number | null
  score: number
}

interface MarketState {
  coins: MarketCoin[]
  coinDetail: CoinDetail | null
  chartData: ChartData | null
  globalData: GlobalData | null
  trendingCoins: TrendingCoin[]
  searchResults: { id: string; symbol: string; name: string; thumb: string; market_cap_rank: number | null }[]
  isLoading: boolean
  isLoadingDetail: boolean
  isLoadingChart: boolean
  page: number
  error: string | null

  fetchCoins: (page?: number) => Promise<void>
  fetchCoinDetail: (coinId: string) => Promise<void>
  fetchChart: (coinId: string, days?: string) => Promise<void>
  fetchGlobalData: () => Promise<void>
  fetchTrending: () => Promise<void>
  searchCoins: (q: string) => Promise<void>
  clearDetail: () => void
  clearSearch: () => void
}

export const useMarketStore = create<MarketState>((set, get) => ({
  coins: [],
  coinDetail: null,
  chartData: null,
  globalData: null,
  trendingCoins: [],
  searchResults: [],
  isLoading: false,
  isLoadingDetail: false,
  isLoadingChart: false,
  page: 1,
  error: null,

  fetchCoins: async (page = 1) => {
    set({ isLoading: true, error: null, page })
    try {
      const data = await apiClient.get<MarketCoin[]>(
        `/api/v1/market/crypto/coins?page=${page}&per_page=100&sparkline=true`
      )
      set((s) => ({
        coins: page === 1 ? data : [...s.coins, ...data],
        isLoading: false,
      }))
    } catch (e: any) {
      set({ error: e.message, isLoading: false })
    }
  },

  fetchCoinDetail: async (coinId) => {
    set({ isLoadingDetail: true, coinDetail: null })
    try {
      const data = await apiClient.get<CoinDetail>(`/api/v1/market/crypto/coin/${coinId}`)
      set({ coinDetail: data, isLoadingDetail: false })
    } catch (e: any) {
      set({ error: e.message, isLoadingDetail: false })
    }
  },

  fetchChart: async (coinId, days = '7') => {
    set({ isLoadingChart: true })
    try {
      const data = await apiClient.get<ChartData>(`/api/v1/market/crypto/chart/${coinId}?days=${days}`)
      set({ chartData: data, isLoadingChart: false })
    } catch (e: any) {
      set({ isLoadingChart: false })
    }
  },

  fetchGlobalData: async () => {
    try {
      const data = await apiClient.get<GlobalData>('/api/v1/market/crypto/global')
      set({ globalData: data })
    } catch {}
  },

  fetchTrending: async () => {
    try {
      const data = await apiClient.get<TrendingCoin[]>('/api/v1/market/crypto/trending')
      set({ trendingCoins: data })
    } catch {}
  },

  searchCoins: async (q) => {
    if (!q || q.length < 1) { set({ searchResults: [] }); return }
    try {
      const data = await apiClient.get<any[]>(`/api/v1/market/crypto/search?q=${encodeURIComponent(q)}`)
      set({ searchResults: data })
    } catch { set({ searchResults: [] }) }
  },

  clearDetail: () => set({ coinDetail: null, chartData: null }),
  clearSearch: () => set({ searchResults: [] }),
}))
