'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Shield, CheckCircle, X, Loader2, Building2, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useBankStore } from '@/stores/bank-store'
import type { Bank } from '@/types/api'

interface AddBankModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type Step = 'select' | 'credentials' | 'syncing' | '2fa' | 'success'

export function AddBankModal({ isOpen, onClose, onSuccess }: AddBankModalProps) {
  const [step, setStep] = useState<Step>('select')
  const [search, setSearch] = useState('')
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null)
  const [credentials, setCredentials] = useState<Record<string, string>>({})
  const credentialsRef = useRef<Record<string, string>>({})
  const [syncProgress, setSyncProgress] = useState(0)
  const [syncStep, setSyncStep] = useState('')
  const [syncResult, setSyncResult] = useState<{ accounts: number; transactions: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 2FA state
  const [pendingConnectionId, setPendingConnectionId] = useState<string | null>(null)
  const [tfaCode, setTfaCode] = useState(['', '', '', ''])
  const tfaInputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Keep ref in sync with state so handleSync always reads fresh values
  useEffect(() => {
    credentialsRef.current = credentials
  }, [credentials])

  const { banks, fetchBanks, isLoadingBanks, createConnection, verify2FA } = useBankStore()

  useEffect(() => {
    if (isOpen && banks.length === 0) {
      fetchBanks()
    }
  }, [isOpen, banks.length, fetchBanks])

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep('select')
        setSearch('')
        setSelectedBank(null)
        setCredentials({})
        setSyncProgress(0)
        setSyncStep('')
        setSyncResult(null)
        setError(null)
        setPendingConnectionId(null)
        setTfaCode(['', '', '', ''])
      }, 300)
    }
  }, [isOpen])

  const filteredBanks = banks.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelectBank = (bank: Bank) => {
    setSelectedBank(bank)
    setCredentials({})
    setStep('credentials')
  }

  const isTradeRepublic = selectedBank?.module === 'traderepublic'

  const handleSync = async () => {
    if (!selectedBank) return

    // Read credentials from ref (always up-to-date, immune to stale closures)
    const currentCreds = { ...credentialsRef.current }

    // Safety guard: prevent sending empty credentials for Trade Republic
    if (selectedBank.module === 'traderepublic') {
      if (!currentCreds['phone_number']?.trim() || !currentCreds['pin']?.trim()) {
        setError('Veuillez remplir le numéro de téléphone et le code PIN.')
        return
      }
    }

    setStep('syncing')
    setError(null)
    setSyncProgress(0)

    const progressInterval = setInterval(() => {
      setSyncProgress((p) => Math.min(p + 0.5, 90))
    }, 1000)

    const payload = {
      bank_module: selectedBank.module,
      credentials: currentCreds,
    }

    try {
      const result = await createConnection(payload)

      clearInterval(progressInterval)
      setSyncProgress(100)

      if (result.status === 'sca_required' && isTradeRepublic) {
        // Trade Republic needs 2FA code
        setPendingConnectionId(result.connection_id)
        setTfaCode(['', '', '', ''])
        setStep('2fa')
      } else if (result.status === 'active') {
        setSyncResult({
          accounts: result.accounts_synced,
          transactions: result.transactions_synced,
        })
        setStep('success')
      } else {
        setError(result.error || 'Erreur lors de la synchronisation')
        setStep('credentials')
      }
    } catch (e: any) {
      clearInterval(progressInterval)
      setError(e.message || 'Erreur de connexion')
      setStep('credentials')
    }
  }

  // ── 2FA code input handlers ──────────────────────────────
  const handleTfaDigit = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const digit = value.slice(-1)  // Take only last char
    const newCode = [...tfaCode]
    newCode[index] = digit
    setTfaCode(newCode)

    // Auto-focus next input
    if (digit && index < 3) {
      tfaInputRefs.current[index + 1]?.focus()
    }
  }

  const handleTfaKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !tfaCode[index] && index > 0) {
      tfaInputRefs.current[index - 1]?.focus()
    }
  }

  const handleTfaPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    if (pasted.length === 4) {
      setTfaCode(pasted.split(''))
      tfaInputRefs.current[3]?.focus()
    }
  }

  const handleVerify2FA = async () => {
    if (!pendingConnectionId) return
    const code = tfaCode.join('')
    if (code.length !== 4) return

    setStep('syncing')
    setError(null)
    setSyncProgress(0)

    const progressInterval = setInterval(() => {
      setSyncProgress((p) => Math.min(p + 0.5, 95))
    }, 1000)

    try {
      const result = await verify2FA(pendingConnectionId, code)
      clearInterval(progressInterval)
      setSyncProgress(100)

      if (result.status === 'active') {
        setSyncResult({
          accounts: result.accounts_synced,
          transactions: result.transactions_synced,
        })
        setStep('success')
      } else {
        setError(result.error || 'Erreur lors de la synchronisation')
        setTfaCode(['', '', '', ''])
        setStep('2fa')
      }
    } catch (e: any) {
      clearInterval(progressInterval)
      setError(e.message || 'Code invalide')
      setTfaCode(['', '', '', ''])
      setStep('2fa')
    }
  }

  const handleDone = () => {
    onSuccess()
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="relative w-full max-w-lg mx-4 rounded-omni-lg border border-border bg-background-tertiary p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-foreground-tertiary hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Step 1: Select bank */}
          {step === 'select' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-xl font-bold text-foreground mb-1">
                Connecter une banque
              </h2>
              <p className="text-sm text-foreground-secondary mb-5">
                Sélectionnez votre établissement bancaire
              </p>

              <Input
                placeholder="Rechercher une banque..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<Search className="h-4 w-4" />}
              />

              <div className="mt-4 grid grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-1">
                {isLoadingBanks ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-20 animate-pulse rounded-omni-sm bg-surface"
                    />
                  ))
                ) : (
                  filteredBanks.map((bank, i) => (
                    <motion.button
                      key={bank.module}
                      className="flex flex-col items-center justify-center gap-2 rounded-omni-sm border border-border bg-background p-4 hover:border-brand hover:bg-surface transition-all"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.3) }}
                      onClick={() => handleSelectBank(bank)}
                    >
                      {bank.logo_url ? (
                        <Image
                          src={bank.logo_url}
                          alt={bank.name}
                          width={32}
                          height={32}
                          className="h-8 w-8 object-contain rounded-md"
                          unoptimized
                        />
                      ) : (
                        <Building2 className="h-8 w-8 text-brand" />
                      )}
                      <span className="text-xs font-medium text-foreground text-center leading-tight">
                        {bank.name}
                      </span>
                    </motion.button>
                  ))
                )}
              </div>

              {filteredBanks.length === 0 && !isLoadingBanks && (
                <p className="text-center text-sm text-foreground-tertiary py-8">
                  Aucune banque trouvée pour &quot;{search}&quot;
                </p>
              )}
            </motion.div>
          )}

          {/* Step 2: Credentials */}
          {step === 'credentials' && selectedBank && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <div className="flex items-center gap-3 mb-1">
                {selectedBank.logo_url && (
                  <Image
                    src={selectedBank.logo_url}
                    alt={selectedBank.name}
                    width={36}
                    height={36}
                    className="h-9 w-9 object-contain rounded-lg"
                    unoptimized
                  />
                )}
                <h2 className="text-xl font-bold text-foreground">
                  {selectedBank.name}
                </h2>
              </div>
              <p className="text-sm text-foreground-secondary mb-5">
                {isTradeRepublic
                  ? 'Entrez vos identifiants Trade Republic'
                  : 'Entrez vos identifiants bancaires'}
              </p>

              {/* Privacy notice */}
              <div className="flex items-start gap-3 rounded-omni-sm bg-brand/10 border border-brand/20 p-3 mb-5">
                <Shield className="h-5 w-5 text-brand mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-brand">Vos données sont protégées</p>
                  <p className="text-xs text-foreground-secondary mt-0.5">
                    {isTradeRepublic
                      ? 'Vos identifiants sont chiffrés AES-256. Après connexion, un code 2FA apparaîtra dans votre app Trade Republic.'
                      : 'Vos identifiants sont chiffrés AES-256 et ne sont jamais stockés en clair. Connexion sécurisée via le protocole Woob open-source.'}
                  </p>
                </div>
              </div>

              {error && (
                <div className="mb-4 rounded-omni-sm bg-loss/10 border border-loss/20 p-3 text-sm text-loss">
                  {error}
                </div>
              )}

              {isTradeRepublic ? (
                <div className="space-y-4">
                  {/* Phone number field with helper */}
                  <div className="space-y-1.5">
                    <Input
                      label="Numéro de téléphone"
                      type="text"
                      placeholder="+33612345678"
                      value={credentials['phone_number'] || ''}
                      onChange={(e) =>
                        setCredentials((prev) => ({
                          ...prev,
                          phone_number: e.target.value,
                        }))
                      }
                    />
                    <p className="text-xs text-foreground-tertiary pl-1">
                      Format international avec indicatif pays.{' '}
                      <span className="text-foreground-secondary font-medium">
                        Exemples : +33612345678, 0612345678, +4917612345678
                      </span>
                    </p>
                  </div>

                  {/* PIN field with helper */}
                  <div className="space-y-1.5">
                    <Input
                      label="Code PIN"
                      type="password"
                      placeholder="••••"
                      value={credentials['pin'] || ''}
                      onChange={(e) => {
                        // Only allow digits, max 4
                        const val = e.target.value.replace(/\D/g, '').slice(0, 4)
                        setCredentials((prev) => ({
                          ...prev,
                          pin: val,
                        }))
                      }}
                      maxLength={4}
                    />
                    <p className="text-xs text-foreground-tertiary pl-1">
                      Le code PIN à 4 chiffres de votre app Trade Republic.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedBank.fields.map((field) =>
                    field.type === 'select' && field.choices ? (
                      <div key={field.id} className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-foreground-secondary">
                          {field.label}
                        </label>
                        <select
                          className="flex h-10 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-foreground-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0"
                          value={credentials[field.id] || ''}
                          onChange={(e) =>
                            setCredentials((prev) => ({
                              ...prev,
                              [field.id]: e.target.value,
                            }))
                          }
                        >
                          <option value="" disabled>
                            {field.placeholder}
                          </option>
                          {Object.entries(field.choices).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <Input
                        key={field.id}
                        label={field.label}
                        type={field.type === 'tel' ? 'text' : field.type}
                        placeholder={field.placeholder}
                        pattern={field.pattern}
                        value={credentials[field.id] || ''}
                        onChange={(e) =>
                          setCredentials((prev) => ({
                            ...prev,
                            [field.id]: e.target.value,
                          }))
                        }
                      />
                    )
                  )}
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={() => setStep('select')}
                  className="flex-1"
                >
                  Retour
                </Button>
                <Button
                  onClick={handleSync}
                  className="flex-1"
                  disabled={
                    isTradeRepublic
                      ? !(credentials['phone_number']?.trim() && credentials['pin']?.trim()?.length === 4)
                      : selectedBank.fields.some((f) => !credentials[f.id]?.trim())
                  }
                >
                  {isTradeRepublic ? 'Recevoir le code 2FA' : 'Connecter'}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 2.5: 2FA Code Entry (Trade Republic) */}
          {step === '2fa' && selectedBank && (
            <motion.div
              className="flex flex-col items-center py-4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div className="w-14 h-14 rounded-full bg-brand/10 flex items-center justify-center mb-4">
                <Smartphone className="h-7 w-7 text-brand" />
              </div>

              <h2 className="text-lg font-bold text-foreground mb-1">
                Vérification 2FA
              </h2>
              <p className="text-sm text-foreground-secondary text-center mb-6 max-w-xs">
                Ouvrez l&apos;app <span className="font-semibold text-foreground">Trade Republic</span> sur votre téléphone.
                Un code à 4 chiffres s&apos;affiche dans la notification.
              </p>
              <div className="w-full rounded-omni-sm bg-brand/5 border border-brand/10 p-3 mb-4">
                <p className="text-xs text-foreground-secondary text-center">
                  📱 Le code apparaît dans l&apos;app Trade Republic, <strong>pas par SMS</strong>.
                  Si vous ne voyez pas de notification, ouvrez directement l&apos;app.
                </p>
              </div>

              {error && (
                <div className="mb-4 w-full rounded-omni-sm bg-loss/10 border border-loss/20 p-3 text-sm text-loss text-center">
                  {error}
                </div>
              )}

              {/* 4-digit code input */}
              <div className="flex gap-3 mb-6" onPaste={handleTfaPaste}>
                {[0, 1, 2, 3].map((i) => (
                  <input
                    key={i}
                    ref={(el) => { tfaInputRefs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={tfaCode[i]}
                    onChange={(e) => handleTfaDigit(i, e.target.value)}
                    onKeyDown={(e) => handleTfaKeyDown(i, e)}
                    className="w-14 h-16 text-center text-2xl font-bold rounded-omni-sm border border-border bg-background text-foreground focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition-all"
                    autoFocus={i === 0}
                  />
                ))}
              </div>

              <div className="flex gap-3 w-full">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setStep('credentials')
                    setError(null)
                  }}
                  className="flex-1"
                >
                  Retour
                </Button>
                <Button
                  onClick={handleVerify2FA}
                  disabled={tfaCode.join('').length !== 4}
                  className="flex-1"
                >
                  Vérifier
                </Button>
              </div>

              <p className="text-xs text-foreground-tertiary mt-4 text-center">
                Le code expire après quelques minutes. Si vous ne le voyez pas,
                ouvrez l&apos;app Trade Republic ou revenez en arrière pour réessayer.
              </p>
            </motion.div>
          )}

          {/* Step 3: Syncing */}
          {step === 'syncing' && (
            <motion.div
              className="flex flex-col items-center py-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                <Loader2 className="h-12 w-12 text-brand" />
              </motion.div>
              <h2 className="text-lg font-bold text-foreground mt-5">
                {isTradeRepublic && syncProgress < 30
                  ? 'Connexion à Trade Republic...'
                  : 'Synchronisation en cours...'}
              </h2>
              <p className="text-sm text-foreground-secondary mt-1">
                {syncProgress < 30
                  ? isTradeRepublic ? 'Envoi de la demande 2FA à votre app TR...' : 'Connexion à votre banque...'
                  : syncProgress < 60
                    ? 'Récupération de vos comptes...'
                    : syncProgress < 90
                      ? 'Récupération des transactions...'
                      : 'Finalisation...'}
              </p>

              <div className="w-full mt-6 h-2 rounded-full bg-surface overflow-hidden">
                <motion.div
                  className="h-full bg-brand rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${syncProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className="text-xs text-foreground-tertiary mt-2">{syncProgress}%</p>
            </motion.div>
          )}

          {/* Step 4: Success */}
          {step === 'success' && syncResult && (
            <motion.div
              className="flex flex-col items-center py-8"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
              >
                <CheckCircle className="h-16 w-16 text-gain" />
              </motion.div>
              <h2 className="text-lg font-bold text-foreground mt-5">
                Connexion réussie ! 🎉
              </h2>
              <p className="text-sm text-foreground-secondary mt-1 text-center">
                {syncResult.accounts} compte{syncResult.accounts > 1 ? 's' : ''} et{' '}
                {syncResult.transactions} transaction{syncResult.transactions > 1 ? 's' : ''}{' '}
                synchronisé{syncResult.transactions > 1 ? 's' : ''}
              </p>

              <Button onClick={handleDone} className="mt-6 w-full">
                Voir mon dashboard
              </Button>
              <button
                onClick={() => {
                  setStep('select')
                  setSelectedBank(null)
                }}
                className="mt-3 text-sm text-brand hover:text-brand-light transition-colors"
              >
                Ajouter une autre banque
              </button>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
