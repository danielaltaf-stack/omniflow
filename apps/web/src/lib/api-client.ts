/**
 * OmniFlow — Typed API client with auto-refresh.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface ApiError {
  detail: string
}

interface RefreshResult {
  access_token: string
  refresh_token: string
}

class ApiClient {
  private accessToken: string | null = null
  private refreshToken: string | null = null
  private refreshPromise: Promise<boolean> | null = null
  private onTokenRefreshed: ((access: string, refresh: string) => void) | null = null
  private onAuthFailure: (() => void) | null = null

  setToken(token: string | null) {
    this.accessToken = token
  }

  getToken(): string | null {
    return this.accessToken
  }

  setRefreshToken(token: string | null) {
    this.refreshToken = token
  }

  /**
   * Register callbacks so the auth store stays in sync
   * when tokens are auto-refreshed.
   */
  onRefresh(
    onSuccess: (access: string, refresh: string) => void,
    onFailure: () => void
  ) {
    this.onTokenRefreshed = onSuccess
    this.onAuthFailure = onFailure
  }

  /**
   * Attempt to refresh the access token using the stored refresh token.
   * De-duplicates concurrent refresh calls.
   */
  private async tryRefresh(): Promise<boolean> {
    if (!this.refreshToken) return false

    // De-duplicate: if a refresh is already in flight, wait for it
    if (this.refreshPromise) return this.refreshPromise

    this.refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: this.refreshToken }),
        })
        if (!res.ok) return false
        const data: RefreshResult = await res.json()
        this.accessToken = data.access_token
        this.refreshToken = data.refresh_token
        this.onTokenRefreshed?.(data.access_token, data.refresh_token)
        return true
      } catch {
        return false
      } finally {
        this.refreshPromise = null
      }
    })()

    return this.refreshPromise
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    _isRetry = false
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    })

    // On 401, try refresh once then retry the original request
    if (response.status === 401 && !_isRetry && this.refreshToken) {
      const refreshed = await this.tryRefresh()
      if (refreshed) {
        return this.request<T>(endpoint, options, true)
      }
      // Refresh failed — force logout
      this.onAuthFailure?.()
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: `HTTP ${response.status}`,
      }))
      const detail = error.detail
      const message = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((e: any) => e.msg ?? JSON.stringify(e)).join('; ')
          : `HTTP ${response.status}`
      throw new Error(message)
    }

    // 204 No Content — nothing to parse
    if (response.status === 204) {
      return undefined as unknown as T
    }

    return response.json() as Promise<T>
  }

  get<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  post<T>(endpoint: string, body?: unknown) {
    const serialized = body ? JSON.stringify(body) : undefined
    return this.request<T>(endpoint, {
      method: 'POST',
      body: serialized,
    })
  }

  put<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }

  patch<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    })
  }
}

export const apiClient = new ApiClient()
