/**
 * OmniFlow — Sentry Client-Side Configuration
 *
 * Initializes Sentry in the browser for error tracking, performance
 * monitoring, and session replay on errors.
 *
 * Features:
 *   - beforeSend filter: suppress ResizeObserver, ChunkLoadError, and network noise
 *   - Session Replay on errors (100%) and on sessions (10%)
 *   - Distributed tracing: propagates to api.omniflow.app
 *   - RGPD: no PII, scrubs Authorization/cookies/passwords
 *   - Source maps uploaded at build time (not exposed to client)
 *
 * Usage:
 *   import { initSentry, captureException, setUser } from '@/lib/sentry.client.config'
 *   initSentry() // Call once in providers.tsx
 */

// ── Types ──────────────────────────────────────────────────────

interface SentryEvent {
  exception?: {
    values?: Array<{
      type?: string
      value?: string
    }>
  }
  request?: {
    headers?: Record<string, string>
    data?: Record<string, unknown>
  }
  transaction?: string
  [key: string]: unknown
}

interface SentryHint {
  originalException?: Error | string
  [key: string]: unknown
}

// ── State ──────────────────────────────────────────────────────

let _initialized = false
let _Sentry: typeof import('@sentry/nextjs') | null = null

// ── Noise patterns to suppress ─────────────────────────────────

const SUPPRESSED_ERRORS = [
  // Browser resize observer noise (common in all SPAs)
  'ResizeObserver loop',
  'ResizeObserver loop completed with undelivered notifications',
  // Next.js chunk loading failures (user on slow connection, deploy during navigation)
  'ChunkLoadError',
  'Loading chunk',
  'Failed to fetch dynamically imported module',
  // Network errors (user offline, API timeout — handled by app-level error handling)
  'Load failed',
  'NetworkError',
  'AbortError',
  'TypeError: Failed to fetch',
  // Browser extension noise
  'chrome-extension://',
  'moz-extension://',
  // Safari-specific noise
  'cancelled',
]

// ── Before Send Filter ─────────────────────────────────────────

function beforeSend(event: SentryEvent, hint: SentryHint): SentryEvent | null {
  const errorMessage =
    hint.originalException instanceof Error
      ? hint.originalException.message
      : typeof hint.originalException === 'string'
        ? hint.originalException
        : ''

  // Check error message against suppressed patterns
  if (errorMessage && SUPPRESSED_ERRORS.some((pattern) => errorMessage.includes(pattern))) {
    return null
  }

  // Check exception values (Sentry-normalized)
  const exceptionValues = event.exception?.values ?? []
  for (const exVal of exceptionValues) {
    const val = exVal.value ?? ''
    const typ = exVal.type ?? ''
    if (SUPPRESSED_ERRORS.some((p) => val.includes(p) || typ.includes(p))) {
      return null
    }
  }

  // Scrub sensitive request headers (RGPD compliance)
  if (event.request?.headers) {
    const headers = event.request.headers
    for (const key of Object.keys(headers)) {
      const lk = key.toLowerCase()
      if (lk === 'authorization' || lk === 'cookie' || lk === 'set-cookie') {
        headers[key] = '[Filtered]'
      }
    }
  }

  // Scrub password/token fields from request body
  if (event.request?.data && typeof event.request.data === 'object') {
    const data = event.request.data as Record<string, unknown>
    for (const key of Object.keys(data)) {
      const lk = key.toLowerCase()
      if (lk.includes('password') || lk.includes('secret') || lk.includes('token')) {
        data[key] = '[Filtered]'
      }
    }
  }

  return event
}

// ── Before Send Transaction Filter ─────────────────────────────

function beforeSendTransaction(event: SentryEvent): SentryEvent | null {
  const name = event.transaction ?? ''
  // Drop health check & static asset transactions
  if (name.includes('/health') || name.includes('/_next/') || name.includes('/favicon')) {
    return null
  }
  return event
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Initialize Sentry client-side SDK.
 * Safe to call multiple times — only initializes once.
 * Gracefully degrades if @sentry/nextjs is not installed.
 */
export async function initSentry(): Promise<boolean> {
  if (_initialized) return true

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn || dsn.trim() === '' || dsn.includes('examplePublicKey')) {
    if (process.env.NODE_ENV === 'development') {
      console.info('[Sentry] DSN not configured — error tracking disabled (dev mode).')
    }
    return false
  }

  try {
    const Sentry = await import('@sentry/nextjs')
    _Sentry = Sentry

    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || 'development',
      release: `omniflow-web@${process.env.NEXT_PUBLIC_APP_VERSION || '0.5.0'}`,

      // Performance
      tracesSampleRate: 0.2, // 20% of page loads traced
      profilesSampleRate: 0.1, // 10% of traces profiled

      // Session Replay
      replaysSessionSampleRate: 0.1, // 10% of sessions recorded
      replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors recorded

      // Filtering
      beforeSend: beforeSend as Parameters<typeof Sentry.init>[0] extends { beforeSend?: infer B } ? B : never,
      beforeSendTransaction: beforeSendTransaction as Parameters<typeof Sentry.init>[0] extends { beforeSendTransaction?: infer B } ? B : never,

      // Privacy (RGPD)
      sendDefaultPii: false,

      // Distributed tracing — connect frontend spans to backend spans
      tracePropagationTargets: [
        'localhost',
        /^https:\/\/api\.omniflow\.app/,
      ],

      // Integrations
      integrations: [
        Sentry.replayIntegration({
          // Mask all text content and block media for privacy
          maskAllText: false, // We want to see UI state for debugging
          blockAllMedia: false,
          // Mask sensitive inputs
          maskAllInputs: true,
        }),
        Sentry.browserTracingIntegration(),
      ],

      // Limits
      maxBreadcrumbs: 50,

      // Ignore specific URLs
      denyUrls: [
        // Browser extensions
        /extensions\//i,
        /^chrome:\/\//i,
        /^chrome-extension:\/\//i,
        /^moz-extension:\/\//i,
        // Analytics & third party
        /plausible\.io/i,
        /googletagmanager\.com/i,
      ],
    })

    _initialized = true
    if (process.env.NODE_ENV === 'development') {
      console.info('[Sentry] Initialized — env=%s, release=omniflow-web@%s',
        process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
        process.env.NEXT_PUBLIC_APP_VERSION,
      )
    }
    return true
  } catch (err) {
    console.warn('[Sentry] Failed to initialize:', err)
    return false
  }
}

/**
 * Capture an exception to Sentry.
 * No-op if Sentry is not initialized.
 */
export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (!_initialized || !_Sentry) return
  _Sentry.captureException(error, context ? { extra: context } : undefined)
}

/**
 * Set the current user for Sentry context.
 * Hashes email for RGPD compliance.
 */
export function setUser(userId: string, email?: string): void {
  if (!_initialized || !_Sentry) return

  const userData: Record<string, string> = { id: userId }
  if (email) {
    // Hash email — don't send raw PII to Sentry
    // Using a simple hash since crypto.subtle is async
    let hash = 0
    for (let i = 0; i < email.length; i++) {
      const char = email.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash |= 0 // Convert to 32bit integer
    }
    userData.email_hash = Math.abs(hash).toString(16).padStart(8, '0')
  }

  _Sentry.setUser(userData)
}

/**
 * Clear user context (on logout).
 */
export function clearUser(): void {
  if (!_initialized || !_Sentry) return
  _Sentry.setUser(null)
}

/**
 * Check if Sentry is initialized.
 */
export function isInitialized(): boolean {
  return _initialized
}

// ── Export for testing ─────────────────────────────────────────
export { beforeSend as _beforeSend, beforeSendTransaction as _beforeSendTransaction }
export { SUPPRESSED_ERRORS as _SUPPRESSED_ERRORS }
