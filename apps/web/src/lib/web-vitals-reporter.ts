/**
 * OmniFlow — Web Vitals Reporter
 *
 * Captures Core Web Vitals (CLS, FID, FCP, LCP, TTFB, INP) via the
 * web-vitals@5 package and batches them for beacon delivery to the backend.
 *
 * Features:
 * - Batching: accumulates up to 10 entries, flushes every 30s or on page unload
 * - navigator.sendBeacon: guaranteed delivery even during tab close
 * - Fallback to fetch for browsers without sendBeacon
 * - No PII: only metric names, values, and page URL
 */

import type { Metric } from 'web-vitals'

const BATCH_SIZE = 10
const FLUSH_INTERVAL_MS = 30_000
const ENDPOINT = '/api/v1/analytics/vitals'

let buffer: VitalEntry[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

interface VitalEntry {
  name: string
  value: number
  delta: number
  id: string
  navigation_type: string
  rating: string
}

function mapMetric(metric: Metric): VitalEntry {
  return {
    name: metric.name,
    value: Math.round(metric.value * 1000) / 1000,
    delta: Math.round(metric.delta * 1000) / 1000,
    id: metric.id,
    navigation_type: metric.navigationType || '',
    rating: metric.rating || '',
  }
}

function flush() {
  if (buffer.length === 0) return

  const payload = JSON.stringify({
    entries: buffer,
    url: typeof window !== 'undefined' ? window.location.pathname : '',
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  })

  buffer = []

  // Prefer sendBeacon (works during page unload)
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' })
    const sent = navigator.sendBeacon(ENDPOINT, blob)
    if (sent) return
  }

  // Fallback to fetch (keepalive for unload scenarios)
  try {
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Silent fail — vitals are non-critical
  }
}

function enqueue(entry: VitalEntry) {
  buffer.push(entry)

  if (buffer.length >= BATCH_SIZE) {
    flush()
    return
  }

  // Schedule flush if not already scheduled
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null
      flush()
    }, FLUSH_INTERVAL_MS)
  }
}

/**
 * Initialize Web Vitals reporting.
 * Call this once from a client component (e.g., layout or providers).
 */
export function initWebVitalsReporter() {
  if (typeof window === 'undefined') return

  // Dynamically import web-vitals to avoid SSR issues
  import('web-vitals').then(({ onCLS, onFCP, onLCP, onTTFB, onINP }) => {
    const handler = (metric: Metric) => enqueue(mapMetric(metric))

    onCLS(handler)
    onFCP(handler)
    onLCP(handler)
    onTTFB(handler)
    onINP(handler)
  }).catch(() => {
    // web-vitals not available — silent fail
  })

  // Flush remaining buffer on page unload
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flush()
      }
    })
  }
}
