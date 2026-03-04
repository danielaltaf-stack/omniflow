'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, Trash2, FileText, Fingerprint, GraduationCap, Award, Shield, FileCheck, Landmark, Heart, Folder, AlertTriangle, Clock, CalendarClock } from 'lucide-react'
import { useVaultStore } from '@/stores/vault-store'
import { VaultWizard, WizardField, WizardGrid, WizardSection, wizardInputCls, wizardSelectCls } from '@/components/vault/vault-wizard'
import { Button } from '@/components/ui/button'
import type { VaultDocument } from '@/types/api'

const DOC_CATEGORIES = [
  { value: 'identity', label: 'Identité', icon: Fingerprint, color: 'text-blue-400', bg: 'bg-blue-500/10', emoji: '🪪', examples: 'CNI, Passeport, Permis' },
  { value: 'diploma', label: 'Diplôme', icon: GraduationCap, color: 'text-amber-400', bg: 'bg-amber-500/10', emoji: '🎓', examples: 'Bac, Licence, Master' },
  { value: 'certificate', label: 'Certificat', icon: Award, color: 'text-purple-400', bg: 'bg-purple-500/10', emoji: '📜', examples: 'Naissance, Mariage, CACES' },
  { value: 'insurance', label: 'Assurance', icon: Shield, color: 'text-emerald-400', bg: 'bg-emerald-500/10', emoji: '🛡️', examples: 'Habitation, Auto, Santé' },
  { value: 'contract', label: 'Contrat', icon: FileCheck, color: 'text-indigo-400', bg: 'bg-indigo-500/10', emoji: '📋', examples: 'Travail, Location, Prêt' },
  { value: 'tax', label: 'Fiscal', icon: Landmark, color: 'text-orange-400', bg: 'bg-orange-500/10', emoji: '🏛️', examples: 'Avis d\'impôt, Taxes foncières' },
  { value: 'medical', label: 'Médical', icon: Heart, color: 'text-rose-400', bg: 'bg-rose-500/10', emoji: '🏥', examples: 'Carte Vitale, Ordonnances' },
  { value: 'other', label: 'Autre', icon: Folder, color: 'text-gray-400', bg: 'bg-gray-500/10', emoji: '📁', examples: 'Divers' },
]

const WIZARD_STEPS = [
  { id: 'category', label: 'Type' },
  { id: 'details', label: 'Détails' },
  { id: 'dates', label: 'Dates' },
]

export default function DocumentsTab() {
  const { documents: vaultDocuments, createDocument: createVaultDocument, deleteDocument: deleteVaultDocument, isLoading } = useVaultStore()
  const [showWizard, setShowWizard] = useState(false)
  const [step, setStep] = useState(0)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')

  const [form, setForm] = useState({
    name: '', category: '', document_type: '', issuer: '',
    issue_date: '', expiry_date: '', document_number: '',
    reminder_days: '30', notes: '',
  })

  const resetForm = () => {
    setStep(0)
    setForm({ name: '', category: '', document_type: '', issuer: '', issue_date: '', expiry_date: '', document_number: '', reminder_days: '30', notes: '' })
  }

  const handleCreate = useCallback(async () => {
    if (!form.name || !form.category) return
    await createVaultDocument({
      name: form.name,
      category: form.category,
      document_type: form.document_type || undefined,
      issuer: form.issuer || undefined,
      issue_date: form.issue_date || undefined,
      expiry_date: form.expiry_date || undefined,
      document_number: form.document_number || undefined,
      reminder_days: parseInt(form.reminder_days) || 30,
      notes: form.notes || undefined,
    })
    setShowWizard(false)
    resetForm()
  }, [form, createVaultDocument])

  const canAdvance = step === 0 ? !!form.category : step === 1 ? !!form.name : true

  // Stats
  const expiringSoon = vaultDocuments.filter((d) => d.days_until_expiry != null && d.days_until_expiry > 0 && d.days_until_expiry <= 30).length
  const expired = vaultDocuments.filter((d) => d.is_expired).length

  const filtered = vaultDocuments.filter((d) => {
    if (search) {
      const q = search.toLowerCase()
      if (!d.name.toLowerCase().includes(q) && !(d.issuer || '').toLowerCase().includes(q)) return false
    }
    if (filterCat && d.category !== filterCat) return false
    return true
  })

  return (
    <div className="flex flex-col gap-4">
      {/* Alerts */}
      {(expiringSoon > 0 || expired > 0) && (
        <div className="flex gap-3">
          {expired > 0 && (
            <div className="flex-1 flex items-center gap-2 p-3 rounded-omni bg-loss/5 border border-loss/20">
              <AlertTriangle className="h-5 w-5 text-loss shrink-0" />
              <p className="text-sm"><span className="font-bold text-loss">{expired}</span> document{expired > 1 ? 's' : ''} expiré{expired > 1 ? 's' : ''}</p>
            </div>
          )}
          {expiringSoon > 0 && (
            <div className="flex-1 flex items-center gap-2 p-3 rounded-omni bg-warning/5 border border-warning/20">
              <Clock className="h-5 w-5 text-warning shrink-0" />
              <p className="text-sm"><span className="font-bold text-warning">{expiringSoon}</span> expire{expiringSoon > 1 ? 'nt' : ''} bientôt</p>
            </div>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-tertiary" />
            <input className={`${wizardInputCls} pl-9`} placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className={`${wizardSelectCls} max-w-[150px]`} value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
            <option value="">Toute catégorie</option>
            {DOC_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
          </select>
        </div>
        <Button onClick={() => setShowWizard(true)}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter
        </Button>
      </div>

      {/* Document grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-foreground-tertiary">
          <FileText className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-lg font-medium">Aucun document</p>
          <p className="text-sm">Numérisez et suivez vos documents importants</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <AnimatePresence>
            {filtered.map((doc, i) => (
              <DocumentCard key={doc.id} doc={doc} index={i} onDelete={deleteVaultDocument} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Wizard */}
      <VaultWizard
        open={showWizard}
        onClose={() => { setShowWizard(false); resetForm() }}
        title="Ajouter un document"
        subtitle="Numérisez vos documents importants"
        steps={WIZARD_STEPS}
        currentStep={step}
        onStepChange={setStep}
        onSubmit={handleCreate}
        canAdvance={canAdvance}
        isSubmitting={isLoading}
        accent="bg-indigo-500"
      >
        {step === 0 && (
          <WizardSection>
            <p className="text-sm text-foreground-secondary mb-3">Type de document :</p>
            <div className="grid grid-cols-2 gap-3">
              {DOC_CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setForm((f) => ({ ...f, category: c.value }))}
                  className={`flex items-center gap-3 p-4 rounded-omni border-2 transition-all text-left ${form.category === c.value ? 'border-indigo-500 bg-indigo-500/10' : 'border-border hover:border-foreground-tertiary'}`}
                >
                  <span className="text-2xl">{c.emoji}</span>
                  <div>
                    <p className="text-sm font-medium">{c.label}</p>
                    <p className="text-xs text-foreground-tertiary">{c.examples}</p>
                  </div>
                </button>
              ))}
            </div>
          </WizardSection>
        )}

        {step === 1 && (
          <WizardSection title="Informations du document">
            <WizardField label="Nom du document" required>
              <input className={wizardInputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Carte d'identité" />
            </WizardField>
            <WizardGrid>
              <WizardField label="Type spécifique" hint="Ex: CNI, Passeport, etc.">
                <input className={wizardInputCls} value={form.document_type} onChange={(e) => setForm((f) => ({ ...f, document_type: e.target.value }))} placeholder="CNI" />
              </WizardField>
              <WizardField label="Émetteur">
                <input className={wizardInputCls} value={form.issuer} onChange={(e) => setForm((f) => ({ ...f, issuer: e.target.value }))} placeholder="Préfecture de Paris" />
              </WizardField>
            </WizardGrid>
            <WizardField label="Numéro du document" hint="Optionnel, sera chiffré">
              <input className={wizardInputCls} value={form.document_number} onChange={(e) => setForm((f) => ({ ...f, document_number: e.target.value }))} placeholder="123456789" />
            </WizardField>
          </WizardSection>
        )}

        {step === 2 && (
          <WizardSection title="Dates et rappels">
            <WizardGrid>
              <WizardField label="Date d'émission">
                <input type="date" className={wizardInputCls} value={form.issue_date} onChange={(e) => setForm((f) => ({ ...f, issue_date: e.target.value }))} />
              </WizardField>
              <WizardField label="Date d'expiration">
                <input type="date" className={wizardInputCls} value={form.expiry_date} onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))} />
              </WizardField>
            </WizardGrid>
            <WizardField label="Rappel avant expiration (jours)">
              <input type="number" min={0} max={365} className={wizardInputCls} value={form.reminder_days} onChange={(e) => setForm((f) => ({ ...f, reminder_days: e.target.value }))} />
            </WizardField>
            <WizardField label="Notes">
              <textarea className={`${wizardInputCls} min-h-[60px] resize-none`} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Emplacement du document original, copies..." />
            </WizardField>
          </WizardSection>
        )}
      </VaultWizard>
    </div>
  )
}

/* ── Document Card ────────────────────────────────────── */

function DocumentCard({ doc, index, onDelete }: { doc: VaultDocument; index: number; onDelete: (id: string) => void }) {
  const cat = DOC_CATEGORIES.find((c) => c.value === doc.category) ?? DOC_CATEGORIES[7]!
  const isExpired = doc.is_expired
  const isExpiring = doc.days_until_expiry != null && doc.days_until_expiry > 0 && doc.days_until_expiry <= 30
  const Icon = cat.icon

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.03 }}
      className={`group relative bg-surface rounded-omni border overflow-hidden hover:shadow-lg transition-all ${isExpired ? 'border-loss/40' : isExpiring ? 'border-warning/40' : 'border-border hover:border-indigo-500/30'}`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`flex items-center justify-center w-10 h-10 rounded-omni-sm ${cat.bg}`}>
            <Icon className={`h-5 w-5 ${cat.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{doc.name}</h3>
            <p className="text-xs text-foreground-tertiary">{doc.issuer || cat.label}{doc.document_type ? ` • ${doc.document_type}` : ''}</p>
          </div>
          <button onClick={() => onDelete(doc.id)} className="p-1.5 rounded-omni-sm opacity-0 group-hover:opacity-100 hover:bg-loss/10 text-foreground-tertiary hover:text-loss transition-all">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Dates */}
        <div className="flex items-center gap-4 mt-3 text-xs text-foreground-tertiary">
          {doc.issue_date && (
            <span>Émis: {new Date(doc.issue_date).toLocaleDateString('fr-FR')}</span>
          )}
          {doc.expiry_date && (
            <span className={isExpired ? 'text-loss font-medium' : isExpiring ? 'text-warning font-medium' : ''}>
              Exp: {new Date(doc.expiry_date).toLocaleDateString('fr-FR')}
            </span>
          )}
        </div>

        {/* Status badge */}
        {(isExpired || isExpiring) && (
          <div className="mt-2">
            {isExpired && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-loss/10 text-loss text-xs">
                <AlertTriangle className="h-3 w-3" /> Expiré
              </span>
            )}
            {isExpiring && !isExpired && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/10 text-warning text-xs">
                <CalendarClock className="h-3 w-3" /> Expire dans {doc.days_until_expiry}j
              </span>
            )}
          </div>
        )}

        {doc.has_document_number && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-xs mt-2">
            N° enregistré
          </span>
        )}
      </div>
    </motion.div>
  )
}
