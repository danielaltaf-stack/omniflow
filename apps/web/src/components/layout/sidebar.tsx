'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Wallet,
  PieChart,
  Target,
  Brain,
  Sparkles,
  Vault,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Monitor,
  Search,
} from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { useAuthStore } from '@/stores/auth-store'
import { useTheme } from 'next-themes'
import { NotificationCenter } from '@/components/ui/notification-center'

interface NavItem {
  label: string
  href: string
  icon: typeof LayoutDashboard
}

interface NavSection {
  title: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: '',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Patrimoine', href: '/patrimoine', icon: Wallet },
      { label: 'Budget', href: '/gestion', icon: PieChart },
      { label: 'Objectifs', href: '/objectifs', icon: Target },
    ],
  },
  {
    title: 'IA',
    items: [
      { label: 'Intelligence', href: '/intelligence', icon: Brain },
      { label: 'Coffre-fort', href: '/vault', icon: Vault },
      { label: 'Nova IA', href: '/nova', icon: Sparkles },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()
  const [collapsed, setCollapsed] = useState(false)
  const { theme, setTheme } = useTheme()

  const cycleTheme = () => {
    if (theme === 'dark') setTheme('light')
    else if (theme === 'light') setTheme('system')
    else setTheme('dark')
  }

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor

  return (
    <aside
      className={`
        hidden md:flex flex-col border-r border-border bg-surface
        transition-all duration-200 ease-in-out
        ${collapsed ? 'w-16' : 'w-56'}
      `}
    >
      {/* Header */}
      <div className={`flex items-center h-14 px-3 border-b border-border ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && <Logo size="sm" />}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-omni-sm hover:bg-surface-elevated text-foreground-secondary transition-colors"
          title={collapsed ? 'Agrandir' : 'Réduire'}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 px-2 overflow-y-auto">
        {NAV_SECTIONS.map((section, sIdx) => (
          <div key={section.title || 'main'} className={sIdx > 0 ? 'mt-3' : ''}>
            {/* Section header */}
            {section.title && !collapsed && (
              <p className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-wider text-foreground-tertiary">
                {section.title}
              </p>
            )}
            {section.title && collapsed && (
              <div className="mx-auto my-1.5 w-6 border-t border-border" />
            )}

            {/* Section items */}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                const Icon = item.icon

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      flex items-center gap-2.5 px-2.5 py-2 rounded-omni-sm
                      transition-all duration-150 group relative
                      ${isActive
                        ? 'bg-brand/10 text-brand font-medium'
                        : 'text-foreground-secondary hover:text-foreground hover:bg-surface-elevated'
                      }
                      ${collapsed ? 'justify-center' : ''}
                    `}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon size={18} className={isActive ? 'text-brand' : ''} />
                    
                    {!collapsed && (
                      <span className="text-[13px] truncate">{item.label}</span>
                    )}

                    {/* Active indicator */}
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-brand rounded-r-full"
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Search shortcut */}
      {!collapsed && (
        <button
          onClick={() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
          }}
          className="mx-2 mb-1 flex items-center gap-2 px-2.5 py-1.5 rounded-omni-sm border border-border text-foreground-tertiary hover:text-foreground hover:bg-surface-elevated transition-colors"
        >
          <Search size={14} />
          <span className="text-[12px] flex-1 text-left">Rechercher...</span>
          <kbd className="text-[10px] font-mono px-1 py-0.5 rounded bg-surface-elevated border border-border">⌘K</kbd>
        </button>
      )}

      {/* Bottom controls */}
      <div className={`border-t border-border px-2 py-2 space-y-1 ${collapsed ? 'flex flex-col items-center' : ''}`}>
        {/* Theme toggle + Notifications row */}
        <div className={`flex items-center ${collapsed ? 'flex-col gap-1' : 'gap-1 px-1'}`}>
          <button
            onClick={cycleTheme}
            className="p-2 rounded-omni-sm hover:bg-surface-elevated text-foreground-secondary hover:text-foreground transition-colors"
            title={`Thème: ${theme === 'dark' ? 'Sombre' : theme === 'light' ? 'Clair' : 'Système'}`}
          >
            <motion.div
              key={theme}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <ThemeIcon size={15} />
            </motion.div>
          </button>
          <NotificationCenter />
          {!collapsed && (
            <span className="text-[10px] text-foreground-tertiary ml-auto capitalize">
              {theme === 'dark' ? 'Sombre' : theme === 'light' ? 'Clair' : 'Auto'}
            </span>
          )}
        </div>

        {/* User info */}
        {!collapsed && (
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="w-7 h-7 rounded-full bg-brand/20 flex items-center justify-center text-brand font-bold text-xs">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-foreground truncate">{user?.name || 'Utilisateur'}</p>
              <p className="text-[10px] text-foreground-tertiary truncate">{user?.email}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className={`flex ${collapsed ? 'flex-col' : ''} gap-0.5 overflow-hidden`}>
          <Link
            href="/settings"
            className={`
              flex items-center gap-2 px-2.5 py-1.5 rounded-omni-sm text-[13px]
              text-foreground-secondary hover:text-foreground hover:bg-surface-elevated transition-colors
              min-w-0 ${collapsed ? 'justify-center' : 'flex-1'}
            `}
            title={collapsed ? 'Réglages' : undefined}
          >
            <Settings size={15} className="flex-shrink-0" />
            {!collapsed && <span className="truncate">Réglages</span>}
          </Link>
          <button
            onClick={logout}
            className={`
              flex items-center gap-2 px-2.5 py-1.5 rounded-omni-sm text-[13px]
              text-loss hover:bg-loss/10 transition-colors
              min-w-0 ${collapsed ? 'justify-center' : ''}
            `}
            title={collapsed ? 'Déconnexion' : undefined}
          >
            <LogOut size={15} className="flex-shrink-0" />
            {!collapsed && <span className="truncate">Déconnexion</span>}
          </button>
        </div>
      </div>
    </aside>
  )
}
