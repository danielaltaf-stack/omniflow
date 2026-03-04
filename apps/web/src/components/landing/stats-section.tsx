'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { motion, useInView } from 'framer-motion'

/* ── Bank logos (grayscale → color on hover) ──────────────── */
const bankNames = [
  'Crédit Agricole', 'BNP Paribas', 'Société Générale', 'LCL',
  'Caisse d\'Épargne', 'Banque Populaire', 'CIC', 'Crédit Mutuel',
  'La Banque Postale', 'Boursorama', 'Fortuneo', 'Hello bank!',
  'N26', 'Revolut', 'Monabanq', 'ING',
  'HSBC', 'AXA Banque', 'BforBank', 'Orange Bank',
  'Crédit du Nord', 'Banque Palatine', 'Milleis', 'Nickel',
]

/* ── Stat Counter with particle easter egg ────────────────── */
function AnimatedStat({
  value,
  suffix,
  prefix,
  label,
  inView,
  delay,
}: {
  value: number
  suffix?: string
  prefix?: string
  label: string
  inView: boolean
  delay: number
}) {
  const [count, setCount] = useState(0)
  const [particles, setParticles] = useState<{ id: number; x: number; y: number }[]>([])
  const particleId = useRef(0)

  useEffect(() => {
    if (!inView) return
    let start: number | null = null
    const duration = 2000

    const step = (timestamp: number) => {
      if (!start) start = timestamp
      const progress = Math.min((timestamp - start) / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * value))
      if (progress < 1) requestAnimationFrame(step)
    }

    const timer = setTimeout(() => requestAnimationFrame(step), delay)
    return () => clearTimeout(timer)
  }, [inView, value, delay])

  const handleHover = useCallback(() => {
    // Easter egg: spawn particles on hover
    const newParticles = Array.from({ length: 12 }).map(() => ({
      id: ++particleId.current,
      x: (Math.random() - 0.5) * 120,
      y: (Math.random() - 0.5) * 80 - 20,
    }))
    setParticles(prev => [...prev, ...newParticles])
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.includes(p)))
    }, 800)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: delay / 1000, duration: 0.6 }}
      className="relative text-center"
      data-cursor="stat"
      onMouseEnter={handleHover}
    >
      {/* Particle effects */}
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-brand-light"
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      ))}

      <div className="font-heading text-2xl font-bold text-gray-900 sm:text-3xl lg:text-4xl dark:text-white">
        {prefix}
        <span className="tabular-nums">{count.toLocaleString('fr-FR')}</span>
        {suffix}
      </div>
      <div className="mt-1.5 text-xs text-gray-400 dark:text-white/40">{label}</div>
    </motion.div>
  )
}

/* ── Infinite marquee for bank logos ──────────────────────── */
function BankMarquee() {
  return (
    <div className="relative mt-8 overflow-hidden">
      {/* Fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-gray-50 to-transparent dark:from-[#0a0a0a]" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-gray-50 to-transparent dark:from-[#0a0a0a]" />

      <div className="marquee-track flex gap-8">
        {/* Double the items for seamless loop */}
        {[...bankNames, ...bankNames].map((name, i) => (
          <div
            key={i}
            className="flex-shrink-0 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-xs font-medium text-gray-400 transition-all duration-300 hover:border-brand/20 hover:text-gray-600 dark:border-white/[0.04] dark:bg-white/[0.02] dark:text-white/20 dark:hover:text-white/60"
          >
            {name}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Stats Section ────────────────────────────────────────── */
export function StatsSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-15%' })

  return (
    <section
      ref={ref}
      className="relative bg-gray-50 px-4 py-10 dark:bg-[#0a0a0a]"
    >
      {/* Background gradient accent */}
      <div
        className="absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(108,92,231,0.3), transparent)',
        }}
      />

      <div className="mx-auto max-w-5xl">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-8">
          <AnimatedStat value={34} suffix="+" label="Banques connectées" inView={inView} delay={0} />
          <AnimatedStat value={8000} suffix="+" label="Cryptomonnaies" inView={inView} delay={200} />
          <AnimatedStat prefix="<" value={200} suffix="ms" label="Latence moyenne" inView={inView} delay={400} />
          <AnimatedStat value={100} suffix="%" label="Conforme RGPD" inView={inView} delay={600} />
        </div>

        {/* Bank logos marquee */}
        <BankMarquee />
      </div>
    </section>
  )
}
