'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CreditCard, Plus, Pencil, Trash2, X,
  TrendingDown, Percent, Calendar, AlertCircle,
  ChevronDown, ChevronUp, BarChart3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebtStore } from '@/stores/debt-store'
import { formatAmount } from '@/lib/format'
import type { Debt } from '@/types/api'

/* ── Debt type labels (FR) ──────────────────────────────── */
const DEBT_TYPE_LABELS: Record<string, string> = {
  mortgage: 'Prêt immobilier',
  consumer: 'Crédit conso',
  student: 'Prêt étudiant',
  credit_card: 'Carte de crédit',
  loc: 'Ligne de crédit',
  lombard: 'Crédit lombard',
  other: 'Autre',
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  constant_annuity: 'Annuités constantes',
  constant_amortization: 'Amortissement constant',
  in_fine: 'In fine',
  deferred: 'Différé',
}

/* ── Debt Form Modal ────────────────────────────────────── */
function DebtFormModal({
  isOpen,
  onClose,
  debt,
}: {
  isOpen: boolean
  onClose: () => void
  debt?: Debt | null
}) {
  const { createDebt, updateDebt, isSaving } = useDebtStore()
  const isEdit = !!debt

  const [form, setForm] = useState({
    label: '',
    debt_type: 'consumer',
    creditor: '',
    initial_amount: '',
    remaining_amount: '',
    interest_rate_pct: '',
    insurance_rate_pct: '',
    monthly_payment: '',
    start_date: '',
    end_date: '',
    duration_months: '',
    early_repayment_fee_pct: '3',
    payment_type: 'constant_annuity',
    is_deductible: false,
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (debt) {
      setForm({
        label: debt.label || '',
        debt_type: debt.debt_type || 'consumer',
        creditor: debt.creditor || '',
        initial_amount: debt.initial_amount ? String(debt.initial_amount / 100) : '',
        remaining_amount: debt.remaining_amount ? String(debt.remaining_amount / 100) : '',
        interest_rate_pct: debt.interest_rate_pct != null ? String(debt.interest_rate_pct) : '',
        insurance_rate_pct: debt.insurance_rate_pct != null ? String(debt.insurance_rate_pct) : '',
        monthly_payment: debt.monthly_payment ? String(debt.monthly_payment / 100) : '',
        start_date: debt.start_date || '',
        end_date: debt.end_date || '',
        duration_months: debt.duration_months ? String(debt.duration_months) : '',
        early_repayment_fee_pct: debt.early_repayment_fee_pct != null ? String(debt.early_repayment_fee_pct) : '3',
        payment_type: debt.payment_type || 'constant_annuity',
        is_deductible: debt.is_deductible || false,
      })
    } else {
      setForm({
        label: '', debt_type: 'consumer', creditor: '',
        initial_amount: '', remaining_amount: '',
        interest_rate_pct: '', insurance_rate_pct: '',
        monthly_payment: '', start_date: '', end_date: '',
        duration_months: '', early_repayment_fee_pct: '3',
        payment_type: 'constant_annuity', is_deductible: false,
      })
    }
  }, [debt, isOpen])

  const set = (key: string, value: string | boolean) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const payload: any = {
      label: form.label,
      debt_type: form.debt_type,
      creditor: form.creditor || null,
      initial_amount: form.initial_amount ? Math.round(parseFloat(form.initial_amount) * 100) : 0,
      remaining_amount: form.remaining_amount ? Math.round(parseFloat(form.remaining_amount) * 100) : 0,
      interest_rate_pct: form.interest_rate_pct ? parseFloat(form.interest_rate_pct) : 0,
      insurance_rate_pct: form.insurance_rate_pct ? parseFloat(form.insurance_rate_pct) : 0,
      monthly_payment: form.monthly_payment ? Math.round(parseFloat(form.monthly_payment) * 100) : 0,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      duration_months: form.duration_months ? parseInt(form.duration_months) : 1,
      early_repayment_fee_pct: form.early_repayment_fee_pct ? parseFloat(form.early_repayment_fee_pct) : 3,
      payment_type: form.payment_type,
      is_deductible: form.is_deductible,
    }

    try {
      if (isEdit && debt) {
        await updateDebt(debt.id, payload)
      } else {
        await createDebt(payload)
      }
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la sauvegarde')
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-surface border border-border rounded-omni-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              {isEdit ? 'Modifier la dette' : 'Ajouter une dette'}
            </h2>
            <button onClick={onClose} className="p-1 hover:bg-surface-elevated rounded-omni-sm">
              <X size={18} />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 text-sm bg-loss/10 text-loss rounded-omni-sm flex items-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Label */}
            <div>
              <label className="block text-xs text-foreground-secondary mb-1">Nom *</label>
              <input
                className="w-full px-3 py-2 rounded-omni-sm bg-surface-elevated border border-border text-foreground text-sm focus:border-brand focus:outline-none"
                value={form.label}
                onChange={(e) => set('label', e.target.value)}
                placeholder="Prêt immobilier résidence principale"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Debt Type */}
              <div>
                <label className="block text-xs text-foreground-secondary mb-1">Type</label>
                <select
                  className="w-full px-3 py-2 rounded-omni-sm bg-surface-elevated border border-border text-foreground text-sm"
                  value={form.debt_type}
                  onChange={(e) => set('debt_type', e.target.value)}
                >
                  {Object.entries(DEBT_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              {/* Payment Type */}
              <div>
                <label className="block text-xs text-foreground-secondary mb-1">Mode de remboursement</label>
                <select
                  className="w-full px-3 py-2 rounded-omni-sm bg-surface-elevated border border-border text-foreground text-sm"
                  value={form.payment_type}
                  onChange={(e) => set('payment_type', e.target.value)}
                >
                  {Object.entries(PAYMENT_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Creditor */}
            <div>
              <label className="block text-xs text-foreground-secondary mb-1">Créancier</label>
              <input
                className="w-full px-3 py-2 rounded-omni-sm bg-surface-elevated border border-border text-foreground text-sm focus:border-brand focus:outline-none"
                value={form.creditor}
                onChange={(e) => set('creditor', e.target.value)}
                placeholder="Crédit Agricole, BNP..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Initial Amount */}
              <div>
                <label className="block text-xs text-foreground-secondary mb-1">Montant initial (€) *</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 rounded-omni-sm bg-surface-elevated border border-border text-foreground text-sm focus:border-brand focus:outline-none"
                  value={form.initial_amount}
                  onChange={(e) => set('initial_amount', e.target.value)}
                  placeholder="200000"
                  required
                />
              </div>
              {/* Remaining Amount */}
              <div>
                <label className="block text-xs text-foreground-secondary mb-1">Capital restant dû (€) *</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 rounded-omni-sm bg-surface-elevated border border-border text-foreground text-sm focus:border-brand focus:outline-none"
                  value={form.remaining_amount}
                  onChange={(e) => set('remaining_amount', e.target.value)}
                  placeholder="155000"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Interest Rate */}
              <div>
                <label className="block text-xs text-foreground-secondary mb-1">Taux nominal (%) *</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 rounded-omni-sm bg-surface-elevated border border-border text-foreground text-sm focus:border-brand focus:outline-none"
                  value={form.interest_rate_pct}
                  onChange={(e) => set('interest_rate_pct', e.target.value)}
                  placeholder="1.35"
                  required
                />
              </div>
              {/* Insurance Rate */}
              <div>
                <label className="block text-xs text-foreground-secondary mb-1">Taux assurance (%)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 rounded-omni-sm bg-surface-elevated border border-border text-foreground text-sm focus:border-brand focus:outline-none"
                  value={form.insurance_rate_pct}
                  onChange={(e) => set('insurance_rate_pct', e.target.value)}
                  placeholder="0.30"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Monthly Payment */}
              <div>
                <label className="block text-xs text-foreground-secondary mb-1">Mensualité (€) *</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 rounded-omni-sm bg-surface-elevated border border-border text-foreground text-sm focus:border-brand focus:outline-none"
                  value={form.monthly_payment}
                  onChange={(e) => set('monthly_payment', e.target.value)}
                  placeholder="850"
                  required
                />
              </div>
              {/* Duration */}
              <div>
                <label className="block text-xs text-foreground-secondary mb-1">Durée (mois) *</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 rounded-omni-sm bg-surface-elevated border border-border text-foreground text-sm focus:border-brand focus:outline-none"
                  value={form.duration_months}
                  onChange={(e) => set('duration_months', e.target.value)}
                  placeholder="240"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Start Date */}
              <div>
                <label className="block text-xs text-foreground-secondary mb-1">Date de début</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 rounded-omni-sm bg-surface-elevated border border-border text-foreground text-sm focus:border-brand focus:outline-none"
                  value={form.start_date}
                  onChange={(e) => set('start_date', e.target.value)}
                />
              </div>
              {/* End Date */}
              <div>
                <label className="block text-xs text-foreground-secondary mb-1">Date de fin</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 rounded-omni-sm bg-surface-elevated border border-border text-foreground text-sm focus:border-brand focus:outline-none"
                  value={form.end_date}
                  onChange={(e) => set('end_date', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Early Repayment Fee */}
              <div>
                <label className="block text-xs text-foreground-secondary mb-1">IRA (%)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 rounded-omni-sm bg-surface-elevated border border-border text-foreground text-sm focus:border-brand focus:outline-none"
                  value={form.early_repayment_fee_pct}
                  onChange={(e) => set('early_repayment_fee_pct', e.target.value)}
                  placeholder="3"
                />
              </div>
              {/* Deductible */}
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_deductible}
                    onChange={(e) => set('is_deductible', e.target.checked)}
                    className="rounded border-border"
                  />
                  Déductible fiscalement
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
                Annuler
              </Button>
              <Button type="submit" disabled={isSaving} className="flex-1">
                {isSaving ? 'Enregistrement...' : isEdit ? 'Modifier' : 'Ajouter'}
              </Button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

/* ── Single Debt Card ───────────────────────────────────── */
function DebtCard({
  debt,
  onEdit,
  onDelete,
}: {
  debt: Debt
  onEdit: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const { fetchAmortization, amortization, fetchChartData, chartData } = useDebtStore()

  const toggleExpand = async () => {
    if (!expanded) {
      await fetchAmortization(debt.id)
    }
    setExpanded(!expanded)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="bg-surface border border-border rounded-omni-md p-4 hover:border-brand/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-omni-sm bg-loss/10 flex items-center justify-center flex-shrink-0">
            <CreditCard size={18} className="text-loss" />
          </div>
          <div className="min-w-0">
            <h3 className="font-medium text-foreground text-sm truncate">{debt.label}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs px-1.5 py-0.5 rounded bg-surface-elevated text-foreground-secondary">
                {DEBT_TYPE_LABELS[debt.debt_type] || debt.debt_type}
              </span>
              {debt.creditor && (
                <span className="text-xs text-foreground-tertiary truncate">{debt.creditor}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onEdit} className="p-1.5 rounded-omni-sm hover:bg-surface-elevated text-foreground-secondary">
            <Pencil size={14} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-omni-sm hover:bg-loss/10 text-loss">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-foreground-secondary">
            Remboursé: {debt.progress_pct.toFixed(1)}%
          </span>
          <span className="font-medium text-foreground">
            {formatAmount(debt.remaining_amount)} restants
          </span>
        </div>
        <div className="h-2 bg-surface-elevated rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${debt.progress_pct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full bg-brand rounded-full"
          />
        </div>
      </div>

      {/* Key metrics row */}
      <div className="grid grid-cols-4 gap-2 mt-3 text-center">
        <div>
          <p className="text-[10px] text-foreground-tertiary">Mensualité</p>
          <p className="text-xs font-semibold text-foreground">{formatAmount(debt.monthly_payment)}</p>
        </div>
        <div>
          <p className="text-[10px] text-foreground-tertiary">Taux</p>
          <p className="text-xs font-semibold text-foreground">{debt.interest_rate_pct.toFixed(2)}%</p>
        </div>
        <div>
          <p className="text-[10px] text-foreground-tertiary">Durée restante</p>
          <p className="text-xs font-semibold text-foreground">{debt.remaining_months} mois</p>
        </div>
        <div>
          <p className="text-[10px] text-foreground-tertiary">Coût total</p>
          <p className="text-xs font-semibold text-loss">{formatAmount(debt.total_cost)}</p>
        </div>
      </div>

      {/* Expand for amortization preview */}
      <button
        onClick={toggleExpand}
        className="flex items-center justify-center gap-1 w-full mt-3 pt-2 border-t border-border text-xs text-foreground-secondary hover:text-brand transition-colors"
      >
        <BarChart3 size={12} />
        {expanded ? 'Masquer le tableau' : "Tableau d'amortissement"}
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      <AnimatePresence>
        {expanded && amortization && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mt-2"
          >
            <div className="max-h-60 overflow-y-auto border border-border rounded-omni-sm">
              <table className="w-full text-xs">
                <thead className="bg-surface-elevated sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-foreground-secondary font-medium">#</th>
                    <th className="px-2 py-1.5 text-right text-foreground-secondary font-medium">Capital</th>
                    <th className="px-2 py-1.5 text-right text-foreground-secondary font-medium">Intérêts</th>
                    <th className="px-2 py-1.5 text-right text-foreground-secondary font-medium">Assurance</th>
                    <th className="px-2 py-1.5 text-right text-foreground-secondary font-medium">Restant</th>
                  </tr>
                </thead>
                <tbody>
                  {amortization.rows.slice(0, 24).map((row) => (
                    <tr key={row.payment_number} className="border-t border-border/50">
                      <td className="px-2 py-1 text-foreground-secondary">{row.payment_number}</td>
                      <td className="px-2 py-1 text-right text-foreground">{formatAmount(row.principal)}</td>
                      <td className="px-2 py-1 text-right text-loss">{formatAmount(row.interest)}</td>
                      <td className="px-2 py-1 text-right text-foreground-secondary">{formatAmount(row.insurance)}</td>
                      <td className="px-2 py-1 text-right font-medium text-foreground">{formatAmount(row.remaining)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {amortization.rows.length > 24 && (
                <p className="text-center text-[10px] text-foreground-tertiary py-1.5 bg-surface-elevated">
                  ... et {amortization.rows.length - 24} échéances de plus
                </p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2 text-center">
              <div className="bg-surface-elevated rounded-omni-sm p-2">
                <p className="text-[10px] text-foreground-tertiary">Total intérêts</p>
                <p className="text-xs font-semibold text-loss">{formatAmount(amortization.total_interest)}</p>
              </div>
              <div className="bg-surface-elevated rounded-omni-sm p-2">
                <p className="text-[10px] text-foreground-tertiary">Total assurance</p>
                <p className="text-xs font-semibold text-foreground-secondary">{formatAmount(amortization.total_insurance)}</p>
              </div>
              <div className="bg-surface-elevated rounded-omni-sm p-2">
                <p className="text-[10px] text-foreground-tertiary">Coût total</p>
                <p className="text-xs font-semibold text-foreground">{formatAmount(amortization.total_cost)}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ── Main Page ──────────────────────────────────────────── */
export default function DebtsPage() {
  const { summary, isLoading, error, fetchSummary, deleteDebt, fetchConsolidation, consolidation } = useDebtStore()
  const [showForm, setShowForm] = useState(false)
  const [editDebt, setEditDebt] = useState<Debt | null>(null)
  const [showConsolidation, setShowConsolidation] = useState(false)

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  const handleEdit = (debt: Debt) => {
    setEditDebt(debt)
    setShowForm(true)
  }

  const handleDelete = async (debt: Debt) => {
    if (confirm(`Supprimer "${debt.label}" ?`)) {
      await deleteDebt(debt.id)
    }
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditDebt(null)
  }

  const handleConsolidation = async () => {
    await fetchConsolidation(0)
    setShowConsolidation(true)
  }

  /* ── Loading state ─── */
  if (isLoading && !summary) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-omni-md" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-omni-md" />
          ))}
        </div>
      </div>
    )
  }

  const debts = summary?.debts || []

  return (
    <div className="space-y-6 p-6 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <CreditCard size={22} className="text-loss" /> Dettes & Crédits
          </h1>
          <p className="text-sm text-foreground-secondary mt-0.5">
            Gestion centralisée de vos emprunts, crédits, et simulations
          </p>
        </div>
        <div className="flex gap-2">
          {debts.length > 1 && (
            <Button variant="secondary" size="sm" onClick={handleConsolidation}>
              <BarChart3 size={14} className="mr-1.5" /> Consolidation
            </Button>
          )}
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus size={14} className="mr-1.5" /> Ajouter
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-3 text-sm bg-loss/10 text-loss rounded-omni-sm flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Summary cards */}
      {summary && summary.debts_count > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
            className="bg-surface border border-border rounded-omni-md p-3"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <TrendingDown size={14} className="text-loss" />
              <span className="text-xs text-foreground-secondary">Encours total</span>
            </div>
            <p className="text-lg font-bold text-loss">{formatAmount(summary.total_remaining)}</p>
            <p className="text-[10px] text-foreground-tertiary mt-0.5">
              sur {formatAmount(summary.total_initial)} empruntés
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-surface border border-border rounded-omni-md p-3"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Calendar size={14} className="text-brand" />
              <span className="text-xs text-foreground-secondary">Mensualités</span>
            </div>
            <p className="text-lg font-bold text-foreground">{formatAmount(summary.total_monthly)}</p>
            <p className="text-[10px] text-foreground-tertiary mt-0.5">
              {summary.debts_count} crédit{summary.debts_count > 1 ? 's' : ''}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-surface border border-border rounded-omni-md p-3"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Percent size={14} className="text-foreground-secondary" />
              <span className="text-xs text-foreground-secondary">Taux moyen pondéré</span>
            </div>
            <p className="text-lg font-bold text-foreground">{summary.weighted_avg_rate.toFixed(2)}%</p>
            <p className="text-[10px] text-foreground-tertiary mt-0.5">
              Ratio d&apos;endettement: {summary.debt_ratio_pct.toFixed(1)}%
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-surface border border-border rounded-omni-md p-3"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Calendar size={14} className="text-foreground-secondary" />
              <span className="text-xs text-foreground-secondary">Prochaine fin</span>
            </div>
            <p className="text-lg font-bold text-foreground">
              {summary.next_end_date
                ? new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' }).format(new Date(summary.next_end_date))
                : '—'}
            </p>
            <p className="text-[10px] text-foreground-tertiary mt-0.5">
              Prochain crédit soldé
            </p>
          </motion.div>
        </div>
      )}

      {/* Consolidation panel */}
      <AnimatePresence>
        {showConsolidation && consolidation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-surface border border-brand/20 rounded-omni-md p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                  <BarChart3 size={16} className="text-brand" /> Consolidation de vos dettes
                </h3>
                <button onClick={() => setShowConsolidation(false)} className="p-1 hover:bg-surface-elevated rounded-omni-sm">
                  <X size={14} />
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-xs text-foreground-secondary">Total restant</p>
                  <p className="font-semibold text-foreground">{formatAmount(consolidation.total_remaining)}</p>
                </div>
                <div>
                  <p className="text-xs text-foreground-secondary">Mensualité totale</p>
                  <p className="font-semibold text-foreground">{formatAmount(consolidation.total_monthly)}</p>
                </div>
                <div>
                  <p className="text-xs text-foreground-secondary">Taux moyen</p>
                  <p className="font-semibold text-foreground">{consolidation.weighted_avg_rate.toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-xs text-foreground-secondary">Mois épargnés (avec extra)</p>
                  <p className="font-semibold text-gain">{consolidation.months_saved_with_extra} mois</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="bg-surface-elevated rounded-omni-sm p-3">
                  <p className="text-xs font-medium text-foreground-secondary mb-1">Stratégie Avalanche (taux le plus haut d&apos;abord)</p>
                  <ol className="text-xs space-y-0.5 text-foreground">
                    {consolidation.avalanche_order.map((label, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-brand/20 text-brand text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
                        {label}
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="bg-surface-elevated rounded-omni-sm p-3">
                  <p className="text-xs font-medium text-foreground-secondary mb-1">Stratégie Snowball (solde le plus bas d&apos;abord)</p>
                  <ol className="text-xs space-y-0.5 text-foreground">
                    {consolidation.snowball_order.map((label, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-gain/20 text-gain text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
                        {label}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Debt list */}
      {debts.length === 0 ? (
        <div className="text-center py-16">
          <CreditCard size={48} className="mx-auto mb-4 text-foreground-tertiary" />
          <h3 className="text-lg font-semibold text-foreground mb-1">Aucune dette enregistrée</h3>
          <p className="text-sm text-foreground-secondary mb-4">
            Ajoutez vos prêts immobiliers, crédits conso, prêts étudiants pour une vision complète de votre patrimoine net.
          </p>
          <Button onClick={() => setShowForm(true)}>
            <Plus size={14} className="mr-1.5" /> Ajouter une dette
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {debts.map((debt) => (
              <DebtCard
                key={debt.id}
                debt={debt}
                onEdit={() => handleEdit(debt)}
                onDelete={() => handleDelete(debt)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Form modal */}
      <DebtFormModal
        isOpen={showForm}
        onClose={handleCloseForm}
        debt={editDebt}
      />
    </div>
  )
}
