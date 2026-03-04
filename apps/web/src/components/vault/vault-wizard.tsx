'use client'

import { useState, useCallback, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

/* ── Types ──────────────────────────────────────────── */

export interface WizardStep {
  id: string
  label: string
  icon?: ReactNode
  isOptional?: boolean
}

interface VaultWizardProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  steps: WizardStep[]
  currentStep: number
  onStepChange: (step: number) => void
  onSubmit: () => void
  isSubmitting?: boolean
  canAdvance?: boolean
  children: ReactNode
  /** Accent color for stepper */
  accent?: string
}

/* ── Wizard Shell ───────────────────────────────────── */

export function VaultWizard({
  open,
  onClose,
  title,
  subtitle,
  steps,
  currentStep,
  onStepChange,
  onSubmit,
  isSubmitting = false,
  canAdvance = true,
  children,
  accent = 'bg-brand',
}: VaultWizardProps) {
  const isFirst = currentStep === 0
  const isLast = currentStep === steps.length - 1

  const handleNext = useCallback(() => {
    if (isLast) {
      onSubmit()
    } else {
      onStepChange(currentStep + 1)
    }
  }, [isLast, onSubmit, onStepChange, currentStep])

  const handleBack = useCallback(() => {
    if (!isFirst) onStepChange(currentStep - 1)
  }, [isFirst, onStepChange, currentStep])

  if (!open) return null

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Content */}
          <motion.div
            className="relative w-full max-w-2xl bg-background rounded-omni-lg border border-border shadow-2xl overflow-hidden"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.4 }}
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-border">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold">{title}</h2>
                  {subtitle && <p className="text-sm text-foreground-secondary mt-0.5">{subtitle}</p>}
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-omni-sm hover:bg-surface transition-colors"
                >
                  <X className="h-5 w-5 text-foreground-secondary" />
                </button>
              </div>

              {/* Stepper */}
              {steps.length > 1 && (
                <div className="flex items-center gap-1">
                  {steps.map((step, i) => {
                    const isDone = i < currentStep
                    const isCurrent = i === currentStep
                    return (
                      <div key={step.id} className="flex items-center flex-1 last:flex-none">
                        <button
                          onClick={() => i < currentStep && onStepChange(i)}
                          className={`
                            flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all
                            ${isDone ? `${accent} text-white` : ''}
                            ${isCurrent ? `${accent}/20 text-foreground border-2 border-current` : ''}
                            ${!isDone && !isCurrent ? 'bg-surface text-foreground-tertiary' : ''}
                            ${i < currentStep ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
                          `}
                        >
                          {isDone ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <span className="w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold">
                              {i + 1}
                            </span>
                          )}
                          <span className="hidden sm:inline">{step.label}</span>
                        </button>
                        {i < steps.length - 1 && (
                          <div className={`flex-1 h-0.5 mx-1.5 rounded-full transition-colors ${i < currentStep ? accent : 'bg-border'}`} />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Body — step content */}
            <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={isFirst ? onClose : handleBack}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                {isFirst ? 'Annuler' : 'Retour'}
              </Button>

              <div className="flex items-center gap-2">
                <span className="text-xs text-foreground-tertiary">
                  {currentStep + 1} / {steps.length}
                </span>
                <Button
                  size="sm"
                  onClick={handleNext}
                  disabled={!canAdvance}
                  isLoading={isSubmitting}
                >
                  {isLast ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Créer
                    </>
                  ) : (
                    <>
                      Suivant
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ── Shared wizard form elements ────────────────────── */

export function WizardField({ label, required, hint, children }: {
  label: string
  required?: boolean
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-loss ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-foreground-tertiary">{hint}</p>}
    </div>
  )
}

export function WizardGrid({ cols = 2, children }: { cols?: 2 | 3; children: ReactNode }) {
  return (
    <div className={`grid gap-4 ${cols === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
      {children}
    </div>
  )
}

export function WizardSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="space-y-4">
      {title && <h3 className="text-sm font-semibold text-foreground-secondary uppercase tracking-wider">{title}</h3>}
      {children}
    </div>
  )
}

export const wizardInputCls = 'w-full rounded-omni-sm border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-colors'
export const wizardSelectCls = 'w-full rounded-omni-sm border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-colors appearance-none cursor-pointer'

/* ── Image Drop Zone ────────────────────────────────── */

export function ImageDropZone({ value, onChange, placeholder }: {
  value: string
  onChange: (url: string) => void
  placeholder?: string
}) {
  const [dragOver, setDragOver] = useState(false)

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => onChange(reader.result as string)
    reader.readAsDataURL(file)
  }, [onChange])

  return (
    <div
      className={`
        relative border-2 border-dashed rounded-omni transition-colors cursor-pointer overflow-hidden
        ${dragOver ? 'border-brand bg-brand/5' : 'border-border hover:border-foreground-tertiary'}
        ${value ? 'h-40' : 'h-32'}
      `}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0])
      }}
      onClick={() => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.onchange = () => input.files?.[0] && handleFile(input.files[0])
        input.click()
      }}
    >
      {value ? (
        <img src={value} alt="Preview" className="w-full h-full object-cover" />
      ) : (
        <div className="flex flex-col items-center justify-center h-full gap-2 text-foreground-tertiary">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
          </svg>
          <span className="text-xs">{placeholder || 'Glissez une image ou cliquez'}</span>
        </div>
      )}
    </div>
  )
}
