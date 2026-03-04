'use client'

/**
 * OmniFlow — TradingView Chart (lightweight-charts v4)
 * Full candlestick charting with SMA/EMA/Bollinger overlay + RSI/MACD panes.
 * Integrates real-time WebSocket ticks to update the current candle live.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type HistogramData,
  ColorType,
  CrosshairMode,
  LineStyle,
  type DeepPartial,
  type ChartOptions,
} from 'lightweight-charts'
import { useThrottledMarket } from '@/lib/use-throttled-market'
import { type TickData } from '@/lib/useMarketWebSocket'
import { apiClient } from '@/lib/api-client'
import {
  calcSMA, calcEMA, calcBollinger, calcRSI, calcMACD, calcVolume,
  type Candle, type BollingerPoint, type MACDPoint,
} from '@/lib/technical-indicators'
import { useWorkerIndicators } from '@/lib/use-worker-indicators'
import {
  BarChart3, TrendingUp, Activity, Layers, CandlestickChart,
  Minus, LineChart as LineChartIcon, AreaChart as AreaIcon,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────

interface OHLCVResponse {
  symbol: string
  interval: string
  candles: Candle[]
  currency: string
  exchange?: string
  name?: string
}

type ChartType = 'candlestick' | 'line' | 'area'

interface IndicatorState {
  sma20: boolean
  sma50: boolean
  sma200: boolean
  ema12: boolean
  ema26: boolean
  bollinger: boolean
  rsi: boolean
  macd: boolean
  volume: boolean
}

const INTERVALS = [
  { label: '1min', value: '1m', range: '1d' },
  { label: '5min', value: '5m', range: '5d' },
  { label: '15min', value: '15m', range: '5d' },
  { label: '1H', value: '1h', range: '1mo' },
  { label: '4H', value: '4h', range: '6mo' },
  { label: '1D', value: '1d', range: '5y' },
  { label: '1W', value: '1wk', range: 'max' },
  { label: '1M', value: '1mo', range: 'max' },
] as const

const INDICATOR_COLORS = {
  sma20: '#3B82F6',   // blue
  sma50: '#F59E0B',   // amber
  sma200: '#EF4444',  // red
  ema12: '#8B5CF6',   // violet
  ema26: '#EC4899',   // pink
  bollUpper: 'rgba(99,102,241,0.6)',
  bollLower: 'rgba(99,102,241,0.6)',
  rsi: '#8B5CF6',
  macdLine: '#3B82F6',
  macdSignal: '#F59E0B',
} as const

// ── Component ────────────────────────────────────────────

export default function TradingChart({
  symbol,
  symbolName,
  ohlcvUrlPrefix,
}: {
  symbol: string
  symbolName?: string
  ohlcvUrlPrefix?: string
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const mainSeriesRef = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | ISeriesApi<'Area'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const indicatorSeriesRefs = useRef<Map<string, ISeriesApi<any>>>(new Map())
  const candlesRef = useRef<Candle[]>([])

  const [activeInterval, setActiveInterval] = useState<typeof INTERVALS[number]>(INTERVALS[5]) // default 1D
  const [chartType, setChartType] = useState<ChartType>('candlestick')
  const [isLoading, setIsLoading] = useState(false)
  const [indicators, setIndicators] = useState<IndicatorState>({
    sma20: false, sma50: true, sma200: false,
    ema12: false, ema26: false,
    bollinger: false,
    rsi: false, macd: false, volume: true,
  })
  const [crosshairData, setCrosshairData] = useState<{
    time?: string | number; open?: number; high?: number; low?: number; close?: number; volume?: number
  } | null>(null)

  // WebSocket for live ticks
  const isCrypto = ohlcvUrlPrefix?.includes('crypto')
  const wsChannels = useMemo(
    () => [isCrypto ? `crypto:${symbol}` : symbol.startsWith('^') ? `index:${symbol}` : `stock:${symbol}`],
    [symbol, isCrypto]
  )
  const { prices: livePrices, isConnected } = useThrottledMarket(wsChannels)

  // ── Fetch OHLCV data ───────────────────────────────────
  const fetchCandles = useCallback(async () => {
    setIsLoading(true)
    try {
      const baseUrl = ohlcvUrlPrefix || '/api/v1/market/stocks/ohlcv'
      // Crypto uses ?interval=1d&limit=365, stocks use ?interval=1d&range=5y
      // Binance intervals: 1m,5m,15m,1h,4h,1d,1w,1M  (no 1wk/1mo)
      const cryptoIv = activeInterval.value === '1wk' ? '1w' : activeInterval.value === '1mo' ? '1M' : activeInterval.value
      const qp = isCrypto
        ? `interval=${cryptoIv}&limit=${['1m','5m','15m'].includes(cryptoIv) ? 500 : 365}`
        : `interval=${activeInterval.value}&range=${activeInterval.range}`
      const data = await apiClient.get<OHLCVResponse>(
        `${baseUrl}/${encodeURIComponent(symbol)}?${qp}`
      )
      candlesRef.current = data.candles || []
      return data.candles || []
    } catch (e) {
      console.error('Failed to fetch OHLCV:', e)
      return []
    } finally {
      setIsLoading(false)
    }
  }, [symbol, activeInterval, ohlcvUrlPrefix, isCrypto])

  // ── Create / update chart ──────────────────────────────
  useEffect(() => {
    if (!chartContainerRef.current) return

    // Cleanup previous chart
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
      mainSeriesRef.current = null
      volumeSeriesRef.current = null
      indicatorSeriesRefs.current.clear()
    }

    const container = chartContainerRef.current
    const chartOptions: DeepPartial<ChartOptions> = {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(156,163,175,0.9)',
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(75,85,99,0.15)' },
        horzLines: { color: 'rgba(75,85,99,0.15)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(99,102,241,0.4)', width: 1, style: LineStyle.Dashed },
        horzLine: { color: 'rgba(99,102,241,0.4)', width: 1, style: LineStyle.Dashed },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: indicators.volume ? 0.25 : 0.05 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: activeInterval.value.includes('m') || activeInterval.value === '1h' || activeInterval.value === '4h',
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
      width: container.clientWidth,
      height: container.clientHeight || 500,
    }

    const chart = createChart(container, chartOptions)
    chartRef.current = chart

    // Crosshair subscriber
    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time) {
        setCrosshairData(null)
        return
      }
      const mainSeries = mainSeriesRef.current
      if (mainSeries) {
        const data = param.seriesData.get(mainSeries) as any
        if (data) {
          setCrosshairData({
            time: param.time as string | number | undefined,
            open: data.open ?? data.value,
            high: data.high,
            low: data.low,
            close: data.close ?? data.value,
            volume: undefined, // will add from volume series if needed
          })
        }
      }
    })

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (chartRef.current && container) {
        chartRef.current.applyOptions({ width: container.clientWidth, height: container.clientHeight || 500 })
      }
    })
    ro.observe(container)

    // Fetch and render
    fetchCandles().then((candles) => {
      if (!chartRef.current || candles.length === 0) return
      renderChart(chart, candles)
    })

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, activeInterval, chartType])

  // ── Recalculate indicators when toggles change ─────────
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || candlesRef.current.length === 0) return
    updateIndicators(chart, candlesRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators])

  // ── Live tick updates ──────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current
    const series = mainSeriesRef.current
    if (!chart || !series || candlesRef.current.length === 0) return

    const channel = symbol.startsWith('^') ? `index:${symbol}` : `stock:${symbol}`
    const tick = livePrices.get(channel)
    if (!tick) return

    const lastCandle = candlesRef.current[candlesRef.current.length - 1]
    if (!lastCandle) return

    const updatedCandle: CandlestickData = {
      time: lastCandle.time as any,
      open: lastCandle.open,
      high: Math.max(lastCandle.high, tick.price),
      low: Math.min(lastCandle.low, tick.price),
      close: tick.price,
    }

    try {
      if (chartType === 'candlestick') {
        (series as ISeriesApi<'Candlestick'>).update(updatedCandle)
      } else {
        (series as ISeriesApi<'Line'>).update({ time: lastCandle.time as any, value: tick.price })
      }
    } catch {
      // Ignore update errors
    }
  }, [livePrices, symbol, chartType])

  // ── Render chart data ──────────────────────────────────
  function renderChart(chart: IChartApi, candles: Candle[]) {
    // Clear existing series
    indicatorSeriesRefs.current.forEach((s) => { try { chart.removeSeries(s) } catch {} })
    indicatorSeriesRefs.current.clear()
    if (volumeSeriesRef.current) { try { chart.removeSeries(volumeSeriesRef.current) } catch {} }
    if (mainSeriesRef.current) { try { chart.removeSeries(mainSeriesRef.current) } catch {} }

    // Main series
    if (chartType === 'candlestick') {
      const series = chart.addCandlestickSeries({
        upColor: '#22C55E', downColor: '#EF4444',
        borderUpColor: '#22C55E', borderDownColor: '#EF4444',
        wickUpColor: '#22C55E', wickDownColor: '#EF4444',
      })
      series.setData(candles.map(c => ({
        time: c.time as any,
        open: c.open, high: c.high, low: c.low, close: c.close,
      })))
      mainSeriesRef.current = series
    } else if (chartType === 'line') {
      const series = chart.addLineSeries({
        color: '#6366F1', lineWidth: 2,
      })
      series.setData(candles.map(c => ({ time: c.time as any, value: c.close })))
      mainSeriesRef.current = series
    } else {
      const series = chart.addAreaSeries({
        topColor: 'rgba(99,102,241,0.3)',
        bottomColor: 'rgba(99,102,241,0.02)',
        lineColor: '#6366F1',
        lineWidth: 2,
      })
      series.setData(candles.map(c => ({ time: c.time as any, value: c.close })))
      mainSeriesRef.current = series
    }

    updateIndicators(chart, candles)
    chart.timeScale().fitContent()
  }

  // ── Indicators rendering ───────────────────────────────
  function updateIndicators(chart: IChartApi, candles: Candle[]) {
    // Remove old indicator series
    indicatorSeriesRefs.current.forEach((s) => { try { chart.removeSeries(s) } catch {} })
    indicatorSeriesRefs.current.clear()
    if (volumeSeriesRef.current) { try { chart.removeSeries(volumeSeriesRef.current) } catch {} }
    volumeSeriesRef.current = null

    // Adjust price scale margins based on whether volume is shown
    chart.applyOptions({
      rightPriceScale: {
        scaleMargins: { top: 0.1, bottom: indicators.volume ? 0.25 : 0.05 },
      },
    })

    // SMA overlays
    const smaConfigs: [keyof IndicatorState, number, string][] = [
      ['sma20', 20, INDICATOR_COLORS.sma20],
      ['sma50', 50, INDICATOR_COLORS.sma50],
      ['sma200', 200, INDICATOR_COLORS.sma200],
    ]
    for (const [key, period, color] of smaConfigs) {
      if (!indicators[key]) continue
      const data = calcSMA(candles, period)
      if (data.length === 0) continue
      const series = chart.addLineSeries({
        color, lineWidth: 1,
        priceScaleId: 'right',
        lastValueVisible: false,
        priceLineVisible: false,
      })
      series.setData(data.map(d => ({ time: d.time as any, value: d.value })))
      indicatorSeriesRefs.current.set(key, series)
    }

    // EMA overlays
    const emaConfigs: [keyof IndicatorState, number, string][] = [
      ['ema12', 12, INDICATOR_COLORS.ema12],
      ['ema26', 26, INDICATOR_COLORS.ema26],
    ]
    for (const [key, period, color] of emaConfigs) {
      if (!indicators[key]) continue
      const data = calcEMA(candles, period)
      if (data.length === 0) continue
      const series = chart.addLineSeries({
        color, lineWidth: 1, lineStyle: LineStyle.Dashed,
        priceScaleId: 'right',
        lastValueVisible: false,
        priceLineVisible: false,
      })
      series.setData(data.map(d => ({ time: d.time as any, value: d.value })))
      indicatorSeriesRefs.current.set(key, series)
    }

    // Bollinger Bands
    if (indicators.bollinger) {
      const boll = calcBollinger(candles, 20, 2)
      if (boll.length > 0) {
        const upperSeries = chart.addLineSeries({
          color: INDICATOR_COLORS.bollUpper, lineWidth: 1, lineStyle: LineStyle.Dotted,
          priceScaleId: 'right', lastValueVisible: false, priceLineVisible: false,
        })
        upperSeries.setData(boll.map(b => ({ time: b.time as any, value: b.upper })))
        indicatorSeriesRefs.current.set('bollUpper', upperSeries)

        const lowerSeries = chart.addLineSeries({
          color: INDICATOR_COLORS.bollLower, lineWidth: 1, lineStyle: LineStyle.Dotted,
          priceScaleId: 'right', lastValueVisible: false, priceLineVisible: false,
        })
        lowerSeries.setData(boll.map(b => ({ time: b.time as any, value: b.lower })))
        indicatorSeriesRefs.current.set('bollLower', lowerSeries)
      }
    }

    // Volume
    if (indicators.volume) {
      const volData = calcVolume(candles)
      const volSeries = chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: 'vol',
      })
      chart.priceScale('vol').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      })
      volSeries.setData(volData.map(v => ({ time: v.time as any, value: v.value, color: v.color })))
      volumeSeriesRef.current = volSeries
    }
  }

  // ── Toggle helpers ─────────────────────────────────────
  const toggleIndicator = (key: keyof IndicatorState) => {
    setIndicators(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // ── Crosshair price display ────────────────────────────
  const lastCandle = candlesRef.current.length > 0 ? candlesRef.current[candlesRef.current.length - 1] : null
  const displayData = crosshairData || (lastCandle ? {
    open: lastCandle.open, high: lastCandle.high, low: lastCandle.low, close: lastCandle.close
  } : null)

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        {/* Left: Symbol info + OHLCV */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{symbolName || symbol}</span>
            <span className="text-xs text-foreground-tertiary">{symbol}</span>
            {isConnected && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium border border-gain/30 bg-gain/10 text-gain">
                <span className="w-1 h-1 rounded-full bg-gain animate-pulse" />
                LIVE
              </span>
            )}
          </div>
          {displayData && (
            <div className="flex items-center gap-2 text-[11px] tabular-nums">
              <span className="text-foreground-tertiary">O <span className="text-foreground">{displayData.open?.toFixed(2)}</span></span>
              <span className="text-foreground-tertiary">H <span className="text-gain">{displayData.high?.toFixed(2)}</span></span>
              <span className="text-foreground-tertiary">L <span className="text-loss">{displayData.low?.toFixed(2)}</span></span>
              <span className="text-foreground-tertiary">C <span className="text-foreground font-medium">{displayData.close?.toFixed(2)}</span></span>
            </div>
          )}
        </div>

        {/* Right: Loading indicator */}
        {isLoading && (
          <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border/30 overflow-x-auto scrollbar-none">
        {/* Interval buttons */}
        <div className="flex items-center gap-0.5 mr-2">
          {INTERVALS.map((intv) => (
            <button
              key={intv.value}
              onClick={() => setActiveInterval(intv)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                activeInterval.value === intv.value
                  ? 'bg-brand/15 text-brand'
                  : 'text-foreground-tertiary hover:text-foreground-secondary hover:bg-surface-elevated/50'
              }`}
            >
              {intv.label}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-border/50 mx-1" />

        {/* Chart type buttons */}
        <div className="flex items-center gap-0.5 mr-2">
          {([
            { type: 'candlestick' as ChartType, icon: CandlestickChart, label: 'Bougies' },
            { type: 'line' as ChartType, icon: LineChartIcon, label: 'Ligne' },
            { type: 'area' as ChartType, icon: AreaIcon, label: 'Surface' },
          ]).map(({ type, icon: Icon, label }) => (
            <button
              key={type}
              onClick={() => setChartType(type)}
              title={label}
              className={`p-1.5 rounded transition-colors ${
                chartType === type
                  ? 'bg-brand/15 text-brand'
                  : 'text-foreground-tertiary hover:text-foreground-secondary'
              }`}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-border/50 mx-1" />

        {/* Indicator toggles */}
        <div className="flex items-center gap-0.5 flex-wrap">
          {([
            { key: 'sma20' as keyof IndicatorState, label: 'SMA20', color: INDICATOR_COLORS.sma20 },
            { key: 'sma50' as keyof IndicatorState, label: 'SMA50', color: INDICATOR_COLORS.sma50 },
            { key: 'sma200' as keyof IndicatorState, label: 'SMA200', color: INDICATOR_COLORS.sma200 },
            { key: 'ema12' as keyof IndicatorState, label: 'EMA12', color: INDICATOR_COLORS.ema12 },
            { key: 'ema26' as keyof IndicatorState, label: 'EMA26', color: INDICATOR_COLORS.ema26 },
            { key: 'bollinger' as keyof IndicatorState, label: 'BB', color: INDICATOR_COLORS.bollUpper },
            { key: 'volume' as keyof IndicatorState, label: 'Vol', color: 'rgba(156,163,175,0.6)' },
          ]).map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => toggleIndicator(key)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors border ${
                indicators[key]
                  ? 'border-current bg-current/10'
                  : 'border-border/50 text-foreground-tertiary hover:text-foreground-secondary'
              }`}
              style={indicators[key] ? { color, borderColor: color } : undefined}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div ref={chartContainerRef} className="flex-1 min-h-[350px]" />

      {/* RSI / MACD panes (below chart, rendered as separate lightweight-charts) */}
      {indicators.rsi && <RSIPane candles={candlesRef.current} />}
      {indicators.macd && <MACDPane candles={candlesRef.current} />}
    </div>
  )
}

// ── RSI Pane ──────────────────────────────────────────────

function RSIPane({ candles }: { candles: Candle[] }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return

    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: 'rgba(156,163,175,0.7)', fontSize: 10 },
      grid: { vertLines: { color: 'rgba(75,85,99,0.1)' }, horzLines: { color: 'rgba(75,85,99,0.1)' } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.05, bottom: 0.05 } },
      timeScale: { visible: false },
      width: containerRef.current.clientWidth,
      height: 80,
      handleScroll: false,
      handleScale: false,
    })

    const rsiData = calcRSI(candles, 14)

    const rsiSeries = chart.addLineSeries({
      color: INDICATOR_COLORS.rsi, lineWidth: 2 as const,
      priceLineVisible: false, lastValueVisible: true,
    })
    rsiSeries.setData(rsiData.map(d => ({ time: d.time as any, value: d.value })))

    // Overbought / oversold lines
    if (rsiData.length > 1) {
      const lineData70 = [
        { time: rsiData[0]!.time as any, value: 70 },
        { time: rsiData[rsiData.length - 1]!.time as any, value: 70 },
      ]
      const lineData30 = [
        { time: rsiData[0]!.time as any, value: 30 },
        { time: rsiData[rsiData.length - 1]!.time as any, value: 30 },
      ]

      const line70 = chart.addLineSeries({
        color: 'rgba(239,68,68,0.3)', lineWidth: 1, lineStyle: LineStyle.Dashed,
        priceLineVisible: false, lastValueVisible: false,
      })
      line70.setData(lineData70)

      const line30 = chart.addLineSeries({
        color: 'rgba(34,197,94,0.3)', lineWidth: 1, lineStyle: LineStyle.Dashed,
        priceLineVisible: false, lastValueVisible: false,
      })
      line30.setData(lineData30)
    }

    chart.timeScale().fitContent()

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth })
    })
    ro.observe(containerRef.current)

    return () => { ro.disconnect(); chart.remove() }
  }, [candles])

  return (
    <div className="border-t border-border/30">
      <div className="flex items-center gap-1 px-3 py-0.5">
        <Activity size={10} className="text-foreground-tertiary" />
        <span className="text-[10px] text-foreground-tertiary font-medium">RSI (14)</span>
      </div>
      <div ref={containerRef} className="h-[80px]" />
    </div>
  )
}

// ── MACD Pane ─────────────────────────────────────────────

function MACDPane({ candles }: { candles: Candle[] }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return

    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: 'rgba(156,163,175,0.7)', fontSize: 10 },
      grid: { vertLines: { color: 'rgba(75,85,99,0.1)' }, horzLines: { color: 'rgba(75,85,99,0.1)' } },
      rightPriceScale: { borderVisible: false },
      timeScale: { visible: false },
      width: containerRef.current.clientWidth,
      height: 80,
      handleScroll: false,
      handleScale: false,
    })

    const macdData = calcMACD(candles, 12, 26, 9)
    if (macdData.length === 0) { chart.remove(); return }

    // MACD line
    const macdLine = chart.addLineSeries({
      color: INDICATOR_COLORS.macdLine, lineWidth: 2 as const,
      priceLineVisible: false, lastValueVisible: false,
    })
    macdLine.setData(macdData.map(d => ({ time: d.time as any, value: d.macd })))

    // Signal line
    const signalLine = chart.addLineSeries({
      color: INDICATOR_COLORS.macdSignal, lineWidth: 2 as const,
      priceLineVisible: false, lastValueVisible: false,
    })
    signalLine.setData(macdData.map(d => ({ time: d.time as any, value: d.signal })))

    // Histogram
    const histogram = chart.addHistogramSeries({
      priceLineVisible: false, lastValueVisible: false,
    })
    histogram.setData(macdData.map(d => ({
      time: d.time as any,
      value: d.histogram,
      color: d.histogram >= 0 ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)',
    })))

    chart.timeScale().fitContent()

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth })
    })
    ro.observe(containerRef.current)

    return () => { ro.disconnect(); chart.remove() }
  }, [candles])

  return (
    <div className="border-t border-border/30">
      <div className="flex items-center gap-1 px-3 py-0.5">
        <Layers size={10} className="text-foreground-tertiary" />
        <span className="text-[10px] text-foreground-tertiary font-medium">MACD (12, 26, 9)</span>
      </div>
      <div ref={containerRef} className="h-[80px]" />
    </div>
  )
}
