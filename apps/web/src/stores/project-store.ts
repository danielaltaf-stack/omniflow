'use client'

import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'
import type { ProjectBudget, ProjectProgress } from '@/types/api'

interface ProjectState {
  projects: ProjectBudget[]
  selectedProject: ProjectBudget | null
  isLoading: boolean
  error: string | null

  fetchProjects: (includeArchived?: boolean) => Promise<void>
  fetchProject: (id: string) => Promise<ProjectBudget>
  createProject: (data: {
    name: string
    description?: string
    icon?: string
    color?: string
    target_amount: number
    deadline?: string
  }) => Promise<ProjectBudget>
  updateProject: (id: string, data: Record<string, any>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  archiveProject: (id: string) => Promise<void>
  addContribution: (projectId: string, data: {
    amount: number
    date: string
    note?: string
  }) => Promise<void>
  deleteContribution: (projectId: string, contributionId: string) => Promise<void>
  getProgress: (id: string) => Promise<ProjectProgress>
  clearError: () => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  selectedProject: null,
  isLoading: false,
  error: null,

  fetchProjects: async (includeArchived = false) => {
    set({ isLoading: true, error: null })
    try {
      const projects = await apiClient.get<ProjectBudget[]>(
        `/api/v1/projects?include_archived=${includeArchived}`
      )
      set({ projects, isLoading: false })
    } catch (e: any) {
      set({ error: e.message, isLoading: false })
    }
  },

  fetchProject: async (id) => {
    try {
      const project = await apiClient.get<ProjectBudget>(`/api/v1/projects/${id}`)
      set({ selectedProject: project })
      return project
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  createProject: async (data) => {
    try {
      const project = await apiClient.post<ProjectBudget>('/api/v1/projects', data)
      await get().fetchProjects()
      return project
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  updateProject: async (id, data) => {
    try {
      await apiClient.put(`/api/v1/projects/${id}`, data)
      await get().fetchProjects()
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  deleteProject: async (id) => {
    try {
      await apiClient.delete(`/api/v1/projects/${id}`)
      await get().fetchProjects()
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  archiveProject: async (id) => {
    try {
      await apiClient.post(`/api/v1/projects/${id}/archive`, {})
      await get().fetchProjects()
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  addContribution: async (projectId, data) => {
    try {
      await apiClient.post(`/api/v1/projects/${projectId}/contributions`, {
        amount: data.amount,
        contribution_date: data.date,
        note: data.note,
      })
      await get().fetchProjects()
      // Refresh selected project if it's the same one
      if (get().selectedProject?.id === projectId) {
        await get().fetchProject(projectId)
      }
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  deleteContribution: async (projectId, contributionId) => {
    try {
      await apiClient.delete(`/api/v1/projects/${projectId}/contributions/${contributionId}`)
      await get().fetchProjects()
      if (get().selectedProject?.id === projectId) {
        await get().fetchProject(projectId)
      }
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  getProgress: async (id) => {
    try {
      return await apiClient.get<ProjectProgress>(`/api/v1/projects/${id}/progress`)
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  clearError: () => set({ error: null }),
}))
