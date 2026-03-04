'use client'

import { motion } from 'framer-motion'
import { Building2, Bitcoin, BarChart3, Home, LucideIcon } from 'lucide-react'

interface QuickAction {
  label: string
  icon: LucideIcon
  color: string
  bgColor: string
  onClick?: () => void
}

interface QuickActionsProps {
  onAddBank?: () => void
  onAddCrypto?: () => void
  onAddStock?: () => void
  onAddRealEstate?: () => void
}

/**
 * Horizontal grid of quick action buttons for adding new assets.
 * Staggered slide-up animation.
 */
export function QuickActions({
  onAddBank,
  onAddCrypto,
  onAddStock,
  onAddRealEstate,
}: QuickActionsProps) {
  const actions: QuickAction[] = [
    {
      label: 'Ajouter une banque',
      icon: Building2,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10 hover:bg-blue-500/20',
      onClick: onAddBank,
    },
    {
      label: 'Ajouter crypto',
      icon: Bitcoin,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10 hover:bg-amber-500/20',
      onClick: onAddCrypto,
    },
    {
      label: 'Ajouter actions',
      icon: BarChart3,
      color: 'text-violet-500',
      bgColor: 'bg-violet-500/10 hover:bg-violet-500/20',
      onClick: onAddStock,
    },
    {
      label: 'Ajouter un bien',
      icon: Home,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10 hover:bg-cyan-500/20',
      onClick: onAddRealEstate,
    },
  ]

  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:overflow-visible">
      {actions.map((action, i) => {
        const Icon = action.icon
        return (
          <motion.button
            key={action.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.06, duration: 0.25 }}
            whileHover={{ scale: 1.03, transition: { duration: 0.15 } }}
            whileTap={{ scale: 0.97 }}
            onClick={action.onClick}
            className={`
              flex items-center gap-2.5 px-3 py-2.5 rounded-omni-lg
              border border-border hover:border-brand/20
              transition-colors min-w-[160px] sm:min-w-0
              ${action.bgColor}
            `}
          >
            <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-background/40 ${action.color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-foreground whitespace-nowrap">{action.label}</span>
          </motion.button>
        )
      })}
    </div>
  )
}
