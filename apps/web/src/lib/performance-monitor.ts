/**
 * OmniFlow F1.6 — Performance Monitoring Utilities
 *
 * Provides FPS counter, Web Vitals tracking, Long Task detection,
 * and render-time measurement helpers.
 *
 * Usage:
 *   import { startFPSMonitor, reportWebVitals, measureRenderTime } from '@/lib/performance-monitor'
 *
 *   // In dev mode layout:
 *   useEffect(() => { const stop = startFPSMonitor(setFps); return stop }, [])
 */

// ── FPS Counter ──────────────────────────────────────────

let fpsFrames = 0
let fpsLastTime = performance.now()

/**
 * Start a real-time FPS counter using RAF.
 * Returns a cleanup function.
 *
 * @param onUpdate - Called every second with the current FPS value
 */
export function startFPSMonitor(onUpdate: (fps: number) => void): () => void {
  let running = true
  fpsFrames = 0
  fpsLastTime = performance.now()

  function tick() {
    if (!running) return
    fpsFrames++
    const now = performance.now()
    if (now - fpsLastTime >= 1000) {
      onUpdate(fpsFrames)
      fpsFrames = 0
      fpsLastTime = now
    }
    requestAnimationFrame(tick)
  }

  requestAnimationFrame(tick)
  return () => { running = false }
}

// ── Web Vitals ───────────────────────────────────────────

interface Metric {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
}

/**
 * Report Core Web Vitals metrics (CLS, FID, LCP, INP, TTFB).
 * Lazy-loads the web-vitals library.
 *
 * @param onReport - Called for each metric
 */
export async function reportWebVitals(
  onReport: (metric: Metric) => void = (m) => {
    const label = `[WebVital] ${m.name}: ${m.value.toFixed(2)} (${m.rating})`
    if (m.rating === 'poor') console.warn(label)
    else console.log(label)
  },
) {
  try {
    const { onCLS, onLCP, onINP, onTTFB } = await import('web-vitals')
    onCLS((m) => onReport({ name: 'CLS', value: m.value, rating: m.rating }))
    onLCP((m) => onReport({ name: 'LCP', value: m.value, rating: m.rating }))
    onINP((m) => onReport({ name: 'INP', value: m.value, rating: m.rating }))
    onTTFB((m) => onReport({ name: 'TTFB', value: m.value, rating: m.rating }))
  } catch {
    // web-vitals not available
  }
}

// ── Long Task Observer ───────────────────────────────────

/**
 * Observe Long Tasks (tasks > 50ms that block the main thread).
 * Returns a cleanup function.
 */
export function observeLongTasks(
  onLongTask: (duration: number, startTime: number) => void = (d) => {
    console.warn(`[LongTask] ${d.toFixed(1)}ms blocked main thread`)
  },
): () => void {
  if (typeof PerformanceObserver === 'undefined') return () => {}

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        onLongTask(entry.duration, entry.startTime)
      }
    })
    observer.observe({ type: 'longtask', buffered: true })
    return () => observer.disconnect()
  } catch {
    return () => {}
  }
}

// ── Render Time Measurement ──────────────────────────────

/**
 * Measure the time a render or computation takes.
 *
 * @example
 * ```ts
 * const stop = measureRenderTime('ChartRender')
 * // ... expensive operation
 * stop() // logs: [Perf] ChartRender: 12.34ms
 * ```
 */
export function measureRenderTime(label: string): () => number {
  const start = performance.now()
  return () => {
    const elapsed = performance.now() - start
    if (process.env.NODE_ENV === 'development') {
      const emoji = elapsed > 16.67 ? '🔴' : elapsed > 8 ? '🟡' : '🟢'
      console.log(`${emoji} [Perf] ${label}: ${elapsed.toFixed(2)}ms`)
    }
    return elapsed
  }
}

// ── Component Re-render Tracker ──────────────────────────

const renderCounts = new Map<string, number>()

/**
 * Track component re-renders in dev mode.
 * Call at the top of a component.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   trackRender('MyComponent')
 *   ...
 * }
 * ```
 */
export function trackRender(componentName: string): void {
  if (process.env.NODE_ENV !== 'development') return
  const count = (renderCounts.get(componentName) ?? 0) + 1
  renderCounts.set(componentName, count)
  if (count % 10 === 0) {
    console.log(`[Render] ${componentName}: ${count} renders`)
  }
}
