'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { Link2, Brain, LineChart, ChevronLeft, ChevronRight } from 'lucide-react'

/* ── Steps Data ───────────────────────────────────────────── */
const steps = [
  {
    number: '01',
    icon: Link2,
    title: 'Connectez vos comptes',
    desc: 'Ajoutez vos banques, courtiers, wallets crypto et biens immobiliers en quelques clics. Connexion sécurisée via Woob (open-source).',
    color: '#54A0FF',
    gradient: 'from-[#54A0FF] to-brand',
    video: 'https://assets.mixkit.co/videos/4614/4614-720.mp4',
  },
  {
    number: '02',
    icon: Brain,
    title: "L'IA analyse tout",
    desc: 'Nova catégorise vos transactions, détecte les anomalies, calcule votre OmniScore et identifie les optimisations possibles.',
    color: '#6C5CE7',
    gradient: 'from-brand to-brand-light',
    video: 'https://assets.mixkit.co/videos/4957/4957-720.mp4',
  },
  {
    number: '03',
    icon: LineChart,
    title: 'Prenez les bonnes décisions',
    desc: "Dashboard unifié, simulations retraite, alertes fiscales, négociation de frais — passez de l'insight à l'action.",
    color: '#00D68F',
    gradient: 'from-gain to-[#54A0FF]',
    video: 'https://assets.mixkit.co/videos/4622/4622-720.mp4',
  },
]

const AUTOPLAY_MS = 6000

/* ── Slide variants ───────────────────────────────────────── */
const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? '60%' : '-60%',
    opacity: 0,
    scale: 0.92,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (dir: number) => ({
    x: dir > 0 ? '-60%' : '60%',
    opacity: 0,
    scale: 0.92,
  }),
}

const textVariants = {
  enter: (dir: number) => ({
    y: dir > 0 ? 40 : -40,
    opacity: 0,
  }),
  center: {
    y: 0,
    opacity: 1,
  },
  exit: (dir: number) => ({
    y: dir > 0 ? -40 : 40,
    opacity: 0,
  }),
}

/* ── Component ────────────────────────────────────────────── */
export function HowItWorksSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const inView = useInView(sectionRef, { once: true, margin: '-10%' })
  const [[active, direction], setActive] = useState([0, 0])
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const go = useCallback(
    (idx: number) => {
      const dir = idx > active ? 1 : -1
      setActive([idx, dir])
      setProgress(0)
    },
    [active],
  )

  const next = useCallback(() => {
    const idx = (active + 1) % steps.length
    setActive([idx, 1])
    setProgress(0)
  }, [active])

  const prev = useCallback(() => {
    const idx = (active - 1 + steps.length) % steps.length
    setActive([idx, -1])
    setProgress(0)
  }, [active])

  /* Autoplay timer + progress bar */
  useEffect(() => {
    if (!inView) return
    const tick = 50 // ms
    timerRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          next()
          return 0
        }
        return p + (tick / AUTOPLAY_MS) * 100
      })
    }, tick)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [inView, next])

  const step = steps[active]!
  const Icon = step.icon

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="relative overflow-hidden bg-white px-4 py-16 dark:bg-black sm:py-20"
    >
      {/* Section header */}
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-brand dark:text-brand-light/60"
        >
          Simple & Efficace
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="font-heading text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white"
        >
          3 étapes.{' '}
          <span className="bg-gradient-to-r from-brand to-gain bg-clip-text text-transparent">
            3 minutes.
          </span>
        </motion.h2>
      </div>

      {/* ── Carousel ──────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl">
        {/* Main card */}
        <div className="relative">
          {/* Video carousel viewport */}
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-gray-200/60 sm:aspect-[2.2/1] dark:border-white/[0.06]">
            <AnimatePresence initial={false} custom={direction} mode="popLayout">
              <motion.div
                key={active}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
                className="absolute inset-0"
              >
                {/* Video */}
                <video
                  className="h-full w-full object-cover"
                  src={step.video}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                />
                {/* Dark overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />
                {/* Color tint */}
                <div
                  className="absolute inset-0 opacity-20 mix-blend-overlay"
                  style={{
                    background: `linear-gradient(135deg, ${step.color}40 0%, transparent 60%)`,
                  }}
                />
              </motion.div>
            </AnimatePresence>

            {/* ── Content overlay ── */}
            <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-8 lg:p-10">
              {/* Big ghost number */}
              <AnimatePresence initial={false} custom={direction} mode="popLayout">
                <motion.span
                  key={`num-${active}`}
                  custom={direction}
                  variants={textVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="pointer-events-none absolute right-4 top-2 select-none font-heading text-[5rem] font-black leading-none tracking-tighter text-white/[0.06] sm:right-8 sm:top-4 sm:text-[8rem] lg:text-[10rem]"
                  aria-hidden="true"
                >
                  {step.number}
                </motion.span>
              </AnimatePresence>

              <AnimatePresence initial={false} custom={direction} mode="popLayout">
                <motion.div
                  key={`text-${active}`}
                  custom={direction}
                  variants={textVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
                  className="relative z-10"
                >
                  {/* Icon + Tag */}
                  <div className="mb-3 flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r ${step.gradient} shadow-lg`}
                    >
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/10 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white/60 backdrop-blur-sm">
                      Étape {step.number}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="mb-2 font-heading text-xl font-bold text-white sm:text-2xl lg:text-3xl">
                    {step.title}
                  </h3>

                  {/* Description */}
                  <p className="max-w-lg text-sm leading-relaxed text-white/60 sm:text-base">
                    {step.desc}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ── Navigation arrows (desktop) ── */}
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/30 p-2 text-white/60 backdrop-blur-sm transition-all hover:bg-black/50 hover:text-white sm:flex"
              aria-label="Étape précédente"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/30 p-2 text-white/60 backdrop-blur-sm transition-all hover:bg-black/50 hover:text-white sm:flex"
              aria-label="Étape suivante"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* ── Step indicators with progress ── */}
          <div className="mt-6 flex items-center justify-center gap-3 sm:gap-4">
            {steps.map((s, i) => {
              const StepIcon = s.icon
              const isActive = i === active
              return (
                <button
                  key={i}
                  onClick={() => go(i)}
                  className={`group relative flex items-center gap-2.5 rounded-full border px-3 py-2 transition-all duration-300 sm:px-4 sm:py-2.5 ${
                    isActive
                      ? 'border-gray-300 bg-gray-50 shadow-md dark:border-white/10 dark:bg-white/[0.06] dark:shadow-brand/10'
                      : 'border-transparent bg-transparent hover:bg-gray-100 dark:hover:bg-white/[0.03]'
                  }`}
                >
                  {/* Icon circle */}
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                      isActive ? 'scale-110' : 'scale-100 opacity-40 group-hover:opacity-70'
                    }`}
                    style={{
                      backgroundColor: isActive ? `${s.color}20` : 'transparent',
                      border: `1.5px solid ${isActive ? s.color : 'transparent'}`,
                    }}
                  >
                    <StepIcon
                      className="h-3.5 w-3.5 transition-colors"
                      style={{ color: isActive ? s.color : undefined }}
                    />
                  </div>

                  {/* Label (visible on sm+) */}
                  <span
                    className={`hidden text-xs font-semibold transition-colors sm:block ${
                      isActive
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-400 group-hover:text-gray-600 dark:text-white/30 dark:group-hover:text-white/50'
                    }`}
                  >
                    {s.title}
                  </span>

                  {/* Active progress bar */}
                  {isActive && (
                    <div className="absolute -bottom-1.5 left-1/2 h-0.5 w-3/4 -translate-x-1/2 overflow-hidden rounded-full bg-gray-200/50 dark:bg-white/[0.06]">
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          width: `${progress}%`,
                          backgroundColor: s.color,
                        }}
                        transition={{ duration: 0.05, ease: 'linear' }}
                      />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
