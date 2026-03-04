'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { Brain, Scissors, Shield, Zap, Bell } from 'lucide-react'
import { HubTabs, type HubTab } from '@/components/ui/hub-tabs'

/* ── Lazy-loaded sub-pages ─── */
const InsightsPage = dynamic(() => import('@/app/(dashboard)/insights/page'), { ssr: false })
const FeesPage = dynamic(() => import('@/app/(dashboard)/fees/page'), { ssr: false })
const FiscalPage = dynamic(() => import('@/app/(dashboard)/fiscal/page'), { ssr: false })
const AutopilotPage = dynamic(() => import('@/app/(dashboard)/autopilot/page'), { ssr: false })
const AlertsPage = dynamic(() => import('@/app/(dashboard)/alerts/page'), { ssr: false })

const TABS: HubTab[] = [
  { key: 'analyses', label: 'Analyses', icon: Brain },
  { key: 'frais', label: 'Frais', icon: Scissors },
  { key: 'fiscal', label: 'Fiscal', icon: Shield },
  { key: 'autopilot', label: 'Autopilot', icon: Zap },
  { key: 'alertes', label: 'Alertes', icon: Bell },
]

const TAB_COMPONENTS: Record<string, React.ComponentType> = {
  analyses: InsightsPage,
  frais: FeesPage,
  fiscal: FiscalPage,
  autopilot: AutopilotPage,
  alertes: AlertsPage,
}

function IntelligenceHubContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeTab = searchParams.get('tab') || 'analyses'

  const ActiveComponent = TAB_COMPONENTS[activeTab] || InsightsPage

  const handleTabChange = (key: string) => {
    router.push(`/intelligence?tab=${key}`, { scroll: false })
  }

  return (
    <div className="flex flex-col min-h-0">
      {/* Sticky tab header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border px-3 lg:px-6 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold text-foreground shrink-0">Intelligence</h1>
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

export default function IntelligencePage() {
  return (
    <Suspense fallback={<div className="p-6 text-foreground-secondary">Chargement...</div>}>
      <IntelligenceHubContent />
    </Suspense>
  )
}
