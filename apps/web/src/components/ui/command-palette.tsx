'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  LayoutDashboard,
  Wallet,
  PieChart,
  Target,
  Brain,
  Sparkles,
  Vault,
  Settings,
  Building2,
  Bitcoin,
  BarChart3,
  Home,
  CreditCard,
  Zap,
  CalendarDays,
  Sunset,
  Users,
  Scissors,
  Shield,
  Bell,
} from 'lucide-react'

import type { LucideIcon } from 'lucide-react'

interface PaletteItem {
  id: string
  label: string
  description?: string
  href: string
  icon: LucideIcon
  keywords: string[]
}

const PALETTE_ITEMS: PaletteItem[] = [
  // Main pages
  { id: 'dashboard', label: 'Dashboard', description: 'Vue d\'ensemble', href: '/dashboard', icon: LayoutDashboard, keywords: ['accueil', 'home', 'overview'] },
  { id: 'nova', label: 'Nova IA', description: 'Assistant intelligent', href: '/nova', icon: Sparkles, keywords: ['ia', 'ai', 'chatbot', 'assistant'] },
  { id: 'settings', label: 'Réglages', description: 'Paramètres du compte', href: '/settings', icon: Settings, keywords: ['parametres', 'profil', 'compte'] },

  // Patrimoine hub
  { id: 'patrimoine', label: 'Patrimoine', description: 'Vue globale des actifs', href: '/patrimoine', icon: Wallet, keywords: ['actifs', 'fortune', 'wealth'] },
  { id: 'banques', label: 'Banques', description: 'Comptes bancaires', href: '/patrimoine?tab=banques', icon: Building2, keywords: ['comptes', 'bank', 'virement'] },
  { id: 'crypto', label: 'Crypto', description: 'Portefeuille crypto', href: '/patrimoine?tab=crypto', icon: Bitcoin, keywords: ['bitcoin', 'ethereum', 'blockchain', 'token'] },
  { id: 'bourse', label: 'Bourse', description: 'Actions & ETF', href: '/patrimoine?tab=bourse', icon: BarChart3, keywords: ['actions', 'stocks', 'etf', 'pea', 'cto', 'dividende'] },
  { id: 'immobilier', label: 'Immobilier', description: 'Biens immobiliers', href: '/patrimoine?tab=immobilier', icon: Home, keywords: ['loyer', 'appartement', 'maison', 'real estate'] },

  // Budget/Gestion hub
  { id: 'gestion', label: 'Budget & Gestion', description: 'Cash-flow, budget, calendrier', href: '/gestion', icon: PieChart, keywords: ['budget', 'depenses', 'gestion'] },
  { id: 'cashflow', label: 'Cash-Flow', description: 'Flux de trésorerie', href: '/gestion?tab=cashflow', icon: Zap, keywords: ['tresorerie', 'flux', 'entrees', 'sorties'] },
  { id: 'budget', label: 'Budget', description: 'Suivi budgétaire', href: '/gestion?tab=budget', icon: PieChart, keywords: ['enveloppes', 'limites', 'categories'] },
  { id: 'calendrier', label: 'Calendrier', description: 'Échéances financières', href: '/gestion?tab=calendrier', icon: CalendarDays, keywords: ['echeances', 'dates', 'rappel'] },
  { id: 'dettes', label: 'Dettes', description: 'Crédits & emprunts', href: '/gestion?tab=dettes', icon: CreditCard, keywords: ['credit', 'emprunt', 'pret', 'remboursement'] },

  // Objectifs hub
  { id: 'objectifs', label: 'Objectifs', description: 'Projets & planification', href: '/objectifs', icon: Target, keywords: ['projets', 'objectifs', 'epargne'] },
  { id: 'projets', label: 'Projets', description: 'Projets d\'épargne', href: '/objectifs?tab=projets', icon: Target, keywords: ['epargne', 'objectif', 'cible'] },
  { id: 'retraite', label: 'Retraite', description: 'Simulateur retraite', href: '/objectifs?tab=retraite', icon: Sunset, keywords: ['pension', 'simulateur', 'retirement'] },
  { id: 'heritage', label: 'Héritage', description: 'Planification successorale', href: '/objectifs?tab=heritage', icon: Users, keywords: ['succession', 'transmission', 'donation'] },

  // Intelligence hub
  { id: 'intelligence', label: 'Intelligence', description: 'Analyses & optimisations', href: '/intelligence', icon: Brain, keywords: ['analyses', 'insights', 'optimisation'] },
  { id: 'analyses', label: 'Analyses', description: 'Insights financiers', href: '/intelligence?tab=analyses', icon: Brain, keywords: ['insights', 'tendances', 'patterns'] },
  { id: 'frais', label: 'Frais', description: 'Négociateur de frais', href: '/intelligence?tab=frais', icon: Scissors, keywords: ['commissions', 'couts', 'negociation'] },
  { id: 'fiscal', label: 'Fiscal', description: 'Radar fiscal', href: '/intelligence?tab=fiscal', icon: Shield, keywords: ['impots', 'taxes', 'declaration', 'tva'] },
  { id: 'autopilot', label: 'Autopilot', description: 'Pilotage automatique', href: '/intelligence?tab=autopilot', icon: Zap, keywords: ['automatisation', 'regles', 'auto'] },
  { id: 'alertes', label: 'Alertes', description: 'Alertes & notifications', href: '/intelligence?tab=alertes', icon: Bell, keywords: ['notifications', 'seuils', 'warnings'] },

  // Standalone
  { id: 'vault', label: 'Coffre-fort', description: 'Documents sécurisés', href: '/vault', icon: Vault, keywords: ['documents', 'fichiers', 'securise', 'coffre'] },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Ctrl+K / Cmd+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Fuzzy filter
  const filtered = useMemo(() => {
    if (!query.trim()) return PALETTE_ITEMS
    const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return PALETTE_ITEMS.filter((item) => {
      const haystack = [item.label, item.description || '', ...item.keywords]
        .join(' ')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
      return haystack.includes(q)
    })
  }, [query])

  // Keyboard nav
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && filtered[selectedIndex]) {
        e.preventDefault()
        navigate(filtered[selectedIndex].href)
      }
    },
    [filtered, selectedIndex],
  )

  const navigate = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.children[selectedIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  // Reset selection on filter change
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <motion.div
            className="relative w-full max-w-lg mx-4 bg-surface border border-border rounded-omni shadow-2xl overflow-hidden"
            initial={{ scale: 0.95, y: -10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: -10 }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search size={18} className="text-foreground-tertiary shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Rechercher une page..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground-tertiary outline-none"
              />
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-surface-elevated text-[10px] text-foreground-tertiary font-mono border border-border">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div
              ref={listRef}
              className="max-h-[50vh] overflow-y-auto py-2"
            >
              {filtered.length === 0 && (
                <p className="px-4 py-6 text-sm text-foreground-tertiary text-center">
                  Aucun résultat pour &quot;{query}&quot;
                </p>
              )}
              {filtered.map((item, idx) => {
                const Icon = item.icon
                const isSelected = idx === selectedIndex
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.href)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`
                      flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors
                      ${isSelected ? 'bg-brand/10 text-brand' : 'text-foreground hover:bg-surface-elevated'}
                    `}
                  >
                    <Icon
                      size={18}
                      className={isSelected ? 'text-brand' : 'text-foreground-tertiary'}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{item.label}</span>
                      {item.description && (
                        <span className="ml-2 text-xs text-foreground-tertiary">
                          {item.description}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Footer hint */}
            <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-[10px] text-foreground-tertiary">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-surface-elevated font-mono border border-border">↑↓</kbd>
                naviguer
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-surface-elevated font-mono border border-border">↵</kbd>
                ouvrir
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-surface-elevated font-mono border border-border">esc</kbd>
                fermer
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
