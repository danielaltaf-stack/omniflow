'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Shield,
  PiggyBank,
  TrendingUp,
  BarChart3,
  Repeat,
  CreditCard,
  ChevronRight,
  Info,
} from 'lucide-react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────

interface ScoreCriterion {
  key: string
  label: string
  icon: React.ElementType
  score: number
  maxScore: number
  description: string
  color: string
}

interface OmniScoreData {
  total: number           // 0-100
  criteria: ScoreCriterion[]
  history?: number[]      // last 6 months
  recommendations?: string[]
}

interface OmniScoreProps {
  data: OmniScoreData | null
  isLoading?: boolean
  /** Compact widget version for dashboard */
  variant?: 'full' | 'widget'
}

// ── Score color helpers ────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 75) return '#00D68F'
  if (score >= 50) return '#FECA57'
  if (score >= 25) return '#FF9F43'
  return '#FF4757'
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 65) return 'Bon'
  if (score >= 45) return 'Moyen'
  if (score >= 25) return 'Faible'
  return 'Critique'
}

// ── Circular Gauge (SVG) ───────────────────────────────────

function CircularGauge({
  score,
  size = 140,
  strokeWidth = 8,
  animated = true,
}: {
  score: number
  size?: number
  strokeWidth?: number
  animated?: boolean
}) {
  const [displayScore, setDisplayScore] = useState(0)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference
  const color = scoreColor(score)

  // CountUp
  useEffect(() => {
    if (!animated) {
      setDisplayScore(score)
      return
    }
    let current = 0
    const steps = 50
    const increment = score / steps
    const timer = setInterval(() => {
      current += increment
      if (current >= score) {
        setDisplayScore(score)
        clearInterval(timer)
      } else {
        setDisplayScore(Math.round(current))
      }
    }, 20)
    return () => clearInterval(timer)
  }, [score, animated])

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        {/* Score arc */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 }}
        />
      </svg>
      {/* Central score */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-foreground tabular-nums">
          {displayScore}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color }}>
          {scoreLabel(score)}
        </span>
      </div>
    </div>
  )
}

// ── Mini Gauge (for widget) ────────────────────────────────

export function MiniGauge({ score }: { score: number }) {
  return <CircularGauge score={score} size={56} strokeWidth={4} />
}

// ── Criterion Row ──────────────────────────────────────────

function CriterionBar({
  criterion,
  index,
}: {
  criterion: ScoreCriterion
  index: number
}) {
  const Icon = criterion.icon
  const pct = (criterion.score / criterion.maxScore) * 100

  return (
    <motion.div
      className="flex items-center gap-3"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5 + index * 0.08 }}
    >
      <div
        className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center"
        style={{ backgroundColor: `${criterion.color}15` }}
      >
        <Icon size={14} style={{ color: criterion.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-xs text-foreground-secondary truncate">
            {criterion.label}
          </span>
          <span className="text-xs font-medium text-foreground tabular-nums ml-2">
            {criterion.score}/{criterion.maxScore}
          </span>
        </div>
        <div className="h-1.5 bg-surface rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: criterion.color }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, delay: 0.6 + index * 0.08, ease: 'easeOut' }}
          />
        </div>
      </div>
    </motion.div>
  )
}

// ── Full OmniScore Card ────────────────────────────────────

export function OmniScore({ data, isLoading, variant = 'full' }: OmniScoreProps) {
  if (isLoading || !data) {
    return (
      <div className="bg-surface/80 backdrop-blur-xl border border-border rounded-omni p-5">
        <div className="flex items-center justify-center py-8">
          <div className="w-20 h-20 rounded-full skeleton-shimmer" />
        </div>
      </div>
    )
  }

  // ── Widget variant (mini) ──────────────────────────────
  if (variant === 'widget') {
    return (
      <Link href="/settings" className="block">
        <motion.div
          className="bg-surface/80 backdrop-blur-xl border border-border rounded-omni p-4 hover:border-brand/20 hover:shadow-lg hover:shadow-brand/5 transition-all cursor-pointer"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          whileHover={{ y: -2 }}
        >
          <div className="flex items-center gap-3">
            <MiniGauge score={data.total} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground-secondary">OmniScore</p>
              <p className="text-lg font-bold text-foreground">{data.total}/100</p>
              <p className="text-[10px] text-foreground-tertiary mt-0.5">
                {scoreLabel(data.total)} — Voir détails →
              </p>
            </div>
          </div>
        </motion.div>
      </Link>
    )
  }

  // ── Full variant ───────────────────────────────────────
  return (
    <motion.div
      className="bg-surface/80 backdrop-blur-xl border border-border rounded-omni p-5"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">
          OmniScore — Santé financière
        </h3>
        <div className="flex items-center gap-1 text-foreground-tertiary">
          <Info size={13} />
          <span className="text-[10px]">Mis à jour quotidiennement</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-5">
        {/* Gauge */}
        <CircularGauge score={data.total} />

        {/* Criteria */}
        <div className="flex-1 w-full space-y-2.5">
          {data.criteria.map((c, i) => (
            <CriterionBar key={c.key} criterion={c} index={i} />
          ))}
        </div>
      </div>

      {/* Recommendations */}
      {data.recommendations && data.recommendations.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border space-y-2">
          <p className="text-xs font-medium text-foreground-secondary">
            Recommandations
          </p>
          {data.recommendations.map((rec, i) => (
            <motion.div
              key={i}
              className="flex items-start gap-2 text-xs text-foreground-secondary"
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.2 + i * 0.1 }}
            >
              <ChevronRight size={12} className="text-brand mt-0.5 flex-shrink-0" />
              <span>{rec}</span>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

// ── Default criteria icons mapping ─────────────────────────

export const OMNISCORE_ICONS = {
  emergency_savings: PiggyBank,
  debt_ratio: Shield,
  diversification: BarChart3,
  savings_regularity: Repeat,
  networth_growth: TrendingUp,
  banking_fees: CreditCard,
}
