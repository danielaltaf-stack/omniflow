'use client'

import { motion } from 'framer-motion'
import { Flame, Leaf, Trophy, Star } from 'lucide-react'
import type { GreenDayStreak } from '@/types/api'

interface GreenDayTrackerProps {
  streak: GreenDayStreak
  daysInMonth: number
  greenDays: boolean[] // Array of booleans for each day of the month
}

/**
 * Gamified "Green Days" tracker — inspired by Apple Watch activity rings.
 * A day is "green" if the user made no non-essential spending.
 */
export function GreenDayTracker({ streak, daysInMonth, greenDays }: GreenDayTrackerProps) {
  const circumference = 2 * Math.PI * 42 // radius = 42
  const progress = (streak.pct / 100) * circumference
  const emoji = streak.pct >= 80 ? '🏆' : streak.pct >= 50 ? '🌿' : '🌱'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="rounded-omni-lg border border-border bg-surface/80 backdrop-blur-xl p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-omni-sm bg-gain/10">
          <Leaf className="w-4 h-4 text-gain" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Jours Verts</h3>
          <p className="text-xs text-foreground-secondary">Zéro dépense non-essentielle</p>
        </div>
      </div>

      <div className="flex items-center gap-5">
        {/* Activity Ring */}
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
            {/* Background ring */}
            <circle
              cx="48"
              cy="48"
              r="42"
              fill="none"
              stroke="var(--border)"
              strokeWidth="6"
              opacity={0.3}
            />
            {/* Progress ring */}
            <motion.circle
              cx="48"
              cy="48"
              r="42"
              fill="none"
              stroke="var(--gain)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: circumference - progress }}
              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg">{emoji}</span>
            <span className="text-sm font-bold text-foreground">{Math.round(streak.pct)}%</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-warning" />
              <span className="text-xs text-foreground-secondary">Série actuelle</span>
            </div>
            <span className="text-sm font-bold text-foreground">
              {streak.current_streak} jour{streak.current_streak > 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-brand" />
              <span className="text-xs text-foreground-secondary">Record</span>
            </div>
            <span className="text-sm font-bold text-foreground">
              {streak.best_streak} jour{streak.best_streak > 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-gain" />
              <span className="text-xs text-foreground-secondary">Ce mois</span>
            </div>
            <span className="text-sm font-bold text-foreground">
              {streak.total_green_days}/{streak.total_days_elapsed}
            </span>
          </div>
        </div>
      </div>

      {/* Day dots grid */}
      <div className="mt-4 flex flex-wrap gap-1">
        {greenDays.map((isGreen, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3 + i * 0.02 }}
            className={`w-3 h-3 rounded-full transition-colors ${
              i < streak.total_days_elapsed
                ? isGreen
                  ? 'bg-gain shadow-sm shadow-gain/30'
                  : 'bg-loss/60'
                : 'bg-border/40'
            }`}
            title={`Jour ${i + 1}${isGreen ? ' — Vert ✓' : ' — Dépense non-essentielle'}`}
          />
        ))}
      </div>
    </motion.div>
  )
}
