'use client'

import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'
import type {
  ConversationData,
  ConversationDetail,
  ConversationsResponse,
  ChatSuggestion,
  SuggestionsResponse,
  AdvisorStatus,
  SimulationResult,
  NovaMemory,
  MemoriesResponse,
  MemoryStats,
} from '@/types/api'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface StreamMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

interface AdvisorState {
  // Chat state
  messages: StreamMessage[]
  conversations: ConversationData[]
  currentConversationId: string | null
  suggestions: ChatSuggestion[]
  status: AdvisorStatus | null

  // Memory state
  memories: NovaMemory[]
  memoryStats: MemoryStats | null
  isLoadingMemories: boolean

  // Simulator state
  simulation: SimulationResult | null

  // UI state
  isStreaming: boolean
  isChatOpen: boolean
  isLoadingConversations: boolean
  isLoadingSimulation: boolean
  error: string | null

  // Chat actions
  sendMessage: (message: string) => Promise<void>
  fetchConversations: () => Promise<void>
  loadConversation: (id: string) => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  pinConversation: (id: string) => Promise<void>
  newConversation: () => void
  fetchSuggestions: () => Promise<void>
  fetchStatus: () => Promise<void>

  // Memory actions
  fetchMemories: (category?: string) => Promise<void>
  addMemory: (content: string, type?: string, category?: string, importance?: number) => Promise<void>
  deleteMemory: (id: string) => Promise<void>
  clearMemories: () => Promise<void>
  fetchMemoryStats: () => Promise<void>

  // Simulator actions
  runSimulation: (params: {
    initial_amount: number
    monthly_contribution: number
    years: number
    scenario: string
    inflation_rate?: number
  }) => Promise<void>

  // UI actions
  toggleChat: () => void
  openChat: () => void
  closeChat: () => void
  clearError: () => void
}

let messageCounter = 0

export const useAdvisorStore = create<AdvisorState>((set, get) => ({
  messages: [],
  conversations: [],
  currentConversationId: null,
  suggestions: [],
  status: null,
  memories: [],
  memoryStats: null,
  isLoadingMemories: false,
  simulation: null,

  isStreaming: false,
  isChatOpen: false,
  isLoadingConversations: false,
  isLoadingSimulation: false,
  error: null,

  sendMessage: async (message: string) => {
    const state = get()
    if (state.isStreaming) return

    const userMsg: StreamMessage = {
      id: `user-${++messageCounter}`,
      role: 'user',
      content: message,
    }

    const assistantMsg: StreamMessage = {
      id: `assistant-${++messageCounter}`,
      role: 'assistant',
      content: '',
      isStreaming: true,
    }

    set({
      messages: [...state.messages, userMsg, assistantMsg],
      isStreaming: true,
      error: null,
    })

    try {
      const token = apiClient.getToken()
      const response = await fetch(`${API_BASE}/api/v1/advisor/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message,
          conversation_id: state.currentConversationId,
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }))
        throw new Error(errData.detail || `Erreur ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No stream reader')

      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))

            if (data.content) {
              fullContent += data.content
              set((s) => ({
                messages: s.messages.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, content: fullContent }
                    : m
                ),
              }))
            }

            if (data.conversation_id) {
              set({ currentConversationId: data.conversation_id })
            }
          } catch {
            // Ignore malformed events
          }
        }
      }

      // Mark streaming as done
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, isStreaming: false }
            : m
        ),
        isStreaming: false,
      }))

      // Refresh suggestions after each conversation (they're now dynamic)
      get().fetchSuggestions()
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Erreur de connexion'
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === assistantMsg.id
            ? {
                ...m,
                content: `Erreur: ${errMsg}`,
                isStreaming: false,
              }
            : m
        ),
        isStreaming: false,
        error: errMsg,
      }))
    }
  },

  fetchConversations: async () => {
    set({ isLoadingConversations: true })
    try {
      const data = await apiClient.get<ConversationsResponse>(
        '/api/v1/advisor/conversations'
      )
      set({ conversations: data.conversations, isLoadingConversations: false })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Erreur', isLoadingConversations: false })
    }
  },

  loadConversation: async (id: string) => {
    try {
      const data = await apiClient.get<ConversationDetail>(
        `/api/v1/advisor/conversations/${id}`
      )
      const messages: StreamMessage[] = data.messages.map((m, i) => ({
        id: `loaded-${i}`,
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))
      set({
        messages,
        currentConversationId: id,
      })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Erreur' })
    }
  },

  deleteConversation: async (id: string) => {
    try {
      await apiClient.delete(`/api/v1/advisor/conversations/${id}`)
      set((s) => ({
        conversations: s.conversations.filter((c) => c.id !== id),
        ...(s.currentConversationId === id
          ? { currentConversationId: null, messages: [] }
          : {}),
      }))
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Erreur' })
    }
  },

  pinConversation: async (id: string) => {
    try {
      const data = await apiClient.post<{ id: string; is_pinned: boolean }>(
        `/api/v1/advisor/conversations/${id}/pin`,
        {}
      )
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === id ? { ...c, is_pinned: data.is_pinned } : c
        ),
      }))
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Erreur' })
    }
  },

  newConversation: () => {
    set({ messages: [], currentConversationId: null })
  },

  fetchSuggestions: async () => {
    try {
      const data = await apiClient.get<SuggestionsResponse>(
        '/api/v1/advisor/suggestions'
      )
      set({ suggestions: data.suggestions })
    } catch {
      // silent
    }
  },

  fetchStatus: async () => {
    try {
      const data = await apiClient.get<AdvisorStatus>(
        '/api/v1/advisor/status'
      )
      set({ status: data })
    } catch {
      // silent
    }
  },

  // ── Memory actions ──────────────────────────────────────

  fetchMemories: async (category?: string) => {
    set({ isLoadingMemories: true })
    try {
      const url = category
        ? `/api/v1/advisor/memories?category=${category}`
        : '/api/v1/advisor/memories'
      const data = await apiClient.get<MemoriesResponse>(url)
      set({ memories: data.memories, isLoadingMemories: false })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Erreur', isLoadingMemories: false })
    }
  },

  addMemory: async (content: string, type = 'fact', category = 'general', importance = 5) => {
    try {
      await apiClient.post('/api/v1/advisor/memories', {
        content,
        memory_type: type,
        category,
        importance,
      })
      // Refresh
      get().fetchMemories()
      get().fetchMemoryStats()
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Erreur' })
    }
  },

  deleteMemory: async (id: string) => {
    try {
      await apiClient.delete(`/api/v1/advisor/memories/${id}`)
      set((s) => ({
        memories: s.memories.filter((m) => m.id !== id),
      }))
      get().fetchMemoryStats()
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Erreur' })
    }
  },

  clearMemories: async () => {
    try {
      await apiClient.delete('/api/v1/advisor/memories')
      set({ memories: [] })
      get().fetchMemoryStats()
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Erreur' })
    }
  },

  fetchMemoryStats: async () => {
    try {
      const data = await apiClient.get<MemoryStats>('/api/v1/advisor/memories/stats')
      set({ memoryStats: data })
    } catch {
      // silent
    }
  },

  // ── Simulator actions ───────────────────────────────────

  runSimulation: async (params) => {
    set({ isLoadingSimulation: true, error: null })
    try {
      const data = await apiClient.post<SimulationResult>(
        '/api/v1/advisor/simulate',
        params
      )
      set({ simulation: data, isLoadingSimulation: false })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Erreur', isLoadingSimulation: false })
    }
  },

  toggleChat: () => set((s) => ({ isChatOpen: !s.isChatOpen })),
  openChat: () => set({ isChatOpen: true }),
  closeChat: () => set({ isChatOpen: false }),
  clearError: () => set({ error: null }),
}))
