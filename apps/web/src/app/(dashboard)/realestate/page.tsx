'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home, Plus, Pencil, Trash2, X,
  TrendingUp, TrendingDown, MapPin,
  DollarSign, AlertCircle, Building,
  BarChart3, History, Wallet, Map,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useRealEstateStore } from '@/stores/realestate-store'
import { formatAmount, amountColorClass } from '@/lib/format'
import { YieldAnalysisPanel, DVFHistoryPanel, CashFlowPanel } from './analytics'
import type { RealEstateProperty } from '@/types/api'
import dynamic from 'next/dynamic'

const PropertyWizardModal = dynamic(
  () => import('@/components/realestate/property-wizard-modal'),
  { ssr: false }
)

const FrancePropertyMap = dynamic(
  () => import('@/components/realestate/france-property-map'),
  { ssr: false, loading: () => <Skeleton className="h-[480px] w-full rounded-omni-lg" /> }
)

type Tab = 'biens' | 'carte' | 'rendements' | 'dvf' | 'cashflow'

/* ── Property Card ──────────────────────────────────────── */
function PropertyCard({
  property,
  index,
  onEdit,
  onDelete,
}: {
  property: RealEstateProperty
  index: number
  onEdit: () => void
  onDelete: () => void
}) {
  const typeLabels: Record<string, string> = {
    apartment: 'Appartement',
    house: 'Maison',
    parking: 'Parking',
    commercial: 'Local commercial',
    land: 'Terrain',
    other: 'Autre',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="rounded-omni-lg border border-border bg-surface p-4 hover:border-brand/30 transition-colors"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-semibold text-foreground">{property.label}</h3>
          <div className="flex items-center gap-2 text-xs text-foreground-tertiary mt-0.5">
            <span className="px-1.5 py-0.5 rounded bg-surface-elevated">
              {typeLabels[property.property_type] || property.property_type}
            </span>
            {property.city && (
              <span className="flex items-center gap-0.5">
                <MapPin size={10} />
                {property.city} {property.postal_code}
              </span>
            )}
            {property.surface_m2 && <span>{property.surface_m2} m²</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 text-foreground-tertiary hover:text-brand transition-colors"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => {
              if (confirm(`Supprimer "${property.label}" ?`)) onDelete()
            }}
            className="p-1.5 text-foreground-tertiary hover:text-loss transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Value */}
      <div className="mb-3">
        <p className="text-xl font-bold text-foreground tabular-nums">
          {formatAmount(property.current_value)}
        </p>
        {property.capital_gain !== 0 && (
          <div className={`flex items-center gap-1 text-sm mt-0.5 ${amountColorClass(property.capital_gain)}`}>
            {property.capital_gain >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span className="tabular-nums">
              {property.capital_gain > 0 ? '+' : ''}{formatAmount(property.capital_gain)}
            </span>
            <span className="text-foreground-tertiary text-xs">plus-value</span>
          </div>
        )}
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        {property.monthly_rent > 0 && (
          <div>
            <p className="text-foreground-tertiary text-xs">Loyer mensuel</p>
            <p className="font-medium text-gain tabular-nums">{formatAmount(property.monthly_rent)}</p>
          </div>
        )}
        {property.net_monthly_cashflow !== 0 && (
          <div>
            <p className="text-foreground-tertiary text-xs">Cash-flow net</p>
            <p className={`font-medium tabular-nums ${amountColorClass(property.net_monthly_cashflow)}`}>
              {property.net_monthly_cashflow > 0 ? '+' : ''}{formatAmount(property.net_monthly_cashflow)}/mois
            </p>
          </div>
        )}
        {property.gross_yield_pct > 0 && (
          <div>
            <p className="text-foreground-tertiary text-xs">Rend. brut</p>
            <p className="font-medium text-foreground tabular-nums">{property.gross_yield_pct.toFixed(2)}%</p>
          </div>
        )}
        {property.net_yield_pct > 0 && (
          <div>
            <p className="text-foreground-tertiary text-xs">Rend. net</p>
            <p className="font-medium text-foreground tabular-nums">{property.net_yield_pct.toFixed(2)}%</p>
          </div>
        )}
        {property.net_net_yield_pct !== undefined && property.net_net_yield_pct !== 0 && (
          <div>
            <p className="text-foreground-tertiary text-xs">Rend. net-net</p>
            <p className={`font-medium tabular-nums ${property.net_net_yield_pct >= 0 ? 'text-gain' : 'text-loss'}`}>
              {property.net_net_yield_pct.toFixed(2)}%
            </p>
          </div>
        )}
        {property.loan_remaining > 0 && (
          <div>
            <p className="text-foreground-tertiary text-xs">Capital restant dû</p>
            <p className="font-medium text-loss tabular-nums">{formatAmount(property.loan_remaining)}</p>
          </div>
        )}
        {property.dvf_estimation && property.dvf_estimation > 0 && (
          <div>
            <p className="text-foreground-tertiary text-xs">Estimation DVF</p>
            <p className="font-medium text-foreground-secondary tabular-nums">{formatAmount(property.dvf_estimation)}</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}

/* ── Main Page ──────────────────────────────────────────── */
export default function RealEstatePage() {
  const { summary, isLoading, error, fetchSummary, deleteProperty, clearAnalytics } = useRealEstateStore()
  const [showForm, setShowForm] = useState(false)
  const [editProperty, setEditProperty] = useState<RealEstateProperty | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('biens')

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  const properties = summary?.properties ?? []

  const handleEdit = (p: RealEstateProperty) => {
    setEditProperty(p)
    setShowForm(true)
  }

  const handleClose = () => {
    setShowForm(false)
    setEditProperty(null)
  }

  const handleTabChange = (t: Tab) => {
    setActiveTab(t)
    if (t === 'biens') clearAnalytics()
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'biens', label: 'Biens', icon: <Home size={14} /> },
    { key: 'carte', label: 'Carte', icon: <Map size={14} /> },
    { key: 'rendements', label: 'Rendements', icon: <BarChart3 size={14} /> },
    { key: 'dvf', label: 'Historique DVF', icon: <History size={14} /> },
    { key: 'cashflow', label: 'Cash-flow', icon: <Wallet size={14} /> },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-border bg-background/80 px-5 backdrop-blur-lg">
        <div className="flex items-center gap-2">
          <Home size={18} className="text-brand" />
          <h1 className="text-base font-bold text-foreground">Immobilier</h1>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus size={14} className="mr-1" />
          Ajouter un bien
        </Button>
      </header>

      {/* Tab navigation */}
      {properties.length > 0 && (
        <div className="border-b border-border bg-background/60 backdrop-blur-sm px-5">
          <nav className="mx-auto max-w-5xl flex gap-1 -mb-px overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => handleTabChange(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === t.key
                    ? 'border-brand text-brand'
                    : 'border-transparent text-foreground-tertiary hover:text-foreground hover:border-border'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-3 sm:px-5 py-4">
        {error && (
          <div className="mb-4 flex items-center gap-2 text-sm text-loss bg-loss/10 rounded-omni-sm p-3">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* ── Tab: Biens ─────────────────────────────── */}
        {activeTab === 'biens' && (
          <>
            {/* Summary card */}
            {summary && properties.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-omni-lg border border-border bg-surface p-5 mb-5"
              >
                <p className="text-sm text-foreground-secondary mb-1">Patrimoine Immobilier</p>
                {isLoading ? (
                  <Skeleton className="h-9 w-44" />
                ) : (
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <h2 className="text-2xl font-bold text-foreground tabular-nums">
                      {formatAmount(summary.total_value)}
                    </h2>
                    {summary.total_capital_gain !== 0 && (
                      <span className={`text-sm font-medium flex items-center gap-1 ${amountColorClass(summary.total_capital_gain)}`}>
                        {summary.total_capital_gain >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {summary.total_capital_gain > 0 ? '+' : ''}{formatAmount(summary.total_capital_gain)}
                        <span className="text-foreground-tertiary">
                          ({summary.total_capital_gain_pct > 0 ? '+' : ''}{summary.total_capital_gain_pct.toFixed(1)}%)
                        </span>
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-foreground-tertiary text-xs">Biens</p>
                    <p className="font-semibold text-foreground">{summary.properties_count}</p>
                  </div>
                  {summary.total_monthly_rent > 0 && (
                    <div>
                      <p className="text-foreground-tertiary text-xs">Loyers / mois</p>
                      <p className="font-semibold text-gain tabular-nums">{formatAmount(summary.total_monthly_rent)}</p>
                    </div>
                  )}
                  {summary.net_monthly_cashflow !== 0 && (
                    <div>
                      <p className="text-foreground-tertiary text-xs">Cash-flow net / mois</p>
                      <p className={`font-semibold tabular-nums ${amountColorClass(summary.net_monthly_cashflow)}`}>
                        {summary.net_monthly_cashflow > 0 ? '+' : ''}{formatAmount(summary.net_monthly_cashflow)}
                      </p>
                    </div>
                  )}
                  {summary.avg_gross_yield_pct > 0 && (
                    <div>
                      <p className="text-foreground-tertiary text-xs">Rend. brut moyen</p>
                      <p className="font-semibold text-foreground tabular-nums">{summary.avg_gross_yield_pct.toFixed(2)}%</p>
                    </div>
                  )}
                  {summary.total_loan_remaining > 0 && (
                    <div>
                      <p className="text-foreground-tertiary text-xs">Encours crédit</p>
                      <p className="font-semibold text-loss tabular-nums">{formatAmount(summary.total_loan_remaining)}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Properties grid */}
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2].map((i) => (
                  <div key={i} className="rounded-omni-lg border border-border bg-surface p-5">
                    <Skeleton className="h-5 w-40 mb-3" />
                    <Skeleton className="h-8 w-32 mb-3" />
                    <div className="grid grid-cols-2 gap-3">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : properties.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {properties.map((p, i) => (
                  <PropertyCard
                    key={p.id}
                    property={p}
                    index={i}
                    onEdit={() => handleEdit(p)}
                    onDelete={() => deleteProperty(p.id)}
                  />
                ))}
              </div>
            ) : (
              /* Empty state */
              <div className="text-center py-16">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 mx-auto">
                  <Building size={32} className="text-brand" />
                </div>
                <h2 className="mt-5 text-lg font-bold text-foreground">
                  Gérez votre patrimoine immobilier
                </h2>
                <p className="mt-2 text-sm text-foreground-secondary max-w-md mx-auto">
                  Ajoutez vos biens immobiliers pour suivre leur valeur, les rendements locatifs,
                  le cash-flow net et la plus-value latente. Estimation automatique via l&apos;API DVF.
                </p>
                <Button onClick={() => setShowForm(true)} className="mt-5">
                  <Plus size={16} className="mr-2" />
                  Ajouter un bien
                </Button>
              </div>
            )}
          </>
        )}

        {/* ── Tab: Carte ────────────────────────────── */}
        {activeTab === 'carte' && (
          <FrancePropertyMap properties={properties} onPropertyClick={(p) => { setEditProperty(p); setShowForm(true) }} />
        )}

        {/* ── Tab: Rendements ────────────────────────── */}
        {activeTab === 'rendements' && (
          <YieldAnalysisPanel properties={properties} />
        )}

        {/* ── Tab: DVF History ───────────────────────── */}
        {activeTab === 'dvf' && (
          <DVFHistoryPanel properties={properties} />
        )}

        {/* ── Tab: Cash-flow ─────────────────────────── */}
        {activeTab === 'cashflow' && (
          <CashFlowPanel properties={properties} />
        )}
      </main>

      <PropertyWizardModal
        isOpen={showForm}
        onClose={handleClose}
        property={editProperty}
      />
    </div>
  )
}
