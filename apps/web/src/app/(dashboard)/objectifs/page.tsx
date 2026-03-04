'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { Target, Sunset, Users } from 'lucide-react'
import { HubTabs, type HubTab } from '@/components/ui/hub-tabs'

/* ── Lazy-loaded sub-pages ─── */
const ProjectsPage = dynamic(() => import('@/app/(dashboard)/projects/page'), { ssr: false })
const RetirementPage = dynamic(() => import('@/app/(dashboard)/retirement/page'), { ssr: false })
const HeritagePage = dynamic(() => import('@/app/(dashboard)/heritage/page'), { ssr: false })

const TABS: HubTab[] = [
  { key: 'projets', label: 'Projets', icon: Target },
  { key: 'retraite', label: 'Retraite', icon: Sunset },
  { key: 'heritage', label: 'Héritage', icon: Users },
]

const TAB_COMPONENTS: Record<string, React.ComponentType> = {
  projets: ProjectsPage,
  retraite: RetirementPage,
  heritage: HeritagePage,
}

function ProjetsHubContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeTab = searchParams.get('tab') || 'projets'

  const ActiveComponent = TAB_COMPONENTS[activeTab] || ProjectsPage

  const handleTabChange = (key: string) => {
    router.push(`/objectifs?tab=${key}`, { scroll: false })
  }

  return (
    <div className="flex flex-col min-h-0">
      {/* Sticky tab header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border px-3 lg:px-6 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold text-foreground shrink-0">Objectifs</h1>
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

export default function ObjectifsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-foreground-secondary">Chargement...</div>}>
      <ProjetsHubContent />
    </Suspense>
  )
}
