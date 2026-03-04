'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import {
  Layers,
  Brain,
  Sparkles,
  TrendingUp,
  CalendarClock,
  Vault,
} from 'lucide-react'

/* ── Feature Data ─────────────────────────────────────────── */
const features = [
  {
    icon: Layers,
    tag: 'Agrégation',
    title: 'Vision 360°',
    desc: 'Banques, crypto, bourse, immobilier, dettes — tout votre patrimoine converge en un tableau de bord unifié.',
    gradient: 'from-brand to-brand-light',
    video: 'https://assets.mixkit.co/videos/1163/1163-720.mp4',
  },
  {
    icon: Brain,
    tag: 'Intelligence',
    title: 'Budget IA',
    desc: 'Catégorisation intelligente, détection d\'anomalies, budget auto-optimal. L\'IA qui comprend vos habitudes.',
    gradient: 'from-[#54A0FF] to-brand',
    video: 'https://assets.mixkit.co/videos/4960/4960-720.mp4',
  },
  {
    icon: Sparkles,
    tag: 'Copilote',
    title: 'Nova Advisor',
    desc: 'Votre conseiller financier IA personnel. Posez-lui n\'importe quelle question, il analyse et répond en contexte.',
    gradient: 'from-brand-light to-[#FF9F43]',
    video: 'https://assets.mixkit.co/videos/4921/4921-720.mp4',
  },
  {
    icon: TrendingUp,
    tag: 'Multi-Assets',
    title: 'Crypto & Bourse',
    desc: '8 000+ cryptos, actions, ETF — suivi temps réel, graphiques avancés, score de diversification.',
    gradient: 'from-[#FF9F43] to-[#FF4757]',
    video: 'https://assets.mixkit.co/videos/328/328-720.mp4',
  },
  {
    icon: CalendarClock,
    tag: 'Projection',
    title: 'Simulateur Retraite',
    desc: 'Projection Monte-Carlo, 3 scénarios, inflation intégrée, droits acquis, train de vie cible.',
    gradient: 'from-gain to-[#54A0FF]',
    video: 'https://assets.mixkit.co/videos/4394/4394-720.mp4',
  },
  {
    icon: Vault,
    tag: 'Sécurité',
    title: 'Coffre-Fort Digital',
    desc: 'Biens, documents, cartes, abonnements — tout inventorié et valorisé. Chiffrement AES-256.',
    gradient: 'from-[#FF4757] to-brand',
    video: 'https://assets.mixkit.co/videos/4488/4488-720.mp4',
  },
]

/* ── Single Feature Card ──────────────────────────────────── */
function FeatureCard({
  feature,
  index,
}: {
  feature: (typeof features)[0]
  index: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-5%' })
  const Icon = feature.icon

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: index * 0.08, duration: 0.5 }}
      className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white transition-colors hover:border-gray-300 dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:border-white/[0.1] dark:hover:bg-white/[0.04]"
    >
      {/* Video / visual area */}
      <div className="relative aspect-video overflow-hidden">
        <video
          className="h-full w-full object-cover opacity-50 transition-opacity duration-500 group-hover:opacity-70 dark:opacity-40 dark:group-hover:opacity-60"
          src={feature.video}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
        {/* Icon floating */}
        <div className="absolute bottom-3 left-3">
          <div className={`rounded-lg bg-gradient-to-r ${feature.gradient} p-1.5`}>
            <Icon className="h-3.5 w-3.5 text-white" />
          </div>
        </div>
        {/* Tag */}
        <div className="absolute right-3 top-3">
          <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/50 backdrop-blur-sm">
            {feature.tag}
          </span>
        </div>
      </div>

      {/* Text */}
      <div className="p-4">
        <h3 className="mb-1.5 font-heading text-base font-bold text-gray-900 dark:text-white">
          {feature.title}
        </h3>
        <p className="text-[13px] leading-relaxed text-gray-500 dark:text-white/40">
          {feature.desc}
        </p>
      </div>
    </motion.div>
  )
}

/* ── Features Section ─────────────────────────────────────── */
export function FeaturesSection() {
  return (
    <section id="features" className="relative bg-gray-50 px-4 py-12 dark:bg-black">
      {/* Section header */}
      <div className="mx-auto mb-8 max-w-2xl text-center">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-brand dark:text-brand-light/60"
        >
          Super-Pouvoirs Financiers
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="font-heading text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white"
        >
          Tout ce dont vous avez besoin.{' '}
          <span className="bg-gradient-to-r from-brand to-brand-light bg-clip-text text-transparent">
            Rien de superflu.
          </span>
        </motion.h2>
      </div>

      {/* Feature cards grid */}
      <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, i) => (
          <FeatureCard key={i} feature={feature} index={i} />
        ))}
      </div>
    </section>
  )
}
