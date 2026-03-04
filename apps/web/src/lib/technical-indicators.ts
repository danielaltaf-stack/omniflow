/**
 * OmniFlow — Technical Indicators Engine (client-side)
 * Pure TypeScript calculations for SMA, EMA, Bollinger, RSI, MACD, Volume.
 * Used by the TradingChart component to render overlay & pane indicators.
 *
 * Note: Array bounds are validated before all indexed access.
 * eslint-disable @typescript-eslint/no-non-null-assertion
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */

export interface Candle {
  time: string | number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface IndicatorPoint {
  time: string | number
  value: number
}

// ── SMA (Simple Moving Average) ──────────────────────────────────────

export function calcSMA(candles: Candle[], period: number): IndicatorPoint[] {
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

// ── EMA (Exponential Moving Average) ─────────────────────────────────

export function calcEMA(candles: Candle[], period: number): IndicatorPoint[] {
  const result: IndicatorPoint[] = []
  if (candles.length < period) return result

  const k = 2 / (period + 1)

  // Seed with SMA of first `period` candles
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

// ── Bollinger Bands ──────────────────────────────────────────────────

export interface BollingerPoint {
  time: string | number
  upper: number
  middle: number
  lower: number
}

export function calcBollinger(candles: Candle[], period = 20, stdDev = 2): BollingerPoint[] {
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

// ── RSI (Relative Strength Index) ────────────────────────────────────

export function calcRSI(candles: Candle[], period = 14): IndicatorPoint[] {
  const result: IndicatorPoint[] = []
  if (candles.length < period + 1) return result

  let avgGain = 0
  let avgLoss = 0

  // First period: simple average
  for (let i = 1; i <= period; i++) {
    const change = candles[i]!.close - candles[i - 1]!.close
    if (change > 0) avgGain += change
    else avgLoss += Math.abs(change)
  }
  avgGain /= period
  avgLoss /= period

  const rsi0 = avgLoss === 0 ? 100 : round(100 - 100 / (1 + avgGain / avgLoss))
  result.push({ time: candles[period]!.time, value: rsi0 })

  // Smoothed (Wilder's method)
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

// ── MACD (Moving Average Convergence Divergence) ─────────────────────

export interface MACDPoint {
  time: string | number
  macd: number
  signal: number
  histogram: number
}

export function calcMACD(
  candles: Candle[],
  fast = 12,
  slow = 26,
  signal = 9,
): MACDPoint[] {
  const emaFast = calcEMA(candles, fast)
  const emaSlow = calcEMA(candles, slow)

  if (emaFast.length === 0 || emaSlow.length === 0) return []

  // Align: both start from the slow period
  const startIdx = slow - fast
  const macdLine: IndicatorPoint[] = []
  for (let i = 0; i < emaSlow.length; i++) {
    const fastVal = emaFast[i + startIdx]
    const slowVal = emaSlow[i]
    if (!fastVal || !slowVal) continue
    macdLine.push({
      time: slowVal.time,
      value: round(fastVal.value - slowVal.value),
    })
  }

  if (macdLine.length < signal) return []

  // Signal line = EMA of MACD line
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

// ── Volume with coloring ─────────────────────────────────────────────

export interface VolumePoint {
  time: string | number
  value: number
  color: string
}

export function calcVolume(candles: Candle[], upColor = 'rgba(34,197,94,0.5)', downColor = 'rgba(239,68,68,0.5)'): VolumePoint[] {
  return candles.map((c) => ({
    time: c.time,
    value: c.volume,
    color: c.close >= c.open ? upColor : downColor,
  }))
}

function round(v: number, decimals = 4): number {
  const f = 10 ** decimals
  return Math.round(v * f) / f
}
