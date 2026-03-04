'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Search,
  Filter,
  X,
  Calendar,
  Repeat,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CategoryBadge } from '@/components/finance/category-badge'
import { useBankStore } from '@/stores/bank-store'
import { formatAmount, formatDate } from '@/lib/format'
import Link from 'next/link'
import type { Transaction, Account } from '@/types/api'

export default function AccountDetailPage() {
  const params = useParams()
  const router = useRouter()
  const accountId = params.accountId as string

  const { accounts, transactions, fetchAccounts, fetchTransactions } = useBankStore()

  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const account = accounts.find(a => a.id === accountId)
  const txnData = transactions[accountId]

  useEffect(() => {
    if (accounts.length === 0) fetchAccounts()
    fetchTransactions(accountId, 1)
  }, [accountId, accounts.length, fetchAccounts, fetchTransactions])

  // Load initial transactions
  useEffect(() => {
    if (txnData) {
      setAllTransactions(txnData.items)
      setHasMore(txnData.page < txnData.pages)
    }
  }, [txnData])

  // Infinite scroll
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return
    setIsLoadingMore(true)
    const nextPage = page + 1
    await fetchTransactions(accountId, nextPage)
    const newData = transactions[accountId]
    if (newData) {
      setAllTransactions(prev => {
        const existingIds = new Set(prev.map(t => t.id))
        const newItems = newData.items.filter(t => !existingIds.has(t.id))
        return [...prev, ...newItems]
      })
      setPage(nextPage)
      setHasMore(newData.page < newData.pages)
    }
    setIsLoadingMore(false)
  }, [accountId, fetchTransactions, hasMore, isLoadingMore, page, transactions])

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()

    observerRef.current = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting && hasMore) {
          loadMore()
        }
      },
      { threshold: 0.1 }
    )

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current)
    }

    return () => observerRef.current?.disconnect()
  }, [hasMore, loadMore])

  // Filter transactions client-side
  const filteredTransactions = allTransactions.filter(t => {
    if (search) {
      const q = search.toLowerCase()
      if (
        !t.label.toLowerCase().includes(q) &&
        !(t.merchant || '').toLowerCase().includes(q) &&
        !(t.raw_label || '').toLowerCase().includes(q)
      ) return false
    }
    if (selectedCategories.size > 0 && !selectedCategories.has(t.category || 'Autres')) {
      return false
    }
    return true
  })

  // Get unique categories
  const categories = Array.from(new Set(allTransactions.map(t => t.category || 'Autres'))).sort()

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  if (!account) {
    return (
      <div className="max-w-4xl mx-auto p-4 lg:p-8">
        <div className="text-center py-16 text-foreground-secondary">
          Compte introuvable...
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-4 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/banks"
          className="inline-flex items-center gap-1 text-sm text-foreground-secondary hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft size={14} />
          Retour aux banques
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{account.label}</h1>
              <span className="px-2 py-0.5 text-xs rounded-full bg-brand/10 text-brand capitalize">
                {account.type.replace('_', ' ')}
              </span>
            </div>
            <p className="text-sm text-foreground-secondary mt-1">
              {account.bank_name} · {account.currency}
            </p>
          </div>

          <div className="text-right">
            <p className={`text-2xl font-bold ${account.balance >= 0 ? 'text-foreground' : 'text-loss'}`}>
              {formatAmount(account.balance, account.currency)}
            </p>
          </div>
        </div>
      </div>

      {/* Search & filters */}
      <div className="mb-4 space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-tertiary" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher une transaction..."
              className="w-full pl-9 pr-4 py-2.5 rounded-omni-sm bg-surface border border-border text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-brand/50"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-tertiary hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-omni-sm border text-sm transition-colors ${
              showFilters || selectedCategories.size > 0
                ? 'border-brand text-brand bg-brand/5'
                : 'border-border text-foreground-secondary hover:text-foreground'
            }`}
          >
            <Filter size={14} />
            Filtres
            {selectedCategories.size > 0 && (
              <span className="ml-1 w-4 h-4 rounded-full bg-brand text-white text-[10px] flex items-center justify-center">
                {selectedCategories.size}
              </span>
            )}
          </button>
        </div>

        {/* Category filter chips */}
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-wrap gap-2"
          >
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedCategories.has(cat)
                    ? 'bg-brand text-white'
                    : 'bg-surface-elevated text-foreground-secondary hover:text-foreground'
                }`}
              >
                {cat}
              </button>
            ))}
            {selectedCategories.size > 0 && (
              <button
                onClick={() => setSelectedCategories(new Set())}
                className="px-3 py-1.5 rounded-full text-xs text-loss hover:bg-loss/10 transition-colors"
              >
                Effacer
              </button>
            )}
          </motion.div>
        )}
      </div>

      {/* Transaction count */}
      <p className="text-xs text-foreground-tertiary mb-3">
        {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
        {search || selectedCategories.size > 0 ? ' (filtré)' : ''}
        {txnData ? ` sur ${txnData.total}` : ''}
      </p>

      {/* Transactions list */}
      <div className="space-y-1">
        {filteredTransactions.map((txn, idx) => (
          <motion.div
            key={txn.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: Math.min(idx * 0.02, 0.5) }}
            className="flex items-center gap-3 py-3 px-3 rounded-omni-sm hover:bg-surface-elevated/50 transition-colors border-b border-border/50 last:border-0"
          >
            {/* Category badge */}
            <div className="flex-shrink-0">
              <CategoryBadge category={txn.category} subcategory={txn.subcategory} />
            </div>

            {/* Label & details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-foreground truncate">
                  {txn.merchant || txn.label}
                </p>
                {txn.is_recurring && (
                  <Repeat size={12} className="text-brand flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-foreground-tertiary">
                <span>{formatDate(txn.date)}</span>
                {txn.merchant && txn.merchant !== txn.label && (
                  <span className="truncate">{txn.label}</span>
                )}
              </div>
            </div>

            {/* Amount */}
            <p className={`text-sm font-semibold flex-shrink-0 ${
              txn.amount >= 0 ? 'text-gain' : 'text-loss'
            }`}>
              {txn.amount >= 0 ? '+' : ''}{formatAmount(txn.amount)}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Infinite scroll sentinel */}
      {hasMore && (
        <div ref={sentinelRef} className="py-8 text-center">
          {isLoadingMore && (
            <div className="flex items-center justify-center gap-2 text-sm text-foreground-tertiary">
              <div className="w-4 h-4 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
              Chargement...
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!txnData && (
        <div className="text-center py-12 text-foreground-tertiary text-sm">
          Chargement des transactions...
        </div>
      )}
      {txnData && allTransactions.length === 0 && (
        <div className="text-center py-12 text-foreground-tertiary text-sm">
          Aucune transaction trouvée pour ce compte.
        </div>
      )}
    </div>
  )
}
