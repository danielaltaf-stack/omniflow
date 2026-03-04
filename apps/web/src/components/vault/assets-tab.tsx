'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Trash2, RefreshCw, TrendingUp, TrendingDown, Shield, Car, Smartphone,
  Watch, Gem, Sofa, Palette, Bike, Camera, Music, Gamepad2, Dumbbell, Baby,
  Wrench, Laptop, ChevronDown, Eye, Search, Filter, SlidersHorizontal, Package
} from 'lucide-react'
import { useVaultStore } from '@/stores/vault-store'
import { VaultWizard, WizardField, WizardGrid, WizardSection, wizardInputCls, wizardSelectCls, ImageDropZone } from '@/components/vault/vault-wizard'
import { Button } from '@/components/ui/button'
import type { TangibleAsset } from '@/types/api'

/* ── Category Config ─────────────────────────────────── */

const ASSET_CATEGORIES = [
  { value: 'vehicle', label: 'Véhicule', icon: Car, color: 'from-blue-500 to-blue-600', description: 'Voiture, moto, scooter, vélo...' },
  { value: 'tech', label: 'Tech & Électronique', icon: Smartphone, color: 'from-violet-500 to-purple-600', description: 'Smartphone, PC, tablette, TV...' },
  { value: 'luxury', label: 'Montres & Luxe', icon: Watch, color: 'from-amber-500 to-yellow-600', description: 'Montres, sacs, accessoires...' },
  { value: 'jewelry', label: 'Bijoux', icon: Gem, color: 'from-pink-500 to-rose-600', description: 'Bagues, colliers, bracelets...' },
  { value: 'furniture', label: 'Mobilier', icon: Sofa, color: 'from-emerald-500 to-green-600', description: 'Canapé, table, lit, rangement...' },
  { value: 'art', label: 'Art & Collection', icon: Palette, color: 'from-orange-500 to-red-500', description: 'Tableaux, sculptures, éditions...' },
  { value: 'sport', label: 'Sport & Loisirs', icon: Dumbbell, color: 'from-cyan-500 to-teal-600', description: 'Équipement sport, vélo...' },
  { value: 'music', label: 'Instruments', icon: Music, color: 'from-indigo-500 to-blue-600', description: 'Guitare, piano, synthé...' },
  { value: 'gaming', label: 'Gaming', icon: Gamepad2, color: 'from-green-500 to-emerald-600', description: 'Consoles, PC gaming, VR...' },
  { value: 'photo', label: 'Photo & Vidéo', icon: Camera, color: 'from-gray-600 to-gray-700', description: 'Appareil photo, objectifs...' },
  { value: 'baby', label: 'Puériculture', icon: Baby, color: 'from-sky-400 to-blue-500', description: 'Poussette, siège auto...' },
  { value: 'tools', label: 'Outillage', icon: Wrench, color: 'from-yellow-600 to-amber-700', description: 'Outils électriques, jardin...' },
  { value: 'collectible', label: 'Collection', icon: Palette, color: 'from-fuchsia-500 to-pink-600', description: 'Cartes, figurines, vinyles...' },
  { value: 'bike', label: 'Deux-roues', icon: Bike, color: 'from-red-500 to-rose-600', description: 'Vélo électrique, trottinette...' },
  { value: 'computer', label: 'Informatique Pro', icon: Laptop, color: 'from-slate-600 to-gray-700', description: 'Serveur, NAS, périphériques...' },
  { value: 'other', label: 'Autre', icon: Plus, color: 'from-gray-500 to-gray-600', description: 'Tout autre bien de valeur' },
] as const

const CONDITIONS = [
  { value: 'mint', label: 'Neuf / Mint', color: 'text-gain' },
  { value: 'excellent', label: 'Excellent', color: 'text-blue-400' },
  { value: 'good', label: 'Bon état', color: 'text-foreground' },
  { value: 'fair', label: 'Correct', color: 'text-warning' },
  { value: 'poor', label: 'Usé', color: 'text-loss' },
]

const WIZARD_STEPS = [
  { id: 'category', label: 'Catégorie' },
  { id: 'details', label: 'Détails' },
  { id: 'financial', label: 'Finances' },
  { id: 'photos', label: 'Photos' },
]

/* ── Helpers ──────────────────────────────────────────── */

const fmt = (c: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(c / 100)
const fmtPct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('fr-FR') : ''

/* ── Component ───────────────────────────────────────── */

export default function AssetsTab() {
  const { assets, createAsset, deleteAsset, revalueAsset, isLoading } = useVaultStore()
  const [showWizard, setShowWizard] = useState(false)
  const [step, setStep] = useState(0)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState<string>('all')
  const [form, setForm] = useState({
    name: '', category: '', subcategory: '', brand: '', model: '',
    purchase_price: '', purchase_date: '', condition: 'good',
    warranty_expires: '', serial_number: '', notes: '', image_url: '',
  })

  const resetForm = () => {
    setForm({ name: '', category: '', subcategory: '', brand: '', model: '', purchase_price: '', purchase_date: '', condition: 'good', warranty_expires: '', serial_number: '', notes: '', image_url: '' })
    setStep(0)
  }

  const handleCreate = useCallback(async () => {
    if (!form.name || !form.purchase_price || !form.category) return
    await createAsset({
      name: form.name,
      category: form.category,
      subcategory: form.subcategory || undefined,
      brand: form.brand || undefined,
      model: form.model || undefined,
      purchase_price: Math.round(parseFloat(form.purchase_price) * 100),
      purchase_date: form.purchase_date || new Date().toISOString().slice(0, 10),
      condition: form.condition,
      warranty_expires: form.warranty_expires || undefined,
      serial_number: form.serial_number || undefined,
      notes: form.notes || undefined,
      image_url: form.image_url || undefined,
    })
    setShowWizard(false)
    resetForm()
  }, [form, createAsset])

  const canAdvance = step === 0 ? !!form.category : step === 1 ? !!form.name : step === 2 ? !!form.purchase_price : true

  // Filtered assets
  const filtered = assets.filter((a) => {
    if (filterCat !== 'all' && a.category !== filterCat) return false
    if (search) {
      const q = search.toLowerCase()
      return a.name.toLowerCase().includes(q) || (a.brand || '').toLowerCase().includes(q) || (a.model || '').toLowerCase().includes(q)
    }
    return true
  })

  const getCategoryConfig = (cat: string) => ASSET_CATEGORIES.find((c) => c.value === cat) ?? ASSET_CATEGORIES[ASSET_CATEGORIES.length - 1]!

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-tertiary" />
            <input
              className={`${wizardInputCls} pl-9`}
              placeholder="Rechercher un bien..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className={`${wizardSelectCls} w-auto`}
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
          >
            <option value="all">Toutes catégories</option>
            {ASSET_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <Button onClick={() => setShowWizard(true)}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter un bien
        </Button>
      </div>

      {/* Asset Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-foreground-tertiary">
          <Package className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-lg font-medium">Aucun bien enregistré</p>
          <p className="text-sm">Ajoutez vos biens pour suivre leur valeur</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {filtered.map((a, i) => (
              <AssetCard key={a.id} asset={a} index={i} onDelete={deleteAsset} onRevalue={revalueAsset} getCategoryConfig={getCategoryConfig} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Wizard */}
      <VaultWizard
        open={showWizard}
        onClose={() => { setShowWizard(false); resetForm() }}
        title="Ajouter un bien"
        subtitle="Enregistrez un bien pour suivre sa valeur"
        steps={WIZARD_STEPS}
        currentStep={step}
        onStepChange={setStep}
        onSubmit={handleCreate}
        canAdvance={canAdvance}
        isSubmitting={isLoading}
      >
        {step === 0 && (
          <WizardSection title="Choisissez la catégorie">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {ASSET_CATEGORIES.map((cat) => {
                const Icon = cat.icon
                const selected = form.category === cat.value
                return (
                  <button
                    key={cat.value}
                    onClick={() => setForm((f) => ({ ...f, category: cat.value }))}
                    className={`
                      flex flex-col items-center gap-2 p-4 rounded-omni border-2 transition-all text-center
                      ${selected ? 'border-brand bg-brand/10 shadow-lg shadow-brand/10' : 'border-border hover:border-foreground-tertiary bg-surface'}
                    `}
                  >
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${cat.color} flex items-center justify-center`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xs font-medium">{cat.label}</span>
                  </button>
                )
              })}
            </div>
          </WizardSection>
        )}

        {step === 1 && (
          <WizardSection title="Informations du bien">
            <WizardGrid>
              <WizardField label="Nom du bien" required>
                <input className={wizardInputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={form.category === 'vehicle' ? 'Tesla Model 3' : form.category === 'tech' ? 'MacBook Pro 16"' : 'Mon bien'} />
              </WizardField>
              <WizardField label="Marque">
                <input className={wizardInputCls} value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} placeholder={form.category === 'vehicle' ? 'Tesla' : 'Apple'} />
              </WizardField>
            </WizardGrid>
            <WizardGrid>
              <WizardField label="Modèle">
                <input className={wizardInputCls} value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} placeholder={form.category === 'vehicle' ? 'Model 3 Performance' : 'M3 Pro'} />
              </WizardField>
              <WizardField label="N° de série">
                <input className={wizardInputCls} value={form.serial_number} onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))} placeholder="Optionnel" />
              </WizardField>
            </WizardGrid>
            <WizardField label="État">
              <div className="flex flex-wrap gap-2">
                {CONDITIONS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setForm((f) => ({ ...f, condition: c.value }))}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all border-2 ${form.condition === c.value ? 'border-brand bg-brand/10' : 'border-border hover:border-foreground-tertiary'}`}
                  >
                    <span className={c.color}>{c.label}</span>
                  </button>
                ))}
              </div>
            </WizardField>
            <WizardField label="Notes">
              <textarea className={`${wizardInputCls} min-h-[80px] resize-none`} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Notes personnelles..." rows={3} />
            </WizardField>
          </WizardSection>
        )}

        {step === 2 && (
          <WizardSection title="Informations financières">
            <WizardGrid>
              <WizardField label="Prix d'achat (€)" required hint="Le prix que vous avez payé">
                <input type="number" step="0.01" className={wizardInputCls} value={form.purchase_price} onChange={(e) => setForm((f) => ({ ...f, purchase_price: e.target.value }))} placeholder="1 299,00" />
              </WizardField>
              <WizardField label="Date d'achat">
                <input type="date" className={wizardInputCls} value={form.purchase_date} onChange={(e) => setForm((f) => ({ ...f, purchase_date: e.target.value }))} />
              </WizardField>
            </WizardGrid>
            <WizardField label="Fin de garantie" hint="Pour recevoir des alertes avant expiration">
              <input type="date" className={wizardInputCls} value={form.warranty_expires} onChange={(e) => setForm((f) => ({ ...f, warranty_expires: e.target.value }))} />
            </WizardField>
            {form.purchase_price && (
              <div className="p-4 rounded-omni bg-brand/5 border border-brand/20">
                <p className="text-sm text-foreground-secondary">
                  La dépréciation sera calculée automatiquement selon la catégorie <strong>{getCategoryConfig(form.category)?.label}</strong>.
                </p>
              </div>
            )}
          </WizardSection>
        )}

        {step === 3 && (
          <WizardSection title="Photo du bien">
            <ImageDropZone
              value={form.image_url}
              onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
              placeholder="Ajoutez une photo de votre bien"
            />
            <WizardField label="Ou collez une URL d'image">
              <input className={wizardInputCls} value={form.image_url.startsWith('data:') ? '' : form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />
            </WizardField>
          </WizardSection>
        )}
      </VaultWizard>
    </div>
  )
}

/* ── Asset Card ──────────────────────────────────────── */

function AssetCard({ asset: a, index, onDelete, onRevalue, getCategoryConfig }: {
  asset: TangibleAsset
  index: number
  onDelete: (id: string) => void
  onRevalue: (id: string) => void
  getCategoryConfig: (cat: string) => typeof ASSET_CATEGORIES[number]
}) {
  const cat = getCategoryConfig(a.category)
  const Icon = cat.icon
  const depreciating = (a.depreciation_pct ?? 0) > 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05 }}
      className="group bg-surface rounded-omni-lg border border-border overflow-hidden hover:border-brand/30 hover:shadow-lg hover:shadow-brand/5 transition-all"
    >
      {/* Image or gradient header */}
      {a.image_url ? (
        <div className="h-36 bg-background-tertiary overflow-hidden">
          <img src={a.image_url} alt={a.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        </div>
      ) : (
        <div className={`h-20 bg-gradient-to-br ${cat.color} flex items-center justify-center`}>
          <Icon className="h-8 w-8 text-white/80" />
        </div>
      )}

      <div className="p-4">
        {/* Title row */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{a.name}</h3>
            <p className="text-xs text-foreground-secondary truncate mt-0.5">
              {a.brand && `${a.brand} `}{a.model && `${a.model} · `}
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gradient-to-r ${cat.color} text-white`}>
                {cat.label}
              </span>
            </p>
          </div>
          <div className="text-right ml-2">
            <div className="font-bold text-sm">{fmt(a.current_value)}</div>
            {a.depreciation_pct != null && (
              <div className={`flex items-center gap-0.5 text-xs ${depreciating ? 'text-loss' : 'text-gain'}`}>
                {depreciating ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                {fmtPct(-a.depreciation_pct)}
              </div>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-3 text-xs text-foreground-tertiary mb-3">
          <span>Achat: {fmt(a.purchase_price)}</span>
          <span>{fmtDate(a.purchase_date)}</span>
        </div>

        {/* Warranty + Condition */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full border ${
            a.condition === 'mint' ? 'border-gain/30 text-gain bg-gain/5' :
            a.condition === 'excellent' ? 'border-blue-400/30 text-blue-400 bg-blue-400/5' :
            a.condition === 'good' ? 'border-border text-foreground-secondary' :
            a.condition === 'fair' ? 'border-warning/30 text-warning bg-warning/5' :
            'border-loss/30 text-loss bg-loss/5'
          }`}>
            {CONDITIONS.find((c) => c.value === a.condition)?.label || a.condition}
          </span>

          {a.warranty_status && a.warranty_status !== 'unknown' && (
            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
              a.warranty_status === 'active' ? 'bg-gain/10 text-gain' :
              a.warranty_status === 'expiring_soon' ? 'bg-warning/10 text-warning' :
              'bg-surface text-foreground-tertiary'
            }`}>
              <Shield className="h-3 w-3" />
              {a.warranty_status === 'active' ? 'Garantie' : a.warranty_status === 'expiring_soon' ? 'Expire bientôt' : 'Expirée'}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-3 pt-3 border-t border-border opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="secondary" size="sm" onClick={() => onRevalue(a.id)} className="flex-1">
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Réévaluer
          </Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(a.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
