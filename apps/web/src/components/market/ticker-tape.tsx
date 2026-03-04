'use client'

/**
 * OmniFlow — Ticker Tape (scrolling price banner)
 * Smooth CSS animation, real-time WS updates, click to select symbol.
 */

import { useMemo } from 'react'
import { useThrottledMarket } from '@/lib/use-throttled-market'
import { type TickData } from '@/lib/useMarketWebSocket'

const TICKER_SYMBOLS = [
  { symbol: '^GSPC', label: 'S&P 500', prefix: 'index' },
  { symbol: '^FCHI', label: 'CAC 40', prefix: 'index' },
  { symbol: '^GDAXI', label: 'DAX', prefix: 'index' },
  { symbol: '^FTSE', label: 'FTSE', prefix: 'index' },
  { symbol: '^IXIC', label: 'Nasdaq', prefix: 'index' },
  { symbol: 'AAPL', label: 'AAPL', prefix: 'stock' },
  { symbol: 'MSFT', label: 'MSFT', prefix: 'stock' },
  { symbol: 'GOOGL', label: 'GOOGL', prefix: 'stock' },
  { symbol: 'AMZN', label: 'AMZN', prefix: 'stock' },
  { symbol: 'NVDA', label: 'NVDA', prefix: 'stock' },
  { symbol: 'TSLA', label: 'TSLA', prefix: 'stock' },
  { symbol: 'META', label: 'META', prefix: 'stock' },
  { symbol: 'MC.PA', label: 'LVMH', prefix: 'stock' },
  { symbol: 'OR.PA', label: "L'Oréal", prefix: 'stock' },
  { symbol: 'BNP.PA', label: 'BNP', prefix: 'stock' },
  { symbol: 'TTE.PA', label: 'Total', prefix: 'stock' },
]

function fmtPrice(v: number | undefined): string {
  if (v == null) return '—'
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPct(v: number | undefined): string {
  if (v == null) return ''
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`
}

export default function TickerTape({
  onSelectSymbol,
}: {
  onSelectSymbol?: (symbol: string) => void
}) {
  const channels = useMemo(
    () => TICKER_SYMBOLS.map((t) => `${t.prefix}:${t.symbol}`),
    [],
  )

  const { prices } = useThrottledMarket(channels)

  const items = TICKER_SYMBOLS.map((t) => {
    const tick = prices.get(`${t.prefix}:${t.symbol}`)
    return { ...t, price: tick?.price, change: tick?.change_pct_24h }
  })

  // Duplicate items for infinite scroll illusion
  const allItems = [...items, ...items]

  return (
    <div className="relative overflow-hidden bg-surface-elevated/60 border-b border-border/30 h-9 hidden md:block">
      <style jsx>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-track {
          animation: ticker-scroll 60s linear infinite;
          will-change: transform;
        }
        .ticker-track:hover {
          animation-play-state: paused;
        }
      `}</style>

      <div className="ticker-track flex items-center h-full whitespace-nowrap">
        {allItems.map((item, i) => {
          const isUp = (item.change ?? 0) >= 0
          return (
            <button
              key={`${item.symbol}-${i}`}
              onClick={() => onSelectSymbol?.(item.symbol)}
              className="inline-flex items-center gap-1.5 px-3 h-full text-[11px] hover:bg-surface-elevated transition-colors shrink-0"
            >
              <span className="font-medium text-foreground-secondary">{item.label}</span>
              <span className="tabular-nums text-foreground">{fmtPrice(item.price)}</span>
              {item.change != null && (
                <span className={`tabular-nums font-medium ${isUp ? 'text-gain' : 'text-loss'}`}>
                  {fmtPct(item.change)}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
