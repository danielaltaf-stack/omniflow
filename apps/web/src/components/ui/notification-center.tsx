'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  X,
  CheckCheck,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  CreditCard,
  PieChart,
  Info,
} from 'lucide-react'
import { formatRelativeDate } from '@/lib/format'
import { apiClient } from '@/lib/api-client'

// ── Types ──────────────────────────────────────────────────

export interface AppNotification {
  id: string
  type: 'sync_success' | 'sync_error' | 'patrimoine_up' | 'patrimoine_down' | 'fees_detected' | 'budget_exceeded' | 'anomaly' | 'info' | 'alert_triggered'
  title: string
  body: string
  is_read: boolean
  created_at: string
}

const TYPE_ICON: Record<string, React.ElementType> = {
  sync_success: RefreshCw,
  sync_error: AlertTriangle,
  patrimoine_up: TrendingUp,
  patrimoine_down: TrendingDown,
  fees_detected: CreditCard,
  budget_exceeded: PieChart,
  anomaly: AlertTriangle,
  info: Info,
  alert_triggered: Bell,
}

const TYPE_COLOR: Record<string, string> = {
  sync_success: 'text-gain bg-gain/10',
  sync_error: 'text-loss bg-loss/10',
  patrimoine_up: 'text-gain bg-gain/10',
  patrimoine_down: 'text-loss bg-loss/10',
  fees_detected: 'text-warning bg-warning/10',
  budget_exceeded: 'text-loss bg-loss/10',
  anomaly: 'text-warning bg-warning/10',
  info: 'text-info bg-info/10',
  alert_triggered: 'text-brand bg-brand/10',
}

// ── Notification Center ────────────────────────────────────

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.is_read).length

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await apiClient.get<AppNotification[]>('/api/v1/notifications')
      setNotifications(data)
    } catch {
      // Silently fail — notifications are non-critical
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    // Poll every 60s
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  // Mark as read
  const markAsRead = async (id: string) => {
    try {
      await apiClient.patch(`/api/v1/notifications/${id}/read`)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      )
    } catch {}
  }

  // Mark all as read
  const markAllRead = async () => {
    try {
      await Promise.all(
        notifications.filter((n) => !n.is_read).map((n) =>
          apiClient.patch(`/api/v1/notifications/${n.id}/read`)
        )
      )
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    } catch {}
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-omni-sm hover:bg-surface-elevated text-foreground-secondary hover:text-foreground transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold text-white bg-loss rounded-full"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute left-0 bottom-full mb-2 w-80 bg-surface/95 backdrop-blur-xl border border-border rounded-omni shadow-2xl z-50 overflow-hidden md:left-full md:bottom-0 md:ml-2 md:mb-0"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h4 className="text-sm font-semibold text-foreground">Notifications</h4>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[10px] text-brand hover:text-brand-light transition-colors"
                  >
                    Tout marquer lu
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-foreground-tertiary hover:text-foreground transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-72 overflow-y-auto">
              {notifications.length === 0 && !isLoading && (
                <div className="flex flex-col items-center py-8 text-foreground-tertiary">
                  <Bell size={24} className="mb-2 opacity-40" />
                  <p className="text-xs">Aucune notification</p>
                </div>
              )}

              {notifications.map((notif, i) => {
                const Icon = TYPE_ICON[notif.type] || Info
                const colorClass = TYPE_COLOR[notif.type] || 'text-info bg-info/10'

                return (
                  <motion.button
                    key={notif.id}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-surface-elevated/50 transition-colors border-b border-border/50 last:border-0 ${
                      !notif.is_read ? 'bg-brand/[0.02]' : ''
                    }`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => {
                      if (!notif.is_read) markAsRead(notif.id)
                    }}
                  >
                    <div className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center ${colorClass}`}>
                      <Icon size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-medium truncate ${notif.is_read ? 'text-foreground-secondary' : 'text-foreground'}`}>
                          {notif.title}
                        </p>
                        {!notif.is_read && (
                          <div className="w-1.5 h-1.5 rounded-full bg-brand flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-[10px] text-foreground-tertiary mt-0.5 line-clamp-2">
                        {notif.body}
                      </p>
                      <p className="text-[9px] text-foreground-disabled mt-1">
                        {formatRelativeDate(notif.created_at)}
                      </p>
                    </div>
                  </motion.button>
                )
              })}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-2 border-t border-border">
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center justify-center gap-1 text-[10px] text-brand hover:text-brand-light transition-colors"
                >
                  <CheckCheck size={11} />
                  {unreadCount === 0 ? 'Toutes les notifications lues' : `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
