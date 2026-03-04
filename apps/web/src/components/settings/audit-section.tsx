'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  LogIn,
  LogOut,
  UserPlus,
  Download,
  Trash2,
  Shield,
  Key,
  Activity,
  Loader2,
  ChevronDown,
  Monitor,
  MessageSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSettingsStore } from '@/stores/settings-store'

const ACTION_CONFIG: Record<string, { icon: typeof LogIn; color: string; label: string }> = {
  login_success: { icon: LogIn, color: 'text-gain', label: 'Connexion réussie' },
  login_failed: { icon: LogIn, color: 'text-loss', label: 'Tentative échouée' },
  register: { icon: UserPlus, color: 'text-brand', label: 'Inscription' },
  logout: { icon: LogOut, color: 'text-foreground-secondary', label: 'Déconnexion' },
  data_export: { icon: Download, color: 'text-info', label: 'Export données' },
  account_deleted: { icon: Trash2, color: 'text-loss', label: 'Suppression compte' },
  consent_updated: { icon: Shield, color: 'text-warning', label: 'Consentements modifiés' },
  password_change: { icon: Key, color: 'text-warning', label: 'Mot de passe changé' },
  feedback_submitted: { icon: MessageSquare, color: 'text-brand', label: 'Feedback envoyé' },
}

const ACTION_FILTERS = [
  { value: '', label: 'Toutes les actions' },
  { value: 'login_success', label: 'Connexions' },
  { value: 'login_failed', label: 'Tentatives échouées' },
  { value: 'register', label: 'Inscriptions' },
  { value: 'logout', label: 'Déconnexions' },
  { value: 'password_change', label: 'Mot de passe' },
  { value: 'data_export', label: 'Exports' },
  { value: 'consent_updated', label: 'Consentements' },
]

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffMin < 1) return 'À l\'instant'
  if (diffMin < 60) return `Il y a ${diffMin}min`
  if (diffHour < 24) return `Il y a ${diffHour}h`
  if (diffDay < 7) return `Il y a ${diffDay}j`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function AuditSection() {
  const { auditEntries, auditTotal, isLoadingAudit, fetchAuditLog } = useSettingsStore()
  const [actionFilter, setActionFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetchAuditLog(0, 10, actionFilter || undefined)
  }, [fetchAuditLog, actionFilter])

  const loadMore = useCallback(() => {
    fetchAuditLog(auditEntries.length, 10, actionFilter || undefined)
  }, [fetchAuditLog, auditEntries.length, actionFilter])

  const handleFilterChange = (value: string) => {
    setActionFilter(value)
    // Reset is handled by the useEffect dependency
  }

  return (
    <div className="space-y-6">
      <div className="rounded-omni-lg border border-border bg-background-tertiary p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-brand" />
            <h3 className="text-base font-semibold text-foreground">Journal d&apos;activité</h3>
          </div>
          <span className="text-xs text-foreground-tertiary">
            {auditTotal} événement{auditTotal !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Filter */}
        <div className="mb-4">
          <select
            value={actionFilter}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-sm rounded-omni-sm border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30"
          >
            {ACTION_FILTERS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>

        {/* Timeline */}
        {isLoadingAudit && auditEntries.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-brand" />
          </div>
        ) : auditEntries.length === 0 ? (
          <p className="text-sm text-foreground-tertiary text-center py-8">
            Aucune activité enregistrée.
          </p>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

            <div className="space-y-1">
              {auditEntries.map((entry, i) => {
                const config = ACTION_CONFIG[entry.action] || {
                  icon: Activity,
                  color: 'text-foreground-secondary',
                  label: entry.action,
                }
                const Icon = config.icon
                const isExpanded = expandedId === entry.id

                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <button
                      className="w-full text-left flex items-start gap-3 p-2.5 rounded-omni-sm hover:bg-surface transition-colors relative"
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    >
                      <div className={`z-10 flex-shrink-0 h-10 w-10 rounded-full bg-surface-elevated border border-border flex items-center justify-center ${config.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">{config.label}</p>
                          <span
                            className="text-[11px] text-foreground-tertiary flex-shrink-0"
                            title={new Date(entry.created_at).toLocaleString('fr-FR')}
                          >
                            {formatRelativeTime(entry.created_at)}
                          </span>
                        </div>

                        {entry.resource_type && (
                          <p className="text-xs text-foreground-tertiary mt-0.5">
                            {entry.resource_type}
                            {entry.resource_id ? ` · ${entry.resource_id.slice(0, 8)}...` : ''}
                          </p>
                        )}

                        {/* Expanded details */}
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-2 p-3 rounded-omni-sm bg-surface-elevated border border-border text-xs space-y-1.5"
                          >
                            {entry.ip_address && (
                              <div className="flex items-center gap-2">
                                <Monitor className="h-3 w-3 text-foreground-tertiary" />
                                <span className="text-foreground-secondary">IP: {entry.ip_address}</span>
                              </div>
                            )}
                            {entry.user_agent && (
                              <p className="text-foreground-tertiary truncate">
                                UA: {entry.user_agent.slice(0, 80)}
                                {entry.user_agent.length > 80 ? '...' : ''}
                              </p>
                            )}
                            {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                              <pre className="text-foreground-tertiary bg-surface p-2 rounded text-[10px] overflow-x-auto">
                                {JSON.stringify(entry.metadata, null, 2)}
                              </pre>
                            )}
                            <p className="text-foreground-tertiary">
                              {new Date(entry.created_at).toLocaleString('fr-FR', {
                                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                                hour: '2-digit', minute: '2-digit', second: '2-digit',
                              })}
                            </p>
                          </motion.div>
                        )}
                      </div>
                    </button>
                  </motion.div>
                )
              })}
            </div>

            {/* Load more */}
            {auditEntries.length < auditTotal && (
              <div className="flex justify-center mt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadMore}
                  disabled={isLoadingAudit}
                >
                  {isLoadingAudit ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ChevronDown className="h-4 w-4 mr-2" />
                  )}
                  Charger plus ({auditTotal - auditEntries.length} restant{auditTotal - auditEntries.length > 1 ? 's' : ''})
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
