'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle,
  Gift,
  RefreshCw,
  Settings,
  Shield,
  Sliders,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useHeritageStore } from '@/stores/heritage-store'
import { formatAmount } from '@/lib/format'
import type {
  Heir,
  HeirResult,
  DonationScenario,
  TimelinePoint,
} from '@/types/api'

// ── Tabs ─────────────────────────────────────────────────────

type TabKey = 'succession' | 'donations' | 'timeline' | 'profil'

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'succession', label: 'Succession', icon: Shield },
  { key: 'donations', label: 'Donations', icon: Gift },
  { key: 'timeline', label: 'Timeline', icon: TrendingUp },
  { key: 'profil', label: 'Profil', icon: Settings },
]

const RELATIONSHIPS: Record<string, string> = {
  conjoint: 'Conjoint(e)',
  enfant: 'Enfant',
  petit_enfant: 'Petit-enfant',
  frere_soeur: 'Frère / Sœur',
  neveu_niece: 'Neveu / Nièce',
  tiers: 'Tiers',
}

const REGIMES: { value: string; label: string }[] = [
  { value: 'communaute', label: 'Communauté réduite aux acquêts' },
  { value: 'separation', label: 'Séparation de biens' },
  { value: 'pacs', label: 'PACS' },
  { value: 'concubinage', label: 'Concubinage' },
  { value: 'universel', label: 'Communauté universelle' },
]

function formatEur(centimes: number): string {
  return formatAmount(centimes)
}

// ── Main Page ────────────────────────────────────────────────

export default function HeritagePage() {
  const {
    profile,
    simulation,
    donationOptimization,
    timeline,
    isLoading,
    isSimulating,
    isOptimizing,
    isSaving,
    error,
    fetchAll,
    updateProfile,
    runSimulation,
    runDonationOptimization,
    fetchTimeline,
    clearError,
  } = useHeritageStore()

  const [activeTab, setActiveTab] = useState<TabKey>('succession')

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ── Profile form state ────────────────────────────────────
  const [regime, setRegime] = useState('communaute')
  const [heirs, setHeirs] = useState<Heir[]>([])
  const [liBefore70, setLiBefore70] = useState(0)
  const [liAfter70, setLiAfter70] = useState(0)

  useEffect(() => {
    if (profile) {
      setRegime(profile.marital_regime)
      setHeirs(profile.heirs || [])
      setLiBefore70(profile.life_insurance_before_70 / 100)
      setLiAfter70(profile.life_insurance_after_70 / 100)
    }
  }, [profile])

  const handleSaveProfile = async () => {
    try {
      await updateProfile({
        marital_regime: regime,
        heirs,
        life_insurance_before_70: Math.round(liBefore70 * 100),
        life_insurance_after_70: Math.round(liAfter70 * 100),
      })
      await runSimulation()
    } catch {}
  }

  const addHeir = () => {
    setHeirs([...heirs, { name: '', relationship: 'enfant', age: null, handicap: false }])
  }

  const removeHeir = (index: number) => {
    setHeirs(heirs.filter((_, i) => i !== index))
  }

  const updateHeir = (index: number, field: keyof Heir, value: any) => {
    const updated = [...heirs]
    ;(updated[index] as any)[field] = value
    setHeirs(updated)
  }

  // ── Waterfall data ─────────────────────────────────────────
  const waterfallSteps = useMemo(() => {
    if (!simulation) return []
    const totalAbattement = simulation.heirs_detail.reduce((s, h) => s + h.abattement, 0)
    return [
      { label: 'Patrimoine brut', value: simulation.patrimoine_brut, color: 'bg-blue-500' },
      { label: 'Abattements', value: -totalAbattement, color: 'bg-emerald-500' },
      { label: 'Droits de succession', value: -simulation.total_droits, color: 'bg-red-500' },
      { label: 'Net transmis', value: simulation.total_net_transmis, color: 'bg-violet-500' },
    ]
  }, [simulation])

  if (isLoading && !simulation) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20">
            <Users className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Simulateur de Succession</h1>
            <p className="text-sm text-muted-foreground">
              Droits de succession · Donations · Assurance-vie · Démembrement
            </p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => fetchAll()} disabled={isSimulating}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isSimulating ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-400 text-sm"
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
            <button onClick={clearError} className="ml-auto underline">Fermer</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPI Cards */}
      {simulation && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            label="Patrimoine brut"
            value={formatEur(simulation.patrimoine_brut)}
            icon={<BarChart3 className="w-5 h-5" />}
          />
          <KPICard
            label="Droits de succession"
            value={formatEur(simulation.total_droits)}
            icon={<Shield className="w-5 h-5" />}
            color="text-red-400"
          />
          <KPICard
            label="Net transmis"
            value={formatEur(simulation.total_net_transmis)}
            icon={<Gift className="w-5 h-5" />}
            color="text-emerald-400"
          />
          <KPICard
            label="Taux effectif"
            value={`${simulation.taux_effectif_global_pct}%`}
            icon={<TrendingUp className="w-5 h-5" />}
            color={simulation.taux_effectif_global_pct > 20 ? 'text-red-400' : 'text-amber-400'}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-alt rounded-lg p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key)
              if (tab.key === 'donations' && !donationOptimization) runDonationOptimization()
              if (tab.key === 'timeline' && !timeline) fetchTimeline()
            }}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium
              transition-colors flex-1 justify-center
              ${activeTab === tab.key
                ? 'bg-surface text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'}
            `}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'succession' && simulation && (
          <motion.div
            key="succ"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            {/* Waterfall Chart */}
            <div className="bg-surface rounded-xl p-6 border border-border">
              <h3 className="text-lg font-semibold mb-4">Répartition successorale</h3>
              <div className="flex items-end gap-4 h-48">
                {waterfallSteps.map((step, i) => {
                  const maxVal = Math.max(...waterfallSteps.map(s => Math.abs(s.value)), 1)
                  const h = (Math.abs(step.value) / maxVal) * 100
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs font-medium">{formatEur(Math.abs(step.value))}</span>
                      <div className="w-full flex flex-col justify-end h-36">
                        <div
                          className={`w-full rounded-t-lg ${step.color} transition-all duration-500`}
                          style={{ height: `${Math.max(h, 4)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground text-center">{step.label}</span>
                      {step.value < 0 && (
                        <span className="text-xs text-red-400">−</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Heirs Detail Table */}
            <div className="bg-surface rounded-xl p-6 border border-border">
              <h3 className="text-lg font-semibold mb-4">Détail par héritier</h3>
              {simulation.heirs_detail.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ajoutez des héritiers dans l&apos;onglet Profil pour voir la répartition.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left py-2 px-3">Héritier</th>
                        <th className="text-left py-2 px-3">Lien</th>
                        <th className="text-right py-2 px-3">Part brute</th>
                        <th className="text-right py-2 px-3">Abattement</th>
                        <th className="text-right py-2 px-3">Taxable</th>
                        <th className="text-right py-2 px-3">Droits</th>
                        <th className="text-right py-2 px-3">Net reçu</th>
                        <th className="text-right py-2 px-3">Taux</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simulation.heirs_detail.map((heir, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-surface-alt/50">
                          <td className="py-2 px-3 font-medium">{heir.name || 'Inconnu'}</td>
                          <td className="py-2 px-3 text-muted-foreground">{RELATIONSHIPS[heir.relationship] || heir.relationship}</td>
                          <td className="py-2 px-3 text-right">{formatEur(heir.part_brute)}</td>
                          <td className="py-2 px-3 text-right text-emerald-400">{formatEur(heir.abattement)}</td>
                          <td className="py-2 px-3 text-right">{formatEur(heir.taxable)}</td>
                          <td className="py-2 px-3 text-right text-red-400">{formatEur(heir.droits)}</td>
                          <td className="py-2 px-3 text-right font-semibold">{formatEur(heir.net_recu)}</td>
                          <td className="py-2 px-3 text-right text-muted-foreground">{heir.taux_effectif_pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Life Insurance & Demembrement */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {simulation.life_insurance_detail && (
                <div className="bg-surface rounded-xl p-5 border border-border">
                  <h4 className="font-semibold mb-2">Assurance-vie</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avant 70 ans</span>
                      <span>{formatEur(simulation.life_insurance_detail.amount_before_70)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Après 70 ans</span>
                      <span>{formatEur(simulation.life_insurance_detail.amount_after_70)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-1 mt-1">
                      <span className="text-muted-foreground">Taxe totale AV</span>
                      <span className="text-red-400 font-medium">{formatEur(simulation.life_insurance_detail.total_tax)}</span>
                    </div>
                  </div>
                </div>
              )}
              {simulation.demembrement_detail && (
                <div className="bg-surface rounded-xl p-5 border border-border">
                  <h4 className="font-semibold mb-2">Démembrement (art. 669 CGI)</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Âge usufruitier</span>
                      <span>{simulation.demembrement_detail.usufructuary_age} ans</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Usufruit ({simulation.demembrement_detail.usufruit_pct}%)</span>
                      <span>{formatEur(simulation.demembrement_detail.usufruit_value)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nue-propriété ({simulation.demembrement_detail.nue_propriete_pct}%)</span>
                      <span>{formatEur(simulation.demembrement_detail.nue_propriete_value)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'donations' && (
          <motion.div
            key="don"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            {isOptimizing ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
              </div>
            ) : donationOptimization ? (
              <>
                <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 rounded-xl p-5 border border-violet-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-5 h-5 text-violet-400" />
                    <h3 className="font-semibold">Recommandation</h3>
                  </div>
                  <p className="text-sm">{donationOptimization.summary}</p>
                  {donationOptimization.economy_max > 0 && (
                    <div className="mt-2 text-2xl font-bold text-emerald-400">
                      Économie max : {formatEur(donationOptimization.economy_max)}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {donationOptimization.scenarios.map((scenario, i) => (
                    <ScenarioCard
                      key={i}
                      scenario={scenario}
                      isBest={scenario.label === donationOptimization.best_scenario}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Gift className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Ajoutez des héritiers pour voir les scénarios de donation</p>
                <Button className="mt-4" onClick={() => runDonationOptimization()}>
                  Analyser les donations
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'timeline' && (
          <motion.div
            key="timeline"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            {timeline ? (
              <div className="bg-surface rounded-xl p-6 border border-border">
                <h3 className="text-lg font-semibold mb-4">Projection sur {timeline.points.length - 1} ans</h3>
                <div className="overflow-x-auto">
                  <div className="flex items-end gap-[2px] h-64 min-w-[700px]">
                    {timeline.points.filter((_, i) => i % 2 === 0).map((pt, i) => {
                      const maxVal = Math.max(...timeline.points.map(p => p.patrimoine_projete), 1)
                      const hPatrimoine = (pt.patrimoine_projete / maxVal) * 100
                      const hNet = (pt.net_transmis / maxVal) * 100
                      return (
                        <div key={i} className="flex flex-col items-center flex-1 relative group">
                          <div className="absolute bottom-full mb-2 hidden group-hover:block bg-surface-alt border border-border rounded-lg p-2 text-xs z-10 whitespace-nowrap shadow-lg">
                            <div className="font-semibold">{pt.year}</div>
                            <div>Patrimoine: {formatEur(pt.patrimoine_projete)}</div>
                            <div>Droits: {formatEur(pt.droits_si_succession)}</div>
                            <div>Net transmis: {formatEur(pt.net_transmis)}</div>
                            {pt.donation_abattement_available && (
                              <div className="text-emerald-400">✓ Abattement renouvelable</div>
                            )}
                          </div>
                          <div className="w-full flex flex-col items-center justify-end h-full">
                            <div
                              className="w-full rounded-t-sm bg-blue-500/30 relative"
                              style={{ height: `${hPatrimoine}%` }}
                            >
                              <div
                                className="absolute bottom-0 w-full bg-emerald-500/70 rounded-t-sm"
                                style={{ height: `${hPatrimoine > 0 ? (hNet / hPatrimoine) * 100 : 0}%` }}
                              />
                              {pt.donation_abattement_available && (
                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-violet-500" />
                              )}
                            </div>
                          </div>
                          {i % 3 === 0 && (
                            <span className="text-[10px] text-muted-foreground mt-1">{pt.year}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-500/30 inline-block" /> Patrimoine projeté</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500/70 inline-block" /> Net transmis</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500 inline-block" /> Renouvellement abattements</span>
                </div>

                {timeline.donation_renewal_years.length > 0 && (
                  <div className="mt-4 p-3 bg-violet-500/10 rounded-lg border border-violet-500/20 text-sm">
                    <strong>Renouvellement des abattements :</strong> {timeline.donation_renewal_years.join(', ')} — Vous pourrez à nouveau donner {formatEur(10_000_000)} par enfant en franchise de droits.
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <Skeleton className="h-64 rounded-xl" />
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'profil' && (
          <motion.div
            key="profil"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            <div className="bg-surface rounded-xl p-6 border border-border max-w-3xl">
              <h3 className="text-lg font-semibold mb-4">Configuration succession</h3>

              {/* Marital regime */}
              <div className="mb-6">
                <label className="text-sm text-muted-foreground block mb-1">Régime matrimonial</label>
                <select
                  value={regime}
                  onChange={(e) => setRegime(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm"
                >
                  {REGIMES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              {/* Life insurance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Assurance-vie avant 70 ans (€)</label>
                  <input
                    type="number"
                    value={liBefore70}
                    onChange={(e) => setLiBefore70(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Assurance-vie après 70 ans (€)</label>
                  <input
                    type="number"
                    value={liAfter70}
                    onChange={(e) => setLiAfter70(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm"
                  />
                </div>
              </div>

              {/* Heirs */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-sm">Héritiers</h4>
                  <Button size="sm" variant="secondary" onClick={addHeir}>
                    + Ajouter
                  </Button>
                </div>
                {heirs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun héritier configuré.</p>
                ) : (
                  <div className="space-y-3">
                    {heirs.map((heir, i) => (
                      <div key={i} className="flex items-center gap-2 bg-surface-alt rounded-lg p-3 border border-border">
                        <input
                          type="text"
                          placeholder="Nom"
                          value={heir.name}
                          onChange={(e) => updateHeir(i, 'name', e.target.value)}
                          className="flex-1 px-2 py-1 rounded bg-surface border border-border text-sm"
                        />
                        <select
                          value={heir.relationship}
                          onChange={(e) => updateHeir(i, 'relationship', e.target.value)}
                          className="px-2 py-1 rounded bg-surface border border-border text-sm"
                        >
                          {Object.entries(RELATIONSHIPS).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          placeholder="Âge"
                          value={heir.age ?? ''}
                          onChange={(e) => updateHeir(i, 'age', e.target.value ? Number(e.target.value) : null)}
                          className="w-16 px-2 py-1 rounded bg-surface border border-border text-sm"
                        />
                        <label className="flex items-center gap-1 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={heir.handicap}
                            onChange={(e) => updateHeir(i, 'handicap', e.target.checked)}
                            className="rounded"
                          />
                          Hand.
                        </label>
                        <button
                          onClick={() => removeHeir(i)}
                          className="text-red-400 hover:text-red-300 text-sm px-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={isSaving}>
                  {isSaving ? 'Enregistrement…' : 'Enregistrer & Simuler'}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────

function KPICard({ label, value, icon, color }: {
  label: string; value: string; icon: React.ReactNode; color?: string
}) {
  return (
    <div className="bg-surface rounded-xl p-4 border border-border">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className={`text-xl font-bold ${color || ''}`}>{value}</div>
    </div>
  )
}

function ScenarioCard({ scenario, isBest }: { scenario: DonationScenario; isBest: boolean }) {
  return (
    <div className={`bg-surface rounded-xl p-4 border ${isBest ? 'border-violet-500/50 bg-violet-500/5' : 'border-border'}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            {isBest && <CheckCircle className="w-4 h-4 text-violet-400" />}
            <h4 className="font-semibold">{scenario.label}</h4>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{scenario.description}</p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-emerald-400">
            {scenario.economy_vs_no_donation > 0
              ? `−${formatEur(scenario.economy_vs_no_donation)}`
              : '—'}
          </div>
          <div className="text-xs text-muted-foreground">
            Nouveaux droits : {formatEur(scenario.new_total_droits)}
          </div>
        </div>
      </div>
    </div>
  )
}
