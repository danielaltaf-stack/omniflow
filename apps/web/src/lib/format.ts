/**
 * OmniFlow — Financial formatting utilities.
 * All amounts are stored in centimes (integer).
 */

/**
 * Format centimes to EUR display string.
 * e.g. 154320 → "1 543,20 €"
 */
export function formatAmount(centimes: number, currency = 'EUR'): string {
  const value = centimes / 100
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Format centimes to compact string (no currency symbol).
 * e.g. 154320 → "1 543,20"
 */
export function formatNumber(centimes: number): string {
  const value = centimes / 100
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Format a date to French locale.
 */
export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr))
}

/**
 * Format relative date (e.g., "Aujourd'hui", "Hier", "Lun. 15 fév.")
 */
export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return "Aujourd'hui"
  if (date.toDateString() === yesterday.toDateString()) return 'Hier'

  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date)
}

/**
 * Map account type to French label.
 */
export function accountTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    checking: 'Compte courant',
    savings: 'Épargne',
    investment: 'Investissement',
    loan: 'Crédit',
    crypto: 'Crypto',
    credit_card: 'Carte de crédit',
    other: 'Autre',
  }
  return labels[type] || type
}

/**
 * Map transaction type to French label.
 */
export function transactionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    card: 'Carte',
    transfer: 'Virement',
    direct_debit: 'Prélèvement',
    check: 'Chèque',
    fee: 'Frais',
    interest: 'Intérêts',
    atm: 'Retrait',
    other: 'Autre',
  }
  return labels[type] || type
}

/**
 * Get the color class for an amount (green for positive, red for negative).
 */
export function amountColorClass(centimes: number): string {
  if (centimes > 0) return 'text-gain'
  if (centimes < 0) return 'text-loss'
  return 'text-foreground'
}

/**
 * Get icon name for account type. 
 */
export function accountTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    checking: 'Wallet',
    savings: 'PiggyBank',
    investment: 'TrendingUp',
    loan: 'Landmark',
    crypto: 'Bitcoin',
    credit_card: 'CreditCard',
    other: 'Circle',
  }
  return icons[type] || 'Circle'
}
