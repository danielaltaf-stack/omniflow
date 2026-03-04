'use client'

import { motion } from 'framer-motion'
import { Shield, Heart, Zap, Globe, Lightbulb, Users } from 'lucide-react'

const values = [
  {
    icon: Shield,
    title: 'Sécurité d\'abord',
    desc: 'Chiffrement AES-256, authentification forte, conformité RGPD. Vos données ne sont jamais partagées.',
    color: '#6C5CE7',
  },
  {
    icon: Lightbulb,
    title: 'Open Source',
    desc: 'Moteur Woob open-source et auditable. Transparence totale sur les connexions bancaires.',
    color: '#54A0FF',
  },
  {
    icon: Heart,
    title: 'Fait en France',
    desc: 'Équipe française, serveurs européens, respect strict de la législation financière locale.',
    color: '#FF4757',
  },
  {
    icon: Zap,
    title: 'IA puissante',
    desc: 'Modèles Groq, Gemini et OpenAI combinés pour des analyses financières contextuelles uniques.',
    color: '#FF9F43',
  },
  {
    icon: Globe,
    title: 'Multi-actifs',
    desc: '34+ banques, 8000+ cryptos, actions, immobilier — tout unifié dans une seule interface.',
    color: '#00D68F',
  },
  {
    icon: Users,
    title: 'Pour tous',
    desc: 'Du débutant à l\'investisseur avancé, OmniFlow s\'adapte à votre niveau de complexité.',
    color: '#A29BFE',
  },
]

const timeline = [
  { year: '2024 Q1', event: 'Idéation et architecture' },
  { year: '2024 Q2', event: 'Prototype MVP avec intégration Woob' },
  { year: '2024 Q3', event: 'Beta privée — Nova Advisor IA' },
  { year: '2024 Q4', event: 'Beta ouverte — Lancement public' },
  { year: '2025 Q1', event: 'Plans Pro & Famille' },
]

export default function AboutPage() {
  return (
    <div className="px-4 py-16">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-14 text-center">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-light/60"
          >
            À propos
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-3 font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl"
          >
            Reprendre le contrôle{' '}
            <span className="bg-gradient-to-r from-brand to-brand-light bg-clip-text text-transparent">
              de votre argent.
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mx-auto max-w-xl text-sm leading-relaxed text-white/45"
          >
            OmniFlow est né d&apos;un constat : gérer son patrimoine en France est fragmenté, opaque et anxiogène. 
            Nous construisons l&apos;outil que nous aurions aimé avoir — unifié, intelligent et transparent.
          </motion.p>
        </div>

        {/* Values Grid */}
        <div className="mb-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {values.map((v, i) => {
            const Icon = v.icon
            return (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.07 }}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-colors hover:border-white/[0.1]"
              >
                <div
                  className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${v.color}15` }}
                >
                  <Icon className="h-4 w-4" style={{ color: v.color }} />
                </div>
                <h3 className="mb-1.5 text-sm font-bold text-white">{v.title}</h3>
                <p className="text-xs leading-relaxed text-white/40">{v.desc}</p>
              </motion.div>
            )
          })}
        </div>

        {/* Timeline */}
        <div className="mb-16">
          <h2 className="mb-6 text-center font-heading text-xl font-bold text-white">Notre parcours</h2>
          <div className="space-y-4">
            {timeline.map((t, i) => (
              <motion.div
                key={t.year}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-center gap-4 rounded-lg border border-white/[0.04] bg-white/[0.02] px-5 py-3"
              >
                <span className="text-xs font-bold text-brand-light">{t.year}</span>
                <div className="h-4 w-px bg-white/10" />
                <span className="text-sm text-white/50">{t.event}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Tech Stack */}
        <div className="text-center">
          <h2 className="mb-4 font-heading text-xl font-bold text-white">Stack Technologique</h2>
          <div className="flex flex-wrap justify-center gap-2">
            {['Next.js 14', 'FastAPI', 'PostgreSQL', 'Redis', 'Woob', 'Groq', 'Gemini', 'OpenAI', 'Docker', 'Railway'].map(
              (tech) => (
                <span
                  key={tech}
                  className="rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1 text-[11px] text-white/40"
                >
                  {tech}
                </span>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
