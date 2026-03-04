'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Star } from 'lucide-react'

/* ── Testimonial Data ─────────────────────────────────────── */
const row1 = [
  {
    name: 'Alexandre D.',
    role: 'Entrepreneur',
    avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Alexandre&backgroundColor=b6e3f4',
    color: '#6C5CE7',
    stars: 5,
    quote: "J'avais 4 banques, 2 brokers et 3 wallets crypto. OmniFlow a tout unifié en 5 minutes. Je vois enfin mon patrimoine réel.",
  },
  {
    name: 'Marie L.',
    role: 'Investisseuse',
    avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Marie&backgroundColor=ffd5dc',
    color: '#54A0FF',
    stars: 5,
    quote: "Nova IA m'a fait économiser 2 400€ en détectant des frais bancaires cachés que je payais depuis 3 ans. Bluffant.",
  },
  {
    name: 'Thomas B.',
    role: 'Freelance',
    avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Thomas&backgroundColor=c0aede',
    color: '#00D68F',
    stars: 5,
    quote: "Le budget IA comprend mes habitudes. Il a créé un budget optimal que je n'aurais jamais pensé faire moi-même.",
  },
  {
    name: 'Camille P.',
    role: 'Mère de famille',
    avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Camille&backgroundColor=d1f4d9',
    color: '#A29BFE',
    stars: 5,
    quote: "Le coffre-fort digital a changé notre organisation familiale. Tous nos documents importants sont en sécurité, accessibles partout.",
  },
  {
    name: 'Nicolas F.',
    role: 'Ingénieur',
    avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Nicolas&backgroundColor=ffeab6',
    color: '#FF9F43',
    stars: 5,
    quote: "L'agrégation est instantanée, le design est propre, et Nova comprend vraiment le contexte de mes finances. Rien à redire.",
  },
]

const row2 = [
  {
    name: 'Sophie R.',
    role: 'Cadre supérieur',
    avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Sophie&backgroundColor=ffd5dc',
    color: '#FF9F43',
    stars: 5,
    quote: "Le simulateur retraite avec Monte-Carlo m'a ouvert les yeux. J'ai ajusté mon épargne et gagné 8 ans de sérénité.",
  },
  {
    name: 'Julien M.',
    role: 'Crypto trader',
    avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Julien&backgroundColor=b6e3f4',
    color: '#FF4757',
    stars: 4,
    quote: "8 000 cryptos suivies en temps réel, avec le P&L exact et les alertes. C'est le Binance du suivi patrimonial.",
  },
  {
    name: 'Laura V.',
    role: 'Avocate',
    avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Laura&backgroundColor=c0aede',
    color: '#6C5CE7',
    stars: 5,
    quote: "Je recommande OmniFlow à tous mes clients. La vision patrimoine complète en un coup d'œil, c'est un game changer.",
  },
  {
    name: 'Rémi K.',
    role: 'Auto-entrepreneur',
    avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Remi&backgroundColor=d1f4d9',
    color: '#00D68F',
    stars: 5,
    quote: "Le radar fiscal m'a alerté sur un oubli de déclaration. Sans OmniFlow j'aurais payé 1 800€ de pénalités. Merci !",
  },
  {
    name: 'Élodie G.',
    role: 'Consultante',
    avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Elodie&backgroundColor=ffeab6',
    color: '#54A0FF',
    stars: 5,
    quote: "L'interface est magnifique. On sent que chaque pixel a été pensé. C'est rare pour une app de finance.",
  },
]

/* ── Single Testimonial Card ──────────────────────────────── */
function TestimonialCard({ t }: { t: (typeof row1)[0] }) {
  return (
    <div className="mx-2 w-[320px] flex-shrink-0 rounded-xl border border-gray-200/80 bg-white/80 p-5 backdrop-blur-sm transition-colors hover:border-gray-300 dark:border-white/[0.06] dark:bg-white/[0.03] dark:hover:border-white/[0.12] sm:w-[360px]">
      {/* Stars */}
      <div className="mb-3 flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`h-3.5 w-3.5 ${i < t.stars ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200 dark:text-white/10'}`}
          />
        ))}
      </div>

      {/* Quote */}
      <p className="mb-4 text-[13px] leading-relaxed text-gray-600 dark:text-white/55">
        &ldquo;{t.quote}&rdquo;
      </p>

      {/* Author */}
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <img
          src={t.avatar}
          alt={t.name}
          className="h-9 w-9 rounded-full ring-2 ring-gray-100 dark:ring-white/10"
          loading="lazy"
        />
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-white/85">{t.name}</p>
          <p className="text-[11px] text-gray-400 dark:text-white/35">{t.role}</p>
        </div>
      </div>
    </div>
  )
}

/* ── Marquee Row ──────────────────────────────────────────── */
function MarqueeRow({
  items,
  reverse = false,
  speed = 35,
}: {
  items: typeof row1
  reverse?: boolean
  speed?: number
}) {
  // Duplicate items for seamless loop
  const doubled = [...items, ...items]

  return (
    <div className="relative overflow-hidden py-2">
      <motion.div
        className="flex"
        animate={{ x: reverse ? ['0%', '-50%'] : ['-50%', '0%'] }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: 'loop',
            duration: speed,
            ease: 'linear',
          },
        }}
      >
        {doubled.map((t, i) => (
          <TestimonialCard key={`${t.name}-${i}`} t={t} />
        ))}
      </motion.div>
    </div>
  )
}

/* ── Section ──────────────────────────────────────────────── */
export function TestimonialsSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-10%' })

  return (
    <section ref={ref} className="relative overflow-hidden bg-gray-50/50 py-16 dark:bg-[#050505] sm:py-20">
      {/* Header */}
      <div className="mx-auto mb-10 max-w-2xl px-4 text-center">
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-brand dark:text-brand-light/60"
        >
          Témoignages
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 15 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.1 }}
          className="mb-3 font-heading text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white"
        >
          Ils nous font confiance
        </motion.h2>
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.2 }}
          className="inline-flex items-center gap-2 rounded-full border border-yellow-400/20 bg-yellow-400/5 px-3 py-1"
        >
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            ))}
          </div>
          <span className="text-xs text-gray-500 dark:text-white/50">4.9/5 basé sur 2 400+ avis</span>
        </motion.div>
      </div>

      {/* Marquee rows — opposite directions */}
      <div className="relative">
        {/* Fade edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-gray-50/50 via-gray-50/50 to-transparent dark:from-[#050505] dark:via-[#050505] sm:w-40" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-gray-50/50 via-gray-50/50 to-transparent dark:from-[#050505] dark:via-[#050505] sm:w-40" />

        <MarqueeRow items={row1} speed={40} />
        <MarqueeRow items={row2} reverse speed={45} />
      </div>
    </section>
  )
}
