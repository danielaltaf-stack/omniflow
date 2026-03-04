'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, X, Calendar as CalIcon } from 'lucide-react'
import type { CalendarEventCreate } from '@/types/api'

interface AddEventModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CalendarEventCreate) => void
  isSaving: boolean
  defaultDate?: string
}

const EVENT_TYPES = [
  { value: 'custom_reminder', label: 'Rappel personnalisé', icon: '✏️' },
  { value: 'fiscal_deadline', label: 'Échéance fiscale', icon: '📋' },
  { value: 'salary_expected', label: 'Salaire attendu', icon: '💰' },
  { value: 'rent_expected', label: 'Loyer attendu', icon: '🏠' },
  { value: 'insurance_renewal', label: 'Renouvellement assurance', icon: '🛡️' },
  { value: 'tax_payment', label: 'Paiement impôts', icon: '🏛️' },
  { value: 'admin_deadline', label: 'Échéance administrative', icon: '📄' },
  { value: 'guarantee_expiry', label: 'Fin de garantie', icon: '⚠️' },
  { value: 'subscription_trial_end', label: 'Fin période d\'essai', icon: '🔔' },
]

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'Aucune' },
  { value: 'weekly', label: 'Hebdomadaire' },
  { value: 'monthly', label: 'Mensuel' },
  { value: 'quarterly', label: 'Trimestriel' },
  { value: 'semi_annual', label: 'Semestriel' },
  { value: 'annual', label: 'Annuel' },
]

const COLOR_PRESETS = [
  '#6C5CE7',
  '#00D68F',
  '#FF4757',
  '#FECA57',
  '#54A0FF',
  '#A29BFE',
  '#FF6B6B',
  '#48DBFB',
]

export function AddEventModal({ isOpen, onClose, onSubmit, isSaving, defaultDate }: AddEventModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eventType, setEventType] = useState('custom_reminder')
  const [eventDate, setEventDate] = useState(defaultDate ?? new Date().toISOString().split('T')[0] ?? '')
  const [amount, setAmount] = useState('')
  const [isIncome, setIsIncome] = useState(false)
  const [recurrence, setRecurrence] = useState('none')
  const [reminderDays, setReminderDays] = useState('1')
  const [color, setColor] = useState('#6C5CE7')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const data: CalendarEventCreate = {
      title: title.trim(),
      description: description.trim() || undefined,
      event_type: eventType,
      event_date: eventDate,
      amount: amount ? Math.round(parseFloat(amount) * 100) : undefined,
      is_income: isIncome,
      recurrence,
      reminder_days_before: parseInt(reminderDays) || 1,
      color,
    }
    onSubmit(data)
  }

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-surface border border-border rounded-omni-lg shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-omni-sm bg-brand/10">
              <Plus className="w-4 h-4 text-brand" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Nouvel événement</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-omni-sm hover:bg-surface-elevated transition-colors"
          >
            <X className="w-4 h-4 text-foreground-secondary" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-foreground-secondary mb-1.5">
              Titre *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Déclaration d'impôts"
              className="w-full px-3 py-2 text-sm rounded-omni-sm border border-border bg-background-tertiary text-foreground placeholder:text-foreground-secondary/50 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/20"
              required
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-foreground-secondary mb-1.5">
              Type
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {EVENT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setEventType(t.value)}
                  className={`
                    flex items-center gap-1 text-xs px-2 py-1.5 rounded-omni-sm border transition-all
                    ${eventType === t.value
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-border text-foreground-secondary hover:bg-surface-elevated'
                    }
                  `}
                >
                  <span className="text-[10px]">{t.icon}</span>
                  <span className="truncate">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-foreground-secondary mb-1.5">
              Date *
            </label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-omni-sm border border-border bg-background-tertiary text-foreground focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/20"
              required
            />
          </div>

          {/* Amount + Income toggle */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-foreground-secondary mb-1.5">
                Montant (€)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                className="w-full px-3 py-2 text-sm rounded-omni-sm border border-border bg-background-tertiary text-foreground focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/20"
              />
            </div>
            <div className="flex flex-col justify-end">
              <button
                type="button"
                onClick={() => setIsIncome(!isIncome)}
                className={`
                  px-3 py-2 text-xs rounded-omni-sm border font-medium transition-all
                  ${isIncome
                    ? 'border-gain bg-gain/10 text-gain'
                    : 'border-loss bg-loss/10 text-loss'
                  }
                `}
              >
                {isIncome ? '+ Entrée' : '- Sortie'}
              </button>
            </div>
          </div>

          {/* Recurrence */}
          <div>
            <label className="block text-xs font-medium text-foreground-secondary mb-1.5">
              Récurrence
            </label>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-omni-sm border border-border bg-background-tertiary text-foreground focus:outline-none focus:border-brand"
            >
              {RECURRENCE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reminder */}
          <div>
            <label className="block text-xs font-medium text-foreground-secondary mb-1.5">
              Rappel (jours avant)
            </label>
            <input
              type="number"
              min="0"
              max="90"
              value={reminderDays}
              onChange={(e) => setReminderDays(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-omni-sm border border-border bg-background-tertiary text-foreground focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/20"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-medium text-foreground-secondary mb-1.5">
              Couleur
            </label>
            <div className="flex gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    color === c ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-foreground-secondary mb-1.5">
              Notes
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes optionnelles…"
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-omni-sm border border-border bg-background-tertiary text-foreground placeholder:text-foreground-secondary/50 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 resize-none"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!title.trim() || isSaving}
            className="w-full py-2.5 rounded-omni-sm bg-brand text-white text-sm font-semibold hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isSaving ? 'Enregistrement…' : 'Ajouter au calendrier'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  )
}
