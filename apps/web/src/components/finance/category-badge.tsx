'use client'

import {
  ShoppingCart,
  Car,
  Home,
  Zap,
  Smartphone,
  Repeat,
  ShoppingBag,
  Heart,
  Music,
  Landmark,
  TrendingUp,
  PiggyBank,
  FileText,
  BookOpen,
  Banknote,
  HelpCircle,
} from 'lucide-react'

const CATEGORY_CONFIG: Record<string, { icon: React.ComponentType<any>; color: string; bg: string }> = {
  Alimentation: { icon: ShoppingCart, color: 'text-green-600', bg: 'bg-green-500/10' },
  Transport: { icon: Car, color: 'text-blue-600', bg: 'bg-blue-500/10' },
  Logement: { icon: Home, color: 'text-purple-600', bg: 'bg-purple-500/10' },
  'Énergie': { icon: Zap, color: 'text-orange-600', bg: 'bg-orange-500/10' },
  'Télécom': { icon: Smartphone, color: 'text-cyan-600', bg: 'bg-cyan-500/10' },
  Abonnements: { icon: Repeat, color: 'text-pink-600', bg: 'bg-pink-500/10' },
  Shopping: { icon: ShoppingBag, color: 'text-red-500', bg: 'bg-red-500/10' },
  'Santé': { icon: Heart, color: 'text-red-600', bg: 'bg-red-500/10' },
  Loisirs: { icon: Music, color: 'text-lime-600', bg: 'bg-lime-500/10' },
  Banque: { icon: Landmark, color: 'text-gray-600', bg: 'bg-gray-500/10' },
  Revenus: { icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
  'Épargne': { icon: PiggyBank, color: 'text-indigo-600', bg: 'bg-indigo-500/10' },
  'Impôts': { icon: FileText, color: 'text-amber-700', bg: 'bg-amber-500/10' },
  'Éducation': { icon: BookOpen, color: 'text-teal-600', bg: 'bg-teal-500/10' },
  Cash: { icon: Banknote, color: 'text-yellow-600', bg: 'bg-yellow-500/10' },
  Autres: { icon: HelpCircle, color: 'text-gray-500', bg: 'bg-gray-500/10' },
}

interface CategoryBadgeProps {
  category: string | null
  subcategory?: string | null
  size?: 'sm' | 'md'
}

export function CategoryBadge({ category, subcategory, size = 'sm' }: CategoryBadgeProps) {
  const fallback = CATEGORY_CONFIG['Autres']!
  const config = CATEGORY_CONFIG[category || 'Autres'] ?? fallback
  const Icon = config.icon

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-2.5 py-1 gap-1.5',
  }

  return (
    <span
      className={`
        inline-flex items-center rounded-full font-medium
        ${config.bg} ${config.color} ${sizeClasses[size]}
      `}
      title={subcategory ? `${category} > ${subcategory}` : category || 'Non catégorisé'}
    >
      <Icon size={size === 'sm' ? 12 : 14} />
      <span>{category || 'Autre'}</span>
    </span>
  )
}
