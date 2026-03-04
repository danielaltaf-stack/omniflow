'use client'

import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'
import type {
  ConsentStatus,
  ConsentUpdateRequest,
  AuditLogEntry,
  AuditLogResponse,
  DataExportResponse,
  AccountDeletionRequest,
  AccountDeletionResponse,
  FeedbackRequest,
  FeedbackResponse,
  ChangelogVersion,
  ChangelogResponse,
  PrivacyPolicyResponse,
} from '@/types/api'

interface SettingsState {
  // Consent
  consent: ConsentStatus | null
  isLoadingConsent: boolean

  // Audit log
  auditEntries: AuditLogEntry[]
  auditTotal: number
  isLoadingAudit: boolean

  // Export
  isExporting: boolean

  // Account deletion
  isDeleting: boolean

  // Feedback
  isSendingFeedback: boolean

  // Changelog
  changelog: ChangelogVersion[]
  isLoadingChangelog: boolean

  // Password
  isChangingPassword: boolean

  // Privacy policy
  privacyPolicy: PrivacyPolicyResponse | null

  // Actions
  fetchConsent: () => Promise<void>
  updateConsent: (data: ConsentUpdateRequest) => Promise<void>
  exportData: (anonymize?: boolean) => Promise<DataExportResponse>
  deleteAccount: (confirmation: string, password: string) => Promise<AccountDeletionResponse>
  fetchAuditLog: (offset?: number, limit?: number, action?: string) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  sendFeedback: (data: FeedbackRequest) => Promise<FeedbackResponse>
  fetchChangelog: () => Promise<void>
  fetchPrivacyPolicy: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  consent: null,
  isLoadingConsent: false,
  auditEntries: [],
  auditTotal: 0,
  isLoadingAudit: false,
  isExporting: false,
  isDeleting: false,
  isSendingFeedback: false,
  changelog: [],
  isLoadingChangelog: false,
  isChangingPassword: false,
  privacyPolicy: null,

  fetchConsent: async () => {
    set({ isLoadingConsent: true })
    try {
      const data = await apiClient.get<ConsentStatus>('/api/v1/settings/consent')
      set({ consent: data })
    } catch {
      // silent
    } finally {
      set({ isLoadingConsent: false })
    }
  },

  updateConsent: async (data) => {
    try {
      const updated = await apiClient.put<ConsentStatus>('/api/v1/settings/consent', data)
      set({ consent: updated })
    } catch (err) {
      throw err
    }
  },

  exportData: async (anonymize = false) => {
    set({ isExporting: true })
    try {
      const url = anonymize
        ? '/api/v1/settings/export?anonymize=true'
        : '/api/v1/settings/export'
      const data = await apiClient.get<DataExportResponse>(url)
      return data
    } finally {
      set({ isExporting: false })
    }
  },

  deleteAccount: async (confirmation, password) => {
    set({ isDeleting: true })
    try {
      const data = await apiClient.delete<AccountDeletionResponse>('/api/v1/settings/account')
      return data
    } finally {
      set({ isDeleting: false })
    }
  },

  fetchAuditLog: async (offset = 0, limit = 10, action) => {
    set({ isLoadingAudit: true })
    try {
      let url = `/api/v1/settings/audit-log?offset=${offset}&limit=${limit}`
      if (action) url += `&action=${action}`
      const data = await apiClient.get<AuditLogResponse>(url)
      if (offset === 0) {
        set({ auditEntries: data.entries, auditTotal: data.total })
      } else {
        set((s) => ({
          auditEntries: [...s.auditEntries, ...data.entries],
          auditTotal: data.total,
        }))
      }
    } catch {
      // silent
    } finally {
      set({ isLoadingAudit: false })
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    set({ isChangingPassword: true })
    try {
      await apiClient.put('/api/v1/auth/password', {
        current_password: currentPassword,
        new_password: newPassword,
      })
    } finally {
      set({ isChangingPassword: false })
    }
  },

  sendFeedback: async (data) => {
    set({ isSendingFeedback: true })
    try {
      const res = await apiClient.post<FeedbackResponse>('/api/v1/feedback', data)
      return res
    } finally {
      set({ isSendingFeedback: false })
    }
  },

  fetchChangelog: async () => {
    set({ isLoadingChangelog: true })
    try {
      const data = await apiClient.get<ChangelogResponse>('/api/v1/changelog')
      set({ changelog: data.versions })
    } catch {
      // silent
    } finally {
      set({ isLoadingChangelog: false })
    }
  },

  fetchPrivacyPolicy: async () => {
    try {
      const data = await apiClient.get<PrivacyPolicyResponse>('/api/v1/settings/privacy-policy')
      set({ privacyPolicy: data })
    } catch {
      // silent
    }
  },
}))
