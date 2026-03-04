'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Wallet,
  PieChart,
  Brain,
  Target,
  Sparkles,
  Vault,
  X,
  Grid3X3,
  Settings,
  Bell,
  LogOut,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { NotificationCenter } from '@/components/ui/notification-center'

const MAIN_ITEMS = [
  { label: 'Accueil', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Patrimoine', href: '/patrimoine', icon: Wallet },
  { label: 'Budget', href: '/gestion', icon: PieChart },
  { label: 'Intelligence', href: '/intelligence', icon: Brain },
]

const MORE_ITEMS = [
  { label: 'Objectifs', href: '/objectifs', icon: Target },
  { label: 'Coffre-fort', href: '/vault', icon: Vault },
  { label: 'Nova IA', href: '/nova', icon: Sparkles },
  { label: 'Réglages', href: '/settings', icon: Settings },
]

// Notifications are handled inline via <NotificationCenter />

export function BottomNav() {
  const pathname = usePathname()
  const { logout } = useAuthStore()
  const [showMore, setShowMore] = useState(false)

  // Check if current path is in the "more" section
  const isMoreActive = MORE_ITEMS.some(
    (item) => pathname === item.href || pathname?.startsWith(item.href + '/')
  )

  return (
    <>
      {/* "More" overlay panel */}
      <AnimatePresence>
        {showMore && (
          <motion.div
            className="fixed inset-0 z-50 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowMore(false)}
            />
            {/* Panel */}
            <motion.div
              className="absolute bottom-0 left-0 right-0 bg-surface border-t border-border rounded-t-2xl px-4 pb-20 pt-4"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-foreground">Plus</h3>
                <button
                  onClick={() => setShowMore(false)}
                  className="p-1.5 rounded-omni-sm text-foreground-tertiary hover:text-foreground hover:bg-surface-elevated transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {MORE_ITEMS.map((item) => {
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setShowMore(false)}
                      className="flex flex-col items-center gap-1.5 py-3 rounded-omni-sm hover:bg-surface-elevated transition-colors"
                    >
                      <Icon
                        size={22}
                        className={isActive ? 'text-brand' : 'text-foreground-tertiary'}
                      />
                      <span
                        className={`text-[10px] leading-tight text-center ${
                          isActive ? 'text-brand font-semibold' : 'text-foreground-tertiary'
                        }`}
                      >
                        {item.label}
                      </span>
                    </Link>
                  )
                })}
              </div>

              {/* Separator + Déconnexion */}
              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                <div className="flex gap-3">
                  <NotificationCenter />
                </div>
                <button
                  onClick={() => { logout(); setShowMore(false) }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-loss hover:bg-loss/10 transition-colors"
                >
                  <LogOut size={16} />
                  <span className="text-xs font-medium">Déconnexion</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden z-40 bg-surface border-t border-border backdrop-blur-xl bg-surface/90">
        <div className="flex items-center justify-around h-14 px-2 max-w-lg mx-auto">
          {MAIN_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex flex-col items-center gap-0.5 py-1 px-3"
              >
                <motion.div
                  whileTap={{ scale: 0.92 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
                  <Icon
                    size={20}
                    className={isActive ? 'text-brand' : 'text-foreground-tertiary'}
                  />
                </motion.div>
                <span
                  className={`text-[10px] ${
                    isActive
                      ? 'text-brand font-semibold'
                      : 'text-foreground-tertiary'
                  }`}
                >
                  {item.label}
                </span>

                {isActive && (
                  <motion.div
                    layoutId="bottomnav-dot"
                    className="absolute -top-0.5 w-1 h-1 rounded-full bg-brand"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </Link>
            )
          })}

          {/* "Plus" button */}
          <button
            onClick={() => setShowMore(true)}
            className="relative flex flex-col items-center gap-0.5 py-1 px-3"
          >
            <motion.div
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              <Grid3X3
                size={20}
                className={isMoreActive ? 'text-brand' : 'text-foreground-tertiary'}
              />
            </motion.div>
            <span
              className={`text-[10px] ${
                isMoreActive ? 'text-brand font-semibold' : 'text-foreground-tertiary'
              }`}
            >
              Plus
            </span>
            {isMoreActive && (
              <motion.div
                className="absolute -top-0.5 w-1 h-1 rounded-full bg-brand"
              />
            )}
          </button>
        </div>
      </nav>
    </>
  )
}
