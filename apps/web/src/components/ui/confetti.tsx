'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Particle {
  id: number
  x: number
  y: number
  color: string
  size: number
  rotation: number
  delay: number
}

const COLORS = ['#6C5CE7', '#00D68F', '#FF9F43', '#54A0FF', '#FF4757', '#FECA57']

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 40 + Math.random() * 20, // center area (40-60% of width)
    y: -10,
    color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
    size: 4 + Math.random() * 6,
    rotation: Math.random() * 360,
    delay: Math.random() * 0.4,
  }))
}

/**
 * Lightweight confetti burst for milestone celebrations.
 * Triggers automatically when `active` changes to true.
 * Auto-dismisses after 2.5s.
 */
export function ConfettiBurst({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (active) {
      setParticles(generateParticles(30))
      setVisible(true)
      const timer = setTimeout(() => setVisible(false), 2500)
      return () => clearTimeout(timer)
    }
  }, [active])

  return (
    <AnimatePresence>
      {visible && (
        <div className="fixed inset-0 pointer-events-none z-[200] overflow-hidden">
          {particles.map((p) => (
            <motion.div
              key={p.id}
              className="absolute rounded-sm"
              style={{
                left: `${p.x}%`,
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
              }}
              initial={{
                y: '-10vh',
                x: 0,
                rotate: p.rotation,
                opacity: 1,
                scale: 0.5,
              }}
              animate={{
                y: '110vh',
                x: (Math.random() - 0.5) * 200,
                rotate: p.rotation + 720,
                opacity: [1, 1, 0.8, 0],
                scale: [0.5, 1, 1, 0.3],
              }}
              transition={{
                duration: 2 + Math.random(),
                delay: p.delay,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  )
}
