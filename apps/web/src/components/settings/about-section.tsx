'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Info,
  MessageSquare,
  Sparkles,
  Shield,
  Zap,
  Bug,
  Lightbulb,
  HelpCircle,
  Loader2,
  CheckCircle,
  X,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSettingsStore } from '@/stores/settings-store'
import type { ChangelogEntry } from '@/types/api'

const ENTRY_TYPE_CONFIG: Record<ChangelogEntry['type'], { icon: typeof Sparkles; color: string; bg: string }> = {
  feature: { icon: Sparkles, color: 'text-brand', bg: 'bg-brand/10' },
  fix: { icon: Bug, color: 'text-warning', bg: 'bg-warning/10' },
  security: { icon: Shield, color: 'text-gain', bg: 'bg-gain/10' },
  performance: { icon: Zap, color: 'text-info', bg: 'bg-info/10' },
}

const FEEDBACK_CATEGORIES = [
  { value: 'bug' as const, label: 'Bug', icon: Bug },
  { value: 'feature' as const, label: 'Fonctionnalité', icon: Sparkles },
  { value: 'improvement' as const, label: 'Amélioration', icon: Lightbulb },
  { value: 'other' as const, label: 'Autre', icon: HelpCircle },
]

export function AboutSection() {
  const {
    changelog, isLoadingChangelog, fetchChangelog,
    isSendingFeedback, sendFeedback,
  } = useSettingsStore()

  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackCategory, setFeedbackCategory] = useState<'bug' | 'feature' | 'improvement' | 'other'>('feature')
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)

  useEffect(() => {
    fetchChangelog()
  }, [fetchChangelog])

  const handleSendFeedback = async () => {
    if (!feedbackMessage.trim() || feedbackMessage.length < 5) {
      setFeedbackError('Le message doit contenir au moins 5 caractères.')
      return
    }
    try {
      setFeedbackError(null)
      await sendFeedback({
        category: feedbackCategory,
        message: feedbackMessage.trim(),
        metadata: {
          screen_width: window.innerWidth,
          screen_height: window.innerHeight,
          current_route: window.location.pathname,
          user_agent: navigator.userAgent,
          app_version: '0.4.0',
        },
      })
      setFeedbackSent(true)
      setFeedbackMessage('')
      setTimeout(() => {
        setFeedbackSent(false)
        setShowFeedback(false)
      }, 2000)
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Erreur lors de l\'envoi')
    }
  }

  return (
    <div className="space-y-6">
      {/* App Info */}
      <div className="rounded-omni-lg border border-border bg-background-tertiary p-5">
        <div className="flex items-center gap-2 mb-4">
          <Info className="h-5 w-5 text-brand" />
          <h3 className="text-base font-semibold text-foreground">À propos d&apos;OmniFlow</h3>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-3 rounded-omni-sm bg-surface">
            <p className="text-foreground-tertiary text-xs">Version</p>
            <p className="text-foreground font-medium mt-0.5">0.4.0</p>
          </div>
          <div className="p-3 rounded-omni-sm bg-surface">
            <p className="text-foreground-tertiary text-xs">Environnement</p>
            <p className="text-foreground font-medium mt-0.5">
              {process.env.NODE_ENV === 'production' ? 'Production' : 'Développement'}
            </p>
          </div>
          <div className="p-3 rounded-omni-sm bg-surface">
            <p className="text-foreground-tertiary text-xs">Stack</p>
            <p className="text-foreground font-medium mt-0.5">Next.js 14 + FastAPI</p>
          </div>
          <div className="p-3 rounded-omni-sm bg-surface">
            <p className="text-foreground-tertiary text-xs">Licence</p>
            <p className="text-foreground font-medium mt-0.5">Open Source</p>
          </div>
        </div>
      </div>

      {/* Changelog */}
      <div className="rounded-omni-lg border border-border bg-background-tertiary p-5">
        <h3 className="text-base font-semibold text-foreground mb-4">Journal des modifications</h3>

        {isLoadingChangelog ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-brand" />
          </div>
        ) : changelog.length === 0 ? (
          <p className="text-sm text-foreground-tertiary text-center py-6">Aucune entrée disponible.</p>
        ) : (
          <div className="space-y-4">
            {changelog.map((version, vIdx) => (
              <motion.div
                key={version.version}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: vIdx * 0.1 }}
                className="relative"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-bold text-foreground">v{version.version}</span>
                  <span className="text-xs text-foreground-tertiary">
                    {new Date(version.date).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </span>
                </div>
                <div className="space-y-2 pl-3 border-l-2 border-border">
                  {version.entries.map((entry, eIdx) => {
                    const config = ENTRY_TYPE_CONFIG[entry.type]
                    const Icon = config.icon
                    return (
                      <div key={eIdx} className="flex items-start gap-2.5 py-1">
                        <div className={`flex-shrink-0 p-1 rounded ${config.bg}`}>
                          <Icon className={`h-3 w-3 ${config.color}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{entry.title}</p>
                          <p className="text-xs text-foreground-tertiary">{entry.description}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Feedback */}
      <div className="rounded-omni-lg border border-border bg-background-tertiary p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-brand" />
            <h3 className="text-base font-semibold text-foreground">Feedback</h3>
          </div>
          {!showFeedback && (
            <Button size="sm" onClick={() => setShowFeedback(true)}>
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
              Envoyer un feedback
            </Button>
          )}
        </div>

        {showFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Category selection */}
            <div>
              <p className="text-xs font-medium text-foreground-secondary mb-2">Catégorie</p>
              <div className="flex flex-wrap gap-2">
                {FEEDBACK_CATEGORIES.map((cat) => {
                  const Icon = cat.icon
                  return (
                    <button
                      key={cat.value}
                      onClick={() => setFeedbackCategory(cat.value)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        feedbackCategory === cat.value
                          ? 'bg-brand text-white'
                          : 'bg-surface-elevated text-foreground-secondary hover:text-foreground border border-border'
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      {cat.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Message */}
            <div>
              <p className="text-xs font-medium text-foreground-secondary mb-2">Message</p>
              <textarea
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                placeholder="Décrivez votre retour ou suggestion..."
                className="w-full h-28 px-3 py-2.5 text-sm rounded-omni-sm border border-border bg-surface text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
                maxLength={5000}
              />
              <p className="text-[10px] text-foreground-tertiary text-right mt-1">
                {feedbackMessage.length}/5000
              </p>
            </div>

            {feedbackError && (
              <p className="text-xs text-loss">{feedbackError}</p>
            )}

            {feedbackSent ? (
              <div className="flex items-center gap-2 text-gain text-sm">
                <CheckCircle className="h-4 w-4" />
                Merci pour votre retour !
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSendFeedback}
                  disabled={isSendingFeedback || !feedbackMessage.trim()}
                >
                  {isSendingFeedback ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <MessageSquare className="h-4 w-4 mr-1.5" />
                  )}
                  Envoyer
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setShowFeedback(false); setFeedbackMessage('') }}>
                  <X className="h-4 w-4 mr-1.5" />
                  Annuler
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {!showFeedback && (
          <p className="text-xs text-foreground-tertiary">
            Votre feedback nous aide à améliorer OmniFlow. Signaler un bug, proposer une fonctionnalité 
            ou partager vos suggestions.
          </p>
        )}
      </div>

      {/* Links */}
      <div className="rounded-omni-lg border border-border bg-background-tertiary p-5">
        <h3 className="text-base font-semibold text-foreground mb-3">Liens utiles</h3>
        <div className="space-y-2">
          {[
            { label: 'Code source (GitHub)', href: 'https://github.com/omniflow-app' },
            { label: 'Documentation', href: '/docs' },
            { label: 'Security Policy', href: '/.well-known/security.txt' },
          ].map(link => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between py-2 px-3 rounded-omni-sm hover:bg-surface transition-colors text-sm text-foreground-secondary hover:text-foreground"
            >
              {link.label}
              <ExternalLink className="h-3.5 w-3.5 text-foreground-tertiary" />
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
