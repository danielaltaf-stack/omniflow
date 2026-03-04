'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'

/* ── Typewriter Hook ──────────────────────────────────────── */
const typewriterWords = ['Unifié.', 'Intelligent.', 'Automatisé.', 'Sécurisé.', 'Simplifié.']

function useTypewriter() {
  const [display, setDisplay] = useState('')
  const [wordIdx, setWordIdx] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)

  const tick = useCallback(() => {
    const word = typewriterWords[wordIdx]!
    if (!isDeleting) {
      const next = word.slice(0, display.length + 1)
      setDisplay(next)
      if (next === word) {
        setTimeout(() => setIsDeleting(true), 2000)
        return
      }
    } else {
      const next = word.slice(0, display.length - 1)
      setDisplay(next)
      if (next === '') {
        setIsDeleting(false)
        setWordIdx((wordIdx + 1) % typewriterWords.length)
        return
      }
    }
  }, [display, wordIdx, isDeleting])

  useEffect(() => {
    const speed = isDeleting ? 40 : 80
    const timer = setTimeout(tick, speed)
    return () => clearTimeout(timer)
  }, [tick, isDeleting])

  return display
}

/* ── Realistic sparkline chart ────────────────────────────── */
function SparklineChart({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 280 80" fill="none" className={className} preserveAspectRatio="none">
      <defs>
        <linearGradient id="heroChartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00D68F" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#00D68F" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0 65 C15 62, 25 58, 35 55 C45 52, 55 48, 65 50 C75 52, 85 45, 100 38 C115 31, 125 35, 140 30 C155 25, 165 28, 175 22 C185 16, 200 20, 215 15 C230 10, 245 12, 260 8 L280 5"
        stroke="#00D68F"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M0 65 C15 62, 25 58, 35 55 C45 52, 55 48, 65 50 C75 52, 85 45, 100 38 C115 31, 125 35, 140 30 C155 25, 165 28, 175 22 C185 16, 200 20, 215 15 C230 10, 245 12, 260 8 L280 5 V80 H0 Z"
        fill="url(#heroChartFill)"
      />
    </svg>
  )
}

/* ── Desktop App Screen (no outer frame — the frame wraps it) */
function DesktopScreen() {
  const [activeSidebar, setActiveSidebar] = useState('Synthèse')
  const [activeRange, setActiveRange] = useState(4)

  return (
    <div className="flex h-full bg-[#0A0A0D]">
      {/* Sidebar */}
      <div className="w-[160px] flex-shrink-0 border-r border-white/[0.06] px-3 py-5">
        <div className="mb-6 flex items-center gap-2.5 px-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-[11px] font-bold text-white/90">OmniFlow</span>
        </div>
        <div className="space-y-0.5">
          {[
            { label: 'Synthèse' },
            { label: 'Patrimoine' },
            { label: 'Analyse' },
            { label: 'Budget' },
            { label: 'Investir' },
            { label: 'Nova IA' },
          ].map(item => (
            <button
              key={item.label}
              type="button"
              onClick={() => setActiveSidebar(item.label)}
              className={`w-full rounded-lg px-3 py-2 text-left text-[10px] font-medium transition-all duration-150 ${
                activeSidebar === item.label
                  ? 'bg-white/[0.08] text-white'
                  : 'text-white/30 hover:bg-white/[0.04] hover:text-white/50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 p-6">
        {/* Top header row */}
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-[10px] font-semibold tracking-wider text-white/40 uppercase">Patrimoine brut</span>
          <span className="text-[9px] text-white/20">Mars 4 - 26, 2026</span>
        </div>

        {/* Main amount */}
        <div className="mb-1.5">
          <span className="text-[32px] font-bold leading-none tracking-tight text-white">423 817 €</span>
        </div>

        {/* Gain badges */}
        <div className="mb-6 flex items-center gap-2">
          <span className="rounded-md bg-gain/15 px-2 py-0.5 text-[10px] font-bold text-gain">+9 955€</span>
          <span className="rounded-md bg-gain/15 px-2 py-0.5 text-[10px] font-bold text-gain">+1.93%</span>
        </div>

        {/* Chart */}
        <div className="mb-5">
          <SparklineChart className="h-[90px] w-full" />
        </div>

        {/* Time range selector */}
        <div className="mb-6 flex gap-1.5">
          {['J', '7J', '1M', '3M', '1A', 'YTD', 'TOUT'].map((t, i) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveRange(i)}
              className={`rounded-full px-3 py-1 text-[9px] font-medium transition-all duration-150 ${
                i === activeRange
                  ? 'bg-white/[0.1] text-white'
                  : 'text-white/25 hover:bg-white/[0.05] hover:text-white/40'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Asset allocation cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Banques', amount: '89 420 €', pct: '+2.1%', color: '#54A0FF' },
            { label: 'Bourse', amount: '187 211 €', pct: '+3.4%', color: '#6C5CE7' },
            { label: 'Crypto', amount: '54 200 €', pct: '+12.7%', color: '#FF9F43' },
          ].map(a => (
            <button
              key={a.label}
              type="button"
              className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-left transition-all duration-150 hover:border-white/[0.12] hover:bg-white/[0.06] active:scale-[0.97]"
            >
              <div className="mb-2 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: a.color }} />
                <span className="text-[9px] text-white/40">{a.label}</span>
              </div>
              <p className="text-[12px] font-bold text-white/90">{a.amount}</p>
              <p className="text-[9px] font-semibold text-gain">{a.pct}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Mobile Phone Screen ──────────────────────────────────── */
function PhoneScreen() {
  const [activePercent, setActivePercent] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  return (
    <div className="bg-[#0A0A0D] h-full overflow-hidden">
      {/* Status bar */}
      <div className="flex items-center justify-between px-6 pb-1 pt-3">
        <span className="text-[8px] font-semibold text-white/50">9:41</span>
        <div className="flex items-center gap-1">
          <div className="flex gap-[2px]">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-[5px] w-[3px] rounded-sm bg-white/40" style={{ opacity: i <= 3 ? 1 : 0.3 }} />
            ))}
          </div>
          <div className="ml-1 h-[6px] w-[14px] rounded-sm border border-white/40">
            <div className="h-full w-[70%] rounded-sm bg-white/40" />
          </div>
        </div>
      </div>

      {/* App header */}
      <button type="button" className="flex w-full items-center justify-center gap-2 px-4 py-3 transition-colors hover:bg-white/[0.03]">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/30">
          <span className="text-[8px] font-bold text-brand-light">€</span>
        </div>
        <span className="text-[11px] font-bold text-white/90">Investir</span>
        <svg className="h-2.5 w-2.5 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6" /></svg>
      </button>

      {/* Amount entry */}
      <div className="px-6 py-6 text-center">
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-[42px] font-bold leading-none tracking-tight text-white">
            {activePercent === '25%' ? '125' : activePercent === '50%' ? '250' : activePercent === '75%' ? '375' : activePercent === '100%' ? '500' : '150'}
          </span>
          <span className="text-[24px] font-medium text-white/25">EUR</span>
        </div>
      </div>

      {/* Balance row */}
      <div className="mx-5 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5">
        <span className="text-[10px] text-white/40">Solde</span>
        <span className="text-[11px] font-bold text-white/80">500 €</span>
      </div>

      {/* Percentage buttons */}
      <div className="mx-5 mt-3 grid grid-cols-4 gap-2">
        {['25%', '50%', '75%', '100%'].map(p => (
          <button
            key={p}
            type="button"
            onClick={() => setActivePercent(activePercent === p ? null : p)}
            className={`rounded-full border py-1.5 text-center text-[9px] font-medium transition-all duration-150 ${
              activePercent === p
                ? 'border-brand/40 bg-brand/10 text-brand-light'
                : 'border-white/[0.08] text-white/40 hover:border-white/[0.15] hover:text-white/60'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* CTA button */}
      <div className="mx-5 mt-5">
        <button
          type="button"
          onClick={() => setConfirmed(!confirmed)}
          className={`w-full rounded-full py-3 text-center text-[11px] font-bold transition-all duration-200 active:scale-[0.97] ${
            confirmed
              ? 'bg-gain text-white'
              : 'bg-brand text-white hover:bg-brand-light'
          }`}
        >
          {confirmed ? '✓ Confirmé' : 'Confirmer'}
        </button>
      </div>
    </div>
  )
}

/* ── Social proof stat cards ──────────────────────────────── */
const proofStats = [
  { value: '34+', label: 'banques françaises', sublabel: 'connectées via Woob' },
  { value: '4.9/5', label: 'note utilisateurs', sublabel: 'satisfaction beta' },
  { value: 'AES-256', label: 'chiffrement', sublabel: 'de bout en bout' },
]

/* ── Main Hero ────────────────────────────────────────────── */
export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const typed = useTypewriter()

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-white dark:bg-[#0D0D10]"
    >
      {/* ── Layout: full-width, two columns ──────────── */}
      <div className="relative min-h-[95vh] pt-12 lg:flex">

        {/* ── Left Column: Text ──────────────────────── */}
        <div className="relative z-10 flex flex-col justify-center px-6 pt-28 pb-12 sm:px-10 lg:w-[50%] lg:pl-[max(2rem,calc((100vw-80rem)/2+2rem))] lg:pr-12 lg:pt-12 lg:pb-0 xl:w-[47%]">
          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mb-1 font-heading text-[clamp(2.5rem,5vw,4rem)] font-bold leading-[1.05] tracking-tight text-gray-900 dark:text-white"
          >
            Votre patrimoine.
          </motion.h1>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.6 }}
            className="mb-6 font-heading text-[clamp(2.5rem,5vw,4rem)] font-bold leading-[1.05] tracking-tight text-gray-900 dark:text-white"
          >
            <span className="bg-gradient-to-r from-brand via-brand-light to-[#54A0FF] bg-clip-text text-transparent">
              {typed}
            </span>
            <span className="typewriter-cursor ml-0.5 inline-block h-[0.85em] w-[3px] translate-y-[0.1em] rounded-sm bg-brand-light" />
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="mb-8 max-w-[420px] text-[15px] leading-relaxed text-gray-500 sm:text-base dark:text-white/45"
          >
            Connectez vos comptes bancaires, visualisez l&apos;ensemble de vos actifs et prenez les meilleures décisions grâce à l&apos;intelligence artificielle.
          </motion.p>

          {/* CTA button */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65, duration: 0.5 }}
            className="mb-12"
          >
            <Link
              href="/register"
              className="group relative inline-flex items-center justify-center rounded-full bg-brand px-10 py-4 text-[15px] font-semibold text-white shadow-lg shadow-brand/25 transition-all hover:bg-brand-light hover:shadow-xl hover:shadow-brand/35 hover:scale-[1.02] active:scale-[0.98]"
            >
              Démarrer gratuitement
            </Link>
          </motion.div>

          {/* Social Proof Cards — dark cards like Finary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85, duration: 0.6 }}
            className="flex gap-3"
          >
            {proofStats.map(({ value, label, sublabel }) => (
              <div
                key={label}
                className="flex-1 rounded-2xl border border-gray-200/60 bg-gray-50 p-4 text-center transition-colors hover:border-gray-300 dark:border-white/[0.06] dark:bg-[#141418] dark:hover:border-white/[0.1]"
              >
                <p className="mb-1 text-lg font-bold tracking-tight text-gray-900 dark:text-white">{value}</p>
                <p className="text-[11px] font-semibold text-gray-600 dark:text-white/60">{label}</p>
                <p className="text-[10px] text-gray-400 dark:text-white/25">{sublabel}</p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* ── Right Column: Devices — extends to right edge ── */}
        <div className="relative lg:flex-1 lg:min-h-[100vh]">
          {/* Glow */}
          <div
            className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full opacity-[0.04] dark:opacity-[0.1]"
            style={{
              background: 'radial-gradient(circle, #6C5CE7 0%, #A29BFE 30%, transparent 70%)',
              filter: 'blur(80px)',
            }}
          />

          <motion.div
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="relative h-full"
          >
            {/* ── Desktop Frame ─────────────────────────── */}
            <div
              className="absolute top-[24%] right-0 lg:right-[-20%] xl:right-[-16%]"
              style={{ width: 'min(750px, 95%)' }}
            >
              {/* Monitor bezel */}
              <div className="rounded-2xl border-[3px] border-[#2A2A30] bg-[#18181C] p-[3px] shadow-2xl shadow-black/50">
                {/* Screen */}
                <div className="overflow-hidden rounded-xl">
                  {/* Toolbar */}
                  <div className="flex items-center gap-2 bg-[#1E1E22] px-4 py-2">
                    <div className="flex gap-1.5">
                      <div className="h-[10px] w-[10px] rounded-full bg-[#FF5F57] transition-shadow hover:shadow-[0_0_6px_#FF5F57]" />
                      <div className="h-[10px] w-[10px] rounded-full bg-[#FFBD2E] transition-shadow hover:shadow-[0_0_6px_#FFBD2E]" />
                      <div className="h-[10px] w-[10px] rounded-full bg-[#28C840] transition-shadow hover:shadow-[0_0_6px_#28C840]" />
                    </div>
                    <div className="ml-4 flex-1 rounded-md bg-white/[0.06] px-3 py-1 transition-colors hover:bg-white/[0.1] cursor-text">
                      <span className="text-[9px] text-white/25 font-mono">app.omniflow.fr/dashboard</span>
                    </div>
                  </div>
                  {/* App content */}
                  <DesktopScreen />
                </div>
              </div>

            </div>

            {/* ── Phone Frame ── overlapping the desktop ── */}
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.7, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="absolute z-20"
              style={{ bottom: '6%', left: '6%', width: '200px' }}
            >
              {/* Phone outer shell — bottom cut flat */}
              <div className="rounded-t-[32px] rounded-b-none border-[4px] border-b-0 border-[#2A2A30] bg-[#18181C] p-[3px] pb-0 shadow-2xl shadow-black/60">
                {/* Dynamic Island */}
                <div className="relative">
                  <div className="absolute left-1/2 top-[2px] z-20 h-[18px] w-[60px] -translate-x-1/2 rounded-full bg-[#0A0A0D]" />
                </div>
                {/* Screen */}
                <div className="overflow-hidden rounded-t-[26px] rounded-b-none">
                  <PhoneScreen />
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* ── Bottom fade gradient (works in both light & dark) ── */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-30 h-[220px] bg-gradient-to-b from-transparent via-white/70 to-white dark:via-[#0D0D10]/70 dark:to-[#0D0D10]" />
        </div>
      </div>
    </section>
  )
}
