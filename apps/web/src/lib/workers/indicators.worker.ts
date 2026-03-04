/**
 * OmniFlow F1.6 — Technical Indicators Web Worker
 *
 * Runs SMA, EMA, Bollinger, RSI, MACD, Volume calculations off the main thread.
 * Receives candle data via postMessage, returns computed indicator arrays.
 *
 * Protocol:
 *   Main → Worker:  { id, type, candles, params }
 *   Worker → Main:  { id, type, result } | { id, type, error }
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */

/* ── Types ─────────────────────────────────────── */

interface Candle {
  time: string | number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface IndicatorPoint {
  time: string | number
  value: number
}

interface BollingerPoint {
  time: string | number
  upper: number
  middle: number
  lower: number
}

interface MACDPoint {
  time: string | number
  macd: number
  signal: number
  histogram: number
}

interface VolumePoint {
  time: string | number
  value: number
  color: string
}

type WorkerRequest =
  | { id: number; type: 'sma'; candles: Candle[]; params: { period: number } }
  | { id: number; type: 'ema'; candles: Candle[]; params: { period: number } }
  | { id: number; type: 'bollinger'; candles: Candle[]; params: { period: number; stdDev: number } }
  | { id: number; type: 'rsi'; candles: Candle[]; params: { period: number } }
  | { id: number; type: 'macd'; candles: Candle[]; params: { fast: number; slow: number; signal: number } }
  | { id: number; type: 'volume'; candles: Candle[]; params: { upColor: string; downColor: string } }
  | { id: number; type: 'batch'; candles: Candle[]; params: { indicators: string[]; sma20: boolean; sma50: boolean; sma200: boolean; ema12: boolean; bollinger: boolean; rsi: boolean; macd: boolean; volume: boolean } }

/* ── Helper ────────────────────────────────────── */

function round(v: number, decimals = 4): number {
  const f = 10 ** decimals
  return Math.round(v * f) / f
}

/* ── Calculation Functions ─────────────────────── */

function calcSMA(candles: Candle[], period: number): IndicatorPoint[] {
  const result: IndicatorPoint[] = []
  if (candles.length < period) return result
  let sum = 0
  for (let i = 0; i < period; i++) sum += candles[i]!.close
  result.push({ time: candles[period - 1]!.time, value: round(sum / period) })
  for (let i = period; i < candles.length; i++) {
    sum += candles[i]!.close - candles[i - period]!.close
    result.push({ time: candles[i]!.time, value: round(sum / period) })
  }
  return result
}

function calcEMA(candles: Candle[], period: number): IndicatorPoint[] {
  const result: IndicatorPoint[] = []
  if (candles.length < period) return result
  const k = 2 / (period + 1)
  let sum = 0
  for (let i = 0; i < period; i++) sum += candles[i]!.close
  let ema = sum / period
  result.push({ time: candles[period - 1]!.time, value: round(ema) })
  for (let i = period; i < candles.length; i++) {
    ema = candles[i]!.close * k + ema * (1 - k)
    result.push({ time: candles[i]!.time, value: round(ema) })
  }
  return result
}

function calcBollinger(candles: Candle[], period = 20, stdDev = 2): BollingerPoint[] {
  const result: BollingerPoint[] = []
  if (candles.length < period) return result
  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += candles[j]!.close
    const sma = sum / period
    let sqSum = 0
    for (let j = i - period + 1; j <= i; j++) sqSum += (candles[j]!.close - sma) ** 2
    const std = Math.sqrt(sqSum / period)
    result.push({
      time: candles[i]!.time,
      upper: round(sma + stdDev * std),
      middle: round(sma),
      lower: round(sma - stdDev * std),
    })
  }
  return result
}

function calcRSI(candles: Candle[], period = 14): IndicatorPoint[] {
  const result: IndicatorPoint[] = []
  if (candles.length < period + 1) return result
  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const change = candles[i]!.close - candles[i - 1]!.close
    if (change > 0) avgGain += change
    else avgLoss += Math.abs(change)
  }
  avgGain /= period
  avgLoss /= period
  const rsi0 = avgLoss === 0 ? 100 : round(100 - 100 / (1 + avgGain / avgLoss))
  result.push({ time: candles[period]!.time, value: rsi0 })
  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i]!.close - candles[i - 1]!.close
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? Math.abs(change) : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    const rsi = avgLoss === 0 ? 100 : round(100 - 100 / (1 + avgGain / avgLoss))
    result.push({ time: candles[i]!.time, value: rsi })
  }
  return result
}

function calcMACD(candles: Candle[], fast = 12, slow = 26, signal = 9): MACDPoint[] {
  const emaFast = calcEMA(candles, fast)
  const emaSlow = calcEMA(candles, slow)
  if (emaFast.length === 0 || emaSlow.length === 0) return []
  const startIdx = slow - fast
  const macdLine: IndicatorPoint[] = []
  for (let i = 0; i < emaSlow.length; i++) {
    const fastVal = emaFast[i + startIdx]
    const slowVal = emaSlow[i]
    if (!fastVal || !slowVal) continue
    macdLine.push({ time: slowVal.time, value: round(fastVal.value - slowVal.value) })
  }
  if (macdLine.length < signal) return []
  const k = 2 / (signal + 1)
  let sigEma = 0
  for (let i = 0; i < signal; i++) sigEma += macdLine[i]!.value
  sigEma /= signal
  const result: MACDPoint[] = []
  result.push({
    time: macdLine[signal - 1]!.time,
    macd: macdLine[signal - 1]!.value,
    signal: round(sigEma),
    histogram: round(macdLine[signal - 1]!.value - sigEma),
  })
  for (let i = signal; i < macdLine.length; i++) {
    sigEma = macdLine[i]!.value * k + sigEma * (1 - k)
    result.push({
      time: macdLine[i]!.time,
      macd: macdLine[i]!.value,
      signal: round(sigEma),
      histogram: round(macdLine[i]!.value - sigEma),
    })
  }
  return result
}

function calcVolume(candles: Candle[], upColor = 'rgba(34,197,94,0.5)', downColor = 'rgba(239,68,68,0.5)'): VolumePoint[] {
  return candles.map(c => ({
    time: c.time,
    value: c.volume,
    color: c.close >= c.open ? upColor : downColor,
  }))
}

/* ── Batch calculation (all indicators at once) ── */

function calcBatch(candles: Candle[], params: any): Record<string, any> {
  const result: Record<string, any> = {}
  if (params.sma20) result.sma20 = calcSMA(candles, 20)
  if (params.sma50) result.sma50 = calcSMA(candles, 50)
  if (params.sma200) result.sma200 = calcSMA(candles, 200)
  if (params.ema12) result.ema12 = calcEMA(candles, 12)
  if (params.bollinger) result.bollinger = calcBollinger(candles, 20, 2)
  if (params.rsi) result.rsi = calcRSI(candles, 14)
  if (params.macd) result.macd = calcMACD(candles, 12, 26, 9)
  if (params.volume) result.volume = calcVolume(candles)
  return result
}

/* ── Message Handler ───────────────────────────── */

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, type, candles, params } = e.data

  try {
    let result: any

    switch (type) {
      case 'sma':
        result = calcSMA(candles, params.period)
        break
      case 'ema':
        result = calcEMA(candles, params.period)
        break
      case 'bollinger':
        result = calcBollinger(candles, params.period, params.stdDev)
        break
      case 'rsi':
        result = calcRSI(candles, params.period)
        break
      case 'macd':
        result = calcMACD(candles, params.fast, params.slow, params.signal)
        break
      case 'volume':
        result = calcVolume(candles, params.upColor, params.downColor)
        break
      case 'batch':
        result = calcBatch(candles, params)
        break
      default:
        self.postMessage({ id, type, error: `Unknown indicator type: ${type}` })
        return
    }

    self.postMessage({ id, type, result })
  } catch (err: any) {
    self.postMessage({ id, type, error: err?.message || 'Worker computation failed' })
  }
}
