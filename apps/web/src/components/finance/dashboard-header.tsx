'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  RefreshCw,
  Building2,
  Bitcoin,
  BarChart3,
  Home,
  Clock,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DashboardHeaderProps {
  userName?: string
  lastSyncAt?: string | null
  onAddBank?: () => void
  onAddCrypto?: () => void
  onAddStock?: () => void
  onAddRealEstate?: () => void
  onRefresh?: () => void
  isRefreshing?: boolean
}

export function DashboardHeader({
  userName,
  lastSyncAt,
  onAddBank,
  onAddCrypto,
  onAddStock,
  onAddRealEstate,
  onRefresh,
  isRefreshing = false,
}: DashboardHeaderProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [relativeTime, setRelativeTime] = useState('')

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Bonjour'
    if (hour < 18) return 'Bon après-midi'
    return 'Bonsoir'
  }

  const computeRelativeTime = useCallback(() => {
    if (!lastSyncAt) return ''
    const now = Date.now()
    const then = new Date(lastSyncAt).getTime()
    const diffMs = now - then
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'à l\'instant'
    if (diffMin < 60) return `il y a ${diffMin} min`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `il y a ${diffH}h`
    return `il y a ${Math.floor(diffH / 24)}j`
  }, [lastSyncAt])

  useEffect(() => {
    setRelativeTime(computeRelativeTime())
    const interval = setInterval(() => {
      setRelativeTime(computeRelativeTime())
    }, 30000)
    return () => clearInterval(interval)
  }, [computeRelativeTime])

  const firstName = userName?.split(' ')[0] || 'Utilisateur'

  const addActions = [
    { label: 'Banque', icon: Building2, color: 'text-blue-500 bg-blue-500/10', onClick: onAddBank },
    { label: 'Crypto', icon: Bitcoin, color: 'text-amber-500 bg-amber-500/10', onClick: onAddCrypto },
    { label: 'Bourse', icon: BarChart3, color: 'text-violet-500 bg-violet-500/10', onClick: onAddStock },
    { label: 'Immobilier', icon: Home, color: 'text-cyan-500 bg-cyan-500/10', onClick: onAddRealEstate },
  ]

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-xl font-bold text-foreground">
          {getGreeting()}, {firstName} 👋
        </h1>
        {lastSyncAt && relativeTime && (
          <div className="flex items-center gap-1.5 mt-1">
            <Clock className="h-3 w-3 text-foreground-tertiary" />
            <span className="text-xs text-foreground-tertiary">
              Mis à jour {relativeTime}
            </span>
          </div>
        )}
      </motion.div>

      {/* Actions */}
      <motion.div
        className="flex items-center gap-2"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        {/* Refresh button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="gap-1.5"
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
          />
          <span className="hidden sm:inline">Actualiser</span>
        </Button>

        {/* Add asset dropdown */}
        <div className="relative">
          <Button
            size="sm"
            onClick={() => setShowDropdown(!showDropdown)}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Ajouter un actif</span>
            <ChevronDown className={`h-3 w-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </Button>

          <AnimatePresence>
            {showDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowDropdown(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 z-50 w-52 rounded-omni border border-border bg-background-elevated shadow-xl overflow-hidden"
                >
                  {addActions.map((action, i) => {
                    const Icon = action.icon
                    return (
                      <motion.button
                        key={action.label}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => {
                          action.onClick?.()
                          setShowDropdown(false)
                        }}
                        className="flex items-center gap-3 w-full px-4 py-3 text-sm text-foreground hover:bg-surface transition-colors"
                      >
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${action.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span>{action.label}</span>
                      </motion.button>
                    )
                  })}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
