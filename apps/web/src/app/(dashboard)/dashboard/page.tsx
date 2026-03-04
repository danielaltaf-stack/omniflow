'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Building2,
  Bitcoin,
  BarChart3,
  Home,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageTransition } from '@/components/layout/page-transition'
import { DashboardHeader } from '@/components/finance/dashboard-header'
import { NetWorthHero } from '@/components/finance/net-worth-hero'
import { StatCard } from '@/components/finance/stat-card'
import { ActivityFeed } from '@/components/finance/activity-feed'
import { QuickActions } from '@/components/finance/quick-actions'
import { MiniGauge } from '@/components/finance/omni-score'
import { PatrimoineChart } from '@/components/charts/patrimoine-chart'
import { CashFlowChart } from '@/components/charts/cashflow-chart'
import { AllocationDonut } from '@/components/charts/allocation-donut'
import { ExpensesBarChart } from '@/components/charts/expenses-bar-chart'
import { AddBankModal } from '@/components/bank/add-bank-modal'
import { OnboardingChecklist } from '@/components/finance/onboarding-checklist'
import { useAuthStore } from '@/stores/auth-store'
import { useBankStore } from '@/stores/bank-store'
import { useCryptoStore } from '@/stores/crypto-store'
import { useStockStore } from '@/stores/stock-store'
import { useRealEstateStore } from '@/stores/realestate-store'
import { apiClient } from '@/lib/api-client'
import { useRouter } from 'next/navigation'
import type { Transaction, NetWorthData, NetWorthHistoryPoint, CashFlowData } from '@/types/api'

export default function DashboardPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const {
    accounts,
    connections,
    transactions,
    isLoadingAccounts,
    isLoadingConnections,
    fetchConnections,
    fetchAccounts,
    fetchTransactions,
  } = useBankStore()

  const [showAddBank, setShowAddBank] = useState(false)
  const [netWorth, setNetWorth] = useState<NetWorthData | null>(null)
  const [netWorthHistory, setNetWorthHistory] = useState<NetWorthHistoryPoint[]>([])
  const [cashFlowData, setCashFlowData] = useState<CashFlowData | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [omniScore, setOmniScore] = useState<{ total: number } | null>(null)

  const { portfolio: cryptoPortfolio, fetchPortfolio: fetchCrypto } = useCryptoStore()
  const { summary: stockSummary, fetchSummary: fetchStocks } = useStockStore()
  const { summary: realestateSummary, fetchSummary: fetchRealEstate } = useRealEstateStore()

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login')
    }
  }, [isAuthenticated, router])

  // Parallel data fetch on mount
  const fetchAllData = useCallback(async () => {
    if (!isAuthenticated) return
    fetchConnections()
    fetchAccounts()
    fetchCrypto()
    fetchStocks()
    fetchRealEstate()
    apiClient.get<NetWorthData>('/api/v1/networth').then(setNetWorth).catch(() => {})
    apiClient.get<NetWorthHistoryPoint[]>('/api/v1/networth/history').then(setNetWorthHistory).catch(() => {})
    apiClient.get<CashFlowData>('/api/v1/cashflow?period=monthly&months=6').then(setCashFlowData).catch(() => {})
    apiClient.get<{ total: number }>('/api/v1/insights/score').then(setOmniScore).catch(() => {})
  }, [isAuthenticated, fetchConnections, fetchAccounts, fetchCrypto, fetchStocks, fetchRealEstate])

  useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  // Fetch transactions for all accounts (for the activity feed)
  useEffect(() => {
    if (accounts.length > 0) {
      const first = accounts.find((a) => a.type === 'checking') || accounts[0]
      if (first) fetchTransactions(first.id)
    }
  }, [accounts, fetchTransactions])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchAllData()
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  if (!isAuthenticated) return null

  // ── Computed values ─────────────────────────────────
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0)
  const cryptoValue = cryptoPortfolio?.total_value ?? 0
  const stockValue = stockSummary?.total_value ?? 0
  const realEstateValue = realestateSummary?.total_value ?? 0
  const grandTotal = netWorth?.total ?? totalBalance

  // All transactions for the activity feed
  const allTransactions: Transaction[] = Object.values(transactions).flatMap((t) => t.items)

  // Allocation for donut chart
  const allocationData = [
    ...(totalBalance > 0 ? [{ name: 'Banques', value: totalBalance }] : []),
    ...(cryptoValue > 0 ? [{ name: 'Crypto', value: cryptoValue }] : []),
    ...(stockValue > 0 ? [{ name: 'Bourse', value: stockValue }] : []),
    ...(realEstateValue > 0 ? [{ name: 'Immobilier', value: realEstateValue }] : []),
  ]

  // Net Worth breakdown for the hero
  const heroBreakdown: Record<string, number> = {}
  if (totalBalance > 0) heroBreakdown['Liquidités'] = totalBalance
  if (cryptoValue > 0) heroBreakdown['Crypto'] = cryptoValue
  if (stockValue > 0) heroBreakdown['Bourse'] = stockValue
  if (realEstateValue > 0) heroBreakdown['Immobilier'] = realEstateValue

  const heroChange = netWorth?.change
    ? { absolute: netWorth.change.absolute, percentage: netWorth.change.percentage, period: netWorth.change.period }
    : undefined

  // Last sync timestamp
  const lastSync = connections
    .filter((c) => c.last_sync_at)
    .sort((a, b) => new Date(b.last_sync_at!).getTime() - new Date(a.last_sync_at!).getTime())[0]?.last_sync_at ?? null

  const hasData = connections.length > 0 || cryptoValue > 0 || stockValue > 0 || realEstateValue > 0

  const handleAddBankSuccess = () => {
    fetchConnections()
    fetchAccounts()
  }

  return (
    <PageTransition>
    <div className="mx-auto max-w-7xl px-3 sm:px-5 py-4 sm:py-5 overflow-x-hidden">
      {/* ── Header ─────────────────────────────────── */}
      <DashboardHeader
        userName={user?.name}
        lastSyncAt={lastSync}
        onAddBank={() => setShowAddBank(true)}
        onAddCrypto={() => router.push('/crypto')}
        onAddStock={() => router.push('/stocks')}
        onAddRealEstate={() => router.push('/realestate')}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />
      {/* ── Onboarding Checklist ────────────────── */}
      <div className="mt-4">
        <OnboardingChecklist />
      </div>
      {/* ── Empty state ────────────────────────────── */}
      {!hasData && !isLoadingConnections && (
        <motion.div
          className="mt-16 flex flex-col items-center text-center py-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand/10">
            <Building2 className="h-10 w-10 text-brand" />
          </div>
          <h2 className="mt-6 text-lg font-bold text-foreground">
            Connectez votre première banque
          </h2>
          <p className="mt-2 text-sm text-foreground-secondary max-w-md">
            OmniFlow agrège vos comptes bancaires, crypto, bourse et immobilier
            en un seul cockpit. Connexion sécurisée via Woob (open-source).
          </p>
          <div className="mt-6 flex gap-3">
            <Button onClick={() => setShowAddBank(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Connecter une banque
            </Button>
          </div>
          <div className="mt-8">
            <QuickActions
              onAddBank={() => setShowAddBank(true)}
              onAddCrypto={() => router.push('/crypto')}
              onAddStock={() => router.push('/stocks')}
              onAddRealEstate={() => router.push('/realestate')}
            />
          </div>
        </motion.div>
      )}

      {/* ── Dashboard with data ────────────────────── */}
      {(hasData || isLoadingAccounts) && (
        <div className="mt-4 space-y-4">
          {/* Net Worth Hero */}
          <NetWorthHero
            total={grandTotal}
            change={heroChange}
            breakdown={Object.keys(heroBreakdown).length > 0 ? heroBreakdown : undefined}
            isLoading={isLoadingAccounts}
          />

          {/* Stat Cards Grid — 4 col desktop, 2 col mobile */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <StatCard
              title="Liquidités"
              amount={totalBalance}
              icon={Building2}
              iconColor="text-blue-500"
              iconBg="bg-blue-500/10"
              sparklineData={netWorthHistory.slice(-7).map((p) => p.total)}
              onClick={() => router.push('/banks')}
              isLoading={isLoadingAccounts}
              index={0}
            />
            <StatCard
              title="Crypto"
              amount={cryptoValue}
              icon={Bitcoin}
              iconColor="text-amber-500"
              iconBg="bg-amber-500/10"
              change={cryptoPortfolio?.change_24h ? { absolute: cryptoPortfolio.change_24h, percentage: cryptoValue > 0 ? (cryptoPortfolio.change_24h / cryptoValue) * 100 : 0 } : undefined}
              onClick={() => router.push('/crypto')}
              isLoading={isLoadingAccounts}
              index={1}
            />
            <StatCard
              title="Bourse"
              amount={stockValue}
              icon={BarChart3}
              iconColor="text-violet-500"
              iconBg="bg-violet-500/10"
              change={stockSummary?.total_pnl ? { absolute: stockSummary.total_pnl, percentage: stockValue > 0 ? (stockSummary.total_pnl / (stockValue - stockSummary.total_pnl)) * 100 : 0 } : undefined}
              onClick={() => router.push('/stocks')}
              isLoading={isLoadingAccounts}
              index={2}
            />
            <StatCard
              title="Immobilier"
              amount={realEstateValue}
              icon={Home}
              iconColor="text-cyan-500"
              iconBg="bg-cyan-500/10"
              onClick={() => router.push('/realestate')}
              isLoading={isLoadingAccounts}
              index={3}
            />
          </div>

          {/* OmniScore widget */}
          {omniScore && omniScore.total > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="flex justify-end"
            >
              <MiniGauge score={omniScore.total} />
            </motion.div>
          )}

          {/* Charts + Activity — 2-col layout on desktop */}
          <div className="grid gap-2.5 sm:gap-3 lg:grid-cols-3">
            {/* Charts column (2/3 width) */}
            <div className="lg:col-span-2 space-y-2.5 sm:space-y-3 min-w-0">
              {/* Patrimoine evolution */}
              {netWorthHistory.length > 0 && (
                <PatrimoineChart data={netWorthHistory} />
              )}

              {/* Cash Flow + Allocation side by side */}
              <div className="grid gap-2.5 sm:gap-3 sm:grid-cols-2">
                {cashFlowData && cashFlowData.periods.length > 0 && (
                  <CashFlowChart periods={cashFlowData.periods} />
                )}
                {allocationData.length > 1 && (
                  <AllocationDonut data={allocationData} title="Répartition" />
                )}
              </div>

              {/* Top expenses */}
              {cashFlowData && cashFlowData.top_categories.length > 0 && (
                <ExpensesBarChart categories={cashFlowData.top_categories} />
              )}
            </div>

            {/* Activity feed column (1/3 width) */}
            <div className="lg:col-span-1">
              <ActivityFeed
                transactions={allTransactions}
                isLoading={isLoadingAccounts}
              />
            </div>
          </div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h3 className="text-sm font-medium text-foreground-secondary mb-3">Actions rapides</h3>
            <QuickActions
              onAddBank={() => setShowAddBank(true)}
              onAddCrypto={() => router.push('/crypto')}
              onAddStock={() => router.push('/stocks')}
              onAddRealEstate={() => router.push('/realestate')}
            />
          </motion.div>
        </div>
      )}

      {/* ── Add bank modal ─────────────────────────── */}
      <AddBankModal
        isOpen={showAddBank}
        onClose={() => setShowAddBank(false)}
        onSuccess={handleAddBankSuccess}
      />
    </div>
    </PageTransition>
  )
}
