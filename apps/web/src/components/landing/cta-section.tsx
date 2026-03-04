'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

export function CTASection() {

  return (
    <section className="relative overflow-hidden px-4 py-14">
      {/* Animated gradient background */}
      <div className="cta-gradient absolute inset-0 -z-10" />

      {/* Radial glow */}
      <div
        className="absolute left-1/2 top-1/2 -z-10 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-[100px]"
        style={{ background: 'radial-gradient(circle, #6C5CE7, transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-3xl text-center">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mb-4 font-heading text-2xl font-bold tracking-tight text-white sm:text-3xl dark:text-white"
        >
          Prenez le contrôle de votre{' '}
          <span className="bg-gradient-to-r from-brand-light to-[#54A0FF] bg-clip-text text-transparent">
            avenir financier
          </span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="mx-auto mb-6 max-w-lg text-sm text-white/45 sm:text-base"
        >
          Rejoignez les premiers utilisateurs qui unifient et optimisent leur patrimoine avec l&apos;IA.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <Link
            href="/register"
            data-cursor="link"
            className="group relative inline-flex items-center gap-2 rounded-lg bg-white px-8 py-3 text-sm font-semibold text-black transition-all hover:shadow-[0_0_40px_rgba(108,92,231,0.3)]"
          >
            Commencer gratuitement
            <svg
              className="h-5 w-5 transition-transform group-hover:translate-x-1"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>

            {/* Glow behind button */}
            <div className="absolute inset-0 -z-10 rounded-xl bg-white opacity-0 blur-2xl transition-opacity group-hover:opacity-30" />
          </Link>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="mt-6 text-xs text-white/25"
        >
          Gratuit pendant la beta · Aucune carte requise · Données chiffrées AES-256
        </motion.p>
      </div>
    </section>
  )
}
