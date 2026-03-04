'use client'

import { useState, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import Link from 'next/link'

/* ── Contact Reasons ──────────────────────────────────────── */
const contactReasons = [
  { value: 'support', label: 'Support technique' },
  { value: 'bank', label: 'Problème de connexion bancaire' },
  { value: 'security', label: 'Signaler un problème de sécurité' },
  { value: 'billing', label: 'Facturation & abonnement' },
  { value: 'data', label: 'Demande RGPD (export / suppression)' },
  { value: 'feature', label: 'Suggestion de fonctionnalité' },
  { value: 'partnership', label: 'Partenariat / Presse' },
  { value: 'other', label: 'Autre' },
]

/* ── Priority Options ─────────────────────────────────────── */
const priorityOptions = [
  { value: 'low', label: 'Basse', desc: 'Pas urgent' },
  { value: 'normal', label: 'Normale', desc: 'Réponse sous 48h' },
  { value: 'high', label: 'Haute', desc: 'Bloquant', color: 'text-orange-500' },
  { value: 'critical', label: 'Critique', desc: 'Sécurité / urgence', color: 'text-red-500' },
]

/* ── Quick Help Links ─────────────────────────────────────── */
const quickHelp = [
  {
    title: 'FAQ',
    desc: 'Réponses aux questions les plus fréquentes.',
    href: '/#faq',
  },
  {
    title: 'Banques supportées',
    desc: '34+ banques françaises via Woob.',
    href: '/#faq',
  },
  {
    title: 'Sécurité & RGPD',
    desc: 'Détails sur notre politique de protection des données.',
    href: '/#faq',
  },
  {
    title: 'Statut des services',
    desc: 'Vérifiez la disponibilité de la plateforme en temps réel.',
    href: '#',
  },
]

/* ── Contact Details ──────────────────────────────────────── */
const contactDetails = [
  { label: 'Email support', value: 'support@omniflow.fr', href: 'mailto:support@omniflow.fr' },
  { label: 'Email sécurité', value: 'security@omniflow.fr', href: 'mailto:security@omniflow.fr' },
  { label: 'Réponse moyenne', value: 'Sous 24h en semaine' },
  { label: 'Horaires support', value: 'Lun – Ven, 9h – 18h (CET)' },
]

/* ── SLA Info ─────────────────────────────────────────────── */
const slaItems = [
  { label: 'Support standard', time: '< 48h' },
  { label: 'Problème bancaire', time: '< 24h' },
  { label: 'Faille de sécurité', time: '< 4h' },
  { label: 'Demande RGPD', time: '< 30 jours (légal)' },
]

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    reason: '',
    priority: 'normal',
    bank: '',
    subject: '',
    message: '',
    acceptPrivacy: false,
  })
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const heroInView = useInView(heroRef, { once: true })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)

    // Simulate sending (replace with actual API call)
    await new Promise(resolve => setTimeout(resolve, 1500))

    setSending(false)
    setSubmitted(true)
  }

  const isBankIssue = formData.reason === 'bank'

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* ── Hero Section ──────────────────────────────────── */}
      <section ref={heroRef} className="relative overflow-hidden px-4 pb-12 pt-20 sm:pb-16 sm:pt-28">
        {/* Subtle gradient bg */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand/[0.03] via-transparent to-transparent dark:from-brand/[0.06]" />

        <div className="relative mx-auto max-w-4xl text-center">
          <motion.p
            initial={{ opacity: 0 }}
            animate={heroInView ? { opacity: 1 } : {}}
            className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-brand dark:text-brand-light/60"
          >
            Support & Contact
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1 }}
            className="mb-4 font-heading text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl dark:text-white"
          >
            Comment pouvons-nous vous aider ?
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2 }}
            className="mx-auto max-w-xl text-sm leading-relaxed text-gray-500 sm:text-base dark:text-white/40"
          >
            Notre équipe est disponible du lundi au vendredi pour répondre à toutes vos questions
            — techniques, sécurité, données personnelles ou suggestions.
          </motion.p>
        </div>
      </section>

      {/* ── Quick Help Cards ──────────────────────────────── */}
      <section className="px-4 pb-12">
        <div className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickHelp.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <Link
                href={item.href}
                className="group block rounded-xl border border-gray-200/80 bg-white p-5 transition-all hover:border-brand/20 hover:shadow-lg hover:shadow-brand/5 dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:border-brand/30"
              >
                <h3 className="mb-1 text-sm font-semibold text-gray-800 group-hover:text-brand dark:text-white/80 dark:group-hover:text-brand-light">
                  {item.title}
                </h3>
                <p className="text-xs leading-relaxed text-gray-400 dark:text-white/30">
                  {item.desc}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Main Content: Form + Sidebar ──────────────────── */}
      <section className="px-4 pb-20">
        <div className="mx-auto max-w-5xl lg:flex lg:gap-12">

          {/* ── Left: Contact Form ──────────────────────── */}
          <div className="flex-1">
            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-2xl border border-gain/20 bg-gain/[0.04] p-10 text-center dark:border-gain/30 dark:bg-gain/[0.06]"
              >
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gain/10">
                  <svg className="h-7 w-7 text-gain" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">
                  Message envoyé
                </h2>
                <p className="mb-6 text-sm text-gray-500 dark:text-white/40">
                  Nous avons bien reçu votre message. Notre équipe vous répondra dans les meilleurs délais
                  ({formData.priority === 'critical' ? 'sous 4h' : formData.priority === 'high' ? 'sous 24h' : 'sous 48h'}).
                </p>
                <p className="mb-6 text-xs text-gray-400 dark:text-white/25">
                  Un email de confirmation a été envoyé à <span className="font-medium text-gray-600 dark:text-white/60">{formData.email}</span>
                </p>
                <button
                  onClick={() => { setSubmitted(false); setFormData({ name: '', email: '', reason: '', priority: 'normal', bank: '', subject: '', message: '', acceptPrivacy: false }) }}
                  className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-brand-light hover:shadow-[0_0_20px_rgba(108,92,231,0.3)]"
                >
                  Envoyer un autre message
                </button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <h2 className="mb-1 text-lg font-bold text-gray-900 dark:text-white">
                  Envoyez-nous un message
                </h2>
                <p className="mb-6 text-sm text-gray-400 dark:text-white/30">
                  Tous les champs marqués d&apos;un * sont obligatoires.
                </p>

                <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
                  {/* Name & Email row */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="name" className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-white/50">
                        Nom complet *
                      </label>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        required
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Jean Dupont"
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 outline-none transition-colors placeholder:text-gray-300 focus:border-brand focus:ring-1 focus:ring-brand/30 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white dark:placeholder:text-white/20 dark:focus:border-brand/60"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-white/50">
                        Email *
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="jean@exemple.fr"
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 outline-none transition-colors placeholder:text-gray-300 focus:border-brand focus:ring-1 focus:ring-brand/30 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white dark:placeholder:text-white/20 dark:focus:border-brand/60"
                      />
                    </div>
                  </div>

                  {/* Reason & Priority row */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="reason" className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-white/50">
                        Motif *
                      </label>
                      <select
                        id="reason"
                        name="reason"
                        required
                        value={formData.reason}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand/30 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white dark:focus:border-brand/60"
                      >
                        <option value="" disabled>Sélectionnez un motif</option>
                        {contactReasons.map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-white/50">
                        Priorité
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {priorityOptions.map(p => (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, priority: p.value }))}
                            className={`rounded-lg border px-2 py-2 text-center transition-all ${
                              formData.priority === p.value
                                ? 'border-brand bg-brand/[0.06] dark:border-brand/40 dark:bg-brand/[0.1]'
                                : 'border-gray-200 bg-white hover:border-gray-300 dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:border-white/[0.1]'
                            }`}
                          >
                            <span className={`block text-[11px] font-semibold ${
                              formData.priority === p.value
                                ? 'text-brand dark:text-brand-light'
                                : p.color || 'text-gray-600 dark:text-white/50'
                            }`}>
                              {p.label}
                            </span>
                            <span className="block text-[9px] text-gray-400 dark:text-white/25">
                              {p.desc}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Conditional: Bank selector */}
                  {isBankIssue && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <label htmlFor="bank" className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-white/50">
                        Banque concernée
                      </label>
                      <select
                        id="bank"
                        name="bank"
                        value={formData.bank}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand/30 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white dark:focus:border-brand/60"
                      >
                        <option value="">Sélectionnez votre banque</option>
                        <option value="credit-agricole">Crédit Agricole</option>
                        <option value="bnp">BNP Paribas</option>
                        <option value="sg">Société Générale</option>
                        <option value="boursorama">Boursorama</option>
                        <option value="lcl">LCL</option>
                        <option value="cic">CIC</option>
                        <option value="credit-mutuel">Crédit Mutuel</option>
                        <option value="banque-postale">La Banque Postale</option>
                        <option value="caisse-epargne">Caisse d&apos;Épargne</option>
                        <option value="banque-populaire">Banque Populaire</option>
                        <option value="hsbc">HSBC France</option>
                        <option value="axa-banque">AXA Banque</option>
                        <option value="fortuneo">Fortuneo</option>
                        <option value="hello-bank">Hello bank!</option>
                        <option value="n26">N26</option>
                        <option value="revolut">Revolut</option>
                        <option value="other">Autre</option>
                      </select>
                    </motion.div>
                  )}

                  {/* Subject */}
                  <div>
                    <label htmlFor="subject" className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-white/50">
                      Sujet *
                    </label>
                    <input
                      id="subject"
                      name="subject"
                      type="text"
                      required
                      value={formData.subject}
                      onChange={handleChange}
                      placeholder="Résumez votre demande en une phrase"
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 outline-none transition-colors placeholder:text-gray-300 focus:border-brand focus:ring-1 focus:ring-brand/30 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white dark:placeholder:text-white/20 dark:focus:border-brand/60"
                    />
                  </div>

                  {/* Message */}
                  <div>
                    <label htmlFor="message" className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-white/50">
                      Message *
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      required
                      rows={6}
                      value={formData.message}
                      onChange={handleChange}
                      placeholder="Décrivez votre problème ou votre question en détail. Plus vous êtes précis, plus nous pourrons vous aider rapidement."
                      className="w-full resize-y rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-relaxed text-gray-800 outline-none transition-colors placeholder:text-gray-300 focus:border-brand focus:ring-1 focus:ring-brand/30 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white dark:placeholder:text-white/20 dark:focus:border-brand/60"
                    />
                    <p className="mt-1 text-[11px] text-gray-300 dark:text-white/20">
                      {formData.message.length} / 2000 caractères
                    </p>
                  </div>

                  {/* Privacy checkbox */}
                  <div className="flex items-start gap-3">
                    <input
                      id="acceptPrivacy"
                      name="acceptPrivacy"
                      type="checkbox"
                      required
                      checked={formData.acceptPrivacy}
                      onChange={handleChange}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand accent-brand focus:ring-brand dark:border-white/20"
                    />
                    <label htmlFor="acceptPrivacy" className="text-xs leading-relaxed text-gray-400 dark:text-white/30">
                      J&apos;accepte que mes données soient traitées conformément à la{' '}
                      <Link href="#" className="text-brand underline underline-offset-2 hover:text-brand-light">
                        politique de confidentialité
                      </Link>{' '}
                      d&apos;OmniFlow. Vos données ne seront jamais partagées avec des tiers. *
                    </label>
                  </div>

                  {/* Submit button */}
                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white transition-all hover:bg-brand-light hover:shadow-[0_0_30px_rgba(108,92,231,0.25)] disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto sm:px-8"
                  >
                    {sending ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Envoi en cours...
                      </span>
                    ) : 'Envoyer le message'}
                  </button>
                </form>
              </motion.div>
            )}
          </div>

          {/* ── Right Sidebar ───────────────────────────── */}
          <div className="mt-12 lg:mt-0 lg:w-[320px] lg:flex-shrink-0">
            <div className="lg:sticky lg:top-24 space-y-8">

              {/* Contact Info Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-white/[0.06] dark:bg-white/[0.02]"
              >
                <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-white/80">
                  Coordonnées directes
                </h3>
                <div className="space-y-4">
                  {contactDetails.map(d => (
                    <div key={d.label}>
                      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-gray-400 dark:text-white/25">
                        {d.label}
                      </p>
                      {d.href ? (
                        <a
                          href={d.href}
                          className="text-sm font-medium text-brand hover:text-brand-light dark:text-brand-light dark:hover:text-brand"
                        >
                          {d.value}
                        </a>
                      ) : (
                        <p className="text-sm text-gray-700 dark:text-white/60">{d.value}</p>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* SLA Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-white/[0.06] dark:bg-white/[0.02]"
              >
                <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-white/80">
                  Temps de réponse
                </h3>
                <div className="space-y-3">
                  {slaItems.map(s => (
                    <div key={s.label} className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-white/40">{s.label}</span>
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-white/[0.06] dark:text-white/50">
                        {s.time}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Security Note */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="rounded-2xl border border-brand/10 bg-brand/[0.03] p-6 dark:border-brand/20 dark:bg-brand/[0.05]"
              >
                <h3 className="mb-2 text-sm font-bold text-gray-800 dark:text-white/80">
                  Signaler une faille de sécurité
                </h3>
                <p className="mb-3 text-xs leading-relaxed text-gray-500 dark:text-white/35">
                  Si vous avez découvert une vulnérabilité, envoyez votre rapport
                  détaillé à notre adresse dédiée. Ne divulguez pas la faille publiquement.
                </p>
                <a
                  href="mailto:security@omniflow.fr"
                  className="text-xs font-semibold text-brand hover:text-brand-light dark:text-brand-light"
                >
                  security@omniflow.fr →
                </a>
              </motion.div>

              {/* Additional Channels */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-white/[0.06] dark:bg-white/[0.02]"
              >
                <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-white/80">
                  Autres canaux
                </h3>
                <div className="space-y-3">
                  <a href="#" className="group flex items-center justify-between rounded-lg p-2 -mx-2 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                    <div>
                      <p className="text-xs font-medium text-gray-700 group-hover:text-brand dark:text-white/60 dark:group-hover:text-brand-light">Discord</p>
                      <p className="text-[10px] text-gray-400 dark:text-white/25">Communauté & entraide</p>
                    </div>
                    <span className="text-[11px] text-gray-300 dark:text-white/20">→</span>
                  </a>
                  <a href="#" className="group flex items-center justify-between rounded-lg p-2 -mx-2 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                    <div>
                      <p className="text-xs font-medium text-gray-700 group-hover:text-brand dark:text-white/60 dark:group-hover:text-brand-light">GitHub</p>
                      <p className="text-[10px] text-gray-400 dark:text-white/25">Issues & contributions</p>
                    </div>
                    <span className="text-[11px] text-gray-300 dark:text-white/20">→</span>
                  </a>
                  <a href="#" className="group flex items-center justify-between rounded-lg p-2 -mx-2 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                    <div>
                      <p className="text-xs font-medium text-gray-700 group-hover:text-brand dark:text-white/60 dark:group-hover:text-brand-light">Twitter / X</p>
                      <p className="text-[10px] text-gray-400 dark:text-white/25">Actualités & annonces</p>
                    </div>
                    <span className="text-[11px] text-gray-300 dark:text-white/20">→</span>
                  </a>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom: Trust Bar ─────────────────────────────── */}
      <section className="border-t border-gray-100 bg-gray-50/50 px-4 py-10 dark:border-white/[0.04] dark:bg-[#050505]">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-6 text-xs font-medium text-gray-400 dark:text-white/25">
            Votre vie privée est notre priorité
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-[11px] text-gray-400 dark:text-white/20">
            <span>Chiffrement AES-256</span>
            <span className="hidden sm:block">·</span>
            <span>Conforme RGPD</span>
            <span className="hidden sm:block">·</span>
            <span>Hébergement EU</span>
            <span className="hidden sm:block">·</span>
            <span>Aucune revente de données</span>
            <span className="hidden sm:block">·</span>
            <span>Droit à l&apos;oubli garanti</span>
          </div>
        </div>
      </section>
    </div>
  )
}
