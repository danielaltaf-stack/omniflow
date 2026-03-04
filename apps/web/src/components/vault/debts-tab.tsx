'use client'

import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, Trash2, ArrowUpRight, ArrowDownLeft, Check, Users, CalendarClock, AlertTriangle, HandCoins, Phone, Mail } from 'lucide-react'
import { useVaultStore } from '@/stores/vault-store'
import { VaultWizard, WizardField, WizardGrid, WizardSection, wizardInputCls, wizardSelectCls } from '@/components/vault/vault-wizard'
import { Button } from '@/components/ui/button'
import type { PeerDebt } from '@/types/api'

const fmt = (c: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(c / 100)

const WIZARD_STEPS = [
  { id: 'direction', label: 'Type' },
  { id: 'details', label: 'Détails' },
  { id: 'terms', label: 'Conditions' },
]

export default function DebtsTab() {
  const { peerDebts, createPeerDebt, deletePeerDebt, settlePeerDebt, isLoading } = useVaultStore()
  const [showWizard, setShowWizard] = useState(false)
  const [step, setStep] = useState(0)
  const [search, setSearch] = useState('')
  const [filterDir, setFilterDir] = useState<'' | 'lent' | 'borrowed'>('')

  const [form, setForm] = useState({
    direction: '' as '' | 'lent' | 'borrowed',
    counterparty_name: '', counterparty_email: '', counterparty_phone: '',
    amount: '', currency: 'EUR', description: '',
    due_date: '', reminder_enabled: true,
    reminder_interval_days: '7', notes: '',
  })

  const resetForm = () => {
    setStep(0)
    setForm({ direction: '', counterparty_name: '', counterparty_email: '', counterparty_phone: '', amount: '', currency: 'EUR', description: '', due_date: '', reminder_enabled: true, reminder_interval_days: '7', notes: '' })
  }

  const handleCreate = useCallback(async () => {
    if (!form.counterparty_name || !form.amount || !form.direction) return
    await createPeerDebt({
      counterparty_name: form.counterparty_name,
      counterparty_email: form.counterparty_email || undefined,
      counterparty_phone: form.counterparty_phone || undefined,
      direction: form.direction as 'lent' | 'borrowed',
      amount: Math.round(parseFloat(form.amount) * 100),
      currency: form.currency,
      description: form.description || undefined,
      due_date: form.due_date || undefined,
      reminder_enabled: form.reminder_enabled,
      reminder_interval_days: parseInt(form.reminder_interval_days) || 7,
      notes: form.notes || undefined,
    })
    setShowWizard(false)
    resetForm()
  }, [form, createPeerDebt])

  const canAdvance = step === 0 ? !!form.direction : step === 1 ? !!(form.counterparty_name && form.amount) : true

  // Stats
  const totalLent = useMemo(() => peerDebts.filter((d) => d.direction === 'lent' && !d.is_settled).reduce((t, d) => t + d.amount, 0), [peerDebts])
  const totalBorrowed = useMemo(() => peerDebts.filter((d) => d.direction === 'borrowed' && !d.is_settled).reduce((t, d) => t + d.amount, 0), [peerDebts])
  const overdueCount = peerDebts.filter((d) => d.is_overdue && !d.is_settled).length
  const settledCount = peerDebts.filter((d) => d.is_settled).length

  const filtered = peerDebts.filter((d) => {
    if (search) {
      const q = search.toLowerCase()
      if (!d.counterparty_name.toLowerCase().includes(q) && !(d.description || '').toLowerCase().includes(q)) return false
    }
    if (filterDir && d.direction !== filterDir) return false
    return true
  })

  // Group: active first, then settled
  const active = filtered.filter((d) => !d.is_settled)
  const settled = filtered.filter((d) => d.is_settled)

  return (
    <div className="flex flex-col gap-4">
      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-omni bg-gain/5 border border-gain/20">
          <p className="text-xs text-foreground-tertiary flex items-center gap-1"><ArrowUpRight className="h-3 w-3 text-gain" /> Prêté</p>
          <p className="text-lg font-bold text-gain">{fmt(totalLent)}</p>
        </div>
        <div className="p-3 rounded-omni bg-loss/5 border border-loss/20">
          <p className="text-xs text-foreground-tertiary flex items-center gap-1"><ArrowDownLeft className="h-3 w-3 text-loss" /> Emprunté</p>
          <p className="text-lg font-bold text-loss">{fmt(totalBorrowed)}</p>
        </div>
        <div className="p-3 rounded-omni bg-surface border border-border">
          <p className="text-xs text-foreground-tertiary">Solde net</p>
          <p className={`text-lg font-bold ${totalLent - totalBorrowed >= 0 ? 'text-gain' : 'text-loss'}`}>{fmt(totalLent - totalBorrowed)}</p>
        </div>
        {overdueCount > 0 && (
          <div className="p-3 rounded-omni bg-warning/5 border border-warning/20">
            <p className="text-xs text-warning">En retard</p>
            <p className="text-lg font-bold text-warning">{overdueCount}</p>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-tertiary" />
            <input className={`${wizardInputCls} pl-9`} placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className={`${wizardSelectCls} max-w-[140px]`} value={filterDir} onChange={(e) => setFilterDir(e.target.value as any)}>
            <option value="">Tous</option>
            <option value="lent">Prêts</option>
            <option value="borrowed">Emprunts</option>
          </select>
        </div>
        <Button onClick={() => setShowWizard(true)}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter
        </Button>
      </div>

      {/* Debts list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-foreground-tertiary">
          <HandCoins className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-lg font-medium">Aucune dette</p>
          <p className="text-sm">Suivez vos prêts et emprunts entre amis, famille ou collègues</p>
        </div>
      ) : (
        <div className="space-y-4">
          {active.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground-tertiary uppercase tracking-wider">En cours ({active.length})</p>
              <AnimatePresence>
                {active.map((d, i) => (
                  <DebtRow key={d.id} debt={d} index={i} onDelete={deletePeerDebt} onSettle={settlePeerDebt} />
                ))}
              </AnimatePresence>
            </div>
          )}
          {settled.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground-tertiary uppercase tracking-wider">Réglés ({settled.length})</p>
              <AnimatePresence>
                {settled.map((d, i) => (
                  <DebtRow key={d.id} debt={d} index={i} onDelete={deletePeerDebt} onSettle={settlePeerDebt} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* Wizard */}
      <VaultWizard
        open={showWizard}
        onClose={() => { setShowWizard(false); resetForm() }}
        title="Ajouter une dette"
        subtitle="Prêt ou emprunt entre proches"
        steps={WIZARD_STEPS}
        currentStep={step}
        onStepChange={setStep}
        onSubmit={handleCreate}
        canAdvance={canAdvance}
        isSubmitting={isLoading}
        accent="bg-emerald-500"
      >
        {step === 0 && (
          <WizardSection>
            <p className="text-sm text-foreground-secondary mb-4">Quel type de dette ?</p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setForm((f) => ({ ...f, direction: 'lent' }))}
                className={`flex flex-col items-center gap-3 p-6 rounded-omni-lg border-2 transition-all ${form.direction === 'lent' ? 'border-gain bg-gain/10' : 'border-border hover:border-foreground-tertiary'}`}
              >
                <div className="w-14 h-14 rounded-full bg-gain/20 flex items-center justify-center">
                  <ArrowUpRight className="h-7 w-7 text-gain" />
                </div>
                <div className="text-center">
                  <p className="font-semibold">J&apos;ai prêté</p>
                  <p className="text-xs text-foreground-tertiary">Quelqu&apos;un me doit de l&apos;argent</p>
                </div>
              </button>
              <button
                onClick={() => setForm((f) => ({ ...f, direction: 'borrowed' }))}
                className={`flex flex-col items-center gap-3 p-6 rounded-omni-lg border-2 transition-all ${form.direction === 'borrowed' ? 'border-loss bg-loss/10' : 'border-border hover:border-foreground-tertiary'}`}
              >
                <div className="w-14 h-14 rounded-full bg-loss/20 flex items-center justify-center">
                  <ArrowDownLeft className="h-7 w-7 text-loss" />
                </div>
                <div className="text-center">
                  <p className="font-semibold">J&apos;ai emprunté</p>
                  <p className="text-xs text-foreground-tertiary">Je dois de l&apos;argent</p>
                </div>
              </button>
            </div>
          </WizardSection>
        )}

        {step === 1 && (
          <WizardSection title="Détails">
            <WizardGrid>
              <WizardField label="Nom de la personne" required>
                <input className={wizardInputCls} value={form.counterparty_name} onChange={(e) => setForm((f) => ({ ...f, counterparty_name: e.target.value }))} placeholder="Jean Dupont" />
              </WizardField>
              <WizardField label="Montant (€)" required>
                <input type="number" step="0.01" className={wizardInputCls} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="50.00" />
              </WizardField>
            </WizardGrid>
            <WizardGrid>
              <WizardField label="Email" hint="Optionnel">
                <input type="email" className={wizardInputCls} value={form.counterparty_email} onChange={(e) => setForm((f) => ({ ...f, counterparty_email: e.target.value }))} placeholder="jean@email.com" />
              </WizardField>
              <WizardField label="Téléphone" hint="Optionnel">
                <input type="tel" className={wizardInputCls} value={form.counterparty_phone} onChange={(e) => setForm((f) => ({ ...f, counterparty_phone: e.target.value }))} placeholder="06 12 34 56 78" />
              </WizardField>
            </WizardGrid>
            <WizardField label="Description">
              <input className={wizardInputCls} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Remboursement repas, voyage..." />
            </WizardField>
          </WizardSection>
        )}

        {step === 2 && (
          <WizardSection title="Conditions">
            <WizardField label="Date d'échéance" hint="Optionnel">
              <input type="date" className={wizardInputCls} value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
            </WizardField>
            <div className="flex items-center gap-3 p-3 rounded-omni bg-surface border border-border">
              <input type="checkbox" checked={form.reminder_enabled} onChange={(e) => setForm((f) => ({ ...f, reminder_enabled: e.target.checked }))} className="accent-brand" />
              <span className="text-sm">Activer les rappels</span>
              {form.reminder_enabled && (
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-foreground-tertiary">Tous les</span>
                  <input type="number" min={1} max={90} className={`${wizardInputCls} w-16 text-center`} value={form.reminder_interval_days} onChange={(e) => setForm((f) => ({ ...f, reminder_interval_days: e.target.value }))} />
                  <span className="text-xs text-foreground-tertiary">jours</span>
                </div>
              )}
            </div>
            <WizardField label="Notes">
              <textarea className={`${wizardInputCls} min-h-[60px] resize-none`} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Conditions spéciales..." />
            </WizardField>
          </WizardSection>
        )}
      </VaultWizard>
    </div>
  )
}

/* ── Debt Row ─────────────────────────────────────────── */

function DebtRow({ debt: d, index, onDelete, onSettle }: {
  debt: PeerDebt; index: number; onDelete: (id: string) => void; onSettle: (id: string, data: any) => void
}) {
  const isLent = d.direction === 'lent'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ delay: index * 0.03 }}
      className={`group flex items-center gap-4 p-4 rounded-omni border transition-all ${d.is_settled ? 'opacity-50 border-border bg-surface' : d.is_overdue ? 'border-warning/30 bg-warning/5' : 'border-border bg-surface hover:border-emerald-500/30'}`}
    >
      {/* Direction icon */}
      <div className={`flex items-center justify-center w-10 h-10 rounded-full ${isLent ? 'bg-gain/15' : 'bg-loss/15'}`}>
        {isLent ? <ArrowUpRight className="h-5 w-5 text-gain" /> : <ArrowDownLeft className="h-5 w-5 text-loss" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm truncate">{d.counterparty_name}</h3>
          {d.is_settled && <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-gain/20 text-gain"><Check className="h-3 w-3" /> Réglé</span>}
          {d.is_overdue && !d.is_settled && <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-warning/20 text-warning"><AlertTriangle className="h-3 w-3" /> {d.days_overdue}j retard</span>}
        </div>
        <p className="text-xs text-foreground-tertiary truncate">
          {d.description || (isLent ? 'Prêt' : 'Emprunt')}
          {d.due_date && <> • Échéance: {new Date(d.due_date).toLocaleDateString('fr-FR')}</>}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {d.counterparty_email && <Mail className="h-3 w-3 text-foreground-tertiary" />}
          {d.counterparty_phone && <Phone className="h-3 w-3 text-foreground-tertiary" />}
          {d.reminder_enabled && <CalendarClock className="h-3 w-3 text-info" />}
        </div>
      </div>

      {/* Amount */}
      <div className="text-right shrink-0">
        <p className={`text-lg font-bold ${isLent ? 'text-gain' : 'text-loss'}`}>{isLent ? '+' : '-'}{fmt(d.amount)}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {!d.is_settled && (
          <button
            onClick={() => onSettle(d.id, { settled_amount: d.amount })}
            className="p-1.5 rounded-omni-sm hover:bg-gain/10 text-foreground-tertiary hover:text-gain transition-all"
            title="Marquer comme réglé"
          >
            <Check className="h-4 w-4" />
          </button>
        )}
        <button onClick={() => onDelete(d.id)} className="p-1.5 rounded-omni-sm opacity-0 group-hover:opacity-100 hover:bg-loss/10 text-foreground-tertiary hover:text-loss transition-all">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  )
}
