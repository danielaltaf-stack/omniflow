'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle,
  Circle,
  Building2,
  Bitcoin,
  Bell,
  Shield,
  UserCheck,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useBankStore } from '@/stores/bank-store'
import { useCryptoStore } from '@/stores/crypto-store'
import { ConfettiBurst } from '@/components/ui/confetti'

const DISMISS_KEY = 'omniflow_onboarding_dismissed'

interface Step {
  id: string
  label: string
  description: string
  icon: typeof CheckCircle
  href: string
  check: () => boolean
}

export function OnboardingChecklist() {
  const router = useRouter()
  const { connections } = useBankStore()
  const { portfolio } = useCryptoStore()

  const [dismissed, setDismissed] = useState(true) // Start hidden until hydrated
  const [expanded, setExpanded] = useState(true)
  const [showConfetti, setShowConfetti] = useState(false)

  // Hydrate dismissed state from localStorage
  useEffect(() => {
    const v = localStorage.getItem(DISMISS_KEY)
    setDismissed(v === 'true')
  }, [])

  const steps: Step[] = [
    {
      id: 'account',
      label: 'Créer un compte',
      description: 'Vous êtes inscrit !',
      icon: UserCheck,
      href: '/dashboard',
      check: () => true, // Always done if logged in
    },
    {
      id: 'bank',
      label: 'Connecter une banque',
      description: 'Synchronisez vos comptes bancaires via Woob',
      icon: Building2,
      href: '/patrimoine?tab=banques',
      check: () => connections.length > 0,
    },
    {
      id: 'crypto',
      label: 'Ajouter un wallet crypto',
      description: 'Importez vos portefeuilles crypto (API ou adresse)',
      icon: Bitcoin,
      href: '/patrimoine?tab=crypto',
      check: () => (portfolio?.wallets.length ?? 0) > 0,
    },
    {
      id: 'notifications',
      label: 'Activer les notifications',
      description: 'Recevez des alertes de prix et anomalies',
      icon: Bell,
      href: '/settings',
      check: () => {
        if (typeof window === 'undefined') return false
        return Notification?.permission === 'granted'
      },
    },
    {
      id: 'consent',
      label: 'Configurer les consentements',
      description: 'Personnalisez vos préférences de confidentialité',
      icon: Shield,
      href: '/settings',
      check: () => false, // We'd need to check consent_updated_at from the store
    },
  ]

  const completedCount = steps.filter((s) => s.check()).length
  const allDone = completedCount === steps.length
  const progressPct = (completedCount / steps.length) * 100

  // Show confetti when all done
  useEffect(() => {
    if (allDone && !dismissed) {
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 4000)
    }
  }, [allDone, dismissed])

  // Don't show if dismissed or all done
  if (dismissed) return null
  if (completedCount >= 4) return null // Hide when almost done

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem(DISMISS_KEY, 'true')
  }

  return (
    <>
      {showConfetti && <ConfettiBurst active={showConfetti} />}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-omni-lg border border-brand/20 bg-brand/5 p-4 sm:p-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand" />
            <h3 className="text-sm font-semibold text-foreground">
              Bienvenue sur OmniFlow !
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 text-foreground-tertiary hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <button
              onClick={handleDismiss}
              className="p-1 text-foreground-tertiary hover:text-foreground transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-foreground-secondary">
              {completedCount}/{steps.length} étapes complétées
            </span>
            <span className="text-brand font-medium">{Math.round(progressPct)}%</span>
          </div>
          <div className="h-2 bg-surface-elevated rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-brand to-purple-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Steps */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-1.5"
            >
              {steps.map((step) => {
                const isDone = step.check()
                const Icon = step.icon
                return (
                  <button
                    key={step.id}
                    onClick={() => !isDone && router.push(step.href)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-omni-sm text-left transition-all ${
                      isDone
                        ? 'opacity-60'
                        : 'hover:bg-surface cursor-pointer'
                    }`}
                    disabled={isDone}
                  >
                    {isDone ? (
                      <CheckCircle className="h-5 w-5 text-gain flex-shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-foreground-tertiary flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${isDone ? 'text-foreground-tertiary line-through' : 'text-foreground'}`}>
                        {step.label}
                      </p>
                      <p className="text-xs text-foreground-tertiary">{step.description}</p>
                    </div>
                    <Icon className={`h-4 w-4 flex-shrink-0 ${isDone ? 'text-foreground-tertiary' : 'text-foreground-secondary'}`} />
                  </button>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  )
}
