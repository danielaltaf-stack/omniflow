'use client'

import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, Trash2, CreditCard, Tv, Music, Cloud, Gamepad2, Dumbbell, BookOpen, Shield, Zap, CalendarClock, AlertTriangle, CircleDot, ToggleLeft, ToggleRight, PieChart } from 'lucide-react'
import { useVaultStore } from '@/stores/vault-store'
import { VaultWizard, WizardField, WizardGrid, WizardSection, wizardInputCls, wizardSelectCls } from '@/components/vault/vault-wizard'
import { Button } from '@/components/ui/button'
import type { Subscription } from '@/types/api'

const fmt = (c: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(c / 100)

const SUB_CATEGORIES = [
  { value: 'streaming', label: 'Streaming', icon: Tv, color: 'text-red-400', bg: 'bg-red-500/10', emoji: '🎬' },
  { value: 'music', label: 'Musique', icon: Music, color: 'text-pink-400', bg: 'bg-pink-500/10', emoji: '🎵' },
  { value: 'cloud', label: 'Cloud / SaaS', icon: Cloud, color: 'text-sky-400', bg: 'bg-sky-500/10', emoji: '☁️' },
  { value: 'gaming', label: 'Jeux vidéo', icon: Gamepad2, color: 'text-green-400', bg: 'bg-green-500/10', emoji: '🎮' },
  { value: 'fitness', label: 'Sport / Fitness', icon: Dumbbell, color: 'text-orange-400', bg: 'bg-orange-500/10', emoji: '💪' },
  { value: 'education', label: 'Éducation', icon: BookOpen, color: 'text-indigo-400', bg: 'bg-indigo-500/10', emoji: '📚' },
  { value: 'insurance', label: 'Assurance', icon: Shield, color: 'text-teal-400', bg: 'bg-teal-500/10', emoji: '🛡️' },
  { value: 'telecom', label: 'Télécom', icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-500/10', emoji: '📱' },
  { value: 'essential', label: 'Essentiel', icon: CircleDot, color: 'text-emerald-400', bg: 'bg-emerald-500/10', emoji: '✅' },
  { value: 'other', label: 'Autre', icon: CreditCard, color: 'text-gray-400', bg: 'bg-gray-500/10', emoji: '📋' },
]

const BILLING_CYCLES = [
  { value: 'weekly', label: 'Hebdomadaire' },
  { value: 'monthly', label: 'Mensuel' },
  { value: 'quarterly', label: 'Trimestriel' },
  { value: 'semi_annual', label: 'Semestriel' },
  { value: 'annual', label: 'Annuel' },
]

const POPULAR_SUBS = [
  { name: 'Netflix', provider: 'Netflix', category: 'streaming', amount: 1399 },
  { name: 'Spotify Premium', provider: 'Spotify', category: 'music', amount: 1099 },
  { name: 'Disney+', provider: 'Disney', category: 'streaming', amount: 899 },
  { name: 'Amazon Prime', provider: 'Amazon', category: 'streaming', amount: 699 },
  { name: 'Apple Music', provider: 'Apple', category: 'music', amount: 1099 },
  { name: 'Apple One', provider: 'Apple', category: 'cloud', amount: 1995 },
  { name: 'YouTube Premium', provider: 'Google', category: 'streaming', amount: 1299 },
  { name: 'iCloud+', provider: 'Apple', category: 'cloud', amount: 299 },
  { name: 'Google One', provider: 'Google', category: 'cloud', amount: 299 },
  { name: 'Xbox Game Pass', provider: 'Microsoft', category: 'gaming', amount: 1299 },
  { name: 'PlayStation Plus', provider: 'Sony', category: 'gaming', amount: 899 },
  { name: 'Canal+', provider: 'Canal+', category: 'streaming', amount: 2499 },
  { name: 'Deezer Premium', provider: 'Deezer', category: 'music', amount: 1099 },
  { name: 'Adobe Creative Cloud', provider: 'Adobe', category: 'cloud', amount: 5999 },
  { name: 'Notion', provider: 'Notion', category: 'cloud', amount: 800 },
  { name: 'ChatGPT Plus', provider: 'OpenAI', category: 'cloud', amount: 2000 },
  { name: 'Claude Pro', provider: 'Anthropic', category: 'cloud', amount: 2000 },
  { name: 'Basic-Fit', provider: 'Basic-Fit', category: 'fitness', amount: 2999 },
  { name: 'Fitness Park', provider: 'Fitness Park', category: 'fitness', amount: 2999 },
]

const WIZARD_STEPS = [
  { id: 'type', label: 'Catégorie' },
  { id: 'details', label: 'Détails' },
  { id: 'billing', label: 'Facturation' },
]

export default function SubscriptionsTab() {
  const { subscriptions, createSubscription, deleteSubscription, isLoading } = useVaultStore()
  const [showWizard, setShowWizard] = useState(false)
  const [step, setStep] = useState(0)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')

  const [form, setForm] = useState({
    name: '', provider: '', category: '',
    amount: '', billing_cycle: 'monthly',
    next_billing_date: '', contract_start_date: '', contract_end_date: '',
    cancellation_deadline: '', auto_renew: true,
    cancellation_notice_days: '30', notes: '',
  })

  const resetForm = () => {
    setStep(0)
    setForm({ name: '', provider: '', category: '', amount: '', billing_cycle: 'monthly', next_billing_date: '', contract_start_date: '', contract_end_date: '', cancellation_deadline: '', auto_renew: true, cancellation_notice_days: '30', notes: '' })
  }

  const selectPopular = useCallback((p: typeof POPULAR_SUBS[0]) => {
    setForm((f) => ({ ...f, name: p.name, provider: p.provider, category: p.category, amount: (p.amount / 100).toFixed(2) }))
    setStep(2)
  }, [])

  const handleCreate = useCallback(async () => {
    if (!form.name || !form.amount) return
    await createSubscription({
      name: form.name,
      provider: form.provider,
      category: form.category || 'other',
      amount: Math.round(parseFloat(form.amount) * 100),
      billing_cycle: form.billing_cycle,
      next_billing_date: form.next_billing_date || undefined,
      contract_start_date: form.contract_start_date || undefined,
      contract_end_date: form.contract_end_date || undefined,
      cancellation_deadline: form.cancellation_deadline || undefined,
      auto_renew: form.auto_renew,
      cancellation_notice_days: parseInt(form.cancellation_notice_days) || 30,
      notes: form.notes || undefined,
    })
    setShowWizard(false)
    resetForm()
  }, [form, createSubscription])

  const canAdvance = step === 0 ? !!form.category : step === 1 ? !!(form.name) : !!form.amount

  // Analytics
  const totalMonthly = useMemo(() => subscriptions.filter((s) => s.is_active).reduce((t, s) => t + (s.monthly_cost || 0), 0), [subscriptions])
  const totalAnnual = useMemo(() => subscriptions.filter((s) => s.is_active).reduce((t, s) => t + (s.annual_cost || 0), 0), [subscriptions])
  const activeCount = subscriptions.filter((s) => s.is_active).length
  const urgentCount = subscriptions.filter((s) => s.cancellation_urgent).length

  const filtered = subscriptions.filter((s) => {
    if (search) {
      const q = search.toLowerCase()
      if (!s.name.toLowerCase().includes(q) && !s.provider.toLowerCase().includes(q)) return false
    }
    if (filterCat && s.category !== filterCat) return false
    if (filterActive === 'active' && !s.is_active) return false
    if (filterActive === 'inactive' && s.is_active) return false
    return true
  })

  return (
    <div className="flex flex-col gap-4">
      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-omni bg-surface border border-border">
          <p className="text-xs text-foreground-tertiary">Coût mensuel</p>
          <p className="text-lg font-bold text-brand">{fmt(totalMonthly)}</p>
        </div>
        <div className="p-3 rounded-omni bg-surface border border-border">
          <p className="text-xs text-foreground-tertiary">Coût annuel</p>
          <p className="text-lg font-bold">{fmt(totalAnnual)}</p>
        </div>
        <div className="p-3 rounded-omni bg-surface border border-border">
          <p className="text-xs text-foreground-tertiary">Actifs</p>
          <p className="text-lg font-bold">{activeCount}</p>
        </div>
        {urgentCount > 0 && (
          <div className="p-3 rounded-omni bg-loss/5 border border-loss/20">
            <p className="text-xs text-loss">Résiliation urgente</p>
            <p className="text-lg font-bold text-loss">{urgentCount}</p>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-tertiary" />
            <input className={`${wizardInputCls} pl-9`} placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className={`${wizardSelectCls} max-w-[150px]`} value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
            <option value="">Catégorie</option>
            {SUB_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
          </select>
          <select className={`${wizardSelectCls} max-w-[120px]`} value={filterActive} onChange={(e) => setFilterActive(e.target.value as any)}>
            <option value="all">Tous</option>
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
          </select>
        </div>
        <Button onClick={() => setShowWizard(true)}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter
        </Button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-foreground-tertiary">
          <CreditCard className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-lg font-medium">Aucun abonnement</p>
          <p className="text-sm">Suivez vos abonnements et identifiez les économies potentielles</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map((sub, i) => (
              <SubscriptionRow key={sub.id} sub={sub} index={i} onDelete={deleteSubscription} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Wizard */}
      <VaultWizard
        open={showWizard}
        onClose={() => { setShowWizard(false); resetForm() }}
        title="Ajouter un abonnement"
        subtitle="Suivez vos dépenses récurrentes"
        steps={WIZARD_STEPS}
        currentStep={step}
        onStepChange={setStep}
        onSubmit={handleCreate}
        canAdvance={canAdvance}
        isSubmitting={isLoading}
        accent="bg-brand"
      >
        {step === 0 && (
          <WizardSection>
            <p className="text-sm text-foreground-secondary mb-3">Catégorie :</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {SUB_CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setForm((f) => ({ ...f, category: c.value }))}
                  className={`flex flex-col items-center gap-2 p-3 rounded-omni border-2 transition-all ${form.category === c.value ? 'border-brand bg-brand/10' : 'border-border hover:border-foreground-tertiary'}`}
                >
                  <span className="text-xl">{c.emoji}</span>
                  <span className="text-xs font-medium">{c.label}</span>
                </button>
              ))}
            </div>

            <p className="text-sm text-foreground-secondary mb-2">Abonnements populaires :</p>
            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {POPULAR_SUBS.filter((p) => !form.category || p.category === form.category).map((p) => (
                <button key={p.name} onClick={() => selectPopular(p)} className="w-full flex items-center gap-3 p-2.5 rounded-omni-sm bg-background hover:bg-surface border border-border hover:border-brand/50 transition-all text-left">
                  <span>{SUB_CATEGORIES.find((c) => c.value === p.category)?.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-foreground-tertiary">{p.provider}</p>
                  </div>
                  <span className="text-xs font-medium">{(p.amount / 100).toFixed(2)}€/mois</span>
                </button>
              ))}
            </div>
          </WizardSection>
        )}

        {step === 1 && (
          <WizardSection title="Détails de l'abonnement">
            <WizardGrid>
              <WizardField label="Nom" required>
                <input className={wizardInputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Netflix Premium" />
              </WizardField>
              <WizardField label="Fournisseur">
                <input className={wizardInputCls} value={form.provider} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))} placeholder="Netflix" />
              </WizardField>
            </WizardGrid>
            <WizardField label="Notes">
              <textarea className={`${wizardInputCls} min-h-[60px] resize-none`} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Partagé avec..." />
            </WizardField>
          </WizardSection>
        )}

        {step === 2 && (
          <WizardSection title="Facturation">
            <WizardGrid>
              <WizardField label="Montant (€)" required>
                <input type="number" step="0.01" className={wizardInputCls} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="13.99" />
              </WizardField>
              <WizardField label="Cycle">
                <select className={wizardSelectCls} value={form.billing_cycle} onChange={(e) => setForm((f) => ({ ...f, billing_cycle: e.target.value }))}>
                  {BILLING_CYCLES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </WizardField>
            </WizardGrid>
            <WizardGrid>
              <WizardField label="Prochaine facture">
                <input type="date" className={wizardInputCls} value={form.next_billing_date} onChange={(e) => setForm((f) => ({ ...f, next_billing_date: e.target.value }))} />
              </WizardField>
              <WizardField label="Date de résiliation">
                <input type="date" className={wizardInputCls} value={form.cancellation_deadline} onChange={(e) => setForm((f) => ({ ...f, cancellation_deadline: e.target.value }))} />
              </WizardField>
            </WizardGrid>
            <div className="flex items-center gap-3 p-3 rounded-omni bg-surface border border-border">
              <button onClick={() => setForm((f) => ({ ...f, auto_renew: !f.auto_renew }))} className="text-brand">
                {form.auto_renew ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6 text-foreground-tertiary" />}
              </button>
              <span className="text-sm">Renouvellement automatique</span>
            </div>
          </WizardSection>
        )}
      </VaultWizard>
    </div>
  )
}

/* ── Subscription Row ─────────────────────────────────── */

function SubscriptionRow({ sub, index, onDelete }: { sub: Subscription; index: number; onDelete: (id: string) => void }) {
  const cat = SUB_CATEGORIES.find((c) => c.value === sub.category) ?? SUB_CATEGORIES[9]!
  const isUrgent = sub.cancellation_urgent
  const daysUntil = sub.days_until_renewal

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ delay: index * 0.03 }}
      className={`group flex items-center gap-4 p-4 rounded-omni border transition-all ${!sub.is_active ? 'opacity-50 border-border' : isUrgent ? 'border-loss/30 bg-loss/5' : 'border-border bg-surface hover:border-brand/30'}`}
    >
      {/* Icon */}
      <div className={`flex items-center justify-center w-10 h-10 rounded-omni-sm ${cat.bg}`}>
        <cat.icon className={`h-5 w-5 ${cat.color}`} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm truncate">{sub.name}</h3>
          {!sub.is_active && <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-500/20 text-gray-400">Inactif</span>}
          {isUrgent && <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-loss/20 text-loss"><AlertTriangle className="h-3 w-3" /> Urgent</span>}
        </div>
        <p className="text-xs text-foreground-tertiary">{sub.provider || '—'} • {BILLING_CYCLES.find((c) => c.value === sub.billing_cycle)?.label || sub.billing_cycle}</p>
      </div>

      {/* Renewal info */}
      {daysUntil != null && sub.is_active && (
        <div className="text-right hidden sm:block">
          <p className="text-xs text-foreground-tertiary">Renouvellement</p>
          <p className={`text-xs font-medium ${daysUntil <= 3 ? 'text-warning' : 'text-foreground-secondary'}`}>
            <CalendarClock className="h-3 w-3 inline mr-0.5" />{daysUntil}j
          </p>
        </div>
      )}

      {/* Price */}
      <div className="text-right shrink-0">
        <p className="text-sm font-bold">{fmt(sub.amount)}</p>
        <p className="text-xs text-foreground-tertiary">{sub.monthly_cost ? `${fmt(sub.monthly_cost)}/mois` : ''}</p>
      </div>

      {/* Delete */}
      <button onClick={() => onDelete(sub.id)} className="p-1.5 rounded-omni-sm opacity-0 group-hover:opacity-100 hover:bg-loss/10 text-foreground-tertiary hover:text-loss transition-all">
        <Trash2 className="h-4 w-4" />
      </button>
    </motion.div>
  )
}
