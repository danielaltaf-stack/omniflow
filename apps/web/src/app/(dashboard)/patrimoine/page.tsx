'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { Building2, Bitcoin, BarChart3, Home } from 'lucide-react'
import { HubTabs, type HubTab } from '@/components/ui/hub-tabs'

/* ── Lazy-loaded sub-pages (keeps code-splitting intact) ─── */
const BanksPage = dynamic(() => import('@/app/(dashboard)/banks/page'), { ssr: false })
const CryptoPage = dynamic(() => import('@/app/(dashboard)/crypto/page'), { ssr: false })
const StocksPage = dynamic(() => import('@/app/(dashboard)/stocks/page'), { ssr: false })
const RealEstatePage = dynamic(() => import('@/app/(dashboard)/realestate/page'), { ssr: false })

const TABS: HubTab[] = [
  { key: 'banques', label: 'Banques', icon: Building2 },
  { key: 'crypto', label: 'Crypto', icon: Bitcoin },
  { key: 'bourse', label: 'Bourse', icon: BarChart3 },
  { key: 'immobilier', label: 'Immobilier', icon: Home },
]

const TAB_COMPONENTS: Record<string, React.ComponentType> = {
  banques: BanksPage,
  crypto: CryptoPage,
  bourse: StocksPage,
  immobilier: RealEstatePage,
}

function PatrimoineContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeTab = searchParams.get('tab') || 'banques'

  const ActiveComponent = TAB_COMPONENTS[activeTab] || BanksPage

  const handleTabChange = (key: string) => {
    router.push(`/patrimoine?tab=${key}`, { scroll: false })
  }

  return (
    <div className="flex flex-col min-h-0">
      {/* Sticky tab header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border px-3 lg:px-6 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold text-foreground shrink-0">Patrimoine</h1>
          <HubTabs tabs={TABS} activeTab={activeTab} onChange={handleTabChange} />
        </div>
      </div>

      {/* Sub-page content */}
      <div className="flex-1">
        <ActiveComponent />
      </div>
    </div>
  )
}

export default function PatrimoinePage() {
  return (
    <Suspense fallback={<div className="p-6 text-foreground-secondary">Chargement...</div>}>
      <PatrimoineContent />
    </Suspense>
  )
}
