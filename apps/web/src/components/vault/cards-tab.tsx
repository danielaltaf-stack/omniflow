'use client'

import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, CreditCard, Trash2, Wifi, Eye, EyeOff, ChevronRight, Building2, SlidersHorizontal, Star, Shield, Plane, Gift } from 'lucide-react'
import { useVaultStore } from '@/stores/vault-store'
import { VaultWizard, WizardField, WizardGrid, WizardSection, wizardInputCls, wizardSelectCls } from '@/components/vault/vault-wizard'
import { Button } from '@/components/ui/button'
import { searchCards, getBankNames, CARD_DATABASE, NETWORK_DISPLAY, TIER_LABELS, type BankCardTemplate, type CardNetwork, type CardTier } from '@/lib/card-database'
import type { CardWallet, CardWalletCreate } from '@/types/api'

const WIZARD_STEPS = [
  { id: 'template', label: 'Carte' },
  { id: 'personal', label: 'Perso' },
  { id: 'review', label: 'Confirmer' },
]

const INSURANCE_LABELS: Record<string, string> = {
  none: 'Aucune', basic: 'Basique', extended: 'Étendue', premium: 'Premium'
}

export default function CardsTab() {
  const { cards, createCard, deleteCard, isLoading } = useVaultStore()
  const [showWizard, setShowWizard] = useState(false)
  const [step, setStep] = useState(0)
  const [search, setSearch] = useState('')
  const [filterBank, setFilterBank] = useState('')
  const [showDetails, setShowDetails] = useState<string | null>(null)

  // Wizard state
  const [selectedTemplate, setSelectedTemplate] = useState<BankCardTemplate | null>(null)
  const [templateSearch, setTemplateSearch] = useState('')
  const [templateFilterBank, setTemplateFilterBank] = useState('')
  const [templateFilterNetwork, setTemplateFilterNetwork] = useState<CardNetwork | ''>('')
  const [templateFilterTier, setTemplateFilterTier] = useState<CardTier | ''>('')

  const [form, setForm] = useState({
    last_four: '',
    expiry_month: '',
    expiry_year: '',
    notes: '',
    // Override fields
    custom_name: '',
    custom_bank: '',
  })

  const bankNames = useMemo(() => getBankNames(), [])

  const resetForm = () => {
    setStep(0)
    setSelectedTemplate(null)
    setTemplateSearch('')
    setTemplateFilterBank('')
    setTemplateFilterNetwork('')
    setTemplateFilterTier('')
    setForm({ last_four: '', expiry_month: '', expiry_year: '', notes: '', custom_name: '', custom_bank: '' })
  }

  // Template search results
  const templateResults = useMemo(() => {
    return searchCards(templateSearch, {
      bank: templateFilterBank || undefined,
      network: (templateFilterNetwork as CardNetwork) || undefined,
      tier: (templateFilterTier as CardTier) || undefined,
    })
  }, [templateSearch, templateFilterBank, templateFilterNetwork, templateFilterTier])

  const handleCreate = useCallback(async () => {
    const tpl = selectedTemplate
    if (!tpl) return
    const data: CardWalletCreate = {
      card_name: form.custom_name || tpl.name,
      bank_name: form.custom_bank || tpl.bank,
      card_type: tpl.network,
      card_tier: tpl.tier,
      last_four: form.last_four || '0000',
      expiry_month: parseInt(form.expiry_month) || new Date().getMonth() + 1,
      expiry_year: parseInt(form.expiry_year) || new Date().getFullYear() + 3,
      annual_fee: tpl.annualFee,
      cashback_pct: tpl.cashbackPct || 0,
      insurance_level: tpl.insuranceLevel,
      benefits: tpl.benefits,
      notes: form.notes || undefined,
    }
    await createCard(data)
    setShowWizard(false)
    resetForm()
  }, [selectedTemplate, form, createCard])

  const canAdvance = step === 0 ? !!selectedTemplate : step === 1 ? true : true

  // Filter existing cards
  const filtered = cards.filter((c) => {
    if (search) {
      const q = search.toLowerCase()
      if (!c.card_name.toLowerCase().includes(q) && !c.bank_name.toLowerCase().includes(q)) return false
    }
    if (filterBank && c.bank_name !== filterBank) return false
    return true
  })

  const uniqueBanks = useMemo(() => Array.from(new Set(cards.map((c) => c.bank_name))).sort(), [cards])

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-tertiary" />
            <input className={`${wizardInputCls} pl-9`} placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {uniqueBanks.length > 1 && (
            <select className={`${wizardSelectCls} max-w-[180px]`} value={filterBank} onChange={(e) => setFilterBank(e.target.value)}>
              <option value="">Toutes les banques</option>
              {uniqueBanks.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          )}
        </div>
        <Button onClick={() => setShowWizard(true)}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter une carte
        </Button>
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-foreground-tertiary">
          <CreditCard className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-lg font-medium">Aucune carte bancaire</p>
          <p className="text-sm">Choisissez parmi 80+ cartes bancaires françaises & internationales</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence>
            {filtered.map((card, i) => (
              <StyledBankCard
                key={card.id}
                card={card}
                index={i}
                expanded={showDetails === card.id}
                onToggle={() => setShowDetails(showDetails === card.id ? null : card.id)}
                onDelete={deleteCard}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Wizard */}
      <VaultWizard
        open={showWizard}
        onClose={() => { setShowWizard(false); resetForm() }}
        title="Ajouter une carte bancaire"
        subtitle="Choisissez parmi notre base de données exhaustive"
        steps={WIZARD_STEPS}
        currentStep={step}
        onStepChange={setStep}
        onSubmit={handleCreate}
        canAdvance={canAdvance}
        isSubmitting={isLoading}
        accent="bg-blue-500"
      >
        {step === 0 && (
          <WizardSection>
            {/* Template search */}
            <div className="space-y-3 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-tertiary" />
                <input className={`${wizardInputCls} pl-9`} placeholder="Rechercher une carte..." value={templateSearch} onChange={(e) => setTemplateSearch(e.target.value)} />
              </div>
              <div className="flex gap-2 flex-wrap">
                <select className={`${wizardSelectCls} text-xs flex-1 min-w-[120px]`} value={templateFilterBank} onChange={(e) => setTemplateFilterBank(e.target.value)}>
                  <option value="">Toutes banques</option>
                  {bankNames.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                <select className={`${wizardSelectCls} text-xs flex-1 min-w-[100px]`} value={templateFilterNetwork} onChange={(e) => setTemplateFilterNetwork(e.target.value as any)}>
                  <option value="">Réseau</option>
                  {Object.entries(NETWORK_DISPLAY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select className={`${wizardSelectCls} text-xs flex-1 min-w-[100px]`} value={templateFilterTier} onChange={(e) => setTemplateFilterTier(e.target.value as any)}>
                  <option value="">Gamme</option>
                  {Object.entries(TIER_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>

            {/* Results */}
            <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1">
              {templateResults.length === 0 ? (
                <div className="text-center py-8 text-foreground-tertiary text-sm">Aucune carte trouvée</div>
              ) : (
                templateResults.map((tpl) => (
                  <TemplateRow
                    key={tpl.id}
                    tpl={tpl}
                    selected={selectedTemplate?.id === tpl.id}
                    onSelect={() => setSelectedTemplate(tpl)}
                  />
                ))
              )}
            </div>
          </WizardSection>
        )}

        {step === 1 && selectedTemplate && (
          <WizardSection title="Informations personnelles">
            {/* Template preview card */}
            <div className="mb-6">
              <MiniCardPreview tpl={selectedTemplate} lastFour={form.last_four || '••••'} expiryMonth={form.expiry_month} expiryYear={form.expiry_year} />
            </div>
            <WizardGrid>
              <WizardField label="4 derniers chiffres">
                <input className={wizardInputCls} value={form.last_four} onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); setForm((f) => ({ ...f, last_four: v })) }} placeholder="1234" maxLength={4} />
              </WizardField>
              <div className="flex gap-2">
                <WizardField label="Mois exp.">
                  <input type="number" min={1} max={12} className={wizardInputCls} value={form.expiry_month} onChange={(e) => setForm((f) => ({ ...f, expiry_month: e.target.value }))} placeholder="12" />
                </WizardField>
                <WizardField label="Année exp.">
                  <input type="number" min={2024} max={2040} className={wizardInputCls} value={form.expiry_year} onChange={(e) => setForm((f) => ({ ...f, expiry_year: e.target.value }))} placeholder="2027" />
                </WizardField>
              </div>
            </WizardGrid>
            <WizardField label="Notes">
              <textarea className={`${wizardInputCls} min-h-[60px] resize-none`} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Notes personnelles..." />
            </WizardField>
          </WizardSection>
        )}

        {step === 2 && selectedTemplate && (
          <WizardSection title="Récapitulatif">
            <div className="mb-6">
              <MiniCardPreview tpl={selectedTemplate} lastFour={form.last_four || '••••'} expiryMonth={form.expiry_month} expiryYear={form.expiry_year} />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-foreground-tertiary">Carte</span> <span className="font-medium">{selectedTemplate.name}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-foreground-tertiary">Banque</span> <span className="font-medium">{selectedTemplate.bank}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-foreground-tertiary">Réseau</span> <span className="font-medium">{NETWORK_DISPLAY[selectedTemplate.network].label}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-foreground-tertiary">Gamme</span> <span className="font-medium">{TIER_LABELS[selectedTemplate.tier].label}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-foreground-tertiary">Cotisation annuelle</span> <span className="font-medium">{selectedTemplate.annualFee === 0 ? 'Gratuite' : `${(selectedTemplate.annualFee / 100).toFixed(0)}€/an`}</span>
              </div>
              {selectedTemplate.cashbackPct > 0 && (
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-foreground-tertiary">Cashback</span> <span className="font-medium text-gain">{selectedTemplate.cashbackPct}%</span>
                </div>
              )}
              {selectedTemplate.benefits.length > 0 && (
                <div className="pt-2">
                  <p className="text-foreground-tertiary mb-2">Avantages :</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTemplate.benefits.map((b, i) => (
                      <span key={i} className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs">{b}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </WizardSection>
        )}
      </VaultWizard>
    </div>
  )
}

/* ── Template Row in picker ───────────────────────────── */

function TemplateRow({ tpl, selected, onSelect }: { tpl: BankCardTemplate; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 p-3 rounded-omni border-2 text-left transition-all ${selected ? 'border-blue-500 bg-blue-500/10' : 'border-border hover:border-foreground-tertiary bg-background'}`}
    >
      {/* Mini card icon */}
      <div className={`w-12 h-8 rounded-md flex items-center justify-center text-xs font-bold ${tpl.gradient} ${tpl.textColor}`} style={{ fontSize: '8px' }}>
        {NETWORK_DISPLAY[tpl.network].label}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{tpl.name}</p>
        <p className="text-xs text-foreground-tertiary">{tpl.bank} • {TIER_LABELS[tpl.tier].label}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-medium">{tpl.annualFee === 0 ? 'Gratuite' : `${(tpl.annualFee / 100).toFixed(0)}€/an`}</p>
        {tpl.contactless && <p className="text-[10px] text-foreground-tertiary">Sans contact</p>}
      </div>
      {selected && <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center"><ChevronRight className="h-3 w-3 text-white" /></div>}
    </button>
  )
}

/* ── Mini Card Preview (wizard) ───────────────────────── */

function MiniCardPreview({ tpl, lastFour, expiryMonth, expiryYear }: { tpl: BankCardTemplate; lastFour: string; expiryMonth: string; expiryYear: string }) {
  return (
    <div className={`relative w-full max-w-sm mx-auto aspect-[1.586/1] rounded-omni-lg overflow-hidden shadow-2xl ${tpl.gradient}`}>
      {/* Pattern overlay */}
      {tpl.pattern === 'dots' && (
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full border-[30px] border-white/30" />
          <div className="absolute -bottom-5 -left-5 w-32 h-32 rounded-full border-[20px] border-white/20" />
        </div>
      )}
      {tpl.pattern === 'lines' && (
        <div className="absolute inset-0 opacity-5">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="absolute h-px bg-white" style={{ top: `${i * 8}%`, left: 0, right: 0, transform: 'rotate(-25deg)' }} />
          ))}
        </div>
      )}
      {tpl.pattern === 'waves' && (
        <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 400 250" preserveAspectRatio="none">
          <path d="M0,100 C100,80 200,120 400,90 L400,250 L0,250Z" fill="white" />
          <path d="M0,150 C150,130 300,170 400,140 L400,250 L0,250Z" fill="white" opacity="0.5" />
        </svg>
      )}
      {tpl.pattern === 'circuit' && (
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
      )}

      <div className={`relative h-full flex flex-col justify-between p-5 ${tpl.textColor}`}>
        {/* Top: bank + contactless */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold tracking-wide opacity-90">{tpl.bank}</span>
          {tpl.contactless && <Wifi className="h-4 w-4 opacity-60 rotate-90" />}
        </div>

        {/* Chip */}
        <div className="flex items-center gap-3 my-1">
          <div className="w-10 h-7 rounded-md bg-gradient-to-br from-yellow-300/80 to-yellow-600/80 border border-yellow-500/30" />
        </div>

        {/* Number */}
        <div className="flex items-center gap-3 text-base tracking-[0.2em] font-mono opacity-90">
          <span>••••</span> <span>••••</span> <span>••••</span> <span>{lastFour || '••••'}</span>
        </div>

        {/* Bottom: expiry + network */}
        <div className="flex items-end justify-between -mb-1">
          <div>
            <p className="text-[9px] uppercase tracking-wider opacity-60">Expire fin</p>
            <p className="text-sm font-mono tracking-wider">
              {expiryMonth ? expiryMonth.padStart(2, '0') : 'MM'}/{expiryYear ? expiryYear.slice(-2) : 'YY'}
            </p>
          </div>
          <span className="text-sm font-bold tracking-wide opacity-80">{NETWORK_DISPLAY[tpl.network].label}</span>
        </div>
      </div>
    </div>
  )
}

/* ── Styled Bank Card (collection view) ───────────────── */

function StyledBankCard({ card, index, expanded, onToggle, onDelete }: {
  card: CardWallet; index: number; expanded: boolean; onToggle: () => void; onDelete: (id: string) => void
}) {
  const [flipped, setFlipped] = useState(false)
  const [showNumber, setShowNumber] = useState(false)

  // Try to find matching template
  const tpl = CARD_DATABASE.find(
    (t: BankCardTemplate) => t.name.toLowerCase() === card.card_name.toLowerCase() ||
           (t.bank.toLowerCase() === card.bank_name.toLowerCase() && t.tier === card.card_tier)
  )

  const gradient = tpl?.gradient || 'bg-gradient-to-br from-gray-800 to-gray-900'
  const textColor = tpl?.textColor || 'text-white'
  const pattern = tpl?.pattern || 'dots'
  const network = card.card_type as CardNetwork
  const isExpired = card.is_expired

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05 }}
      className="flex flex-col gap-3"
    >
      {/* Card with flip animation */}
      <div
        className="relative w-full aspect-[1.586/1] cursor-pointer [perspective:1000px]"
        onClick={() => setFlipped(!flipped)}
      >
        <motion.div
          className="w-full h-full relative [transform-style:preserve-3d]"
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: 'spring', stiffness: 300, damping: 30 }}
        >
          {/* Front */}
          <div
            className={`absolute inset-0 rounded-omni-lg overflow-hidden shadow-2xl ${gradient} ${isExpired ? 'opacity-60' : ''}`}
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
          >
            {/* Pattern */}
            {pattern === 'dots' && (
              <div className="absolute inset-0 opacity-10">
                <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full border-[30px] border-white/30" />
                <div className="absolute -bottom-5 -left-5 w-32 h-32 rounded-full border-[20px] border-white/20" />
              </div>
            )}
            {pattern === 'lines' && (
              <div className="absolute inset-0 opacity-5">
                {Array.from({ length: 15 }).map((_, i) => (
                  <div key={i} className="absolute h-px bg-white" style={{ top: `${i * 10}%`, left: 0, right: 0, transform: 'rotate(-25deg)' }} />
                ))}
              </div>
            )}
            {pattern === 'waves' && (
              <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 400 250" preserveAspectRatio="none">
                <path d="M0,100 C100,80 200,120 400,90 L400,250 L0,250Z" fill="white" />
                <path d="M0,150 C150,130 300,170 400,140 L400,250 L0,250Z" fill="white" opacity="0.5" />
              </svg>
            )}
            {pattern === 'circuit' && (
              <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            )}

            <div className={`relative h-full flex flex-col justify-between p-5 ${textColor}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold tracking-wide opacity-90">{card.bank_name}</span>
                <div className="flex items-center gap-2">
                  {isExpired && <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/80 text-white font-bold">EXPIRÉE</span>}
                  {tpl?.contactless && <Wifi className="h-4 w-4 opacity-60 rotate-90" />}
                </div>
              </div>

              <div className="w-10 h-7 rounded-md bg-gradient-to-br from-yellow-300/80 to-yellow-600/80 border border-yellow-500/30" />

              <div className="flex items-center gap-3 text-lg tracking-[0.24em] font-mono opacity-90">
                <span>••••</span> <span>••••</span> <span>••••</span>
                <span>{showNumber ? card.last_four : '••••'}</span>
                <button onClick={(e) => { e.stopPropagation(); setShowNumber(!showNumber) }} className="ml-1 opacity-60 hover:opacity-100 transition-opacity">
                  {showNumber ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>

              <div className="flex items-end justify-between -mb-1">
                <div>
                  <p className="text-[9px] uppercase tracking-wider opacity-60">{card.card_name}</p>
                  <p className="text-sm font-mono tracking-wider">{String(card.expiry_month).padStart(2, '0')}/{String(card.expiry_year).slice(-2)}</p>
                </div>
                <span className="text-lg font-bold tracking-wide opacity-80">{NETWORK_DISPLAY[network]?.label || card.card_type?.toUpperCase()}</span>
              </div>
            </div>
          </div>

          {/* Back */}
          <div
            className={`absolute inset-0 rounded-omni-lg overflow-hidden shadow-2xl ${gradient}`}
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <div className={`relative h-full ${textColor}`}>
              <div className="w-full h-10 bg-black/40 mt-8" />
              <div className="px-5 mt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-8 bg-white/20 rounded-sm flex items-center justify-end pr-3">
                    <span className="text-sm font-mono tracking-wider opacity-70">•••</span>
                  </div>
                </div>
                <div className="text-xs opacity-60 space-y-1.5 mt-4">
                  <p className="flex justify-between"><span>Gamme:</span> <span className="font-medium">{TIER_LABELS[card.card_tier as CardTier]?.label || card.card_tier}</span></p>
                  <p className="flex justify-between"><span>Assurance:</span> <span className="font-medium">{INSURANCE_LABELS[card.insurance_level] || card.insurance_level}</span></p>
                  <p className="flex justify-between"><span>Cotisation:</span> <span className="font-medium">{card.annual_fee ? `${(card.annual_fee / 100).toFixed(0)}€/an` : 'Gratuite'}</span></p>
                  {card.cashback_pct > 0 && <p className="flex justify-between"><span>Cashback:</span> <span className="font-medium">{card.cashback_pct}%</span></p>}
                </div>
              </div>
              <div className="absolute bottom-4 left-5 right-5 text-[9px] opacity-40 text-center">
                Cliquez pour retourner
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Card details / actions bar below card */}
      <div className="flex items-center justify-between px-1">
        <div>
          <p className="text-sm font-semibold">{card.card_name}</p>
          <p className="text-xs text-foreground-tertiary flex items-center gap-1">
            <Building2 className="h-3 w-3" /> {card.bank_name}
            {card.cashback_pct > 0 && <> • <Gift className="h-3 w-3 text-gain" /> {card.cashback_pct}%</>}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {(card.benefits as any[])?.length > 0 && (
            <button onClick={onToggle} className="p-1.5 rounded-omni-sm hover:bg-surface text-foreground-tertiary hover:text-foreground transition-colors">
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          )}
          <button onClick={() => onDelete(card.id)} className="p-1.5 rounded-omni-sm hover:bg-loss/10 text-foreground-tertiary hover:text-loss transition-colors">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Expandable benefits */}
      <AnimatePresence>
        {expanded && (card.benefits as any[])?.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-1.5 px-1 pb-2">
              {(card.benefits as any[]).map((b: any, i: number) => (
                <span key={i} className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs">
                  {typeof b === 'string' ? b : b.description || JSON.stringify(b)}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
