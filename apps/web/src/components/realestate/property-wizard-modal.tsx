'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, MapPin, Home, Building, DollarSign, FileText,
  ChevronRight, ChevronLeft, Check, Loader2, Search,
  ArrowRight, Landmark, ParkingCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAddressSearch, type BANAddress } from '@/lib/use-address-search'
import { useRealEstateStore } from '@/stores/realestate-store'
import type { RealEstateProperty } from '@/types/api'

const STEPS = [
  { id: 'address', label: 'Adresse', icon: MapPin },
  { id: 'details', label: 'Détails', icon: Home },
  { id: 'financials', label: 'Financier', icon: DollarSign },
  { id: 'fiscal', label: 'Fiscalité', icon: FileText },
]

const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Appartement', icon: Building, color: 'bg-blue-400/10 text-blue-400 border-blue-400/30' },
  { value: 'house', label: 'Maison', icon: Home, color: 'bg-gain/10 text-gain border-gain/30' },
  { value: 'parking', label: 'Parking', icon: ParkingCircle, color: 'bg-amber-400/10 text-amber-400 border-amber-400/30' },
  { value: 'commercial', label: 'Local commercial', icon: Landmark, color: 'bg-purple-400/10 text-purple-400 border-purple-400/30' },
  { value: 'land', label: 'Terrain', icon: MapPin, color: 'bg-brand/10 text-brand border-brand/30' },
  { value: 'other', label: 'Autre', icon: Building, color: 'bg-foreground-tertiary/10 text-foreground-tertiary border-border' },
]

const FISCAL_REGIMES = [
  { value: 'micro_foncier', label: 'Micro-foncier', desc: 'Abattement forfaitaire de 30% (loyers < 15 000 €/an)' },
  { value: 'reel', label: 'Régime réel', desc: 'Déduction des charges réelles (intérêts, travaux, etc.)' },
]

const TMI_OPTIONS = [
  { value: '0', label: '0%' },
  { value: '11', label: '11%' },
  { value: '30', label: '30%' },
  { value: '41', label: '41%' },
  { value: '45', label: '45%' },
]

interface WizardForm {
  // Step 1: Address
  label: string
  address: string
  city: string
  postal_code: string
  lat: number | null
  lng: number | null
  // Step 2: Details
  property_type: string
  surface_m2: string
  // Step 3: Financials
  purchase_price: string
  current_value: string
  monthly_rent: string
  monthly_charges: string
  monthly_loan_payment: string
  loan_remaining: string
  loan_interest_rate: string
  loan_insurance_rate: string
  loan_duration_months: string
  loan_start_date: string
  // Step 4: Fiscal
  fiscal_regime: string
  tmi_pct: string
  taxe_fonciere: string
  assurance_pno: string
  vacancy_rate_pct: string
  notary_fees_pct: string
  provision_travaux: string
}

const DEFAULT_FORM: WizardForm = {
  label: '', address: '', city: '', postal_code: '',
  lat: null, lng: null,
  property_type: 'apartment', surface_m2: '',
  purchase_price: '', current_value: '',
  monthly_rent: '', monthly_charges: '',
  monthly_loan_payment: '', loan_remaining: '',
  loan_interest_rate: '', loan_insurance_rate: '',
  loan_duration_months: '', loan_start_date: '',
  fiscal_regime: 'micro_foncier', tmi_pct: '30',
  taxe_fonciere: '', assurance_pno: '',
  vacancy_rate_pct: '', notary_fees_pct: '7.5',
  provision_travaux: '',
}

export default function PropertyWizardModal({
  isOpen,
  onClose,
  property,
}: {
  isOpen: boolean
  onClose: () => void
  property?: RealEstateProperty | null
}) {
  const { createProperty, updateProperty, isSaving } = useRealEstateStore()
  const isEdit = !!property
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<WizardForm>(DEFAULT_FORM)
  const [error, setError] = useState<string | null>(null)
  const [direction, setDirection] = useState(1) // 1 = next, -1 = prev

  // Reset form on open
  useEffect(() => {
    if (!isOpen) return
    setStep(0)
    setDirection(1)
    setError(null)
    if (property) {
      setForm({
        label: property.label || '',
        address: property.address || '',
        city: property.city || '',
        postal_code: property.postal_code || '',
        lat: null, lng: null,
        property_type: property.property_type || 'apartment',
        surface_m2: property.surface_m2 ? String(property.surface_m2) : '',
        purchase_price: property.purchase_price ? String(property.purchase_price / 100) : '',
        current_value: property.current_value ? String(property.current_value / 100) : '',
        monthly_rent: property.monthly_rent ? String(property.monthly_rent / 100) : '',
        monthly_charges: property.monthly_charges ? String(property.monthly_charges / 100) : '',
        monthly_loan_payment: property.monthly_loan_payment ? String(property.monthly_loan_payment / 100) : '',
        loan_remaining: property.loan_remaining ? String(property.loan_remaining / 100) : '',
        fiscal_regime: property.fiscal_regime || 'micro_foncier',
        tmi_pct: property.tmi_pct != null ? String(property.tmi_pct) : '30',
        taxe_fonciere: property.taxe_fonciere ? String(property.taxe_fonciere / 100) : '',
        assurance_pno: property.assurance_pno ? String(property.assurance_pno / 100) : '',
        vacancy_rate_pct: property.vacancy_rate_pct ? String(property.vacancy_rate_pct) : '',
        notary_fees_pct: property.notary_fees_pct != null ? String(property.notary_fees_pct) : '7.5',
        provision_travaux: property.provision_travaux ? String(property.provision_travaux / 100) : '',
        loan_interest_rate: property.loan_interest_rate ? String(property.loan_interest_rate) : '',
        loan_insurance_rate: property.loan_insurance_rate ? String(property.loan_insurance_rate) : '',
        loan_duration_months: property.loan_duration_months ? String(property.loan_duration_months) : '',
        loan_start_date: property.loan_start_date || '',
      })
    } else {
      setForm(DEFAULT_FORM)
    }
  }, [isOpen, property])

  const set = (key: keyof WizardForm, value: any) => setForm(prev => ({ ...prev, [key]: value }))

  const goNext = () => {
    if (step < STEPS.length - 1) {
      setDirection(1)
      setStep(step + 1)
    }
  }

  const goPrev = () => {
    if (step > 0) {
      setDirection(-1)
      setStep(step - 1)
    }
  }

  const handleSubmit = async () => {
    setError(null)
    const payload: any = {
      label: form.label || `Bien ${form.city}`,
      address: form.address || null,
      city: form.city || null,
      postal_code: form.postal_code || null,
      property_type: form.property_type,
      surface_m2: form.surface_m2 ? parseFloat(form.surface_m2) : null,
      purchase_price: form.purchase_price ? Math.round(parseFloat(form.purchase_price) * 100) : 0,
      current_value: form.current_value ? Math.round(parseFloat(form.current_value) * 100) : 0,
      monthly_rent: form.monthly_rent ? Math.round(parseFloat(form.monthly_rent) * 100) : 0,
      monthly_charges: form.monthly_charges ? Math.round(parseFloat(form.monthly_charges) * 100) : 0,
      monthly_loan_payment: form.monthly_loan_payment ? Math.round(parseFloat(form.monthly_loan_payment) * 100) : 0,
      loan_remaining: form.loan_remaining ? Math.round(parseFloat(form.loan_remaining) * 100) : 0,
      fiscal_regime: form.fiscal_regime,
      tmi_pct: parseFloat(form.tmi_pct) || 30,
      taxe_fonciere: form.taxe_fonciere ? Math.round(parseFloat(form.taxe_fonciere) * 100) : 0,
      assurance_pno: form.assurance_pno ? Math.round(parseFloat(form.assurance_pno) * 100) : 0,
      vacancy_rate_pct: form.vacancy_rate_pct ? parseFloat(form.vacancy_rate_pct) : 0,
      notary_fees_pct: form.notary_fees_pct ? parseFloat(form.notary_fees_pct) : 7.5,
      provision_travaux: form.provision_travaux ? Math.round(parseFloat(form.provision_travaux) * 100) : 0,
      loan_interest_rate: form.loan_interest_rate ? parseFloat(form.loan_interest_rate) : 0,
      loan_insurance_rate: form.loan_insurance_rate ? parseFloat(form.loan_insurance_rate) : 0,
      loan_duration_months: form.loan_duration_months ? parseInt(form.loan_duration_months) : 0,
      loan_start_date: form.loan_start_date || null,
      latitude: form.lat ?? null,
      longitude: form.lng ?? null,
    }

    try {
      if (isEdit && property) {
        await updateProperty(property.id, payload)
      } else {
        await createProperty(payload)
      }
      onClose()
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (!isOpen) return null

  const canNext = (() => {
    switch (step) {
      case 0: return form.city.length > 0 || form.address.length > 0
      case 1: return true
      case 2: return form.purchase_price.length > 0
      case 3: return true
      default: return true
    }
  })()

  const isLastStep = step === STEPS.length - 1

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="w-full max-w-lg mx-4 bg-surface rounded-omni-lg border border-border shadow-2xl"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with progress */}
          <div className="p-5 pb-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">
                {isEdit ? 'Modifier le bien' : 'Ajouter un bien immobilier'}
              </h3>
              <button onClick={onClose} className="text-foreground-tertiary hover:text-foreground transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Step indicators */}
            <div className="flex items-center gap-2 mb-5">
              {STEPS.map((s, i) => {
                const Icon = s.icon
                const isActive = i === step
                const isDone = i < step
                return (
                  <div key={s.id} className="flex items-center gap-2 flex-1">
                    <button
                      onClick={() => { if (i < step) { setDirection(-1); setStep(i) } }}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-omni-sm text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-brand/10 text-brand'
                          : isDone
                            ? 'text-gain cursor-pointer hover:bg-gain/5'
                            : 'text-foreground-tertiary'
                      }`}
                    >
                      {isDone ? <Check size={12} /> : <Icon size={12} />}
                      <span className="hidden sm:inline">{s.label}</span>
                    </button>
                    {i < STEPS.length - 1 && (
                      <div className={`flex-1 h-0.5 rounded ${i < step ? 'bg-gain' : 'bg-border'}`} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Step content with animation */}
          <div className="px-5 min-h-[280px]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                initial={{ opacity: 0, x: direction * 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -40 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
              >
                {step === 0 && <StepAddress form={form} set={set} />}
                {step === 1 && <StepDetails form={form} set={set} />}
                {step === 2 && <StepFinancials form={form} set={set} />}
                {step === 3 && <StepFiscal form={form} set={set} />}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Error */}
          {error && (
            <div className="mx-5 mt-3 flex items-center gap-2 text-sm text-loss bg-loss/10 rounded-omni-sm p-3">
              {error}
            </div>
          )}

          {/* Footer navigation */}
          <div className="flex items-center justify-between p-5 pt-4 border-t border-border mt-4">
            <Button
              variant="secondary"
              onClick={goPrev}
              disabled={step === 0}
              className={step === 0 ? 'opacity-0 pointer-events-none' : ''}
            >
              <ChevronLeft size={16} className="mr-1" />
              Retour
            </Button>

            {isLastStep ? (
              <Button onClick={handleSubmit} disabled={isSaving || !canNext}>
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin mr-2" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Check size={16} className="mr-1" />
                    {isEdit ? 'Enregistrer' : 'Ajouter le bien'}
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={goNext} disabled={!canNext}>
                Suivant
                <ChevronRight size={16} className="ml-1" />
              </Button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

/* ── Step 1: Address ─────────────────────────────────────── */
function StepAddress({ form, set }: { form: WizardForm; set: (k: keyof WizardForm, v: any) => void }) {
  const { results, isSearching, search, clear } = useAddressSearch()
  const [query, setQuery] = useState(form.address || '')
  const [showResults, setShowResults] = useState(false)

  const handleSelect = (addr: BANAddress) => {
    setQuery(addr.label)
    set('address', addr.label)
    set('city', addr.city)
    set('postal_code', addr.postcode)
    set('lat', addr.lat)
    set('lng', addr.lng)
    if (!form.label) {
      const typeLabel = PROPERTY_TYPES.find(t => t.value === form.property_type)?.label || 'Bien'
      set('label', `${typeLabel} ${addr.city}`)
    }
    setShowResults(false)
    clear()
  }

  const handleChange = (v: string) => {
    setQuery(v)
    search(v)
    setShowResults(true)
    set('address', v)
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-foreground-secondary mb-1">
          Commencez par rechercher l'adresse du bien
        </p>
      </div>

      {/* Address autocomplete */}
      <div className="relative">
        <label className="block text-sm font-medium text-foreground-secondary mb-1.5">
          Adresse du bien
        </label>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-tertiary" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => { if (results.length > 0) setShowResults(true) }}
            placeholder="12 rue de la Paix, Paris..."
            className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-omni-sm text-foreground text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none"
          />
          {isSearching && (
            <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-foreground-tertiary" />
          )}
        </div>

        {/* Dropdown */}
        <AnimatePresence>
          {showResults && results.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-omni-sm shadow-lg z-50 overflow-hidden"
            >
              {results.map((addr, i) => (
                <motion.button
                  key={`${addr.label}-${i}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => handleSelect(addr)}
                  className="flex items-start gap-3 w-full px-3 py-2.5 hover:bg-surface-elevated/60 transition-colors text-left border-b border-border/50 last:border-0"
                >
                  <MapPin size={14} className="text-brand mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{addr.label}</p>
                    <p className="text-xs text-foreground-tertiary">{addr.context}</p>
                  </div>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Selected address info */}
      {form.city && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-omni-sm border border-gain/30 bg-gain/5 p-3"
        >
          <div className="flex items-center gap-2 mb-2">
            <Check size={14} className="text-gain" />
            <span className="text-xs font-medium text-gain">Adresse sélectionnée</span>
          </div>
          <p className="text-sm text-foreground">{form.address}</p>
          <p className="text-xs text-foreground-tertiary mt-0.5">{form.postal_code} {form.city}</p>
        </motion.div>
      )}

      {/* Manual name */}
      <div>
        <label className="block text-sm font-medium text-foreground-secondary mb-1.5">
          Nom du bien (optionnel)
        </label>
        <input
          type="text"
          value={form.label}
          onChange={(e) => set('label', e.target.value)}
          placeholder="Mon appartement à Paris"
          className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none"
        />
      </div>

      {/* Or manual city/postal */}
      {!form.city && (
        <div className="border-t border-border pt-3">
          <p className="text-xs text-foreground-tertiary mb-2">Ou saisissez manuellement :</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <input
                type="text"
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
                placeholder="Ville"
                className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none"
              />
            </div>
            <div>
              <input
                type="text"
                value={form.postal_code}
                onChange={(e) => set('postal_code', e.target.value)}
                placeholder="Code postal"
                className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Step 2: Details ─────────────────────────────────────── */
function StepDetails({ form, set }: { form: WizardForm; set: (k: keyof WizardForm, v: any) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground-secondary">
        Quel type de bien possédez-vous ?
      </p>

      {/* Property type grid */}
      <div className="grid grid-cols-3 gap-2">
        {PROPERTY_TYPES.map(pt => {
          const Icon = pt.icon
          const isActive = form.property_type === pt.value
          return (
            <button
              key={pt.value}
              type="button"
              onClick={() => set('property_type', pt.value)}
              className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-omni-sm border text-xs font-medium transition-all ${
                isActive
                  ? `${pt.color} border-current`
                  : 'border-border text-foreground-tertiary hover:border-foreground-tertiary hover:text-foreground-secondary'
              }`}
            >
              <Icon size={18} />
              {pt.label}
            </button>
          )
        })}
      </div>

      {/* Surface */}
      <div>
        <label className="block text-sm font-medium text-foreground-secondary mb-1.5">
          Surface (m²)
        </label>
        <input
          type="number"
          value={form.surface_m2}
          onChange={(e) => set('surface_m2', e.target.value)}
          placeholder="45"
          step="0.1"
          className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none"
        />
      </div>
    </div>
  )
}

/* ── Step 3: Financials ──────────────────────────────────── */
function StepFinancials({ form, set }: { form: WizardForm; set: (k: keyof WizardForm, v: any) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground-secondary">
        Informations financières
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-foreground-secondary mb-1.5">Prix d'achat (€) *</label>
          <input
            type="number"
            value={form.purchase_price}
            onChange={(e) => set('purchase_price', e.target.value)}
            placeholder="250 000"
            required
            className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none tabular-nums"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground-secondary mb-1.5">Valeur actuelle (€)</label>
          <input
            type="number"
            value={form.current_value}
            onChange={(e) => set('current_value', e.target.value)}
            placeholder="280 000"
            className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none tabular-nums"
          />
        </div>
      </div>

      <div className="border-t border-border pt-3">
        <p className="text-xs font-semibold text-foreground-secondary mb-3">Revenus & charges mensuels</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-foreground-tertiary mb-1">Loyer mensuel (€)</label>
            <input
              type="number"
              value={form.monthly_rent}
              onChange={(e) => set('monthly_rent', e.target.value)}
              placeholder="1 200"
              className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs text-foreground-tertiary mb-1">Charges (€)</label>
            <input
              type="number"
              value={form.monthly_charges}
              onChange={(e) => set('monthly_charges', e.target.value)}
              placeholder="250"
              className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none tabular-nums"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-3">
        <p className="text-xs font-semibold text-foreground-secondary mb-3">Crédit immobilier</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-foreground-tertiary mb-1">Mensualité crédit (€)</label>
            <input
              type="number"
              value={form.monthly_loan_payment}
              onChange={(e) => set('monthly_loan_payment', e.target.value)}
              placeholder="900"
              className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs text-foreground-tertiary mb-1">Capital restant dû (€)</label>
            <input
              type="number"
              value={form.loan_remaining}
              onChange={(e) => set('loan_remaining', e.target.value)}
              placeholder="180 000"
              className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs text-foreground-tertiary mb-1">Taux intérêt (%)</label>
            <input
              type="number"
              value={form.loan_interest_rate}
              onChange={(e) => set('loan_interest_rate', e.target.value)}
              placeholder="1.5"
              step="0.01"
              className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs text-foreground-tertiary mb-1">Durée (mois)</label>
            <input
              type="number"
              value={form.loan_duration_months}
              onChange={(e) => set('loan_duration_months', e.target.value)}
              placeholder="240"
              className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none tabular-nums"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Step 4: Fiscal ──────────────────────────────────────── */
function StepFiscal({ form, set }: { form: WizardForm; set: (k: keyof WizardForm, v: any) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground-secondary">
        Paramètres fiscaux (optionnel, améliorent la précision des calculs)
      </p>

      {/* Regime cards */}
      <div className="space-y-2">
        {FISCAL_REGIMES.map(r => (
          <button
            key={r.value}
            type="button"
            onClick={() => set('fiscal_regime', r.value)}
            className={`w-full text-left px-3 py-2.5 rounded-omni-sm border transition-all ${
              form.fiscal_regime === r.value
                ? 'border-brand bg-brand/5'
                : 'border-border hover:border-foreground-tertiary'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full border-2 ${
                form.fiscal_regime === r.value ? 'border-brand bg-brand' : 'border-foreground-tertiary'
              }`} />
              <span className="text-sm font-medium text-foreground">{r.label}</span>
            </div>
            <p className="text-xs text-foreground-tertiary mt-0.5 ml-5">{r.desc}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-foreground-secondary mb-1.5">TMI</label>
          <div className="flex gap-1">
            {TMI_OPTIONS.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => set('tmi_pct', t.value)}
                className={`flex-1 py-1.5 rounded-omni-sm text-xs font-medium border transition-colors ${
                  form.tmi_pct === t.value
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-border text-foreground-tertiary hover:border-foreground-tertiary'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground-secondary mb-1.5">Frais notaire (%)</label>
          <input
            type="number"
            value={form.notary_fees_pct}
            onChange={(e) => set('notary_fees_pct', e.target.value)}
            placeholder="7.5"
            step="0.1"
            className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none tabular-nums"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-foreground-tertiary mb-1">Taxe foncière (€/an)</label>
          <input
            type="number"
            value={form.taxe_fonciere}
            onChange={(e) => set('taxe_fonciere', e.target.value)}
            placeholder="1 200"
            className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none tabular-nums"
          />
        </div>
        <div>
          <label className="block text-xs text-foreground-tertiary mb-1">Assurance PNO (€/an)</label>
          <input
            type="number"
            value={form.assurance_pno}
            onChange={(e) => set('assurance_pno', e.target.value)}
            placeholder="200"
            className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none tabular-nums"
          />
        </div>
        <div>
          <label className="block text-xs text-foreground-tertiary mb-1">Vacance locative (%)</label>
          <input
            type="number"
            value={form.vacancy_rate_pct}
            onChange={(e) => set('vacancy_rate_pct', e.target.value)}
            placeholder="5"
            step="0.1"
            className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none tabular-nums"
          />
        </div>
        <div>
          <label className="block text-xs text-foreground-tertiary mb-1">Provision travaux (€/an)</label>
          <input
            type="number"
            value={form.provision_travaux}
            onChange={(e) => set('provision_travaux', e.target.value)}
            placeholder="500"
            className="w-full px-3 py-2 bg-background border border-border rounded-omni-sm text-foreground text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none tabular-nums"
          />
        </div>
      </div>

      {/* Summary preview */}
      {form.purchase_price && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-omni-sm border border-border bg-surface-elevated/30 p-3"
        >
          <p className="text-xs font-semibold text-foreground-secondary mb-2">Récapitulatif</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {form.label && <SummaryRow label="Nom" value={form.label} />}
            {form.city && <SummaryRow label="Ville" value={`${form.postal_code} ${form.city}`} />}
            <SummaryRow label="Type" value={PROPERTY_TYPES.find(t => t.value === form.property_type)?.label || form.property_type} />
            {form.surface_m2 && <SummaryRow label="Surface" value={`${form.surface_m2} m²`} />}
            <SummaryRow label="Prix d'achat" value={`${parseFloat(form.purchase_price).toLocaleString('fr-FR')} €`} />
            {form.monthly_rent && <SummaryRow label="Loyer" value={`${parseFloat(form.monthly_rent).toLocaleString('fr-FR')} €/mois`} />}
            {form.monthly_loan_payment && <SummaryRow label="Crédit" value={`${parseFloat(form.monthly_loan_payment).toLocaleString('fr-FR')} €/mois`} />}
          </div>
        </motion.div>
      )}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-foreground-tertiary">{label}</span>
      <span className="text-foreground font-medium tabular-nums">{value}</span>
    </>
  )
}
