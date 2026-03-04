'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Download,
  Trash2,
  FileJson,
  AlertTriangle,
  Shield,
  Loader2,
  CheckCircle,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSettingsStore } from '@/stores/settings-store'
import { useAuthStore } from '@/stores/auth-store'

export function RGPDSection() {
  const { isExporting, isDeleting, exportData, fetchPrivacyPolicy, privacyPolicy } = useSettingsStore()
  const { logout } = useAuthStore()

  const [exportDone, setExportDone] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1)
  const [confirmation, setConfirmation] = useState('')
  const [password, setPassword] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPrivacyPolicy()
  }, [fetchPrivacyPolicy])

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [countdown])

  const handleExport = async (anonymize: boolean) => {
    try {
      const data = await exportData(anonymize)
      // Download as JSON
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `omniflow-export-${anonymize ? 'anonymized-' : ''}${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setExportDone(true)
      setTimeout(() => setExportDone(false), 3000)
    } catch {
      setError('Erreur lors de l\'export.')
    }
  }

  const handleDeleteStart = () => {
    setShowDelete(true)
    setDeleteStep(1)
    setConfirmation('')
    setPassword('')
    setCountdown(5)
    setError(null)
  }

  const handleDeleteConfirm = async () => {
    if (confirmation !== 'SUPPRIMER MON COMPTE') {
      setError('Veuillez saisir exactement "SUPPRIMER MON COMPTE"')
      return
    }
    if (!password) {
      setError('Veuillez saisir votre mot de passe')
      return
    }
    try {
      setError(null)
      // The deletion endpoint expects body in DELETE
      // We'll call the store method directly
      await useSettingsStore.getState().deleteAccount(confirmation, password)
      logout()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression')
    }
  }

  return (
    <div className="space-y-6">
      {/* Export Section */}
      <div className="rounded-omni-lg border border-border bg-background-tertiary p-5">
        <div className="flex items-center gap-2 mb-4">
          <FileJson className="h-5 w-5 text-brand" />
          <h3 className="text-base font-semibold text-foreground">Mes données (RGPD Art. 15 & 20)</h3>
        </div>

        <p className="text-sm text-foreground-secondary mb-4">
          Vous pouvez exporter l&apos;intégralité de vos données au format JSON. L&apos;export contient toutes vos 
          informations personnelles, transactions, portefeuilles, et paramètres.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            size="sm"
            onClick={() => handleExport(false)}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : exportDone ? (
              <CheckCircle className="h-4 w-4 mr-2 text-gain" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {exportDone ? 'Exporté !' : 'Exporter mes données'}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleExport(true)}
            disabled={isExporting}
          >
            <Shield className="h-4 w-4 mr-2" />
            Export anonymisé (PII masquées)
          </Button>
        </div>

        <p className="text-xs text-foreground-tertiary mt-3">
          L&apos;export anonymisé masque les adresses email, numéros de téléphone et noms réels.
        </p>
      </div>

      {/* Privacy Policy Link */}
      {privacyPolicy && (
        <div className="rounded-omni-lg border border-border bg-background-tertiary p-5">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-5 w-5 text-info" />
            <h3 className="text-base font-semibold text-foreground">Politique de confidentialité</h3>
          </div>
          <p className="text-sm text-foreground-secondary mb-3">
            Version {privacyPolicy.version} — Dernière mise à jour : {privacyPolicy.last_updated}
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
            {privacyPolicy.sections.map((section, i) => (
              <details key={i} className="group">
                <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-foreground hover:text-brand transition-colors py-1.5">
                  <ExternalLink className="h-3.5 w-3.5 text-foreground-tertiary group-open:text-brand transition-colors" />
                  {section.title}
                </summary>
                <p className="text-xs text-foreground-secondary pl-5.5 pb-2 leading-relaxed">
                  {section.content}
                </p>
              </details>
            ))}
          </div>
          <p className="text-xs text-foreground-tertiary mt-2">
            Contact DPO : {privacyPolicy.dpo_contact}
          </p>
        </div>
      )}

      {/* Danger Zone - Delete Account */}
      <div className="rounded-omni-lg border border-loss/30 bg-loss/5 p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-loss" />
          <h3 className="text-base font-semibold text-loss">Supprimer mon compte (Art. 17)</h3>
        </div>

        <p className="text-sm text-foreground-secondary mb-4">
          Cette action est <strong className="text-loss">irréversible</strong>. Toutes vos données seront définitivement 
          supprimées de nos serveurs (43 tables, toutes les informations personnelles).
        </p>

        {!showDelete ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeleteStart}
            className="text-loss hover:bg-loss/10 hover:text-loss"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer définitivement mon compte
          </Button>
        ) : (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-4"
          >
            {deleteStep === 1 && (
              <>
                <p className="text-sm text-foreground">
                  Saisissez <strong className="text-loss font-mono">SUPPRIMER MON COMPTE</strong> pour confirmer :
                </p>
                <Input
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder="SUPPRIMER MON COMPTE"
                  className="font-mono"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={confirmation !== 'SUPPRIMER MON COMPTE'}
                    onClick={() => { setDeleteStep(2); setCountdown(5) }}
                    className="bg-loss hover:bg-loss/90 text-white"
                  >
                    Continuer
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowDelete(false)}>
                    Annuler
                  </Button>
                </div>
              </>
            )}

            {deleteStep === 2 && (
              <>
                <p className="text-sm text-foreground">
                  Dernière étape : saisissez votre mot de passe pour confirmer.
                </p>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Votre mot de passe"
                />
                {error && (
                  <p className="text-xs text-loss">{error}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={!password || countdown > 0 || isDeleting}
                    onClick={handleDeleteConfirm}
                    className="bg-loss hover:bg-loss/90 text-white"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    {countdown > 0 ? `Attendre ${countdown}s...` : 'Supprimer définitivement'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowDelete(false)}>
                    Annuler
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}
