'use client'

import { useState, useCallback, createContext, useContext, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

interface ToastContextValue {
  toast: (t: Omit<Toast, 'id'>) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

// ── Icons & colors ─────────────────────────────────────────

const TOAST_CONFIG: Record<ToastType, { icon: React.ElementType; color: string; bg: string }> = {
  success: { icon: CheckCircle, color: 'text-gain', bg: 'bg-gain/10 border-gain/20' },
  error: { icon: XCircle, color: 'text-loss', bg: 'bg-loss/10 border-loss/20' },
  warning: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10 border-warning/20' },
  info: { icon: Info, color: 'text-info', bg: 'bg-info/10 border-info/20' },
}

// ── Provider ───────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const toast = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const newToast: Toast = { ...t, id }
      setToasts((prev) => [...prev.slice(-4), newToast]) // max 5 toasts
      const duration = t.duration ?? 4000
      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration)
        timers.current.set(id, timer)
      }
    },
    [dismiss]
  )

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}

      {/* Toast container — bottom-right */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => {
            const config = TOAST_CONFIG[t.type]
            const Icon = config.icon

            return (
              <motion.div
                key={t.id}
                className={`pointer-events-auto flex items-start gap-3 px-3.5 py-3 rounded-omni border backdrop-blur-xl shadow-lg ${config.bg}`}
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                layout
              >
                <Icon size={16} className={`${config.color} mt-0.5 flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">{t.title}</p>
                  {t.message && (
                    <p className="text-[10px] text-foreground-secondary mt-0.5 line-clamp-2">
                      {t.message}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => dismiss(t.id)}
                  className="text-foreground-tertiary hover:text-foreground transition-colors flex-shrink-0"
                >
                  <X size={12} />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
