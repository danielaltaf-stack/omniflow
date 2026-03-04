'use client'

import { motion } from 'framer-motion'
import { Logo } from '@/components/ui/logo'
import { Shield, TrendingUp, Layers } from 'lucide-react'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      {/* ── Left: Form ────────────────────────────── */}
      <div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <Logo size="lg" />
          </div>
          {children}
        </div>
      </div>

      {/* ── Right: Illustration (desktop only) ───── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-background-secondary items-center justify-center">
        {/* Gradient orbs */}
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-brand/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-gain/10 blur-3xl" />
        
        <motion.div
          className="relative z-10 max-w-md space-y-8 px-12"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h2 className="text-3xl font-bold text-foreground">
            Votre patrimoine,
            <br />
            <span className="text-brand">simplifié.</span>
          </h2>
          <p className="text-foreground-secondary leading-relaxed">
            Agrégez banques, crypto, bourse, immobilier et dettes en une seule
            interface intelligente.
          </p>

          <div className="space-y-4">
            {[
              {
                icon: Shield,
                title: 'Privacy-first',
                desc: 'Vos données restent les vôtres. Chiffrement AES-256.',
              },
              {
                icon: TrendingUp,
                title: 'IA Prédictive',
                desc: "Anticipez vos flux de trésorerie à 30 jours.",
              },
              {
                icon: Layers,
                title: 'Open-Source',
                desc: "Agrégation Woob — sans API payante.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                className="flex items-start gap-3"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.15 }}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-omni-sm bg-brand/10">
                  <item.icon className="h-4 w-4 text-brand" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {item.title}
                  </p>
                  <p className="text-xs text-foreground-tertiary">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
