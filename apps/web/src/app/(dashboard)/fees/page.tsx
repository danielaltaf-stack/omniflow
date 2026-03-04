'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle,
  ClipboardCopy,
  Download,
  FileText,
  RefreshCw,
  Scissors,
  Send,
  Shield,
  TrendingDown,
  Zap,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useFeeNegotiatorStore } from '@/stores/fee-negotiator-store'
import { formatAmount } from '@/lib/format'
import type { BankAlternative, BankFeeSchedule, FeeBreakdownItem } from '@/types/api'

// ── Tabs ─────────────────────────────────────────────────────

type TabKey = 'analyse' | 'comparatif' | 'negociation' | 'grilles'

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'analyse', label: 'Analyse', icon: BarChart3 },
  { key: 'comparatif', label: 'Comparatif', icon: TrendingDown },
  { key: 'negociation', label: 'Négociation', icon: FileText },
  { key: 'grilles', label: 'Grilles', icon: Shield },
]

const STATUS_STEPS = [
  { key: 'draft', label: 'Brouillon' },
  { key: 'sent', label: 'Envoyé' },
  { key: 'waiting', label: 'En attente' },
  { key: 'resolved_success', label: 'Résolu ✓' },
]

const FEE_FIELD_LABELS: Record<string, string> = {
  fee_account_maintenance: 'Tenue de compte',
  fee_card_classic: 'Carte classique',
  fee_card_premium: 'Carte premium',
  fee_card_international: 'Frais carte intl.',
  fee_overdraft_commission: 'Agios / Commissions',
  fee_transfer_sepa: 'Virement SEPA',
  fee_transfer_intl: 'Virement intl.',
  fee_check: 'Chéquier',
  fee_insurance_card: 'Assurance carte',
  fee_reject: 'Frais de rejet',
  fee_atm_other_bank: 'Retrait DAB autre',
}

function formatEur(centimes: number): string {
  return formatAmount(centimes)
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-red-400'
  if (score >= 40) return 'text-amber-400'
  return 'text-emerald-400'
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Très surfacturé'
  if (score >= 60) return 'Surfacturé'
  if (score >= 40) return 'Dans la moyenne'
  if (score >= 20) return 'Compétitif'
  return 'Excellent'
}

// ── Main Page ────────────────────────────────────────────────

export default function FeesPage() {
  const {
    analysis,
    scan,
    alternatives,
    letter,
    schedules,
    isLoading,
    isScanning,
    isGenerating,
    error,
    fetchAll,
    runScan,
    fetchCompare,
    generateLetter,
    updateStatus,
    fetchSchedules,
    clearError,
  } = useFeeNegotiatorStore()

  const [activeTab, setActiveTab] = useState<TabKey>('analyse')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const hasScanned = analysis && analysis.total_fees_annual > 0

  if (isLoading && !analysis) {
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
          <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20">
            <Scissors className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Fee Negotiator</h1>
            <p className="text-sm text-muted-foreground">
              Analyse de frais · Comparatif multibanque · Lettre de négociation
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => runScan()}
          disabled={isScanning}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
          {isScanning ? 'Scan en cours…' : hasScanned ? 'Re-scanner' : 'Scanner mes frais'}
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
      {analysis && hasScanned && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            label="Frais annuels"
            value={formatEur(analysis.total_fees_annual)}
            icon={<BarChart3 className="w-5 h-5" />}
            color="text-red-400"
          />
          <KPICard
            label="Score surfacturation"
            value={`${analysis.overcharge_score}/100`}
            icon={<Shield className="w-5 h-5" />}
            color={scoreColor(analysis.overcharge_score)}
            subtitle={scoreLabel(analysis.overcharge_score)}
          />
          <KPICard
            label="Meilleure alternative"
            value={analysis.best_alternative_slug?.replace('_', ' ') || '—'}
            icon={<TrendingDown className="w-5 h-5" />}
          />
          <KPICard
            label="Économie potentielle"
            value={formatEur(analysis.best_alternative_saving)}
            icon={<Zap className="w-5 h-5" />}
            color="text-emerald-400"
          />
        </div>
      )}

      {/* No scan yet prompt */}
      {!hasScanned && !isScanning && (
        <div className="text-center py-16 bg-surface rounded-xl border border-border">
          <Scissors className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">Aucune analyse de frais</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Lancez un scan pour analyser 12 mois de frais bancaires, les comparer au marché
            et générer une lettre de négociation personnalisée.
          </p>
          <Button onClick={() => runScan()}>
            <Scissors className="w-4 h-4 mr-2" />
            Lancer l&apos;analyse
          </Button>
        </div>
      )}

      {/* Tabs — only show if scanned */}
      {hasScanned && (
        <>
          <div className="flex gap-1 bg-surface-alt rounded-lg p-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key)
                  if (tab.key === 'comparatif' && alternatives.length === 0) fetchCompare()
                  if (tab.key === 'grilles' && schedules.length === 0) fetchSchedules()
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

          <AnimatePresence mode="wait">
            {/* ── Analyse Tab ──────────────────────────────── */}
            {activeTab === 'analyse' && (
              <motion.div
                key="analyse"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                {/* Horizontal bar chart — fees by type */}
                <div className="bg-surface rounded-xl p-6 border border-border">
                  <h3 className="text-lg font-semibold mb-4">Répartition par type de frais</h3>
                  {scan?.fees_by_type && scan.fees_by_type.length > 0 ? (
                    <div className="space-y-3">
                      {scan.fees_by_type.map((item, i) => {
                        const maxVal = Math.max(...scan.fees_by_type.map(f => f.annual_total), 1)
                        const pct = (item.annual_total / maxVal) * 100
                        return (
                          <div key={i}>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span>{item.label}</span>
                              <span className="font-medium">{formatEur(item.annual_total)}</span>
                            </div>
                            <div className="w-full h-3 bg-surface-alt rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all duration-700"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {item.count} opération(s) · moy. {formatEur(item.monthly_avg)}/mois
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <FeesByTypeFromAnalysis analysis={analysis!} />
                  )}
                </div>

                {/* Monthly timeline */}
                {scan?.monthly_breakdown && scan.monthly_breakdown.length > 0 && (
                  <div className="bg-surface rounded-xl p-6 border border-border">
                    <h3 className="text-lg font-semibold mb-4">Évolution mensuelle (12 mois)</h3>
                    <div className="flex items-end gap-1 h-40">
                      {scan.monthly_breakdown.map((m, i) => {
                        const maxMonth = Math.max(...scan.monthly_breakdown.map(x => x.total), 1)
                        const h = (m.total / maxMonth) * 100
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center group relative">
                            <div className="absolute bottom-full mb-2 hidden group-hover:block bg-surface-alt border border-border rounded-lg p-2 text-xs z-10 whitespace-nowrap shadow-lg">
                              <div className="font-semibold">{m.month}</div>
                              <div>{formatEur(m.total)}</div>
                            </div>
                            <div className="w-full flex flex-col justify-end h-full">
                              <div
                                className="w-full rounded-t-sm bg-gradient-to-t from-orange-500/60 to-red-500/40 transition-all duration-500"
                                style={{ height: `${Math.max(h, 3)}%` }}
                              />
                            </div>
                            {i % 2 === 0 && (
                              <span className="text-[10px] text-muted-foreground mt-1">
                                {m.month.slice(5)}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Comparatif Tab ───────────────────────────── */}
            {activeTab === 'comparatif' && (
              <motion.div
                key="comparatif"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                {/* Top 3 podium */}
                {analysis?.top_alternatives && analysis.top_alternatives.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {(analysis.top_alternatives as BankAlternative[]).slice(0, 3).map((alt, i) => (
                        <div
                          key={alt.bank_slug}
                          className={`bg-surface rounded-xl p-5 border ${i === 0 ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-border'}`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            {i === 0 && <CheckCircle className="w-5 h-5 text-emerald-400" />}
                            <span className="text-xs font-medium text-muted-foreground">
                              #{i + 1}
                            </span>
                            <h4 className="font-semibold">{alt.bank_name}</h4>
                            {alt.is_online && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                                En ligne
                              </span>
                            )}
                          </div>
                          <div className="text-2xl font-bold text-emerald-400 mb-1">
                            −{formatEur(alt.saving)}/an
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Coût estimé : {formatEur(alt.total_there)}/an ({alt.pct_saving}% d&apos;économie)
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Full comparison table */}
                    {alternatives.length > 0 && (
                      <div className="bg-surface rounded-xl p-6 border border-border overflow-x-auto">
                        <h3 className="text-lg font-semibold mb-4">Comparatif complet</h3>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border text-muted-foreground">
                              <th className="text-left py-2 px-3">Banque</th>
                              <th className="text-center py-2 px-3">Type</th>
                              <th className="text-right py-2 px-3">Coût annuel</th>
                              <th className="text-right py-2 px-3">Économie</th>
                              <th className="text-right py-2 px-3">%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {alternatives.map((alt, i) => (
                              <tr
                                key={alt.bank_slug}
                                className={`border-b border-border/50 ${i === 0 ? 'bg-emerald-500/5' : ''}`}
                              >
                                <td className="py-2 px-3 font-medium">{alt.bank_name}</td>
                                <td className="py-2 px-3 text-center">
                                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${alt.is_online ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                    {alt.is_online ? 'En ligne' : 'Agence'}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-right">{formatEur(alt.total_there)}</td>
                                <td className="py-2 px-3 text-right text-emerald-400 font-medium">
                                  {alt.saving > 0 ? `−${formatEur(alt.saving)}` : '—'}
                                </td>
                                <td className="py-2 px-3 text-right text-muted-foreground">
                                  {alt.pct_saving}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <TrendingDown className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Lancez un scan pour voir les comparatifs</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Négociation Tab ──────────────────────────── */}
            {activeTab === 'negociation' && (
              <motion.div
                key="negociation"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                {/* Pipeline stepper */}
                <div className="bg-surface rounded-xl p-6 border border-border">
                  <h3 className="text-lg font-semibold mb-4">Pipeline de négociation</h3>
                  <div className="flex items-center gap-2">
                    {STATUS_STEPS.map((step, i) => {
                      const currentIdx = STATUS_STEPS.findIndex(
                        s => s.key === analysis?.negotiation_status
                      )
                      const isActive = i <= currentIdx
                      const isCurrent = i === currentIdx
                      return (
                        <div key={step.key} className="flex items-center gap-2 flex-1">
                          <div
                            className={`
                              flex items-center gap-2 px-3 py-2 rounded-lg text-sm flex-1 text-center justify-center
                              ${isActive
                                ? isCurrent
                                  ? 'bg-orange-500/20 text-orange-400 font-semibold'
                                  : 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-surface-alt text-muted-foreground'
                              }
                            `}
                          >
                            {isActive && !isCurrent && <CheckCircle className="w-3.5 h-3.5" />}
                            {step.label}
                          </div>
                          {i < STATUS_STEPS.length - 1 && (
                            <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Generate or show letter */}
                {!analysis?.negotiation_letter && !letter ? (
                  <div className="text-center py-12 bg-surface rounded-xl border border-border">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground mb-4">
                      Générez une lettre de négociation personnalisée avec vos montants exacts
                      et des arguments juridiques.
                    </p>
                    <Button onClick={generateLetter} disabled={isGenerating}>
                      {isGenerating ? 'Génération…' : 'Générer la lettre'}
                    </Button>
                  </div>
                ) : (
                  <div className="bg-surface rounded-xl p-6 border border-border">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Lettre de négociation</h3>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            const text = letter?.letter_markdown || analysis?.negotiation_letter || ''
                            navigator.clipboard.writeText(text)
                            setCopied(true)
                            setTimeout(() => setCopied(false), 2000)
                          }}
                        >
                          <ClipboardCopy className="w-4 h-4 mr-1" />
                          {copied ? 'Copié !' : 'Copier'}
                        </Button>
                        {analysis?.negotiation_status === 'draft' && (
                          <Button
                            size="sm"
                            onClick={() => updateStatus('sent')}
                          >
                            <Send className="w-4 h-4 mr-1" />
                            Marquer envoyé
                          </Button>
                        )}
                        {analysis?.negotiation_status === 'sent' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => updateStatus('waiting')}
                          >
                            En attente de réponse
                          </Button>
                        )}
                        {analysis?.negotiation_status === 'waiting' && (
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => updateStatus('resolved_success')}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Résolu (succès)
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Letter preview */}
                    <div className="prose prose-sm prose-invert max-w-none bg-surface-alt rounded-lg p-6 border border-border">
                      <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">
                        {letter?.letter_markdown || analysis?.negotiation_letter}
                      </pre>
                    </div>

                    {/* Legal arguments */}
                    {letter?.arguments && (
                      <div className="mt-4 p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
                        <h4 className="font-semibold text-sm mb-2">Arguments juridiques utilisés</h4>
                        <ul className="text-sm space-y-1 text-muted-foreground">
                          {letter.arguments.map((arg, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-orange-400 mt-0.5">•</span>
                              {arg}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Result if resolved */}
                    {analysis?.negotiation_status === 'resolved_success' && analysis.negotiation_result_amount > 0 && (
                      <div className="mt-4 p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-center">
                        <CheckCircle className="w-6 h-6 mx-auto text-emerald-400 mb-1" />
                        <div className="text-2xl font-bold text-emerald-400">
                          {formatEur(analysis.negotiation_result_amount)} récupérés
                        </div>
                        <p className="text-sm text-muted-foreground">Négociation réussie !</p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Grilles Tab ──────────────────────────────── */}
            {activeTab === 'grilles' && (
              <motion.div
                key="grilles"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <div className="bg-surface rounded-xl p-6 border border-border overflow-x-auto">
                  <h3 className="text-lg font-semibold mb-4">
                    Grilles tarifaires — {schedules.length} banques
                  </h3>
                  {schedules.length > 0 ? (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="text-left py-2 px-2">Banque</th>
                          <th className="text-center py-2 px-1">Type</th>
                          {Object.entries(FEE_FIELD_LABELS).map(([key, label]) => (
                            <th key={key} className="text-right py-2 px-1 whitespace-nowrap">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {schedules.map((sched) => (
                          <tr
                            key={sched.bank_slug}
                            className="border-b border-border/50 hover:bg-surface-alt/50"
                          >
                            <td className="py-1.5 px-2 font-medium whitespace-nowrap">
                              {sched.bank_name}
                            </td>
                            <td className="py-1.5 px-1 text-center">
                              <span className={`text-[10px] px-1 py-0.5 rounded-full ${sched.is_online ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                {sched.is_online ? 'En ligne' : 'Agence'}
                              </span>
                            </td>
                            {Object.keys(FEE_FIELD_LABELS).map((key) => {
                              const val = (sched as any)[key] as number
                              return (
                                <td
                                  key={key}
                                  className={`py-1.5 px-1 text-right ${val === 0 ? 'text-emerald-400' : ''}`}
                                >
                                  {val === 0 ? '0 €' : formatEur(val)}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="space-y-2">
                      {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 rounded" />)}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────

function KPICard({ label, value, icon, color, subtitle }: {
  label: string; value: string; icon: React.ReactNode; color?: string; subtitle?: string
}) {
  return (
    <div className="bg-surface rounded-xl p-4 border border-border">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className={`text-xl font-bold ${color || ''}`}>{value}</div>
      {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
    </div>
  )
}

function FeesByTypeFromAnalysis({ analysis }: { analysis: { fees_by_type: Record<string, number> } }) {
  const items = Object.entries(analysis.fees_by_type || {})
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Aucun frais détecté</p>
  const maxVal = Math.max(...items.map(([, v]) => v), 1)
  return (
    <div className="space-y-3">
      {items.sort((a, b) => b[1] - a[1]).map(([key, amount]) => {
        const pct = (amount / maxVal) * 100
        return (
          <div key={key}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span>{FEE_FIELD_LABELS[key] || key}</span>
              <span className="font-medium">{formatEur(amount)}</span>
            </div>
            <div className="w-full h-3 bg-surface-alt rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
