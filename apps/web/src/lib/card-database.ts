/**
 * Bank Card Database — Exhaustive catalog of French and international bank cards
 * with real designs (gradient colors, logos, networks).
 *
 * Each entry has: name, bank, network, tier, type, colors (gradient), annual fee,
 * cashback %, insurance level, key benefits, and a text-based visual style.
 */

export type CardNetwork = 'visa' | 'mastercard' | 'amex' | 'cb'
export type CardTier = 'standard' | 'premium' | 'gold' | 'platinum' | 'black' | 'infinite'
export type CardType = 'debit' | 'credit' | 'prepaid' | 'charge' | 'business'

export interface BankCardTemplate {
  id: string
  name: string
  bank: string
  bankLogo?: string // emoji or short text
  network: CardNetwork
  tier: CardTier
  type: CardType
  /** Tailwind gradient classes for card face */
  gradient: string
  /** Text color: 'text-white' or 'text-gray-900' */
  textColor: string
  /** Optional pattern overlay */
  pattern?: 'waves' | 'dots' | 'lines' | 'circuit' | 'none'
  annualFee: number // centimes
  cashbackPct: number
  insuranceLevel: 'none' | 'basic' | 'premium' | 'elite'
  benefits: string[]
  contactless: boolean
  appleGooglePay: boolean
  /** Country flag emoji */
  country: string
}

/* ═══════════════════════════════════════════════════════
   FRENCH BANK CARDS — Banques traditionnelles
   ═══════════════════════════════════════════════════════ */

const FRENCH_TRADITIONAL: BankCardTemplate[] = [
  // ── BNP Paribas ──
  { id: 'bnp-classic-visa', name: 'Visa Classic', bank: 'BNP Paribas', bankLogo: '🏛️', network: 'visa', tier: 'standard', type: 'debit', gradient: 'from-emerald-800 via-emerald-700 to-emerald-900', textColor: 'text-white', pattern: 'waves', annualFee: 4480, cashbackPct: 0, insuranceLevel: 'basic', benefits: ['Plafonds standards', 'Assurance basique'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
  { id: 'bnp-premier-visa', name: 'Visa Premier', bank: 'BNP Paribas', bankLogo: '🏛️', network: 'visa', tier: 'gold', type: 'debit', gradient: 'from-emerald-700 via-yellow-600 to-emerald-800', textColor: 'text-white', pattern: 'waves', annualFee: 13400, cashbackPct: 0, insuranceLevel: 'premium', benefits: ['Assurance voyage', 'Plafonds élevés', 'Garantie achats'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
  { id: 'bnp-infinite-visa', name: 'Visa Infinite', bank: 'BNP Paribas', bankLogo: '🏛️', network: 'visa', tier: 'infinite', type: 'debit', gradient: 'from-gray-900 via-emerald-900 to-gray-800', textColor: 'text-white', pattern: 'circuit', annualFee: 33600, cashbackPct: 0, insuranceLevel: 'elite', benefits: ['Conciergerie 24/7', 'Assurance premium', 'Accès salons aéroport'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
  { id: 'bnp-gold-mc', name: 'Gold Mastercard', bank: 'BNP Paribas', bankLogo: '🏛️', network: 'mastercard', tier: 'gold', type: 'debit', gradient: 'from-yellow-600 via-amber-500 to-yellow-700', textColor: 'text-white', pattern: 'lines', annualFee: 13400, cashbackPct: 0, insuranceLevel: 'premium', benefits: ['Assurance voyage', 'Extension garantie', 'Protection achats'], contactless: true, appleGooglePay: true, country: '🇫🇷' },

  // ── Société Générale ──
  { id: 'sg-classic-visa', name: 'Visa Classic', bank: 'Société Générale', bankLogo: '🔴', network: 'visa', tier: 'standard', type: 'debit', gradient: 'from-red-800 via-red-700 to-red-900', textColor: 'text-white', pattern: 'lines', annualFee: 4400, cashbackPct: 0, insuranceLevel: 'basic', benefits: ['Assurance basique', 'Retraits zone euro'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
  { id: 'sg-premier-visa', name: 'Visa Premier', bank: 'Société Générale', bankLogo: '🔴', network: 'visa', tier: 'gold', type: 'debit', gradient: 'from-red-700 via-amber-600 to-red-800', textColor: 'text-white', pattern: 'waves', annualFee: 13400, cashbackPct: 0, insuranceLevel: 'premium', benefits: ['Assurance voyage étendue', 'Plafonds relevés'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
  { id: 'sg-infinite-visa', name: 'Visa Infinite', bank: 'Société Générale', bankLogo: '🔴', network: 'visa', tier: 'infinite', type: 'debit', gradient: 'from-gray-900 via-red-950 to-black', textColor: 'text-white', pattern: 'circuit', annualFee: 38400, cashbackPct: 0, insuranceLevel: 'elite', benefits: ['Conciergerie', 'Assurance premium', 'Salons Priority Pass'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
  { id: 'sg-sobrio', name: 'Sobrio', bank: 'Société Générale', bankLogo: '🔴', network: 'visa', tier: 'standard', type: 'debit', gradient: 'from-teal-600 via-emerald-500 to-teal-700', textColor: 'text-white', pattern: 'dots', annualFee: 0, cashbackPct: 0, insuranceLevel: 'basic', benefits: ['Carte éco-responsable', 'Suivi empreinte carbone'], contactless: true, appleGooglePay: true, country: '🇫🇷' },

  // ── Crédit Agricole ──
  { id: 'ca-classic-mc', name: 'Mastercard Classic', bank: 'Crédit Agricole', bankLogo: '🌿', network: 'mastercard', tier: 'standard', type: 'debit', gradient: 'from-green-700 via-green-600 to-green-800', textColor: 'text-white', pattern: 'waves', annualFee: 4200, cashbackPct: 0, insuranceLevel: 'basic', benefits: ['Plafonds standards'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
  { id: 'ca-gold-mc', name: 'Gold Mastercard', bank: 'Crédit Agricole', bankLogo: '🌿', network: 'mastercard', tier: 'gold', type: 'debit', gradient: 'from-yellow-600 via-green-700 to-yellow-700', textColor: 'text-white', pattern: 'lines', annualFee: 12800, cashbackPct: 0, insuranceLevel: 'premium', benefits: ['Assurance voyage', 'Extension garantie'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
  { id: 'ca-platinum-mc', name: 'Platinum Mastercard', bank: 'Crédit Agricole', bankLogo: '🌿', network: 'mastercard', tier: 'platinum', type: 'debit', gradient: 'from-slate-700 via-green-800 to-slate-800', textColor: 'text-white', pattern: 'circuit', annualFee: 28800, cashbackPct: 0, insuranceLevel: 'elite', benefits: ['Conciergerie', 'Assurance all-risk', 'Priority Pass'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
  { id: 'ca-world-elite', name: 'World Elite Mastercard', bank: 'Crédit Agricole', bankLogo: '🌿', network: 'mastercard', tier: 'black', type: 'debit', gradient: 'from-black via-green-950 to-gray-900', textColor: 'text-white', pattern: 'circuit', annualFee: 42000, cashbackPct: 0, insuranceLevel: 'elite', benefits: ['Conciergerie premium', 'Salons illimités', 'Assurance voyage famille'], contactless: true, appleGooglePay: true, country: '🇫🇷' },

  // ── Crédit Mutuel ──
  { id: 'cm-classic-mc', name: 'Mastercard Classic', bank: 'Crédit Mutuel', bankLogo: '🔵', network: 'mastercard', tier: 'standard', type: 'debit', gradient: 'from-blue-700 via-blue-600 to-blue-800', textColor: 'text-white', pattern: 'dots', annualFee: 4400, cashbackPct: 0, insuranceLevel: 'basic', benefits: ['Paiement sans contact'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
  { id: 'cm-gold-mc', name: 'Gold Mastercard', bank: 'Crédit Mutuel', bankLogo: '🔵', network: 'mastercard', tier: 'gold', type: 'debit', gradient: 'from-amber-500 via-blue-700 to-amber-600', textColor: 'text-white', pattern: 'lines', annualFee: 12800, cashbackPct: 0, insuranceLevel: 'premium', benefits: ['Assurance voyage', 'Garantie achats'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
  { id: 'cm-platinum-mc', name: 'Platinum Mastercard', bank: 'Crédit Mutuel', bankLogo: '🔵', network: 'mastercard', tier: 'platinum', type: 'debit', gradient: 'from-slate-700 via-blue-900 to-slate-800', textColor: 'text-white', pattern: 'circuit', annualFee: 32400, cashbackPct: 0, insuranceLevel: 'elite', benefits: ['Conciergerie', 'Assurance premium', 'Art de vivre'], contactless: true, appleGooglePay: true, country: '🇫🇷' },

  // ── LCL ──
  { id: 'lcl-classic-visa', name: 'Visa Classic', bank: 'LCL', bankLogo: '💛', network: 'visa', tier: 'standard', type: 'debit', gradient: 'from-yellow-600 via-yellow-500 to-amber-600', textColor: 'text-gray-900', pattern: 'waves', annualFee: 4200, cashbackPct: 0, insuranceLevel: 'basic', benefits: ['Carte standard'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
  { id: 'lcl-premier-visa', name: 'Visa Premier', bank: 'LCL', bankLogo: '💛', network: 'visa', tier: 'gold', type: 'debit', gradient: 'from-amber-500 via-yellow-400 to-amber-600', textColor: 'text-gray-900', pattern: 'lines', annualFee: 13400, cashbackPct: 0, insuranceLevel: 'premium', benefits: ['Assurance voyage', 'Location auto'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
  { id: 'lcl-infinite-visa', name: 'Visa Infinite', bank: 'LCL', bankLogo: '💛', network: 'visa', tier: 'infinite', type: 'debit', gradient: 'from-gray-900 via-amber-900 to-black', textColor: 'text-white', pattern: 'circuit', annualFee: 39600, cashbackPct: 0, insuranceLevel: 'elite', benefits: ['Conciergerie', 'Priority Pass', 'Assurance ski/sport'], contactless: true, appleGooglePay: true, country: '🇫🇷' },

  // ── La Banque Postale ──
  { id: 'lbp-classic-visa', name: 'Visa Classic', bank: 'La Banque Postale', bankLogo: '📮', network: 'visa', tier: 'standard', type: 'debit', gradient: 'from-blue-600 via-blue-500 to-indigo-600', textColor: 'text-white', pattern: 'dots', annualFee: 3900, cashbackPct: 0, insuranceLevel: 'basic', benefits: ['Carte accessible'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
  { id: 'lbp-premier-visa', name: 'Visa Premier', bank: 'La Banque Postale', bankLogo: '📮', network: 'visa', tier: 'gold', type: 'debit', gradient: 'from-indigo-700 via-yellow-500 to-indigo-800', textColor: 'text-white', pattern: 'lines', annualFee: 12600, cashbackPct: 0, insuranceLevel: 'premium', benefits: ['Assurance voyage étendue'], contactless: true, appleGooglePay: true, country: '🇫🇷' },

  // ── HSBC France ──
  { id: 'hsbc-classic-visa', name: 'Visa Classic', bank: 'HSBC', bankLogo: '🏦', network: 'visa', tier: 'standard', type: 'debit', gradient: 'from-red-600 via-red-500 to-red-700', textColor: 'text-white', pattern: 'lines', annualFee: 4500, cashbackPct: 0, insuranceLevel: 'basic', benefits: ['Réseau international'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
  { id: 'hsbc-premier-visa', name: 'Visa Premier', bank: 'HSBC', bankLogo: '🏦', network: 'visa', tier: 'gold', type: 'debit', gradient: 'from-red-700 via-amber-600 to-red-800', textColor: 'text-white', pattern: 'waves', annualFee: 13400, cashbackPct: 0, insuranceLevel: 'premium', benefits: ['Assurance voyage monde', 'Retraits gratuits étranger'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
  { id: 'hsbc-infinite-visa', name: 'Visa Infinite', bank: 'HSBC', bankLogo: '🏦', network: 'visa', tier: 'infinite', type: 'debit', gradient: 'from-gray-900 via-red-950 to-black', textColor: 'text-white', pattern: 'circuit', annualFee: 39800, cashbackPct: 0, insuranceLevel: 'elite', benefits: ['Conciergerie HSBC Premier', 'Priority Pass', 'Assurance famille'], contactless: true, appleGooglePay: true, country: '🇫🇷' },

  // ── CIC ──
  { id: 'cic-classic-mc', name: 'Mastercard Classic', bank: 'CIC', bankLogo: '🟡', network: 'mastercard', tier: 'standard', type: 'debit', gradient: 'from-blue-800 via-blue-700 to-blue-900', textColor: 'text-white', pattern: 'dots', annualFee: 4400, cashbackPct: 0, insuranceLevel: 'basic', benefits: ['Paiement mobile'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
  { id: 'cic-gold-mc', name: 'Gold Mastercard', bank: 'CIC', bankLogo: '🟡', network: 'mastercard', tier: 'gold', type: 'debit', gradient: 'from-amber-600 via-blue-800 to-amber-700', textColor: 'text-white', pattern: 'lines', annualFee: 12800, cashbackPct: 0, insuranceLevel: 'premium', benefits: ['Assurance voyage', 'Protection achats'], contactless: true, appleGooglePay: true, country: '🇫🇷' },

  // ── Caisse d'Épargne ──
  { id: 'ce-classic-visa', name: 'Visa Classic', bank: "Caisse d'Épargne", bankLogo: '🐿️', network: 'visa', tier: 'standard', type: 'debit', gradient: 'from-red-600 via-red-500 to-red-700', textColor: 'text-white', pattern: 'waves', annualFee: 4000, cashbackPct: 0, insuranceLevel: 'basic', benefits: ['Carte Ecureuil'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
  { id: 'ce-premier-visa', name: 'Visa Premier', bank: "Caisse d'Épargne", bankLogo: '🐿️', network: 'visa', tier: 'gold', type: 'debit', gradient: 'from-red-700 via-yellow-600 to-red-800', textColor: 'text-white', pattern: 'lines', annualFee: 12800, cashbackPct: 0, insuranceLevel: 'premium', benefits: ['Assurance voyage', 'Garantie neige'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
  { id: 'ce-infinite-visa', name: 'Visa Infinite', bank: "Caisse d'Épargne", bankLogo: '🐿️', network: 'visa', tier: 'infinite', type: 'debit', gradient: 'from-gray-900 via-red-900 to-black', textColor: 'text-white', pattern: 'circuit', annualFee: 36000, cashbackPct: 0, insuranceLevel: 'elite', benefits: ['Conciergerie', 'Priority Pass', 'Assurance famille'], contactless: true, appleGooglePay: true, country: '🇫🇷' },

  // ── Banque Populaire ──
  { id: 'bp-classic-visa', name: 'Visa Classic', bank: 'Banque Populaire', bankLogo: '🅱️', network: 'visa', tier: 'standard', type: 'debit', gradient: 'from-blue-700 via-cyan-600 to-blue-800', textColor: 'text-white', pattern: 'waves', annualFee: 4200, cashbackPct: 0, insuranceLevel: 'basic', benefits: ['Carte standard'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
  { id: 'bp-premier-visa', name: 'Visa Premier', bank: 'Banque Populaire', bankLogo: '🅱️', network: 'visa', tier: 'gold', type: 'debit', gradient: 'from-blue-700 via-amber-500 to-blue-800', textColor: 'text-white', pattern: 'lines', annualFee: 13200, cashbackPct: 0, insuranceLevel: 'premium', benefits: ['Assurance voyage', 'Protection achats', 'Garantie neige/montagne'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
]

/* ═══════════════════════════════════════════════════════
   FRENCH NEOBANKS & FINTECHS
   ═══════════════════════════════════════════════════════ */

const FRENCH_NEOBANKS: BankCardTemplate[] = [
  // ── Boursorama ──
  { id: 'bourso-welcome', name: 'Welcome', bank: 'Boursorama', bankLogo: '🟠', network: 'visa', tier: 'standard', type: 'debit', gradient: 'from-orange-500 via-orange-400 to-orange-600', textColor: 'text-white', pattern: 'dots', annualFee: 0, cashbackPct: 0, insuranceLevel: 'basic', benefits: ['Gratuite', 'Sans condition'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
  { id: 'bourso-ultim', name: 'Ultim', bank: 'Boursorama', bankLogo: '🟠', network: 'visa', tier: 'premium', type: 'debit', gradient: 'from-gray-800 via-orange-600 to-gray-900', textColor: 'text-white', pattern: 'circuit', annualFee: 0, cashbackPct: 0, insuranceLevel: 'premium', benefits: ['Gratuite', 'Retraits gratuits monde', 'Assurance voyage'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
  { id: 'bourso-ultim-metal', name: 'Ultim Metal', bank: 'Boursorama', bankLogo: '🟠', network: 'visa', tier: 'black', type: 'debit', gradient: 'from-gray-900 via-orange-700 to-black', textColor: 'text-white', pattern: 'circuit', annualFee: 990, cashbackPct: 0, insuranceLevel: 'elite', benefits: ['Carte métal', 'Conciergerie', 'Assurance premium', 'Priority Pass'], contactless: true, appleGooglePay: true, country: '🇫🇷' },

  // ── Hello bank! ──
  { id: 'hello-one', name: 'Hello One', bank: 'Hello bank!', bankLogo: '👋', network: 'visa', tier: 'standard', type: 'debit', gradient: 'from-green-500 via-teal-400 to-green-600', textColor: 'text-white', pattern: 'waves', annualFee: 0, cashbackPct: 0, insuranceLevel: 'basic', benefits: ['100% mobile', 'Gratuite'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
  { id: 'hello-prime', name: 'Hello Prime', bank: 'Hello bank!', bankLogo: '👋', network: 'visa', tier: 'gold', type: 'debit', gradient: 'from-green-700 via-amber-500 to-green-800', textColor: 'text-white', pattern: 'lines', annualFee: 500, cashbackPct: 0, insuranceLevel: 'premium', benefits: ['Assurance voyage', 'Pas de frais à l\'étranger'], contactless: true, appleGooglePay: true, country: '🇫🇷' },

  // ── Fortuneo ──
  { id: 'fortuneo-fosfo', name: 'Fosfo', bank: 'Fortuneo', bankLogo: '💎', network: 'mastercard', tier: 'standard', type: 'debit', gradient: 'from-purple-600 via-pink-500 to-purple-700', textColor: 'text-white', pattern: 'dots', annualFee: 0, cashbackPct: 0, insuranceLevel: 'basic', benefits: ['Gratuite sans condition', '1 retrait/mois offert'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
  { id: 'fortuneo-gold', name: 'Gold CB', bank: 'Fortuneo', bankLogo: '💎', network: 'mastercard', tier: 'gold', type: 'debit', gradient: 'from-amber-500 via-purple-600 to-amber-600', textColor: 'text-white', pattern: 'waves', annualFee: 0, cashbackPct: 0, insuranceLevel: 'premium', benefits: ['Gratuite (1000€ revenus)', 'Assurance voyage'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
  { id: 'fortuneo-world-elite', name: 'World Elite', bank: 'Fortuneo', bankLogo: '💎', network: 'mastercard', tier: 'black', type: 'debit', gradient: 'from-black via-purple-950 to-gray-900', textColor: 'text-white', pattern: 'circuit', annualFee: 0, cashbackPct: 0, insuranceLevel: 'elite', benefits: ['Gratuite (4000€ revenus)', 'Conciergerie', 'Priority Pass'], contactless: true, appleGooglePay: true, country: '🇫🇷' },

  // ── Monabanq ──
  { id: 'monabanq-classic', name: 'Visa Classic', bank: 'Monabanq', bankLogo: '🟣', network: 'visa', tier: 'standard', type: 'debit', gradient: 'from-violet-600 via-violet-500 to-violet-700', textColor: 'text-white', pattern: 'dots', annualFee: 300, cashbackPct: 0, insuranceLevel: 'basic', benefits: ['Sans condition de revenus', '3€/mois'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
  { id: 'monabanq-premium', name: 'Visa Premier', bank: 'Monabanq', bankLogo: '🟣', network: 'visa', tier: 'gold', type: 'debit', gradient: 'from-violet-700 via-amber-500 to-violet-800', textColor: 'text-white', pattern: 'lines', annualFee: 900, cashbackPct: 0, insuranceLevel: 'premium', benefits: ['Assurance voyage', '9€/mois'], contactless: true, appleGooglePay: true, country: '🇫🇷' },

  // ── BforBank ──
  { id: 'bforbank-visa-classic', name: 'Visa Classic', bank: 'BforBank', bankLogo: '🔶', network: 'visa', tier: 'standard', type: 'debit', gradient: 'from-orange-600 via-amber-500 to-orange-700', textColor: 'text-white', pattern: 'waves', annualFee: 0, cashbackPct: 0, insuranceLevel: 'basic', benefits: ['Gratuite (1000€ revenus)'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
  { id: 'bforbank-visa-infinite', name: 'Visa Infinite', bank: 'BforBank', bankLogo: '🔶', network: 'visa', tier: 'infinite', type: 'debit', gradient: 'from-gray-900 via-orange-900 to-black', textColor: 'text-white', pattern: 'circuit', annualFee: 0, cashbackPct: 0, insuranceLevel: 'elite', benefits: ['Gratuite (4000€ revenus)', 'Conciergerie', 'Priority Pass'], contactless: true, appleGooglePay: true, country: '🇫🇷' },

  // ── N26 ──
  { id: 'n26-standard', name: 'N26 Standard', bank: 'N26', bankLogo: '🟢', network: 'mastercard', tier: 'standard', type: 'debit', gradient: 'from-teal-500 via-cyan-400 to-teal-600', textColor: 'text-white', pattern: 'none', annualFee: 0, cashbackPct: 0, insuranceLevel: 'none', benefits: ['100% gratuite', '3 retraits/mois'], contactless: true, appleGooglePay: true, country: '🇩🇪' },
  { id: 'n26-smart', name: 'N26 Smart', bank: 'N26', bankLogo: '🟢', network: 'mastercard', tier: 'standard', type: 'debit', gradient: 'from-emerald-500 via-teal-400 to-emerald-600', textColor: 'text-white', pattern: 'dots', annualFee: 490, cashbackPct: 0.1, insuranceLevel: 'basic', benefits: ['Couleurs au choix', '5 retraits/mois', 'Assurance mobile'], contactless: true, appleGooglePay: true, country: '🇩🇪' },
  { id: 'n26-you', name: 'N26 You', bank: 'N26', bankLogo: '🟢', network: 'mastercard', tier: 'premium', type: 'debit', gradient: 'from-sky-500 via-indigo-400 to-sky-600', textColor: 'text-white', pattern: 'waves', annualFee: 990, cashbackPct: 0.1, insuranceLevel: 'premium', benefits: ['Sans frais à l\'étranger', 'Assurance voyage', 'Salons lounge'], contactless: true, appleGooglePay: true, country: '🇩🇪' },
  { id: 'n26-metal', name: 'N26 Metal', bank: 'N26', bankLogo: '🟢', network: 'mastercard', tier: 'black', type: 'debit', gradient: 'from-gray-800 via-slate-700 to-gray-900', textColor: 'text-white', pattern: 'circuit', annualFee: 1690, cashbackPct: 0.5, insuranceLevel: 'elite', benefits: ['Carte métal 18g', 'Cashback 0.5%', 'Assurance premium', 'Offres partenaires'], contactless: true, appleGooglePay: true, country: '🇩🇪' },

  // ── Revolut ──
  { id: 'revolut-standard', name: 'Revolut Standard', bank: 'Revolut', bankLogo: '🟣', network: 'visa', tier: 'standard', type: 'prepaid', gradient: 'from-indigo-500 via-blue-400 to-indigo-600', textColor: 'text-white', pattern: 'none', annualFee: 0, cashbackPct: 0, insuranceLevel: 'none', benefits: ['Gratuite', 'Change multi-devises'], contactless: true, appleGooglePay: true, country: '🇬🇧' },
  { id: 'revolut-plus', name: 'Revolut Plus', bank: 'Revolut', bankLogo: '🟣', network: 'visa', tier: 'standard', type: 'prepaid', gradient: 'from-blue-500 via-indigo-400 to-blue-600', textColor: 'text-white', pattern: 'dots', annualFee: 395, cashbackPct: 0, insuranceLevel: 'basic', benefits: ['Assurance mobile', 'No-limits trading'], contactless: true, appleGooglePay: true, country: '🇬🇧' },
  { id: 'revolut-premium', name: 'Revolut Premium', bank: 'Revolut', bankLogo: '🟣', network: 'visa', tier: 'premium', type: 'prepaid', gradient: 'from-violet-600 via-pink-500 to-violet-700', textColor: 'text-white', pattern: 'waves', annualFee: 899, cashbackPct: 0, insuranceLevel: 'premium', benefits: ['Change illimité', 'Assurance voyage', 'Lounge Key'], contactless: true, appleGooglePay: true, country: '🇬🇧' },
  { id: 'revolut-metal', name: 'Revolut Metal', bank: 'Revolut', bankLogo: '🟣', network: 'visa', tier: 'black', type: 'prepaid', gradient: 'from-gray-900 via-violet-900 to-black', textColor: 'text-white', pattern: 'circuit', annualFee: 1599, cashbackPct: 1, insuranceLevel: 'elite', benefits: ['Carte métal', 'Cashback 1%', 'Lounge illimité', 'Conciergerie'], contactless: true, appleGooglePay: true, country: '🇬🇧' },
  { id: 'revolut-ultra', name: 'Revolut Ultra', bank: 'Revolut', bankLogo: '🟣', network: 'visa', tier: 'black', type: 'prepaid', gradient: 'from-amber-600 via-yellow-500 to-amber-700', textColor: 'text-gray-900', pattern: 'circuit', annualFee: 4500, cashbackPct: 1.5, insuranceLevel: 'elite', benefits: ['Cashback 1.5%', 'Priority Pass illimité', 'Concierge dédié', 'Invit VIP events'], contactless: true, appleGooglePay: true, country: '🇬🇧' },

  // ── Wise (ex-TransferWise) ──
  { id: 'wise-debit', name: 'Wise Debit', bank: 'Wise', bankLogo: '💚', network: 'visa', tier: 'standard', type: 'debit', gradient: 'from-lime-500 via-green-400 to-lime-600', textColor: 'text-gray-900', pattern: 'none', annualFee: 900, cashbackPct: 0, insuranceLevel: 'none', benefits: ['Multi-devises réel', 'Frais les plus bas', '40+ devises'], contactless: true, appleGooglePay: true, country: '🇬🇧' },

  // ── Nickel ──
  { id: 'nickel-standard', name: 'Nickel Classic', bank: 'Nickel', bankLogo: '🟡', network: 'mastercard', tier: 'standard', type: 'debit', gradient: 'from-yellow-500 via-amber-400 to-yellow-600', textColor: 'text-gray-900', pattern: 'dots', annualFee: 2000, cashbackPct: 0, insuranceLevel: 'none', benefits: ['Sans condition', 'Ouverture en 5min', 'Buraliste'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
  { id: 'nickel-chrome', name: 'Nickel Chrome', bank: 'Nickel', bankLogo: '🟡', network: 'mastercard', tier: 'premium', type: 'debit', gradient: 'from-gray-700 via-yellow-600 to-gray-800', textColor: 'text-white', pattern: 'lines', annualFee: 5000, cashbackPct: 0, insuranceLevel: 'basic', benefits: ['Assurance achats', 'Frais réduits étranger'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
  { id: 'nickel-metal', name: 'Nickel Metal', bank: 'Nickel', bankLogo: '🟡', network: 'mastercard', tier: 'black', type: 'debit', gradient: 'from-gray-900 via-amber-800 to-black', textColor: 'text-white', pattern: 'circuit', annualFee: 8000, cashbackPct: 0, insuranceLevel: 'premium', benefits: ['Carte métal', 'Assurance mobile', 'Paiements étranger gratuits'], contactless: true, appleGooglePay: true, country: '🇫🇷' },

  // ── Orange Bank ──
  { id: 'orange-bank-standard', name: 'Orange Bank Standard', bank: 'Orange Bank', bankLogo: '🍊', network: 'visa', tier: 'standard', type: 'debit', gradient: 'from-orange-500 via-orange-400 to-orange-600', textColor: 'text-white', pattern: 'dots', annualFee: 0, cashbackPct: 0, insuranceLevel: 'none', benefits: ['Gratuite', '20€ offerts'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
  { id: 'orange-bank-premium', name: 'Orange Bank Premium', bank: 'Orange Bank', bankLogo: '🍊', network: 'visa', tier: 'premium', type: 'debit', gradient: 'from-gray-800 via-orange-600 to-gray-900', textColor: 'text-white', pattern: 'waves', annualFee: 799, cashbackPct: 0, insuranceLevel: 'premium', benefits: ['Assurance voyage', 'Paiements gratuits monde'], contactless: true, appleGooglePay: true, country: '🇫🇷' },

  // ── Lydia (Sumeria) ──
  { id: 'lydia-sumeria-standard', name: 'Sumeria', bank: 'Lydia', bankLogo: '💜', network: 'visa', tier: 'standard', type: 'debit', gradient: 'from-fuchsia-600 via-purple-500 to-fuchsia-700', textColor: 'text-white', pattern: 'waves', annualFee: 0, cashbackPct: 0, insuranceLevel: 'none', benefits: ['Paiements entre amis', 'Cagnottes'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
  { id: 'lydia-sumeria-plus', name: 'Sumeria+', bank: 'Lydia', bankLogo: '💜', network: 'visa', tier: 'premium', type: 'debit', gradient: 'from-purple-700 via-fuchsia-500 to-purple-800', textColor: 'text-white', pattern: 'lines', annualFee: 999, cashbackPct: 0, insuranceLevel: 'premium', benefits: ['Assurance mobile', 'IBAN français', 'Sub-comptes'], contactless: true, appleGooglePay: true, country: '🇫🇷' },

  // ── Ma French Bank ──
  { id: 'mafrenchbank-standard', name: 'Ma French Bank', bank: 'Ma French Bank', bankLogo: '🇫🇷', network: 'visa', tier: 'standard', type: 'debit', gradient: 'from-blue-500 via-white to-red-500', textColor: 'text-gray-900', pattern: 'none', annualFee: 200, cashbackPct: 0, insuranceLevel: 'none', benefits: ['2€/mois', 'Ouverture en bureau de poste'], contactless: true, appleGooglePay: true, country: '🇫🇷' },

  // ── Aumax pour moi ──
  { id: 'aumax-standard', name: 'Aumax Standard', bank: 'Aumax pour moi', bankLogo: '🌟', network: 'mastercard', tier: 'standard', type: 'debit', gradient: 'from-cyan-500 via-teal-400 to-cyan-600', textColor: 'text-white', pattern: 'dots', annualFee: 0, cashbackPct: 1, insuranceLevel: 'basic', benefits: ['Cashback 1%', 'Agrégation de comptes'], contactless: true, appleGooglePay: true, country: '🇫🇷' },

  // ── Pixpay (ados) ──
  { id: 'pixpay-ado', name: 'Pixpay Ado', bank: 'Pixpay', bankLogo: '🎮', network: 'mastercard', tier: 'standard', type: 'prepaid', gradient: 'from-pink-500 via-purple-400 to-pink-600', textColor: 'text-white', pattern: 'dots', annualFee: 299, cashbackPct: 0, insuranceLevel: 'none', benefits: ['Carte ado', 'Contrôle parental', 'Missions d\'épargne'], contactless: true, appleGooglePay: true, country: '🇫🇷' },

  // ── Kard (jeunes) ──
  { id: 'kard-standard', name: 'Kard', bank: 'Kard', bankLogo: '🎯', network: 'visa', tier: 'standard', type: 'prepaid', gradient: 'from-violet-500 via-indigo-400 to-violet-600', textColor: 'text-white', pattern: 'waves', annualFee: 0, cashbackPct: 5, insuranceLevel: 'none', benefits: ['Cashback 5%', 'Carte jeunes', 'Parrainage'], contactless: true, appleGooglePay: true, country: '🇫🇷' },
]

/* ═══════════════════════════════════════════════════════
   INTERNATIONAL PREMIUM CARDS
   ═══════════════════════════════════════════════════════ */

const INTERNATIONAL_PREMIUM: BankCardTemplate[] = [
  // ── American Express ──
  { id: 'amex-green', name: 'Carte Green', bank: 'American Express', bankLogo: '💳', network: 'amex', tier: 'standard', type: 'charge', gradient: 'from-green-600 via-emerald-500 to-green-700', textColor: 'text-white', pattern: 'lines', annualFee: 0, cashbackPct: 0, insuranceLevel: 'basic', benefits: ['Gratuite 1ère année', 'Membership Rewards'], contactless: true, appleGooglePay: true, country: '🌍' },
  { id: 'amex-gold', name: 'Gold Card', bank: 'American Express', bankLogo: '💳', network: 'amex', tier: 'gold', type: 'charge', gradient: 'from-amber-500 via-yellow-400 to-amber-600', textColor: 'text-gray-900', pattern: 'lines', annualFee: 17000, cashbackPct: 0, insuranceLevel: 'premium', benefits: ['Membership Rewards x3 resto', 'Assurance voyage', 'Accès salons'], contactless: true, appleGooglePay: true, country: '🌍' },
  { id: 'amex-platinum', name: 'Platinum Card', bank: 'American Express', bankLogo: '💳', network: 'amex', tier: 'platinum', type: 'charge', gradient: 'from-slate-300 via-gray-200 to-slate-400', textColor: 'text-gray-900', pattern: 'circuit', annualFee: 66000, cashbackPct: 0, insuranceLevel: 'elite', benefits: ['Carte métal', 'Priority Pass illimité', 'Fine Hotels & Resorts', 'Conciergerie premium', 'Global Dining Collection'], contactless: true, appleGooglePay: true, country: '🌍' },
  { id: 'amex-centurion', name: 'Centurion (Black)', bank: 'American Express', bankLogo: '💳', network: 'amex', tier: 'black', type: 'charge', gradient: 'from-gray-900 via-black to-gray-800', textColor: 'text-white', pattern: 'circuit', annualFee: 350000, cashbackPct: 0, insuranceLevel: 'elite', benefits: ['Sur invitation', 'Conciergerie dédiée', 'Accès ilimité salons', 'Majordome personnel', 'Upgrades hôtels systématiques'], contactless: true, appleGooglePay: true, country: '🌍' },

  // ── Curve ──
  { id: 'curve-free', name: 'Curve Free', bank: 'Curve', bankLogo: '🔄', network: 'mastercard', tier: 'standard', type: 'debit', gradient: 'from-blue-600 via-indigo-500 to-blue-700', textColor: 'text-white', pattern: 'none', annualFee: 0, cashbackPct: 1, insuranceLevel: 'none', benefits: ['Agrège toutes vos cartes', 'Cashback 1%', 'Go Back in Time'], contactless: true, appleGooglePay: true, country: '🇬🇧' },
  { id: 'curve-metal', name: 'Curve Metal', bank: 'Curve', bankLogo: '🔄', network: 'mastercard', tier: 'black', type: 'debit', gradient: 'from-gray-800 via-indigo-800 to-gray-900', textColor: 'text-white', pattern: 'circuit', annualFee: 1499, cashbackPct: 1, insuranceLevel: 'premium', benefits: ['Carte métal', 'Assurance mobile', 'Cashback amélioré', 'Protection achats'], contactless: true, appleGooglePay: true, country: '🇬🇧' },

  // ── Vivid Money ──
  { id: 'vivid-standard', name: 'Vivid Standard', bank: 'Vivid Money', bankLogo: '💚', network: 'visa', tier: 'standard', type: 'debit', gradient: 'from-green-500 via-lime-400 to-green-600', textColor: 'text-white', pattern: 'none', annualFee: 0, cashbackPct: 0.5, insuranceLevel: 'none', benefits: ['Cashback crypto/actions', 'Multi-devises'], contactless: true, appleGooglePay: true, country: '🇩🇪' },
  { id: 'vivid-prime', name: 'Vivid Prime', bank: 'Vivid Money', bankLogo: '💚', network: 'visa', tier: 'premium', type: 'debit', gradient: 'from-emerald-600 via-green-500 to-emerald-700', textColor: 'text-white', pattern: 'dots', annualFee: 999, cashbackPct: 2, insuranceLevel: 'basic', benefits: ['Cashback 2%', 'Retraits illimités', 'Assurance mobile'], contactless: true, appleGooglePay: true, country: '🇩🇪' },

  // ── Bunq ──
  { id: 'bunq-easy-money', name: 'Easy Money', bank: 'Bunq', bankLogo: '🌳', network: 'mastercard', tier: 'standard', type: 'debit', gradient: 'from-green-400 via-teal-300 to-green-500', textColor: 'text-gray-900', pattern: 'none', annualFee: 399, cashbackPct: 0, insuranceLevel: 'none', benefits: ['Plante des arbres', 'Multi-comptes'], contactless: true, appleGooglePay: true, country: '🇳🇱' },
  { id: 'bunq-metal', name: 'Easy Green', bank: 'Bunq', bankLogo: '🌳', network: 'mastercard', tier: 'premium', type: 'debit', gradient: 'from-emerald-700 via-teal-600 to-emerald-800', textColor: 'text-white', pattern: 'waves', annualFee: 1899, cashbackPct: 2, insuranceLevel: 'premium', benefits: ['Carte métal', 'Cashback 2%', 'Assurance voyage', '25 sous-comptes'], contactless: true, appleGooglePay: true, country: '🇳🇱' },

  // ── Trade Republic ──
  { id: 'trade-republic', name: 'Trade Republic Card', bank: 'Trade Republic', bankLogo: '📈', network: 'visa', tier: 'standard', type: 'debit', gradient: 'from-gray-900 via-gray-800 to-black', textColor: 'text-white', pattern: 'none', annualFee: 0, cashbackPct: 1, insuranceLevel: 'none', benefits: ['1% saveback en actions', 'Sans frais', 'Investissement auto'], contactless: true, appleGooglePay: true, country: '🇩🇪' },

  // ── Crypto.com ──
  { id: 'cryptocom-midnight-blue', name: 'Midnight Blue', bank: 'Crypto.com', bankLogo: '🪙', network: 'visa', tier: 'standard', type: 'prepaid', gradient: 'from-blue-800 via-indigo-700 to-blue-900', textColor: 'text-white', pattern: 'dots', annualFee: 0, cashbackPct: 1, insuranceLevel: 'none', benefits: ['Cashback CRO 1%', 'Sans staking'], contactless: true, appleGooglePay: true, country: '🌍' },
  { id: 'cryptocom-ruby', name: 'Ruby Steel', bank: 'Crypto.com', bankLogo: '🪙', network: 'visa', tier: 'standard', type: 'prepaid', gradient: 'from-red-600 via-red-500 to-red-700', textColor: 'text-white', pattern: 'lines', annualFee: 0, cashbackPct: 2, insuranceLevel: 'none', benefits: ['Cashback CRO 2%', 'Spotify remboursé', 'Carte métal'], contactless: true, appleGooglePay: true, country: '🌍' },
  { id: 'cryptocom-jade', name: 'Jade Green', bank: 'Crypto.com', bankLogo: '🪙', network: 'visa', tier: 'premium', type: 'prepaid', gradient: 'from-emerald-600 via-green-500 to-emerald-700', textColor: 'text-white', pattern: 'circuit', annualFee: 0, cashbackPct: 3, insuranceLevel: 'basic', benefits: ['Cashback 3%', 'Spotify+Netflix', 'Lounge Key', 'Earn 6%'], contactless: true, appleGooglePay: true, country: '🌍' },
  { id: 'cryptocom-icy', name: 'Icy White', bank: 'Crypto.com', bankLogo: '🪙', network: 'visa', tier: 'platinum', type: 'prepaid', gradient: 'from-sky-100 via-white to-sky-200', textColor: 'text-gray-900', pattern: 'circuit', annualFee: 0, cashbackPct: 5, insuranceLevel: 'premium', benefits: ['Cashback 5%', 'Tous abos remboursés', 'Expedia remboursé', 'Earn 8%'], contactless: true, appleGooglePay: true, country: '🌍' },
  { id: 'cryptocom-obsidian', name: 'Obsidian', bank: 'Crypto.com', bankLogo: '🪙', network: 'visa', tier: 'black', type: 'prepaid', gradient: 'from-gray-900 via-black to-gray-800', textColor: 'text-white', pattern: 'circuit', annualFee: 0, cashbackPct: 8, insuranceLevel: 'elite', benefits: ['Cashback 8%', 'Sur invitation', 'Conciergerie VIP', 'Earn 10%', 'Tous avantages inclus'], contactless: true, appleGooglePay: true, country: '🌍' },
]

/* ═══════════════════════════════════════════════════════
   CARD DATABASE — MERGED & EXPORTED
   ═══════════════════════════════════════════════════════ */

export const CARD_DATABASE: BankCardTemplate[] = [
  ...FRENCH_TRADITIONAL,
  ...FRENCH_NEOBANKS,
  ...INTERNATIONAL_PREMIUM,
]

/** Get unique bank names */
export function getBankNames(): string[] {
  return Array.from(new Set(CARD_DATABASE.map((c) => c.bank))).sort()
}

/** Filter cards by bank, tier, network, type */
export function searchCards(query: string, filters?: {
  bank?: string
  tier?: CardTier
  network?: CardNetwork
  type?: CardType
}): BankCardTemplate[] {
  let results = CARD_DATABASE
  const q = query.toLowerCase()

  if (q) {
    results = results.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.bank.toLowerCase().includes(q) ||
        c.benefits.some((b) => b.toLowerCase().includes(q))
    )
  }

  if (filters?.bank) results = results.filter((c) => c.bank === filters.bank)
  if (filters?.tier) results = results.filter((c) => c.tier === filters.tier)
  if (filters?.network) results = results.filter((c) => c.network === filters.network)
  if (filters?.type) results = results.filter((c) => c.type === filters.type)

  return results
}

/** Get card by ID */
export function getCardById(id: string): BankCardTemplate | undefined {
  return CARD_DATABASE.find((c) => c.id === id)
}

/* ═══════════════════════════════════════════════════════
   NETWORK LOGOS (SVG paths for card rendering)
   ═══════════════════════════════════════════════════════ */

export const NETWORK_DISPLAY: Record<CardNetwork, { label: string; colors: string }> = {
  visa: { label: 'VISA', colors: 'text-white font-bold italic text-lg tracking-widest' },
  mastercard: { label: '●●', colors: 'text-red-500' },
  amex: { label: 'AMEX', colors: 'text-white font-bold text-sm tracking-wider' },
  cb: { label: 'CB', colors: 'text-white font-bold text-sm' },
}

export const TIER_LABELS: Record<CardTier, { label: string; badge: string }> = {
  standard: { label: 'Standard', badge: 'bg-surface text-foreground' },
  premium: { label: 'Premium', badge: 'bg-blue-500/20 text-blue-400' },
  gold: { label: 'Gold', badge: 'bg-amber-500/20 text-amber-400' },
  platinum: { label: 'Platinum', badge: 'bg-slate-400/20 text-slate-300' },
  black: { label: 'Black', badge: 'bg-gray-800 text-white' },
  infinite: { label: 'Infinite', badge: 'bg-purple-500/20 text-purple-400' },
}
