'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Check, Sparkles, Zap, Crown } from 'lucide-react'

const plans = [
  {
    name: 'Gratuit',
    price: '0€',
    period: '/mois',
    description: 'Tout ce qu\'il faut pour commencer.',
    icon: Zap,
    color: '#54A0FF',
    features: [
      '2 comptes bancaires',
      'Suivi crypto (100 actifs)',
      'Budget IA basique',
      'Nova Advisor (10 msg/jour)',
      'Dashboard unifié',
      'Chiffrement AES-256',
    ],
    cta: 'Commencer gratuitement',
    href: '/register',
    popular: false,
  },
  {
    name: 'Pro',
    price: '9€',
    period: '/mois',
    description: 'Pour les investisseurs sérieux.',
    icon: Sparkles,
    color: '#6C5CE7',
    features: [
      'Comptes bancaires illimités',
      'Suivi crypto illimité',
      'Budget IA avancé',
      'Nova Advisor illimité',
      'Simulateur retraite Monte-Carlo',
      'Radar fiscal & alertes',
      'Négociation auto de frais',
      'Coffre-fort digital',
      'Support prioritaire',
    ],
    cta: 'Essai gratuit 14 jours',
    href: '/register?plan=pro',
    popular: true,
  },
  {
    name: 'Famille',
    price: '19€',
    period: '/mois',
    description: 'Patrimoine familial complet.',
    icon: Crown,
    color: '#FF9F43',
    features: [
      'Tout le plan Pro',
      'Jusqu\'à 5 membres',
      'Heritage & succession',
      'Multi-portfolio',
      'Wealth Autopilot',
      'Calendrier financier partagé',
      'Export comptable avancé',
      'Onboarding dédié',
    ],
    cta: 'Essai gratuit 14 jours',
    href: '/register?plan=family',
    popular: false,
  },
]

export default function PricingPage() {
  return (
    <div className="px-4 py-16">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-light/60"
          >
            Tarifs
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-3 font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl"
          >
            Simple et transparent.{' '}
            <span className="bg-gradient-to-r from-brand to-brand-light bg-clip-text text-transparent">
              Sans surprise.
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mx-auto max-w-lg text-sm text-white/45"
          >
            Commencez gratuitement. Passez au Pro quand vous êtes prêt. Annulez à tout moment.
          </motion.p>
        </div>

        {/* Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan, i) => {
            const Icon = plan.icon
            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 25 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className={`relative rounded-xl border p-6 transition-colors ${
                  plan.popular
                    ? 'border-brand/30 bg-brand/[0.04]'
                    : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    Populaire
                  </div>
                )}

                <div className="mb-4 flex items-center gap-2">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${plan.color}15` }}
                  >
                    <Icon className="h-4 w-4" style={{ color: plan.color }} />
                  </div>
                  <h3 className="text-base font-bold text-white">{plan.name}</h3>
                </div>

                <div className="mb-1 flex items-baseline gap-1">
                  <span className="font-heading text-3xl font-bold text-white">{plan.price}</span>
                  <span className="text-xs text-white/40">{plan.period}</span>
                </div>
                <p className="mb-5 text-xs text-white/40">{plan.description}</p>

                <Link
                  href={plan.href}
                  className={`mb-5 block rounded-lg py-2.5 text-center text-sm font-semibold transition-all ${
                    plan.popular
                      ? 'bg-brand text-white hover:bg-brand-light'
                      : 'border border-white/10 text-white/70 hover:border-white/20 hover:text-white'
                  }`}
                >
                  {plan.cta}
                </Link>

                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-white/50">
                      <Check className="mt-0.5 h-3 w-3 flex-shrink-0 text-gain" />
                      {f}
                    </li>
                  ))}
                </ul>
              </motion.div>
            )
          })}
        </div>

        {/* FAQ note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 text-center text-xs text-white/25"
        >
          TVA incluse · Paiement sécurisé Stripe · 14 jours d&apos;essai gratuit sans engagement
        </motion.p>
      </div>
    </div>
  )
}
