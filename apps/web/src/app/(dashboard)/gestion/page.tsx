'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { Zap, PieChart, CalendarDays, CreditCard } from 'lucide-react'
import { HubTabs, type HubTab } from '@/components/ui/hub-tabs'

/* ── Lazy-loaded sub-pages ─── */
const CashFlowPage = dynamic(() => import('@/app/(dashboard)/cashflow/page'), { ssr: false })
const BudgetPage = dynamic(() => import('@/app/(dashboard)/budget/page'), { ssr: false })
const CalendarPage = dynamic(() => import('@/app/(dashboard)/calendar/page'), { ssr: false })
const DebtsPage = dynamic(() => import('@/app/(dashboard)/debts/page'), { ssr: false })

const TABS: HubTab[] = [
  { key: 'cashflow', label: 'Cash-Flow', icon: Zap },
  { key: 'budget', label: 'Budget', icon: PieChart },
  { key: 'calendrier', label: 'Calendrier', icon: CalendarDays },
  { key: 'dettes', label: 'Dettes', icon: CreditCard },
]

const TAB_COMPONENTS: Record<string, React.ComponentType> = {
  cashflow: CashFlowPage,
  budget: BudgetPage,
  calendrier: CalendarPage,
  dettes: DebtsPage,
}

function GestionBudgetContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeTab = searchParams.get('tab') || 'cashflow'

  const ActiveComponent = TAB_COMPONENTS[activeTab] || CashFlowPage

  const handleTabChange = (key: string) => {
    router.push(`/gestion?tab=${key}`, { scroll: false })
  }

  return (
    <div className="flex flex-col min-h-0">
      {/* Sticky tab header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border px-3 lg:px-6 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold text-foreground shrink-0">Budget</h1>
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

export default function GestionPage() {
  return (
    <Suspense fallback={<div className="p-6 text-foreground-secondary">Chargement...</div>}>
      <GestionBudgetContent />
    </Suspense>
  )
}
