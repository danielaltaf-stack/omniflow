'use client'

import { motion } from 'framer-motion'

const variants = {
  hidden: { opacity: 0, y: 6, scale: 0.995 },
  enter: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.995 },
}

/**
 * Wrap any page content for cinematic crossfade + subtle scale.
 * 200ms enter, 150ms exit — snappy like Linear.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={variants}
      initial="hidden"
      animate="enter"
      exit="exit"
      transition={{
        type: 'tween',
        ease: [0.25, 0.46, 0.45, 0.94],
        duration: 0.2,
      }}
    >
      {children}
    </motion.div>
  )
}
