'use client'

/**
 * OmniFlow — Crypto Fear & Greed Index (F1.3)
 * Semi-circular animated gauge + 30-day history sparkline.
 * Source: alternative.me API (free, no key required).
 */

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { apiClient } from '@/lib/api-client'

interface FearGreedData {
  value: number
  label: string
  timestamp: string
  history: { value: number; label: string; date: string }[]
}

const ZONES: { max: number; color: string; label: string }[] = [
  { max: 25, color: '#ef4444', label: 'Extreme Fear' },
  { max: 45, color: '#f97316', label: 'Fear' },
  { max: 55, color: '#a3a3a3', label: 'Neutral' },
  { max: 75, color: '#22c55e', label: 'Greed' },
  { max: 100, color: '#a855f7', label: 'Extreme Greed' },
]

function getZone(value: number) {
  return ZONES.find(z => value <= z.max) ?? ZONES[ZONES.length - 1]!
}

function getInsight(value: number): string {
  if (value <= 20) return 'Zone d\'accumulation historique — rendements moyens à 30j : +18%'
  if (value <= 35) return 'Sentiment négatif — les acheteurs contrariants entrent souvent ici'
  if (value <= 55) return 'Marché neutre — pas de signal directionnel fort'
  if (value <= 75) return 'Optimisme modéré — momentum haussier en cours'
  return 'Zone de prudence — corrections fréquentes à 14j'
}

export default function CryptoFearGreed({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<FearGreedData | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    apiClient.get<FearGreedData>('/api/v1/market/crypto/fear-greed')
      .then(setData)
      .catch(() => {})
  }, [])

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-[10px] text-foreground-tertiary">
        <span className="inline-block w-2 h-2 rounded-full bg-foreground-tertiary animate-pulse" />
        Fear & Greed…
      </div>
    )
  }

  const zone = getZone(data.value)
  // Gauge angle: 0 = -90deg (left), 100 = +90deg (right)
  const angle = -90 + (data.value / 100) * 180

  if (compact) {
    return (
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-omni-sm hover:bg-surface-elevated/50 transition-colors"
        title={`Fear & Greed: ${data.value} — ${zone?.label}`}
      >
        <div className="relative w-6 h-3 overflow-hidden">
          {/* Mini gauge arc */}
          <svg viewBox="0 0 40 20" className="w-full h-full">
            <path d="M 2 20 A 18 18 0 0 1 38 20" fill="none" stroke="#333" strokeWidth="3" />
            <path d="M 2 20 A 18 18 0 0 1 38 20" fill="none" stroke="url(#fng-grad)" strokeWidth="3"
              strokeDasharray={`${(data.value / 100) * 56.5} 56.5`} />
            <defs>
              <linearGradient id="fng-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="25%" stopColor="#f97316" />
                <stop offset="50%" stopColor="#a3a3a3" />
                <stop offset="75%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <span className="text-[10px] font-bold tabular-nums" style={{ color: zone?.color }}>
          {data.value}
        </span>
        <span className="text-[9px] text-foreground-tertiary hidden md:inline">{zone?.label}</span>
      </button>
    )
  }

  // Full gauge
  return (
    <div className="flex flex-col items-center p-3">
      {/* SVG Gauge */}
      <div className="relative w-[140px] h-[75px]">
        <svg viewBox="0 0 140 75" className="w-full h-full">
          {/* Background arc */}
          <path
            d="M 10 70 A 60 60 0 0 1 130 70"
            fill="none"
            stroke="#262626"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Colored segments */}
          {ZONES.map((z, i) => {
            const startPct = (i === 0 ? 0 : ZONES[i - 1]!.max) / 100
            const endPct = z.max / 100
            const arcLen = 188.5 // approx circumference of the semi-arc
            return (
              <path
                key={z.label}
                d="M 10 70 A 60 60 0 0 1 130 70"
                fill="none"
                stroke={z.color}
                strokeWidth="8"
                strokeLinecap="butt"
                strokeDasharray={`${(endPct - startPct) * arcLen} ${arcLen}`}
                strokeDashoffset={`${-startPct * arcLen}`}
                opacity={0.6}
              />
            )
          })}
          {/* Needle */}
          <motion.g
            initial={{ rotate: -90 }}
            animate={{ rotate: angle }}
            transition={{ type: 'spring', damping: 20, stiffness: 80 }}
            style={{ transformOrigin: '70px 70px' }}
          >
            <line x1="70" y1="70" x2="70" y2="18" stroke={zone?.color} strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="70" cy="70" r="4" fill={zone?.color} />
          </motion.g>
        </svg>
        {/* Value centered */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
          <div className="text-lg font-bold tabular-nums" style={{ color: zone?.color }}>
            {data.value}
          </div>
        </div>
      </div>

      {/* Label */}
      <div className="text-xs font-semibold mt-1" style={{ color: zone?.color }}>
        {zone?.label}
      </div>

      {/* Insight */}
      <p className="text-[9px] text-foreground-tertiary text-center mt-1 max-w-[200px] leading-tight">
        {getInsight(data.value)}
      </p>

      {/* 30-day sparkline */}
      {data.history.length > 1 && (
        <div className="mt-2 w-full">
          <svg viewBox={`0 0 ${data.history.length} 40`} className="w-full h-[24px]" preserveAspectRatio="none">
            <polyline
              fill="none"
              stroke={zone?.color}
              strokeWidth="1.5"
              points={data.history
                .map((h, i) => `${data.history.length - 1 - i},${40 - (h.value / 100) * 40}`)
                .join(' ')}
            />
          </svg>
          <div className="flex justify-between text-[8px] text-foreground-tertiary">
            <span>30j</span>
            <span>Aujourd'hui</span>
          </div>
        </div>
      )}
    </div>
  )
}
