'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart3,
  Bell,
  Brain,
  Share2,
  Loader2,
  CheckCircle,
} from 'lucide-react'
import { useSettingsStore } from '@/stores/settings-store'

interface ToggleItem {
  key: 'consent_analytics' | 'consent_push_notifications' | 'consent_ai_personalization' | 'consent_data_sharing'
  icon: typeof BarChart3
  title: string
  description: string
}

const CONSENT_TOGGLES: ToggleItem[] = [
  {
    key: 'consent_analytics',
    icon: BarChart3,
    title: 'Analytics comportementales',
    description: 'Collecte anonyme de métriques de navigation (Web Vitals, pages visitées) pour améliorer l\'expérience.',
  },
  {
    key: 'consent_push_notifications',
    icon: Bell,
    title: 'Notifications push',
    description: 'Alertes de prix, détection d\'anomalies, rapports hebdomadaires et rappels d\'échéances.',
  },
  {
    key: 'consent_ai_personalization',
    icon: Brain,
    title: 'Personnalisation IA',
    description: 'Conseils budgétaires personnalisés, insights automatiques, budget auto et tips Nova IA.',
  },
  {
    key: 'consent_data_sharing',
    icon: Share2,
    title: 'Données agrégées anonymes',
    description: 'Partage de benchmarks anonymisés pour comparaison entre utilisateurs (aucune donnée personnelle).',
  },
]

export function ConsentSection() {
  const { consent, isLoadingConsent, fetchConsent, updateConsent } = useSettingsStore()

  useEffect(() => {
    fetchConsent()
  }, [fetchConsent])

  const handleToggle = async (key: ToggleItem['key']) => {
    if (!consent) return
    const newValue = !consent[key]
    await updateConsent({ [key]: newValue })
  }

  if (isLoadingConsent && !consent) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-omni-lg border border-border bg-background-tertiary p-5">
        <h3 className="text-base font-semibold text-foreground mb-1">Consentements (RGPD Art. 6 & 7)</h3>
        <p className="text-xs text-foreground-tertiary mb-5">
          Vous pouvez activer ou désactiver chaque type de traitement à tout moment. 
          Vos choix sont enregistrés immédiatement.
        </p>

        <div className="space-y-4">
          {CONSENT_TOGGLES.map((toggle) => {
            const Icon = toggle.icon
            const isActive = consent?.[toggle.key] ?? false

            return (
              <div
                key={toggle.key}
                className="flex items-start gap-4 p-4 rounded-omni-sm border border-border bg-surface"
              >
                <div className={`mt-0.5 p-2 rounded-lg transition-colors ${
                  isActive ? 'bg-brand/10 text-brand' : 'bg-surface-elevated text-foreground-tertiary'
                }`}>
                  <Icon className="h-4 w-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">{toggle.title}</p>
                    <button
                      onClick={() => handleToggle(toggle.key)}
                      className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 ${
                        isActive ? 'bg-brand' : 'bg-surface-elevated border border-border'
                      }`}
                      role="switch"
                      aria-checked={isActive}
                    >
                      <motion.div
                        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm"
                        animate={{ left: isActive ? '22px' : '2px' }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    </button>
                  </div>
                  <p className="text-xs text-foreground-tertiary mt-1 leading-relaxed">
                    {toggle.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Meta info */}
      {consent && (
        <div className="rounded-omni-lg border border-border bg-background-tertiary p-5">
          <h3 className="text-base font-semibold text-foreground mb-3">Informations</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-foreground-secondary">Version politique acceptée</span>
              <span className="text-foreground font-medium">v{consent.privacy_policy_version}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground-secondary">Dernière mise à jour</span>
              <span className="text-foreground font-medium">
                {consent.consent_updated_at
                  ? new Date(consent.consent_updated_at).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'long', year: 'numeric'
                    })
                  : 'Jamais modifié'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gain mt-2">
              <CheckCircle className="h-3.5 w-3.5" />
              Vos choix sont enregistrés automatiquement
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
