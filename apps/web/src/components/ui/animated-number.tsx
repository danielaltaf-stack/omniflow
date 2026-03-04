'use client'

import { useEffect, useRef, useState } from 'react'
import { formatAmount } from '@/lib/format'

interface AnimatedNumberProps {
  value: number
  /** Format as currency (centimes → EUR) */
  asCurrency?: boolean
  currency?: string
  /** Duration in ms */
  duration?: number
  className?: string
}

/**
 * Smooth animated number transition.
 * Animates from previous value to new value.
 * No brutal jumps — numbers always transition smoothly.
 */
export function AnimatedNumber({
  value,
  asCurrency = true,
  currency = 'EUR',
  duration = 600,
  className = '',
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value)
  const prevValue = useRef(value)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const from = prevValue.current
    const to = value
    prevValue.current = value

    if (from === to) return

    const startTime = performance.now()

    const animate = (now: number) => {
      const elapsed = now - startTime
      const t = Math.min(1, elapsed / duration)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      const current = from + (to - from) * eased

      setDisplayValue(Math.round(current))

      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        setDisplayValue(to)
      }
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [value, duration])

  return (
    <span className={`tabular-nums ${className}`}>
      {asCurrency ? formatAmount(displayValue, currency) : displayValue.toLocaleString('fr-FR')}
    </span>
  )
}
