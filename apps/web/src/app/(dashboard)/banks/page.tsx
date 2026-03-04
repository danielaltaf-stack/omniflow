'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  RefreshCw,
  Building2,
  ChevronDown,
  ChevronRight,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AccountCard } from '@/components/bank/account-card'
import { AddBankModal } from '@/components/bank/add-bank-modal'
import { useBankStore } from '@/stores/bank-store'
import { formatAmount } from '@/lib/format'
import Link from 'next/link'
import type { Account, BankConnection } from '@/types/api'

export default function BanksPage() {
  const {
    accounts,
    connections,
    isLoadingAccounts,
    isLoadingConnections,
    isSyncing,
    fetchConnections,
    fetchAccounts,
    syncConnection,
    deleteConnection,
  } = useBankStore()

  const [showAddBank, setShowAddBank] = useState(false)
  const [expandedBanks, setExpandedBanks] = useState<Set<string>>(new Set())
  const [syncingId, setSyncingId] = useState<string | null>(null)

  useEffect(() => {
    fetchConnections()
    fetchAccounts()
  }, [fetchConnections, fetchAccounts])

  // Group accounts by connection
  const accountsByConnection = accounts.reduce<Record<string, Account[]>>((acc, account) => {
    const key = account.connection_id
    if (!acc[key]) acc[key] = []
    acc[key].push(account)
    return acc
  }, {})

  // Auto-expand all banks
  useEffect(() => {
    if (connections.length > 0 && expandedBanks.size === 0) {
      setExpandedBanks(new Set(connections.map(c => c.id)))
    }
  }, [connections, expandedBanks.size])

  const toggleBank = (id: string) => {
    setExpandedBanks(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSync = async (connectionId: string) => {
    setSyncingId(connectionId)
    try {
      await syncConnection(connectionId)
    } finally {
      setSyncingId(null)
    }
  }

  const statusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return { icon: CheckCircle, color: 'text-gain', label: 'Connecté' }
      case 'syncing':
        return { icon: Loader2, color: 'text-brand', label: 'Sync...' }
      case 'error':
        return { icon: AlertCircle, color: 'text-loss', label: 'Erreur' }
      case 'sca_required':
        return { icon: AlertCircle, color: 'text-yellow-500', label: 'SCA requis' }
      default:
        return { icon: Clock, color: 'text-foreground-tertiary', label: status }
    }
  }

  const isLoading = isLoadingAccounts || isLoadingConnections

  return (
    <div className="max-w-5xl mx-auto p-3 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-foreground">Mes Banques</h1>
          <p className="text-sm text-foreground-secondary mt-1">
            {connections.length} connexion{connections.length !== 1 ? 's' : ''} ·{' '}
            {accounts.length} compte{accounts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setShowAddBank(true)} className="gap-2">
          <Plus size={16} />
          Ajouter une banque
        </Button>
      </div>

      {/* Empty state */}
      {!isLoading && connections.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16"
        >
          <Building2 className="mx-auto h-16 w-16 text-foreground-tertiary mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">
            Aucune banque connectée
          </h2>
          <p className="text-foreground-secondary mb-6 max-w-md mx-auto">
            Connectez votre première banque pour voir vos comptes,
            transactions et patrimoine en temps réel.
          </p>
          <Button onClick={() => setShowAddBank(true)} className="gap-2">
            <Plus size={16} />
            Connecter ma banque
          </Button>
        </motion.div>
      )}

      {/* Bank connections list */}
      <div className="space-y-3">
        {connections.map((conn, index) => {
          const bankAccounts = accountsByConnection[conn.id] || []
          const isExpanded = expandedBanks.has(conn.id)
          const status = statusConfig(conn.status)
          const StatusIcon = status.icon
          const totalBalance = bankAccounts.reduce((sum, a) => sum + a.balance, 0)

          return (
            <motion.div
              key={conn.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-surface border border-border rounded-omni-lg overflow-hidden"
            >
              {/* Bank header */}
              <button
                onClick={() => toggleBank(conn.id)}
                className="w-full flex items-center gap-4 p-4 hover:bg-surface-elevated/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-omni-sm bg-brand/10 flex items-center justify-center">
                  <Building2 size={20} className="text-brand" />
                </div>
                
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{conn.bank_name}</h3>
                    <div className={`flex items-center gap-1 text-xs ${status.color}`}>
                      <StatusIcon size={12} className={conn.status === 'syncing' ? 'animate-spin' : ''} />
                      <span>{status.label}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-foreground-tertiary mt-0.5">
                    <span>{bankAccounts.length} compte{bankAccounts.length !== 1 ? 's' : ''}</span>
                    {conn.last_sync_at && (
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(conn.last_sync_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right mr-2">
                  <p className="font-semibold text-foreground">{formatAmount(totalBalance)}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSync(conn.id)
                    }}
                    disabled={syncingId === conn.id}
                    className="p-2 rounded-omni-sm hover:bg-surface-elevated transition-colors text-foreground-secondary"
                    title="Synchroniser"
                  >
                    <RefreshCw size={16} className={syncingId === conn.id ? 'animate-spin' : ''} />
                  </button>
                  {isExpanded ? <ChevronDown size={16} className="text-foreground-tertiary" /> : <ChevronRight size={16} className="text-foreground-tertiary" />}
                </div>
              </button>

              {/* Accounts */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border px-4 py-3 space-y-2">
                      {bankAccounts.map((account) => (
                        <Link
                          key={account.id}
                          href={`/banks/${account.id}`}
                          className="flex items-center justify-between p-3 rounded-omni-sm hover:bg-surface-elevated transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center text-xs font-bold text-brand">
                              {account.type === 'checking' ? 'CC' :
                               account.type === 'savings' ? 'EP' :
                               account.type === 'market' ? 'PEA' :
                               account.type === 'loan' ? 'PR' :
                               account.type === 'life_insurance' ? 'AV' :
                               account.type[0]?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground group-hover:text-brand transition-colors">
                                {account.label}
                              </p>
                              <p className="text-xs text-foreground-tertiary capitalize">
                                {account.type.replace('_', ' ')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className={`font-semibold text-sm ${account.balance >= 0 ? 'text-foreground' : 'text-loss'}`}>
                              {formatAmount(account.balance, account.currency)}
                            </p>
                            <ChevronRight size={14} className="text-foreground-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </Link>
                      ))}

                      {bankAccounts.length === 0 && (
                        <p className="text-sm text-foreground-tertiary text-center py-4">
                          Aucun compte trouvé pour cette banque.
                        </p>
                      )}
                    </div>

                    {/* Connection error */}
                    {conn.last_error && (
                      <div className="mx-4 mb-3 p-3 rounded-omni-sm bg-loss/10 border border-loss/20 text-xs text-loss">
                        {conn.last_error}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>

      {/* Loading skeletons */}
      {isLoading && connections.length === 0 && (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="bg-surface border border-border rounded-omni-lg p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-omni-sm bg-surface-elevated" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-surface-elevated rounded" />
                  <div className="h-3 w-20 bg-surface-elevated rounded" />
                </div>
                <div className="h-5 w-24 bg-surface-elevated rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      <AddBankModal
        isOpen={showAddBank}
        onClose={() => setShowAddBank(false)}
        onSuccess={() => { fetchConnections(); fetchAccounts(); }}
      />
    </div>
  )
}
