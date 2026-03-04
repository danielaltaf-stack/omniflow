'use client'

import { Infinity as InfinityIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  animated?: boolean
  className?: string
}

const sizeConfig = {
  sm: { icon: 20, text: 'text-lg', gap: 'gap-1' },
  md: { icon: 28, text: 'text-2xl', gap: 'gap-1.5' },
  lg: { icon: 40, text: 'text-4xl', gap: 'gap-2' },
}

export function Logo({ size = 'md', animated = true, className }: LogoProps) {
  const Wrapper = animated ? motion.div : 'div'
  const animationProps = animated
    ? {
        initial: { opacity: 0, scale: 0.8 },
        animate: { opacity: 1, scale: 1 },
        transition: { type: 'spring', stiffness: 200, damping: 20 },
      }
    : {}

  const { icon, text, gap } = sizeConfig[size]

  return (
    <Wrapper
      className={cn('flex items-center', gap, className)}
      {...animationProps}
    >
      <InfinityIcon
        size={icon}
        strokeWidth={2.5}
        className="text-brand shrink-0"
        aria-hidden="true"
      />
      <span className={cn('font-bold tracking-tight text-foreground select-none', text)}>
        Omni<span className="text-brand">Flow</span>
      </span>
    </Wrapper>
  )
}
