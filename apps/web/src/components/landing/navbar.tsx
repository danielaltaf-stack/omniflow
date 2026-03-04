'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import {
  Layers, Brain, Sparkles, TrendingUp, CalendarClock, Vault,
  Building2, Bitcoin, LineChart, Bot, Wallet, Scale,
  Zap, Gift, ShieldCheck, Calendar,
  Sun, Moon, Menu, X, ChevronDown,
} from 'lucide-react'

/* ── Mega Dropdown Data ───────────────────────────────────── */
const productColumns = [
  {
    title: 'Patrimoine',
    items: [
      { icon: Layers, label: 'Agrégation', desc: 'Toutes vos banques', href: '#features', color: '#6C5CE7' },
      { icon: LineChart, label: 'Multi-Assets', desc: 'Crypto, Bourse, ETF', href: '#features', color: '#54A0FF' },
      { icon: Building2, label: 'Immobilier', desc: 'Valorisation en temps réel', href: '#features', color: '#00D68F' },
      { icon: Bitcoin, label: 'Crypto', desc: '8 000+ tokens', href: '#features', color: '#FF9F43' },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { icon: Bot, label: 'Nova IA', desc: 'Conseiller personnel', href: '#features', color: '#A29BFE' },
      { icon: Wallet, label: 'Budget IA', desc: 'Catégorisation auto', href: '#features', color: '#54A0FF' },
      { icon: Scale, label: 'Fiscal Radar', desc: 'Optimisation fiscale', href: '#features', color: '#FF4757' },
      { icon: Zap, label: 'Autopilot', desc: 'Alertes intelligentes', href: '#features', color: '#FF9F43' },
    ],
  },
  {
    title: 'Outils',
    items: [
      { icon: CalendarClock, label: 'Retraite', desc: 'Simulateur Monte-Carlo', href: '#features', color: '#00D68F' },
      { icon: Gift, label: 'Héritage', desc: 'Planification succession', href: '#features', color: '#6C5CE7' },
      { icon: Vault, label: 'Coffre-Fort', desc: 'Documents chiffrés', href: '#features', color: '#FF4757' },
      { icon: Calendar, label: 'Calendrier', desc: 'Échéances financières', href: '#features', color: '#54A0FF' },
    ],
  },
]

const navLinks = [
  { label: 'Produit', href: '#', hasDropdown: true },
  { label: 'Tarifs', href: '/pricing' },
  { label: 'Blog', href: '/blog' },
  { label: 'À propos', href: '/about' },
  { label: 'Contact', href: '/contact' },
]

/* ── Component ────────────────────────────────────────────── */
export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const openDropdown = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setDropdownOpen(true)
  }
  const closeDropdown = () => {
    timeoutRef.current = setTimeout(() => setDropdownOpen(false), 150)
  }

  return (
    <>
      <header
        className={`fixed left-0 right-0 top-0 z-[100] transition-all duration-300 ${
          scrolled
            ? 'border-b border-gray-200/60 bg-white/80 backdrop-blur-xl dark:border-white/[0.06] dark:bg-black/70'
            : 'bg-transparent'
        }`}
      >
        <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 lg:px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 text-gray-900 dark:text-white">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-sm font-bold tracking-tight">OmniFlow</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden items-center gap-1 md:flex">
            {navLinks.map(link => (
              <div
                key={link.label}
                className="static"
                onMouseEnter={link.hasDropdown ? openDropdown : undefined}
                onMouseLeave={link.hasDropdown ? closeDropdown : undefined}
              >
                {link.hasDropdown ? (
                  <button
                    className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[13px] text-gray-600 transition-colors hover:text-gray-900 dark:text-white/60 dark:hover:text-white"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                  >
                    {link.label}
                    <ChevronDown className={`h-3 w-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                ) : (
                  <Link
                    href={link.href}
                    className="rounded-lg px-3 py-1.5 text-[13px] text-gray-600 transition-colors hover:text-gray-900 dark:text-white/60 dark:hover:text-white"
                  >
                    {link.label}
                  </Link>
                )}
              </div>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            )}

            <Link
              href="/login"
              className="hidden text-[13px] text-gray-600 transition-colors hover:text-gray-900 sm:block dark:text-white/60 dark:hover:text-white"
            >
              Se connecter
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-brand px-3.5 py-1.5 text-[13px] font-medium text-white transition-all hover:bg-brand-light hover:shadow-[0_0_20px_rgba(108,92,231,0.3)]"
            >
              Commencer
            </Link>

            {/* Mobile toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="ml-1 text-gray-600 md:hidden dark:text-white/60"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        {/* ── Mega Dropdown ─────────────────────────────── */}
        <AnimatePresence>
          {dropdownOpen && (
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="hidden w-[680px] md:block"
              style={{ position: 'fixed', top: '3.5rem', left: 'calc(50% - 340px)' }}
              onMouseEnter={openDropdown}
              onMouseLeave={closeDropdown}
            >
              <div className="rounded-2xl border border-gray-200 bg-white/95 p-5 shadow-2xl backdrop-blur-2xl dark:border-white/[0.08] dark:bg-black/90">
                <div className="grid grid-cols-3 gap-5">
                  {productColumns.map(col => (
                    <div key={col.title}>
                      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-white/30">
                        {col.title}
                      </p>
                      <div className="space-y-1">
                        {col.items.map(item => (
                          <a
                            key={item.label}
                            href={item.href}
                            className="group flex items-start gap-2.5 rounded-lg p-2 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.05]"
                            onClick={() => setDropdownOpen(false)}
                          >
                            <div
                              className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md"
                              style={{ backgroundColor: `${item.color}15` }}
                            >
                              <item.icon className="h-3.5 w-3.5" style={{ color: item.color }} />
                            </div>
                            <div>
                              <p className="text-[12px] font-medium text-gray-700 group-hover:text-gray-900 dark:text-white/80 dark:group-hover:text-white">
                                {item.label}
                              </p>
                              <p className="text-[11px] text-gray-400 group-hover:text-gray-500 dark:text-white/35 dark:group-hover:text-white/50">
                                {item.desc}
                              </p>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom highlight */}
                <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/20">
                      <Sparkles className="h-4 w-4 text-brand-light" />
                    </div>
                    <div>
                      <p className="text-[12px] font-medium text-gray-700 dark:text-white/80">Nouveau : Nova Advisor IA</p>
                      <p className="text-[11px] text-gray-400 dark:text-white/40">Votre copilote financier personnel propulsé par GPT-4</p>
                    </div>
                    <Link
                      href="#features"
                      className="ml-auto text-[11px] font-medium text-brand-light hover:text-brand"
                      onClick={() => setDropdownOpen(false)}
                    >
                      Découvrir →
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Mobile Full-Screen Overlay ──────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99] bg-black/95 pt-14 backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col gap-1 p-4">
              {/* Product section */}
              <p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
                Produit
              </p>
              {productColumns.flatMap(col => col.items).map(item => (
                <a
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg p-2 text-white/70 hover:bg-white/5 hover:text-white"
                  onClick={() => setMobileOpen(false)}
                >
                  <item.icon className="h-4 w-4" style={{ color: item.color }} />
                  <span className="text-sm">{item.label}</span>
                </a>
              ))}

              <div className="my-3 border-t border-white/[0.06]" />

              {navLinks.filter(l => !l.hasDropdown).map(link => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="rounded-lg p-2 text-sm text-white/70 hover:text-white"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}

              <div className="my-3 border-t border-white/[0.06]" />

              <Link
                href="/login"
                className="rounded-lg p-2 text-sm text-white/60"
                onClick={() => setMobileOpen(false)}
              >
                Se connecter
              </Link>
              <Link
                href="/register"
                className="mt-2 rounded-xl bg-brand py-3 text-center text-sm font-semibold text-white"
                onClick={() => setMobileOpen(false)}
              >
                Commencer gratuitement
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
