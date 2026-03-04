'use client'

import { useRef, useCallback, useEffect, useState } from 'react'
import type { Candle, IndicatorPoint, BollingerPoint, MACDPoint } from './technical-indicators'

/**
 * OmniFlow F1.6 — Web Worker Bridge for Technical Indicators
 *
 * Offloads all indicator computation to a dedicated Web Worker.
 * The main thread sends candle data, receives results asynchronously.
 * Worker is lazily initialized on first call and terminated on unmount.
 */

interface WorkerResponse {
  id: number
  type: string
  result?: any
  error?: string
}

interface BatchResult {
  sma20?: IndicatorPoint[]
  sma50?: IndicatorPoint[]
  sma200?: IndicatorPoint[]
  ema12?: IndicatorPoint[]
  bollinger?: BollingerPoint[]
  rsi?: IndicatorPoint[]
  macd?: MACDPoint[]
  volume?: Array<{ time: string | number; value: number; color: string }>
}

/**
 * Hook that provides off-thread indicator calculations via Web Worker.
 *
 * @example
 * ```tsx
 * const { computeBatch, isComputing, results } = useWorkerIndicators()
 *
 * useEffect(() => {
 *   computeBatch(candles, { sma20: true, rsi: true, macd: true })
 * }, [candles])
 * ```
 */
export function useWorkerIndicators() {
  const workerRef = useRef<Worker | null>(null)
  const callbacksRef = useRef<Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>>(new Map())
  const idCounterRef = useRef(0)
  const mountedRef = useRef(true)
  const [isComputing, setIsComputing] = useState(false)
  const [batchResults, setBatchResults] = useState<BatchResult>({})

  // Lazy-init the worker
  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('./workers/indicators.worker.ts', import.meta.url),
      )
      workerRef.current.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const { id, result, error } = e.data
        const cb = callbacksRef.current.get(id)
        if (cb) {
          callbacksRef.current.delete(id)
          if (error) cb.reject(new Error(error))
          else cb.resolve(result)
        }
      }
      workerRef.current.onerror = (err) => {
        console.error('[IndicatorsWorker] Error:', err.message)
      }
    }
    return workerRef.current
  }, [])

  // Generic send to worker
  const sendToWorker = useCallback(<T = any>(
    type: string,
    candles: Candle[],
    params: Record<string, any>,
  ): Promise<T> => {
    const id = ++idCounterRef.current
    const worker = getWorker()

    return new Promise<T>((resolve, reject) => {
      callbacksRef.current.set(id, { resolve, reject })
      worker.postMessage({ id, type, candles, params })
    })
  }, [getWorker])

  // Individual indicator functions
  const computeSMA = useCallback((candles: Candle[], period: number) =>
    sendToWorker<IndicatorPoint[]>('sma', candles, { period }), [sendToWorker])

  const computeEMA = useCallback((candles: Candle[], period: number) =>
    sendToWorker<IndicatorPoint[]>('ema', candles, { period }), [sendToWorker])

  const computeBollinger = useCallback((candles: Candle[], period = 20, stdDev = 2) =>
    sendToWorker<BollingerPoint[]>('bollinger', candles, { period, stdDev }), [sendToWorker])

  const computeRSI = useCallback((candles: Candle[], period = 14) =>
    sendToWorker<IndicatorPoint[]>('rsi', candles, { period }), [sendToWorker])

  const computeMACD = useCallback((candles: Candle[], fast = 12, slow = 26, signal = 9) =>
    sendToWorker('macd', candles, { fast, slow, signal }), [sendToWorker])

  // Batch: compute all enabled indicators in one Worker call
  const computeBatch = useCallback(async (
    candles: Candle[],
    enabled: {
      sma20?: boolean; sma50?: boolean; sma200?: boolean;
      ema12?: boolean; bollinger?: boolean; rsi?: boolean;
      macd?: boolean; volume?: boolean
    },
  ): Promise<BatchResult> => {
    if (!candles || candles.length === 0) return {}
    setIsComputing(true)
    try {
      const result = await sendToWorker<BatchResult>('batch', candles, enabled)
      if (mountedRef.current) {
        setBatchResults(result)
      }
      return result
    } catch (err) {
      console.error('[IndicatorsWorker] Batch error:', err)
      return {}
    } finally {
      if (mountedRef.current) setIsComputing(false)
    }
  }, [sendToWorker])

  // Terminate worker on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
      callbacksRef.current.clear()
    }
  }, [])

  return {
    computeSMA,
    computeEMA,
    computeBollinger,
    computeRSI,
    computeMACD,
    computeBatch,
    isComputing,
    results: batchResults,
  }
}
