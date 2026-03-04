'use client'

import { useState } from 'react'
import Link from 'next/link'

const footerLinks = {
  Produit: [
    { label: 'Fonctionnalités', href: '#features' },
    { label: 'Nova IA', href: '#features' },
    { label: 'Simulateur Retraite', href: '#features' },
    { label: 'Coffre-Fort', href: '#features' },
  ],
  Ressources: [
    { label: 'Changelog', href: '#' },
    { label: 'Documentation', href: '#' },
    { label: 'API', href: '#' },
    { label: 'Contact', href: '/contact' },
  ],
  Légal: [
    { label: 'Conditions d\'utilisation', href: '#' },
    { label: 'Politique de confidentialité', href: '#' },
    { label: 'Mentions légales', href: '#' },
    { label: 'RGPD', href: '#' },
  ],
  Social: [
    { label: 'GitHub', href: '#' },
    { label: 'Twitter / X', href: '#' },
    { label: 'Discord', href: '#' },
    { label: 'LinkedIn', href: '#' },
  ],
}

export function Footer() {
  const [logoPulsing, setLogoPulsing] = useState(false)

  const handleLogoClick = () => {
    // Easter egg: radial pulse
    setLogoPulsing(true)
    setTimeout(() => setLogoPulsing(false), 800)
  }

  return (
    <footer className="relative border-t border-gray-100 bg-gray-50 px-4 pt-10 pb-6 dark:border-white/[0.04] dark:bg-black">
      {/* Gradient divider */}
      <div
        className="absolute -top-px left-1/2 h-px w-2/3 -translate-x-1/2"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(108,92,231,0.2), transparent)',
        }}
      />

      <div className="mx-auto max-w-6xl">
        {/* Top row: Logo + Columns */}
        <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {/* Logo column */}
          <div className="lg:col-span-1">
            <button
              onClick={handleLogoClick}
              className="relative mb-4 flex items-center gap-2"
              aria-label="OmniFlow"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="text-sm font-semibold tracking-tight text-gray-800 dark:text-white">OmniFlow</span>

              {/* Pulse animation on click */}
              {logoPulsing && (
                <div className="absolute left-4 top-4 -z-10 h-4 w-4 animate-ping rounded-full bg-brand opacity-60" />
              )}
            </button>
            <p className="mb-4 text-xs leading-relaxed text-gray-400 dark:text-white/30">
              La super-vision de votre patrimoine.
              <br />
              Banque · Crypto · Bourse · Immobilier.
            </p>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-[10px] text-gray-400 dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-white/30">
              🇫🇷 Made in France
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-gray-400 dark:text-white/40">
                {category}
              </h4>
              <ul className="space-y-2.5">
                {links.map(link => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-400 transition-colors hover:text-gray-700 dark:text-white/25 dark:hover:text-white/60"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-gray-100 pt-6 sm:flex-row dark:border-white/[0.04]">
          <p className="text-[11px] text-gray-400 dark:text-white/20">
            © {new Date().getFullYear()} OmniFlow. Tous droits réservés.
          </p>
          <p className="text-[11px] text-gray-300 dark:text-white/15">
            v0.1.0 · Build with ♥ and a little bit of AI
          </p>
        </div>
      </div>
    </footer>
  )
}
