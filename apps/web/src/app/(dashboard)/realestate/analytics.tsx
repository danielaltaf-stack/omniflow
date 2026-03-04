'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  RefreshCw, Calendar, AlertTriangle,
  ChevronDown, ChevronUp, BarChart3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useRealEstateStore } from '@/stores/realestate-store'
import { formatAmount } from '@/lib/format'
import type { RealEstateProperty } from '@/types/api'

/* ── Yield Analysis Panel ──────────────────────────────── */
export function YieldAnalysisPanel({ properties }: { properties: RealEstateProperty[] }) {
  if (properties.length === 0) return <EmptyAnalytics message="Ajoutez un bien pour voir l'analyse des rendements." />

  const fiscalLabels: Record<string, string> = {
    micro_foncier: 'Micro-foncier',
    reel: 'Régime réel',
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground-secondary">
        Analyse des rendements par bien — brut, net et net-net (après fiscalité).
      </p>
      {properties.map((p, i) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="rounded-omni-lg border border-border bg-surface p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="font-semibold text-foreground">{p.label}</h4>
              <span className="text-xs px-2 py-0.5 rounded bg-brand/10 text-brand">
                {fiscalLabels[p.fiscal_regime] || p.fiscal_regime} — TMI {p.tmi_pct}%
              </span>
            </div>
            <div className="text-right text-sm">
              <p className="text-foreground-tertiary text-xs">Valeur actuelle</p>
              <p className="font-semibold tabular-nums">{formatAmount(p.current_value)}</p>
            </div>
          </div>

          {/* Yield gauges */}
          <div className="grid grid-cols-3 gap-4">
            <YieldGauge label="Brut" value={p.gross_yield_pct} color="text-foreground-secondary" />
            <YieldGauge label="Net" value={p.net_yield_pct} color="text-blue-400" />
            <YieldGauge label="Net-net" value={p.net_net_yield_pct} color={p.net_net_yield_pct >= 0 ? 'text-gain' : 'text-loss'} />
          </div>

          {/* Fiscal details */}
          <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-foreground-tertiary text-xs">Charge fiscale / an</p>
              <p className="font-medium text-loss tabular-nums">{formatAmount(p.annual_tax_burden)}</p>
            </div>
            <div>
              <p className="text-foreground-tertiary text-xs">Taxe foncière</p>
              <p className="font-medium tabular-nums">{formatAmount(p.taxe_fonciere)}</p>
            </div>
            <div>
              <p className="text-foreground-tertiary text-xs">Assurance PNO</p>
              <p className="font-medium tabular-nums">{formatAmount(p.assurance_pno)}</p>
            </div>
            <div>
              <p className="text-foreground-tertiary text-xs">Vacance locative</p>
              <p className="font-medium tabular-nums">{p.vacancy_rate_pct.toFixed(1)}%</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

function YieldGauge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <p className="text-xs text-foreground-tertiary mb-1">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value.toFixed(2)}%</p>
    </div>
  )
}

/* ── DVF History Panel ─────────────────────────────────── */
export function DVFHistoryPanel({ properties }: { properties: RealEstateProperty[] }) {
  const { valuations, dvfRefresh, isLoadingAnalytics, fetchValuations, refreshDVF } = useRealEstateStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  if (properties.length === 0) return <EmptyAnalytics message="Ajoutez un bien pour consulter l'historique DVF." />

  const handleSelect = useCallback(async (id: string) => {
    setSelectedId(id)
    await fetchValuations(id)
  }, [fetchValuations])

  const handleRefresh = useCallback(async () => {
    if (!selectedId) return
    setRefreshing(true)
    await refreshDVF(selectedId)
    setRefreshing(false)
  }, [selectedId, refreshDVF])

  const selectedProperty = properties.find(p => p.id === selectedId)

  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground-secondary">
        Historique des estimations DVF — Sélectionnez un bien pour voir l&apos;évolution du prix au m².
      </p>

      {/* Property selector */}
      <div className="flex flex-wrap gap-2">
        {properties.map(p => (
          <button
            key={p.id}
            onClick={() => handleSelect(p.id)}
            className={`px-3 py-1.5 rounded-omni-sm text-sm font-medium transition-colors ${
              selectedId === p.id
                ? 'bg-brand text-white'
                : 'bg-surface-elevated text-foreground-secondary hover:text-foreground'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {selectedId && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-omni-lg border border-border bg-surface p-4"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-semibold text-foreground">{selectedProperty?.label}</h4>
              {selectedProperty?.city && (
                <p className="text-xs text-foreground-tertiary">
                  {selectedProperty.city} {selectedProperty.postal_code}
                </p>
              )}
            </div>
            <Button size="sm" variant="secondary" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw size={14} className={`mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              Rafraîchir DVF
            </Button>
          </div>

          {/* Refresh alert */}
          {dvfRefresh && dvfRefresh.significant_change && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 flex items-center gap-2 text-sm bg-amber-500/10 text-amber-400 rounded-omni-sm p-3"
            >
              <AlertTriangle size={16} />
              Variation significative : {dvfRefresh.delta_pct > 0 ? '+' : ''}{dvfRefresh.delta_pct.toFixed(1)}% par rapport à la dernière estimation.
            </motion.div>
          )}

          {isLoadingAnalytics ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : valuations && valuations.valuations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-foreground-tertiary text-xs">
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4">Source</th>
                    <th className="pb-2 pr-4 text-right">Prix / m²</th>
                    <th className="pb-2 pr-4 text-right">Estimation</th>
                    <th className="pb-2 text-right">Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  {valuations.valuations.map((v, i) => (
                    <tr key={v.id || i} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-4 text-foreground tabular-nums">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={12} className="text-foreground-tertiary" />
                          {v.recorded_at ? new Date(v.recorded_at).toLocaleDateString('fr-FR') : '\u2014'}
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-foreground-secondary">{v.source}</td>
                      <td className="py-2 pr-4 text-right font-medium tabular-nums">
                        {formatAmount(v.price_m2_centimes)}/m²
                      </td>
                      <td className="py-2 pr-4 text-right font-medium tabular-nums">
                        {v.estimation_centimes ? formatAmount(v.estimation_centimes) : '\u2014'}
                      </td>
                      <td className="py-2 text-right text-foreground-secondary tabular-nums">{v.nb_transactions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-foreground-tertiary text-center py-6">
              Aucun historique DVF. Cliquez sur &laquo;&nbsp;Rafraîchir DVF&nbsp;&raquo; pour lancer une estimation.
            </p>
          )}
        </motion.div>
      )}
    </div>
  )
}

/* ── Cash-Flow Projection Panel ────────────────────────── */
export function CashFlowPanel({ properties }: { properties: RealEstateProperty[] }) {
  const { cashflow, isLoadingAnalytics, fetchCashflow } = useRealEstateStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [months, setMonths] = useState(240)
  const [showAll, setShowAll] = useState(false)

  if (properties.length === 0) return <EmptyAnalytics message="Ajoutez un bien avec un crédit pour voir la projection cash-flow." />

  const handleSelect = useCallback(async (id: string) => {
    setSelectedId(id)
    await fetchCashflow(id, months)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchCashflow, months])

  const handleMonthsChange = useCallback(async (m: number) => {
    setMonths(m)
    if (selectedId) await fetchCashflow(selectedId, m)
  }, [selectedId, fetchCashflow])

  const displayedMonths = cashflow?.monthly ?? []
  const visibleMonths = showAll ? displayedMonths : displayedMonths.slice(0, 24)

  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground-secondary">
        Projection du cash-flow mensuel avec amortissement du crédit, charges et fiscalité.
      </p>

      {/* Property selector */}
      <div className="flex flex-wrap gap-2">
        {properties.map(p => (
          <button
            key={p.id}
            onClick={() => handleSelect(p.id)}
            className={`px-3 py-1.5 rounded-omni-sm text-sm font-medium transition-colors ${
              selectedId === p.id
                ? 'bg-brand text-white'
                : 'bg-surface-elevated text-foreground-secondary hover:text-foreground'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {selectedId && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* Duration selector */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-foreground-secondary">Durée :</span>
            {[60, 120, 180, 240, 300].map(m => (
              <button
                key={m}
                onClick={() => handleMonthsChange(m)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  months === m ? 'bg-brand text-white' : 'bg-surface-elevated text-foreground-secondary hover:text-foreground'
                }`}
              >
                {m / 12} ans
              </button>
            ))}
          </div>

          {isLoadingAnalytics ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : cashflow ? (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <KPICard
                  label="Cash-flow moyen / mois"
                  value={formatAmount(Math.round(cashflow.avg_monthly_cashflow))}
                  positive={cashflow.avg_monthly_cashflow >= 0}
                />
                <KPICard
                  label="Intérêts totaux"
                  value={formatAmount(Math.round(cashflow.total_interest_paid))}
                  positive={false}
                />
                <KPICard
                  label="ROI en fin"
                  value={`${cashflow.roi_at_end_pct.toFixed(1)}%`}
                  positive={cashflow.roi_at_end_pct >= 0}
                />
                <KPICard
                  label="Autofinancé en"
                  value={cashflow.payback_months > 0 ? `${Math.floor(cashflow.payback_months / 12)} ans ${cashflow.payback_months % 12} mois` : '\u2014'}
                  positive={cashflow.payback_months > 0}
                />
              </div>

              {/* Projection table */}
              <div className="rounded-omni-lg border border-border bg-surface overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-left text-foreground-tertiary">
                      <th className="p-2">Mois</th>
                      <th className="p-2">Date</th>
                      <th className="p-2 text-right">Loyer</th>
                      <th className="p-2 text-right">Charges</th>
                      <th className="p-2 text-right">Capital</th>
                      <th className="p-2 text-right">Intérêts</th>
                      <th className="p-2 text-right">Assurance</th>
                      <th className="p-2 text-right">Impôt</th>
                      <th className="p-2 text-right font-semibold">Cash-flow</th>
                      <th className="p-2 text-right">Cumulé</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleMonths.map((row) => (
                      <tr key={row.month} className="border-b border-border/30 hover:bg-surface-elevated/50">
                        <td className="p-2 text-foreground-secondary tabular-nums">{row.month}</td>
                        <td className="p-2 text-foreground-secondary tabular-nums">{row.date}</td>
                        <td className="p-2 text-right text-gain tabular-nums">{formatAmount(Math.round(row.rent))}</td>
                        <td className="p-2 text-right text-loss tabular-nums">{formatAmount(Math.round(row.charges))}</td>
                        <td className="p-2 text-right tabular-nums">{formatAmount(Math.round(row.loan_principal))}</td>
                        <td className="p-2 text-right text-loss tabular-nums">{formatAmount(Math.round(row.loan_interest))}</td>
                        <td className="p-2 text-right tabular-nums">{formatAmount(Math.round(row.loan_insurance))}</td>
                        <td className="p-2 text-right text-loss tabular-nums">{formatAmount(Math.round(row.tax_monthly))}</td>
                        <td className={`p-2 text-right font-semibold tabular-nums ${row.cashflow >= 0 ? 'text-gain' : 'text-loss'}`}>
                          {row.cashflow >= 0 ? '+' : ''}{formatAmount(Math.round(row.cashflow))}
                        </td>
                        <td className={`p-2 text-right tabular-nums ${row.cumulative_cashflow >= 0 ? 'text-gain' : 'text-loss'}`}>
                          {row.cumulative_cashflow >= 0 ? '+' : ''}{formatAmount(Math.round(row.cumulative_cashflow))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {displayedMonths.length > 24 && (
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="mt-2 flex items-center gap-1 text-sm text-brand hover:underline mx-auto"
                >
                  {showAll ? (
                    <>Réduire <ChevronUp size={14} /></>
                  ) : (
                    <>Voir les {displayedMonths.length - 24} mois restants <ChevronDown size={14} /></>
                  )}
                </button>
              )}
            </>
          ) : (
            <p className="text-sm text-foreground-tertiary text-center py-6">
              Sélectionnez un bien pour voir la projection.
            </p>
          )}
        </motion.div>
      )}
    </div>
  )
}

function KPICard({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <div className="rounded-omni-sm border border-border bg-surface-elevated p-3">
      <p className="text-xs text-foreground-tertiary mb-1">{label}</p>
      <p className={`text-base font-bold tabular-nums ${positive ? 'text-gain' : 'text-loss'}`}>{value}</p>
    </div>
  )
}

function EmptyAnalytics({ message }: { message: string }) {
  return (
    <div className="text-center py-12">
      <BarChart3 size={32} className="text-foreground-tertiary mx-auto mb-3" />
      <p className="text-sm text-foreground-secondary">{message}</p>
    </div>
  )
}
