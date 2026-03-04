'use client'

import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

export interface HubTab {
  key: string
  label: string
  icon: LucideIcon
}

interface HubTabsProps {
  tabs: HubTab[]
  activeTab: string
  onChange: (key: string) => void
}

/**
 * Reusable horizontal tab-strip for hub pages.
 * Scrollable on mobile, icon + label on desktop, icon-only on small screens.
 */
export function HubTabs({ tabs, activeTab, onChange }: HubTabsProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-none px-1 py-1 bg-surface-elevated/50 rounded-omni">
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab
        const Icon = tab.icon
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`
              relative flex items-center gap-1.5 px-3 py-1.5 rounded-omni-sm
              text-[13px] font-medium whitespace-nowrap transition-colors
              ${isActive
                ? 'text-brand'
                : 'text-foreground-secondary hover:text-foreground hover:bg-surface-elevated'
              }
            `}
          >
            <Icon size={15} />
            <span className="hidden sm:inline">{tab.label}</span>
            {isActive && (
              <motion.div
                layoutId="hub-tab-active"
                className="absolute inset-0 bg-brand/10 rounded-omni-sm"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
