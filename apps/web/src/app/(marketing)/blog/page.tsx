'use client'

import { motion } from 'framer-motion'
import { Calendar, Tag, ArrowRight } from 'lucide-react'
import Link from 'next/link'

const posts = [
  {
    title: 'Comment OmniFlow unifie 34+ banques françaises en un seul dashboard',
    excerpt: 'Découvrez comment notre moteur Woob se connecte aux banques françaises de manière sécurisée et open-source.',
    date: '15 Jan 2025',
    tag: 'Produit',
    tagColor: '#6C5CE7',
    readTime: '5 min',
    slug: '#',
  },
  {
    title: 'Nova Advisor IA : votre conseiller financier disponible 24/7',
    excerpt: 'Comment l\'IA analyse votre patrimoine en temps réel pour vous donner des recommandations personnalisées.',
    date: '8 Jan 2025',
    tag: 'IA',
    tagColor: '#FF9F43',
    readTime: '4 min',
    slug: '#',
  },
  {
    title: 'Simuler sa retraite avec Monte-Carlo : guide complet',
    excerpt: '10 000 simulations pour anticiper votre future situation financière. Méthodologie et résultats.',
    date: '2 Jan 2025',
    tag: 'Tutoriel',
    tagColor: '#00D68F',
    readTime: '8 min',
    slug: '#',
  },
  {
    title: 'RGPD et patrimoine : comment OmniFlow protège vos données',
    excerpt: 'Chiffrement AES-256, droit à la portabilité, audit de sécurité — notre engagement privacy-first.',
    date: '20 Déc 2024',
    tag: 'Sécurité',
    tagColor: '#FF4757',
    readTime: '6 min',
    slug: '#',
  },
  {
    title: 'Le tracking crypto intelligent : 8 000+ tokens en temps réel',
    excerpt: 'CoinGecko, DeFi, NFTs — comment notre agrégateur multi-source unifie le suivi de vos actifs numériques.',
    date: '12 Déc 2024',
    tag: 'Crypto',
    tagColor: '#54A0FF',
    readTime: '5 min',
    slug: '#',
  },
  {
    title: 'Changelog : les nouveautés de Décembre 2024',
    excerpt: 'Radar fiscal, coffre-fort digital, calendrier financier et wealth autopilot — tout ce qui est nouveau.',
    date: '1 Déc 2024',
    tag: 'Changelog',
    tagColor: '#A29BFE',
    readTime: '3 min',
    slug: '#',
  },
]

export default function BlogPage() {
  return (
    <div className="px-4 py-16">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-light/60"
          >
            Blog
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-3 font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl"
          >
            Insights &{' '}
            <span className="bg-gradient-to-r from-brand to-brand-light bg-clip-text text-transparent">
              actualités
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mx-auto max-w-md text-sm text-white/45"
          >
            Tutoriels, analyses et nouveautés de l&apos;écosystème OmniFlow.
          </motion.p>
        </div>

        {/* Posts Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, i) => (
            <motion.article
              key={post.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.07 }}
              className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-colors hover:border-white/[0.12] hover:bg-white/[0.04]"
            >
              {/* Tag + Date */}
              <div className="mb-3 flex items-center justify-between">
                <span
                  className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                  style={{
                    backgroundColor: `${post.tagColor}15`,
                    color: post.tagColor,
                  }}
                >
                  <Tag className="h-2.5 w-2.5" />
                  {post.tag}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-white/25">
                  <Calendar className="h-2.5 w-2.5" />
                  {post.date}
                </span>
              </div>

              {/* Title */}
              <h2 className="mb-2 text-sm font-bold leading-snug text-white/80 transition-colors group-hover:text-white">
                {post.title}
              </h2>

              {/* Excerpt */}
              <p className="mb-4 text-xs leading-relaxed text-white/35">
                {post.excerpt}
              </p>

              {/* Footer */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/20">{post.readTime} de lecture</span>
                <Link
                  href={post.slug}
                  className="flex items-center gap-1 text-[11px] font-medium text-brand-light/60 transition-colors group-hover:text-brand-light"
                >
                  Lire
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </div>
  )
}
