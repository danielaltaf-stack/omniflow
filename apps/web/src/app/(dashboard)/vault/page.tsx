'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Vault,
  Package,
  Hexagon,
  CreditCard,
  Star,
  RotateCcw,
  FileText,
  Handshake,
  Sparkles,
} from 'lucide-react'
import { useVaultStore } from '@/stores/vault-store'
import AssetsTab from '@/components/vault/assets-tab'
import NFTsTab from '@/components/vault/nfts-tab'
import CardsTab from '@/components/vault/cards-tab'
import LoyaltyTab from '@/components/vault/loyalty-tab'
import SubscriptionsTab from '@/components/vault/subscriptions-tab'
import DocumentsTab from '@/components/vault/documents-tab'
import DebtsTab from '@/components/vault/debts-tab'

/* ── Helpers ──────────────────────────────────────────── */

const fmt = (centimes: number) =>
  (centimes / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

type Tab = 'assets' | 'nfts' | 'cards' | 'loyalty' | 'subscriptions' | 'documents' | 'debts'

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: 'assets', label: 'Biens', icon: Package },
  { key: 'nfts', label: 'NFTs', icon: Hexagon },
  { key: 'cards', label: 'Cartes', icon: CreditCard },
  { key: 'loyalty', label: 'Fidélité', icon: Star },
  { key: 'subscriptions', label: 'Abonnements', icon: RotateCcw },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'debts', label: 'Dettes P2P', icon: Handshake },
]

/* ── Main Page ────────────────────────────────────────── */

export default function VaultPage() {
  const [tab, setTab] = useState<Tab>('assets')
  const store = useVaultStore()

  useEffect(() => {
    store.fetchSummary()
    store.fetchAssets()
    store.fetchNFTs()
    store.fetchCards()
    store.fetchLoyalty()
    store.fetchSubscriptions()
    store.fetchDocuments()
    store.fetchPeerDebts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const s = store.summary

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
      {/* ── Header ─────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Vault className="h-7 w-7 text-brand" />
          Coffre-fort Numérique
        </h1>
        <p className="text-foreground-secondary text-sm mt-1">
          Patrimoine invisible — biens, NFTs, cartes, fidélité, abonnements, documents, dettes P2P
        </p>
      </div>

      {/* ── Shadow Wealth Summary ──────────────────── */}
      {s && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-brand/10 to-brand/5 border border-brand/20 rounded-omni p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-5 w-5 text-brand" />
            <span className="font-semibold text-brand">Shadow Wealth Total</span>
          </div>
          <div className="text-3xl font-bold mb-4">{fmt(s.shadow_wealth_total)}</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-sm">
            <SummaryStat label="Biens" value={fmt(s.tangible_assets_total)} sub={`${s.tangible_assets_count} biens`} />
            <SummaryStat label="NFTs" value={fmt(s.nft_total)} sub={`${s.nft_count} NFTs`} />
            <SummaryStat label="Fidélité" value={fmt(s.loyalty_total)} sub={`${s.loyalty_count} prog.`} />
            <SummaryStat label="Abonnements" value={`${fmt(s.subscription_monthly)}/mois`} sub={`${s.subscription_count} actifs`} />
            <SummaryStat label="Documents" value={`${s.documents_count}`} sub={`${s.documents_expiring_soon} expirent`} />
            <SummaryStat label="Dettes P2P" value={fmt(s.peer_debt_net)} sub={s.peer_debt_net >= 0 ? 'Créditeur' : 'Débiteur'} />
            <SummaryStat label="Cartes" value={`${s.cards_count}`} sub={`${fmt(s.cards_total_annual_fees)}/an`} />
          </div>
        </motion.div>
      )}

      {/* ── Tabs ───────────────────────────────────── */}
      <div className="flex gap-1 overflow-x-auto border-b border-border pb-0">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                active
                  ? 'border-brand text-brand'
                  : 'border-transparent text-foreground-secondary hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* ── Tab Content ────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
        >
          {tab === 'assets' && <AssetsTab />}
          {tab === 'nfts' && <NFTsTab />}
          {tab === 'cards' && <CardsTab />}
          {tab === 'loyalty' && <LoyaltyTab />}
          {tab === 'subscriptions' && <SubscriptionsTab />}
          {tab === 'documents' && <DocumentsTab />}
          {tab === 'debts' && <DebtsTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/* ── Stat Helper ──────────────────────────────────────── */

function SummaryStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-surface/60 rounded-omni-sm p-2">
      <div className="text-foreground-tertiary text-xs">{label}</div>
      <div className="font-semibold text-sm">{value}</div>
      <div className="text-foreground-tertiary text-xs">{sub}</div>
    </div>
  )
}
