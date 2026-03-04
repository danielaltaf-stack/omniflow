'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

const navLinks = [
  { label: 'Fonctionnalités', href: '#features' },
  { label: 'Comment ça marche', href: '#how-it-works' },
  { label: 'FAQ', href: '#faq' },
]

export function FloatingNav() {
  const [visible, setVisible] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > window.innerHeight * 0.6)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.header
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed left-0 right-0 top-4 z-[90] mx-auto max-w-5xl px-4"
        >
          <nav className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-black/60 px-6 py-3 shadow-2xl backdrop-blur-xl">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 text-white">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="text-sm font-semibold tracking-tight">OmniFlow</span>
            </Link>

            {/* Desktop links */}
            <div className="hidden items-center gap-6 md:flex">
              {navLinks.map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  data-cursor="link"
                  className="text-[13px] text-white/50 transition-colors hover:text-white"
                >
                  {link.label}
                </a>
              ))}
            </div>

            {/* CTA */}
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="hidden text-[13px] text-white/60 transition-colors hover:text-white sm:block"
              >
                Se connecter
              </Link>
              <Link
                href="/register"
                data-cursor="link"
                className="rounded-lg bg-brand px-4 py-2 text-[13px] font-medium text-white transition-all hover:bg-brand-light hover:shadow-[0_0_20px_rgba(108,92,231,0.4)]"
              >
                Commencer
              </Link>

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="ml-2 text-white/60 md:hidden"
                aria-label="Menu"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {mobileOpen ? (
                    <path d="M18 6L6 18M6 6l12 12" />
                  ) : (
                    <>
                      <path d="M4 8h16" />
                      <path d="M4 16h16" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </nav>

          {/* Mobile dropdown */}
          <AnimatePresence>
            {mobileOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-2 overflow-hidden rounded-xl border border-white/[0.06] bg-black/80 px-6 py-4 backdrop-blur-xl md:hidden"
              >
                {navLinks.map(link => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="block py-2 text-sm text-white/60 transition-colors hover:text-white"
                  >
                    {link.label}
                  </a>
                ))}
                <Link
                  href="/login"
                  className="mt-2 block border-t border-white/[0.06] pt-3 text-sm text-white/60"
                >
                  Se connecter
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.header>
      )}
    </AnimatePresence>
  )
}
