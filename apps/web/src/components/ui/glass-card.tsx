'use client'

import { useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  /** Enable cursor-following radial glow (Stripe-style) */
  enableGlow?: boolean
  /** Enable subtle 3D tilt on hover */
  enableTilt?: boolean
  /** Max tilt degrees */
  maxTilt?: number
  onClick?: () => void
}

/**
 * Premium glassmorphism card with optional:
 * - Cursor-tracking radial glow (Stripe-style)
 * - Subtle 3D tilt via CSS perspective
 */
export function GlassCard({
  children,
  className = '',
  enableGlow = false,
  enableTilt = false,
  maxTilt = 4,
  onClick,
}: GlassCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 })
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!ref.current) return
      const rect = ref.current.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      if (enableGlow) setGlowPos({ x, y })
      if (enableTilt) {
        const tiltX = ((y - 50) / 50) * -maxTilt
        const tiltY = ((x - 50) / 50) * maxTilt
        setTilt({ x: tiltX, y: tiltY })
      }
    },
    [enableGlow, enableTilt, maxTilt]
  )

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false)
    setTilt({ x: 0, y: 0 })
    setGlowPos({ x: 50, y: 50 })
  }, [])

  return (
    <motion.div
      ref={ref}
      className={`
        relative overflow-hidden rounded-omni border border-border
        bg-surface/80 backdrop-blur-xl
        transition-[border-color,box-shadow] duration-200
        ${onClick ? 'cursor-pointer' : ''}
        ${isHovered ? 'border-brand/20 shadow-lg shadow-brand/5' : ''}
        ${className}
      `}
      style={{
        transform: enableTilt
          ? `perspective(600px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`
          : undefined,
        transition: 'transform 0.15s ease-out',
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      {/* Radial glow overlay */}
      {enableGlow && isHovered && (
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-40 transition-opacity duration-200"
          style={{
            background: `radial-gradient(300px circle at ${glowPos.x}% ${glowPos.y}%, rgba(108,92,231,0.12), transparent 70%)`,
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </motion.div>
  )
}
