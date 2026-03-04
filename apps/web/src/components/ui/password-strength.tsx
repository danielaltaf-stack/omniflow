'use client'

import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface PasswordStrengthProps {
  password: string
}

function calculateStrength(password: string): number {
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;'/`~]/.test(password)) score++
  return score
}

const levels = [
  { label: 'Faible', color: 'bg-loss' },
  { label: 'Moyen', color: 'bg-warning' },
  { label: 'Bon', color: 'bg-info' },
  { label: 'Fort', color: 'bg-gain' },
]

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const strength = calculateStrength(password)
  if (!password) return null

  const level = levels[strength - 1] ?? levels[0]!

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full',
              i <= strength ? level.color : 'bg-surface'
            )}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: i <= strength ? 1 : 0.5 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25, delay: i * 0.05 }}
            style={{ transformOrigin: 'left' }}
          />
        ))}
      </div>
      <p className={cn('text-xs', strength <= 1 ? 'text-loss' : strength <= 2 ? 'text-warning' : 'text-gain')}>
        {level.label}
      </p>
    </div>
  )
}
