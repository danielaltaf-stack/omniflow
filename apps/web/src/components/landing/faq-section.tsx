'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { Plus, Minus, ShieldCheck } from 'lucide-react'

const faqs = [
  {
    q: 'Mes données bancaires sont-elles en sécurité ?',
    a: 'Absolument. Vos identifiants bancaires sont chiffrés avec AES-256 côté serveur via une clé dérivée HKDF-SHA256. Les connexions sont établies via Woob, un moteur open-source auditable. OmniFlow ne stocke jamais vos mots de passe en clair et respecte les standards OWASP.',
  },
  {
    q: 'Comment OmniFlow se connecte à ma banque ?',
    a: 'OmniFlow utilise Woob (anciennement Weboob), un outil open-source français qui simule une connexion bancaire sécurisée. Il supporte 34+ banques françaises dont Crédit Agricole, BNP, SG, Boursorama, etc. Le SCA (authentification forte) est géré via WebSocket en temps réel.',
  },
  {
    q: "C'est vraiment gratuit ?",
    a: 'Oui, pendant toute la durée de la beta. Toutes les fonctionnalités sont accessibles sans limite. Un plan Pro sera proposé ultérieurement pour les utilisateurs avancés (multi-portfolio, support prioritaire), mais le plan gratuit restera très complet.',
  },
  {
    q: 'Qui développe OmniFlow ?',
    a: "OmniFlow est un projet indépendant développé en France. Le code backend est en Python (FastAPI), le frontend en Next.js 14. L'IA utilise des modèles Groq, Gemini et OpenAI pour l'analyse financière contextuelle.",
  },
  {
    q: 'Puis-je exporter toutes mes données ?',
    a: "Oui, conformément au RGPD (droit à la portabilité), vous pouvez exporter l'intégralité de vos données — transactions, patrimoine, insights, documents — au format JSON ou CSV à tout moment depuis les paramètres.",
  },
  {
    q: 'Combien de banques sont supportées ?',
    a: 'OmniFlow supporte plus de 34 banques françaises via Woob : Crédit Agricole, BNP Paribas, Société Générale, Boursorama, LCL, CIC, Crédit Mutuel, La Banque Postale, Caisse d\'Épargne, et bien d\'autres. La liste s\'agrandit chaque mois.',
  },
]

// JSON-LD structured data for Google Rich Results
const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(faq => ({
    '@type': 'Question',
    name: faq.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.a,
    },
  })),
}

function FAQItem({ faq, index, isOpen, onToggle }: { faq: (typeof faqs)[0]; index: number; isOpen: boolean; onToggle: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.06, duration: 0.5 }}
    >
      <div
        className={`group rounded-2xl border transition-all duration-300 ${
          isOpen
            ? 'border-brand/20 bg-brand/[0.03] shadow-lg shadow-brand/5 dark:border-brand/30 dark:bg-brand/[0.05]'
            : 'border-gray-200/80 bg-white hover:border-gray-300 hover:shadow-md dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:border-white/[0.1]'
        }`}
      >
        <button
          onClick={onToggle}
          className="flex w-full items-center gap-4 p-5 text-left"
          aria-expanded={isOpen}
        >
          {/* Question number */}
          <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-colors ${
            isOpen
              ? 'bg-brand text-white'
              : 'bg-gray-100 text-gray-400 dark:bg-white/[0.06] dark:text-white/30'
          }`}>
            {String(index + 1).padStart(2, '0')}
          </span>

          {/* Question text */}
          <span className={`flex-1 text-sm font-semibold transition-colors sm:text-[15px] ${
            isOpen ? 'text-brand dark:text-brand-light' : 'text-gray-800 group-hover:text-gray-900 dark:text-white/80 dark:group-hover:text-white'
          }`}>
            {faq.q}
          </span>

          {/* Toggle icon */}
          <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
            isOpen
              ? 'bg-brand text-white rotate-0'
              : 'bg-gray-100 text-gray-400 dark:bg-white/[0.06] dark:text-white/30'
          }`}>
            {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </div>
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 pl-16">
                <p className="text-[13px] leading-relaxed text-gray-500 sm:text-sm dark:text-white/45">
                  {faq.a}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const sectionRef = useRef<HTMLDivElement>(null)
  const inView = useInView(sectionRef, { once: true, margin: '-10%' })

  return (
    <section id="faq" ref={sectionRef} className="relative bg-gray-50/50 px-4 py-16 dark:bg-[#050505] sm:py-20">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="mx-auto max-w-6xl">
        <div className="lg:flex lg:gap-16">
          {/* ── Left side: Sticky title ── */}
          <div className="mb-10 lg:mb-0 lg:w-[340px] lg:flex-shrink-0">
            <div className="lg:sticky lg:top-24">
              <motion.p
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 1 } : {}}
                className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-brand dark:text-brand-light/60"
              >
                Questions Fréquentes
              </motion.p>
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.1 }}
                className="mb-4 font-heading text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl lg:text-4xl dark:text-white"
              >
                On vous dit tout.
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.2 }}
                className="mb-6 text-sm leading-relaxed text-gray-500 dark:text-white/40"
              >
                Transparence totale sur la sécurité, les données et le fonctionnement d&apos;OmniFlow.
              </motion.p>

              {/* Trust badges */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.3 }}
                className="flex flex-col gap-3"
              >
                <div className="flex items-center gap-2.5 text-gray-400 dark:text-white/30">
                  <ShieldCheck className="h-4 w-4 text-gain" />
                  <span className="text-xs">Chiffrement AES-256</span>
                </div>
                <div className="flex items-center gap-2.5 text-gray-400 dark:text-white/30">
                  <ShieldCheck className="h-4 w-4 text-gain" />
                  <span className="text-xs">Conforme RGPD</span>
                </div>
                <div className="flex items-center gap-2.5 text-gray-400 dark:text-white/30">
                  <ShieldCheck className="h-4 w-4 text-brand" />
                  <span className="text-xs">Support réactif sous 24h</span>
                </div>
              </motion.div>
            </div>
          </div>

          {/* ── Right side: FAQ accordion ── */}
          <div className="flex-1 space-y-3">
            {faqs.map((faq, i) => (
              <FAQItem
                key={i}
                faq={faq}
                index={i}
                isOpen={openIndex === i}
                onToggle={() => setOpenIndex(openIndex === i ? null : i)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
