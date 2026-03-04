'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, Trash2, Star, Plane, ShoppingBag, Building2, Fuel, GraduationCap, Gift, AlertTriangle, Clock } from 'lucide-react'
import { useVaultStore } from '@/stores/vault-store'
import { VaultWizard, WizardField, WizardGrid, WizardSection, wizardInputCls, wizardSelectCls } from '@/components/vault/vault-wizard'
import { Button } from '@/components/ui/button'
import type { LoyaltyProgram } from '@/types/api'

const fmt = (c: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(c / 100)
const fmtPts = (n: number) => new Intl.NumberFormat('fr-FR').format(n)

const PROGRAM_TYPES = [
  { value: 'airline', label: 'Compagnie aérienne', icon: Plane, gradient: 'from-sky-500 to-blue-600', emoji: '✈️' },
  { value: 'hotel', label: 'Hôtellerie', icon: Building2, gradient: 'from-amber-500 to-orange-600', emoji: '🏨' },
  { value: 'retail', label: 'Commerce', icon: ShoppingBag, gradient: 'from-pink-500 to-rose-600', emoji: '🛍️' },
  { value: 'bank', label: 'Banque', icon: Building2, gradient: 'from-emerald-500 to-teal-600', emoji: '🏦' },
  { value: 'fuel', label: 'Carburant', icon: Fuel, gradient: 'from-orange-500 to-red-600', emoji: '⛽' },
  { value: 'other', label: 'Autre', icon: Gift, gradient: 'from-purple-500 to-indigo-600', emoji: '🎁' },
]

const POPULAR_PROGRAMS = [
  { name: 'Flying Blue', provider: 'Air France-KLM', type: 'airline', unit: 'Miles', eur: 0.01 },
  { name: 'Miles & More', provider: 'Lufthansa', type: 'airline', unit: 'Miles', eur: 0.01 },
  { name: 'Avios', provider: 'British Airways', type: 'airline', unit: 'Avios', eur: 0.015 },
  { name: 'SkyMiles', provider: 'Delta', type: 'airline', unit: 'Miles', eur: 0.011 },
  { name: 'Marriott Bonvoy', provider: 'Marriott', type: 'hotel', unit: 'Points', eur: 0.007 },
  { name: 'World of Hyatt', provider: 'Hyatt', type: 'hotel', unit: 'Points', eur: 0.02 },
  { name: 'Hilton Honors', provider: 'Hilton', type: 'hotel', unit: 'Points', eur: 0.005 },
  { name: 'Accor Live Limitless', provider: 'Accor', type: 'hotel', unit: 'Points', eur: 0.02 },
  { name: 'Carte Fidélité Leclerc', provider: 'E.Leclerc', type: 'retail', unit: '€', eur: 1 },
  { name: 'Carte Carrefour', provider: 'Carrefour', type: 'retail', unit: '€', eur: 1 },
  { name: 'Carte U', provider: 'Super U / Hyper U', type: 'retail', unit: '€', eur: 1 },
  { name: 'Carte Fnac+', provider: 'Fnac', type: 'retail', unit: '€', eur: 1 },
  { name: 'Sephora Beauty Insider', provider: 'Sephora', type: 'retail', unit: 'Points', eur: 0.02 },
  { name: 'Programme Total Energies', provider: 'TotalEnergies', type: 'fuel', unit: 'Points', eur: 0.005 },
  { name: 'Carte SMILES', provider: 'Shell', type: 'fuel', unit: 'Points', eur: 0.005 },
]

const WIZARD_STEPS = [
  { id: 'type', label: 'Programme' },
  { id: 'details', label: 'Détails' },
  { id: 'points', label: 'Solde' },
]

export default function LoyaltyTab() {
  const { loyalty: loyaltyPrograms, createLoyalty: createLoyaltyProgram, deleteLoyalty: deleteLoyaltyProgram, isLoading } = useVaultStore()
  const [showWizard, setShowWizard] = useState(false)
  const [step, setStep] = useState(0)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')

  const [form, setForm] = useState({
    program_name: '', provider: '', program_type: '' as string,
    points_balance: '', points_unit: 'Points', eur_per_point: '',
    expiry_date: '', notes: '',
  })

  const resetForm = () => {
    setStep(0)
    setForm({ program_name: '', provider: '', program_type: '', points_balance: '', points_unit: 'Points', eur_per_point: '', expiry_date: '', notes: '' })
  }

  const selectPopular = useCallback((p: typeof POPULAR_PROGRAMS[0]) => {
    setForm((f) => ({
      ...f, program_name: p.name, provider: p.provider, program_type: p.type,
      points_unit: p.unit, eur_per_point: p.eur.toString(),
    }))
    setStep(2)
  }, [])

  const handleCreate = useCallback(async () => {
    if (!form.program_name || !form.provider) return
    await createLoyaltyProgram({
      program_name: form.program_name,
      provider: form.provider,
      program_type: form.program_type || 'other',
      points_balance: form.points_balance ? parseInt(form.points_balance) : 0,
      points_unit: form.points_unit || 'Points',
      eur_per_point: form.eur_per_point ? parseFloat(form.eur_per_point) : 0,
      expiry_date: form.expiry_date || undefined,
      notes: form.notes || undefined,
    })
    setShowWizard(false)
    resetForm()
  }, [form, createLoyaltyProgram])

  const canAdvance = step === 0 ? !!form.program_type : step === 1 ? !!(form.program_name && form.provider) : true

  const filtered = loyaltyPrograms.filter((p) => {
    if (search) {
      const q = search.toLowerCase()
      if (!p.program_name.toLowerCase().includes(q) && !p.provider.toLowerCase().includes(q)) return false
    }
    if (filterType && p.program_type !== filterType) return false
    return true
  })

  const totalValue = loyaltyPrograms.reduce((s, p) => s + (p.estimated_value || 0), 0)

  return (
    <div className="flex flex-col gap-4">
      {/* Summary bar */}
      <div className="flex items-center gap-4 p-4 rounded-omni bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
        <Star className="h-8 w-8 text-amber-400" />
        <div>
          <p className="text-xs text-foreground-tertiary">Valeur totale estimée</p>
          <p className="text-xl font-bold text-amber-400">{fmt(totalValue)}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-foreground-tertiary">Programmes actifs</p>
          <p className="text-lg font-bold">{loyaltyPrograms.length}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-tertiary" />
            <input className={`${wizardInputCls} pl-9`} placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className={`${wizardSelectCls} max-w-[160px]`} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">Tous types</option>
            {PROGRAM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
          </select>
        </div>
        <Button onClick={() => setShowWizard(true)}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter un programme
        </Button>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-foreground-tertiary">
          <Star className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-lg font-medium">Aucun programme de fidélité</p>
          <p className="text-sm">Ajoutez vos cartes de fidélité, miles aériens et points hôtels</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {filtered.map((p, i) => (
              <LoyaltyCard key={p.id} program={p} index={i} onDelete={deleteLoyaltyProgram} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Wizard */}
      <VaultWizard
        open={showWizard}
        onClose={() => { setShowWizard(false); resetForm() }}
        title="Programme de fidélité"
        subtitle="Ajoutez vos programmes et suivez vos points"
        steps={WIZARD_STEPS}
        currentStep={step}
        onStepChange={setStep}
        onSubmit={handleCreate}
        canAdvance={canAdvance}
        isSubmitting={isLoading}
        accent="bg-amber-500"
      >
        {step === 0 && (
          <WizardSection>
            <p className="text-sm text-foreground-secondary mb-3">Type de programme :</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {PROGRAM_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setForm((f) => ({ ...f, program_type: t.value }))}
                  className={`flex flex-col items-center gap-2 p-4 rounded-omni border-2 transition-all ${form.program_type === t.value ? 'border-amber-500 bg-amber-500/10' : 'border-border hover:border-foreground-tertiary'}`}
                >
                  <span className="text-2xl">{t.emoji}</span>
                  <span className="text-xs font-medium">{t.label}</span>
                </button>
              ))}
            </div>

            <p className="text-sm text-foreground-secondary mb-2">Programmes populaires :</p>
            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {POPULAR_PROGRAMS.filter((p) => !form.program_type || p.type === form.program_type).map((p) => (
                <button key={p.name} onClick={() => selectPopular(p)} className="w-full flex items-center gap-3 p-2.5 rounded-omni-sm bg-background hover:bg-surface border border-border hover:border-amber-500/50 transition-all text-left">
                  <span className="text-lg">{PROGRAM_TYPES.find((t) => t.value === p.type)?.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-foreground-tertiary">{p.provider}</p>
                  </div>
                </button>
              ))}
            </div>
          </WizardSection>
        )}

        {step === 1 && (
          <WizardSection title="Informations du programme">
            <WizardGrid>
              <WizardField label="Nom du programme" required>
                <input className={wizardInputCls} value={form.program_name} onChange={(e) => setForm((f) => ({ ...f, program_name: e.target.value }))} placeholder="Flying Blue" />
              </WizardField>
              <WizardField label="Fournisseur" required>
                <input className={wizardInputCls} value={form.provider} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))} placeholder="Air France-KLM" />
              </WizardField>
            </WizardGrid>
            <WizardGrid>
              <WizardField label="Unité de points">
                <input className={wizardInputCls} value={form.points_unit} onChange={(e) => setForm((f) => ({ ...f, points_unit: e.target.value }))} placeholder="Miles, Points, €" />
              </WizardField>
              <WizardField label="Valeur par point (€)">
                <input type="number" step="0.001" className={wizardInputCls} value={form.eur_per_point} onChange={(e) => setForm((f) => ({ ...f, eur_per_point: e.target.value }))} placeholder="0.01" />
              </WizardField>
            </WizardGrid>
          </WizardSection>
        )}

        {step === 2 && (
          <WizardSection title="Solde actuel">
            <WizardField label={`Solde en ${form.points_unit || 'Points'}`}>
              <input type="number" className={wizardInputCls} value={form.points_balance} onChange={(e) => setForm((f) => ({ ...f, points_balance: e.target.value }))} placeholder="15000" />
            </WizardField>
            <WizardField label="Date d'expiration" hint="Optionnel — pour recevoir un rappel avant expiration">
              <input type="date" className={wizardInputCls} value={form.expiry_date} onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))} />
            </WizardField>
            <WizardField label="Notes">
              <textarea className={`${wizardInputCls} min-h-[60px] resize-none`} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Niveau Gold, carte #..." />
            </WizardField>

            {/* Preview */}
            {form.points_balance && form.eur_per_point && (
              <div className="p-3 rounded-omni bg-amber-500/10 border border-amber-500/20 mt-2">
                <p className="text-xs text-foreground-tertiary">Valeur estimée</p>
                <p className="text-lg font-bold text-amber-400">
                  {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(parseInt(form.points_balance) * parseFloat(form.eur_per_point))}
                </p>
              </div>
            )}
          </WizardSection>
        )}
      </VaultWizard>
    </div>
  )
}

/* ── Loyalty Card ─────────────────────────────────────── */

function LoyaltyCard({ program: p, index, onDelete }: { program: LoyaltyProgram; index: number; onDelete: (id: string) => void }) {
  const typeInfo = PROGRAM_TYPES.find((t) => t.value === p.program_type) ?? PROGRAM_TYPES[5]!
  const isExpiring = p.days_until_expiry != null && p.days_until_expiry > 0 && p.days_until_expiry <= 30
  const isExpired = p.days_until_expiry != null && p.days_until_expiry <= 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.04 }}
      className={`group relative bg-surface rounded-omni-lg border overflow-hidden hover:shadow-lg transition-all ${isExpired ? 'border-loss/40 opacity-70' : isExpiring ? 'border-warning/40' : 'border-border hover:border-amber-500/30'}`}
    >
      {/* Top gradient bar */}
      <div className={`h-1.5 bg-gradient-to-r ${typeInfo.gradient}`} />

      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`flex items-center justify-center w-10 h-10 rounded-omni-sm bg-gradient-to-br ${typeInfo.gradient} text-white text-lg`}>
            {typeInfo.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{p.program_name}</h3>
            <p className="text-xs text-foreground-tertiary">{p.provider}</p>
          </div>
          <button onClick={() => onDelete(p.id)} className="p-1.5 rounded-omni-sm opacity-0 group-hover:opacity-100 hover:bg-loss/10 text-foreground-tertiary hover:text-loss transition-all">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Points display */}
        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-xs text-foreground-tertiary uppercase tracking-wider">{p.points_unit}</p>
            <p className="text-2xl font-bold">{fmtPts(p.points_balance)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-foreground-tertiary">Valeur</p>
            <p className="text-sm font-semibold text-amber-400">{fmt(p.estimated_value || 0)}</p>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2 mt-3">
          {isExpiring && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/10 text-warning text-xs">
              <Clock className="h-3 w-3" /> Expire dans {p.days_until_expiry}j
            </span>
          )}
          {isExpired && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-loss/10 text-loss text-xs">
              <AlertTriangle className="h-3 w-3" /> Expiré
            </span>
          )}
          {p.eur_per_point > 0 && !isExpired && !isExpiring && (
            <span className="px-2 py-0.5 rounded-full bg-surface text-foreground-tertiary text-xs">
              1 {p.points_unit} = {p.eur_per_point < 1 ? `${p.eur_per_point}€` : `${p.eur_per_point.toFixed(2)}€`}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}
