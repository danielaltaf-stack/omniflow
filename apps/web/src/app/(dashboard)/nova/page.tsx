'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Calculator,
  Brain,
  MessageCircle,
  Send,
  Plus,
  Trash2,
  ChevronRight,
  Loader2,
  Zap,
  ArrowRight,
  Clock,
  MessageSquare,
  Info,
  Wallet,
  TrendingDown,
  TrendingUp,
  PiggyBank,
  BarChart3,
  ShieldAlert,
  Target,
  Home,
  Bitcoin,
  Bot,
  User,
  Pin,
  AlertTriangle,
  Repeat,
  CreditCard,
  Receipt,
  Sunset,
  Landmark,
  Calendar,
  Scissors,
  Database,
  Tag,
  Star,
  Search,
  PlusCircle,
  X,
} from 'lucide-react'
import { InvestmentSimulator } from '@/components/ai/investment-simulator'
import { useAdvisorStore } from '@/stores/advisor-store'
import { cn } from '@/lib/utils'
import type { ChatSuggestion, NovaMemory } from '@/types/api'

// ── Icon mapping ────────────────────────────────────────

const SUGGESTION_ICONS: Record<string, React.ElementType> = {
  wallet: Wallet,
  'trending-down': TrendingDown,
  'trending-up': TrendingUp,
  'piggy-bank': PiggyBank,
  'bar-chart-3': BarChart3,
  'shield-alert': ShieldAlert,
  'alert-triangle': AlertTriangle,
  target: Target,
  home: Home,
  bitcoin: Bitcoin,
  repeat: Repeat,
  'credit-card': CreditCard,
  receipt: Receipt,
  sunset: Sunset,
  landmark: Landmark,
  calendar: Calendar,
  scissors: Scissors,
  brain: Brain,
}

function SuggestionIcon({ name, size = 16 }: { name: string; size?: number }) {
  const Icon = SUGGESTION_ICONS[name] || Zap
  return <Icon size={size} />
}

// ── Memory type config ──────────────────────────────────

const MEMORY_TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  fact: { icon: '📌', color: 'text-blue-400', label: 'Fait' },
  preference: { icon: '💜', color: 'text-violet-400', label: 'Préférence' },
  goal: { icon: '🎯', color: 'text-emerald-400', label: 'Objectif' },
  insight: { icon: '💡', color: 'text-amber-400', label: 'Insight' },
  personality: { icon: '🧠', color: 'text-cyan-400', label: 'Personnalité' },
}

const MEMORY_CATEGORY_LABELS: Record<string, string> = {
  general: 'Général',
  finance: 'Finance',
  investment: 'Investissement',
  budget: 'Budget',
  lifestyle: 'Style de vie',
  tax: 'Fiscalité',
  retirement: 'Retraite',
  heritage: 'Patrimoine',
  real_estate: 'Immobilier',
  career: 'Carrière',
  family: 'Famille',
}

// ── Animated Nova orb ───────────────────────────────────

function NovaOrb({ size = 56, pulse = false }: { size?: number; pulse?: boolean }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'conic-gradient(from 0deg, #8b5cf6, #06b6d4, #f59e0b, #ec4899, #8b5cf6)',
          filter: 'blur(8px)',
          opacity: 0.4,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      />
      {pulse && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'conic-gradient(from 180deg, #8b5cf6, #06b6d4, #f59e0b, #ec4899, #8b5cf6)',
            filter: 'blur(12px)',
            opacity: 0.3,
          }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <motion.div
        className="absolute inset-1.5 rounded-full flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)',
          boxShadow: '0 0 20px rgba(139, 92, 246, 0.3), inset 0 0 20px rgba(139, 92, 246, 0.1)',
        }}
      >
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Sparkles size={size * 0.35} className="text-violet-300" />
        </motion.div>
      </motion.div>
    </div>
  )
}

// ── Typing indicator ────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-2.5">
      <span className="text-xs text-foreground-secondary mr-1">Nova réfléchit</span>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-violet-400"
          animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}

// ── Inline markdown rendering ───────────────────────────

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
    }
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return <em key={i} className="italic">{part.slice(1, -1)}</em>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="px-1.5 py-0.5 rounded-md bg-violet-500/10 text-[12px] font-mono text-violet-400 border border-violet-500/10">
          {part.slice(1, -1)}
        </code>
      )
    }
    return <span key={i}>{part}</span>
  })
}

// ── Full-screen message bubble ──────────────────────────

function FullMessageBubble({
  role,
  content,
  isStreaming,
  index,
}: {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  index: number
}) {
  const isUser = role === 'user'

  const renderContent = (text: string) => {
    if (isUser) return <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>

    const lines = text.split('\n')
    const elements: JSX.Element[] = []

    lines.forEach((line, i) => {
      if (line.startsWith('# ')) {
        elements.push(
          <h3 key={i} className="text-lg font-bold mt-4 mb-2 first:mt-0 text-foreground">
            {line.slice(2)}
          </h3>
        )
      } else if (line.startsWith('## ')) {
        elements.push(
          <h4 key={i} className="text-base font-semibold mt-3 mb-1.5 text-foreground">
            {line.slice(3)}
          </h4>
        )
      } else if (line.startsWith('### ')) {
        elements.push(
          <h5 key={i} className="text-sm font-semibold mt-2.5 mb-1 text-foreground">
            {line.slice(4)}
          </h5>
        )
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        elements.push(
          <li key={i} className="text-sm leading-relaxed ml-4 list-disc text-foreground-secondary">
            {renderInline(line.slice(2))}
          </li>
        )
      } else if (/^\d+\.\s/.test(line)) {
        elements.push(
          <li key={i} className="text-sm leading-relaxed ml-4 list-decimal text-foreground-secondary">
            {renderInline(line.replace(/^\d+\.\s/, ''))}
          </li>
        )
      } else if (line.startsWith('---')) {
        elements.push(<hr key={i} className="my-3 border-border/50" />)
      } else if (line.trim() === '') {
        elements.push(<div key={i} className="h-2" />)
      } else {
        elements.push(
          <p key={i} className="text-sm leading-relaxed text-foreground-secondary">
            {renderInline(line)}
          </p>
        )
      }
    })

    return <div className="space-y-0.5">{elements}</div>
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3), ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      <motion.div
        className="flex-shrink-0 mt-0.5"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20, delay: Math.min(index * 0.05, 0.3) }}
      >
        {isUser ? (
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <User size={14} className="text-white" />
          </div>
        ) : (
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20"
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }}
          >
            <Bot size={14} className="text-white" />
          </div>
        )}
      </motion.div>

      {/* Message content */}
      <div className={cn('max-w-[90%] sm:max-w-[75%] min-w-0', isUser && 'text-right')}>
        <span className={cn('text-[11px] font-medium mb-1 block', isUser ? 'text-violet-400' : 'text-cyan-400')}>
          {isUser ? 'Vous' : 'Nova'}
        </span>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 relative',
            isUser
              ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-tr-md shadow-lg shadow-violet-500/10'
              : 'bg-surface-elevated border border-border rounded-tl-md shadow-sm'
          )}
        >
          {renderContent(content)}
          {isStreaming && !content && <TypingIndicator />}
          {isStreaming && content && (
            <motion.span
              className="inline-block w-1.5 h-4 bg-violet-400 ml-0.5 rounded-full align-middle"
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.6, repeat: Infinity }}
            />
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ── Conversation history sidebar ────────────────────────

function ConversationSidebar({
  isOpen,
  conversations,
  currentId,
  onLoad,
  onDelete,
  onPin,
  onNew,
}: {
  isOpen: boolean
  conversations: { id: string; title: string; message_count: number; is_pinned?: boolean }[]
  currentId: string | null
  onLoad: (id: string) => void
  onDelete: (id: string) => void
  onPin: (id: string) => void
  onNew: () => void
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Mobile backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={onNew}
          />
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="fixed inset-y-0 left-0 z-50 md:relative md:inset-auto flex-shrink-0 border-r border-border bg-background overflow-hidden"
          >
          <div className="w-[280px] h-full flex flex-col">
            {/* Sidebar header */}
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Clock size={14} className="text-foreground-secondary" />
                  Historique
                </h3>
                <button
                  onClick={onNew}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium',
                    'bg-violet-500/10 text-violet-400 border border-violet-500/20',
                    'hover:bg-violet-500/20 transition-all duration-200'
                  )}
                >
                  <Plus size={12} />
                  Nouveau
                </button>
              </div>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare size={24} className="text-foreground-tertiary mb-2" />
                  <p className="text-xs text-foreground-secondary">Aucune conversation</p>
                  <p className="text-[10px] text-foreground-tertiary mt-1">
                    Commencez une discussion avec Nova
                  </p>
                </div>
              ) : (
                conversations.map((conv, i) => (
                  <motion.div
                    key={conv.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => onLoad(conv.id)}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer group transition-all duration-200',
                      conv.id === currentId
                        ? 'bg-violet-500/10 border border-violet-500/20'
                        : 'hover:bg-surface-elevated border border-transparent'
                    )}
                  >
                    <div className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
                      conv.id === currentId ? 'bg-violet-500/20' : 'bg-surface'
                    )}>
                      {conv.is_pinned ? (
                        <Pin size={13} className="text-violet-400" />
                      ) : (
                        <MessageCircle size={13} className={cn(
                          conv.id === currentId ? 'text-violet-400' : 'text-foreground-tertiary'
                        )} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-[12px] font-medium truncate',
                        conv.id === currentId ? 'text-violet-400' : 'text-foreground'
                      )}>
                        {conv.title}
                      </p>
                      <p className="text-[10px] text-foreground-tertiary mt-0.5">
                        {conv.message_count} messages
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onPin(conv.id)
                        }}
                        className={cn(
                          'p-1 rounded-md transition-all',
                          conv.is_pinned
                            ? 'text-violet-400 opacity-100'
                            : 'opacity-0 group-hover:opacity-100 text-foreground-secondary hover:text-violet-400'
                        )}
                      >
                        <Pin size={11} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(conv.id)
                        }}
                        className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-red-400 transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Welcome screen (empty state) ────────────────────────

function WelcomeScreen({
  suggestions,
  onSuggestionClick,
  isStreaming,
  memoryCount,
}: {
  suggestions: ChatSuggestion[]
  onSuggestionClick: (text: string) => void
  isStreaming: boolean
  memoryCount: number
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-full px-4 py-10 overflow-y-auto">
      {/* Animated orb */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        <NovaOrb size={96} pulse />
      </motion.div>

      {/* Welcome text */}
      <motion.h2
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="mt-6 text-2xl font-bold text-foreground"
      >
        Bonjour, je suis Nova
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="mt-2 text-sm text-foreground-secondary text-center max-w-md"
      >
        Votre intelligence financière omnisciente. J&apos;ai accès à toutes vos données
        — comptes, investissements, crypto, immobilier, budgets, dettes, fiscalité — et je m&apos;en souviens.
      </motion.p>

      {/* Feature badges */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="flex flex-wrap justify-center gap-2 mt-4"
      >
        {[
          { icon: Brain, label: 'Contexte omniscient' },
          { icon: Database, label: `${memoryCount} souvenir${memoryCount !== 1 ? 's' : ''}` },
          { icon: ShieldAlert, label: 'Détection anomalies' },
          { icon: Target, label: 'Conseils sur mesure' },
        ].map((feat, i) => (
          <motion.span
            key={feat.label}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 + i * 0.08 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-border text-[11px] text-foreground-secondary"
          >
            <feat.icon size={12} className="text-violet-400" />
            {feat.label}
          </motion.span>
        ))}
      </motion.div>

      {/* Suggestion grid */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.5 }}
        className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-xl"
      >
        {suggestions.slice(0, 6).map((s, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 + i * 0.06 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSuggestionClick(s.text)}
            disabled={isStreaming}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl text-left',
              'bg-surface-elevated border border-border',
              'hover:border-violet-500/30 hover:bg-gradient-to-r hover:from-violet-500/5 hover:to-cyan-500/5',
              'hover:shadow-lg hover:shadow-violet-500/5',
              'transition-all duration-300 group disabled:opacity-50'
            )}
          >
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
              'bg-violet-500/10 text-violet-400 group-hover:bg-violet-500/20',
              'transition-colors duration-200'
            )}>
              <SuggestionIcon name={s.icon} size={15} />
            </div>
            <span className="text-[12px] text-foreground-secondary group-hover:text-foreground transition-colors leading-snug">
              {s.text}
            </span>
            <ArrowRight size={14} className="text-foreground-tertiary group-hover:text-violet-400 transition-colors ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100" />
          </motion.button>
        ))}
      </motion.div>
    </div>
  )
}

// ── Memory management panel ─────────────────────────────

function MemoryPanel() {
  const {
    memories,
    memoryStats,
    isLoadingMemories,
    fetchMemories,
    fetchMemoryStats,
    addMemory,
    deleteMemory,
    clearMemories,
  } = useAdvisorStore()

  const [filter, setFilter] = useState<string>('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [newType, setNewType] = useState('fact')
  const [newCategory, setNewCategory] = useState('general')

  useEffect(() => {
    fetchMemories()
    fetchMemoryStats()
  }, [fetchMemories, fetchMemoryStats])

  const handleAdd = async () => {
    if (!newContent.trim()) return
    await addMemory(newContent.trim(), newType, newCategory)
    setNewContent('')
    setShowAddForm(false)
  }

  const filteredMemories = filter
    ? memories.filter((m) => m.category === filter || m.memory_type === filter)
    : memories

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 lg:p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Brain size={20} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Mémoire de Nova</h2>
              <p className="text-xs text-foreground-secondary">
                {memoryStats
                  ? `${memoryStats.total} souvenir${memoryStats.total !== 1 ? 's' : ''} • Importance moy. ${memoryStats.avg_importance?.toFixed(1) || 0}/10`
                  : 'Chargement...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium',
                'bg-violet-500/10 text-violet-400 border border-violet-500/20',
                'hover:bg-violet-500/20 transition-all duration-200'
              )}
            >
              <PlusCircle size={13} />
              Ajouter
            </button>
            {memories.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('Effacer tous les souvenirs de Nova ?')) {
                    clearMemories()
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-all duration-200"
              >
                <Trash2 size={13} />
                Tout effacer
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Add memory form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-xl bg-surface-elevated border border-border space-y-3">
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Ex: Je préfère les investissements à faible risque..."
                rows={2}
                className="w-full bg-background rounded-lg border border-border px-3 py-2 text-sm text-foreground placeholder:text-foreground-secondary/50 outline-none focus:border-violet-500/40 resize-none"
              />
              <div className="flex items-center gap-3">
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="bg-background rounded-lg border border-border px-2 py-1.5 text-xs text-foreground outline-none"
                >
                  <option value="fact">📌 Fait</option>
                  <option value="preference">💜 Préférence</option>
                  <option value="goal">🎯 Objectif</option>
                  <option value="insight">💡 Insight</option>
                  <option value="personality">🧠 Personnalité</option>
                </select>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="bg-background rounded-lg border border-border px-2 py-1.5 text-xs text-foreground outline-none"
                >
                  {Object.entries(MEMORY_CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <div className="flex-1" />
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-foreground-secondary hover:bg-surface transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!newContent.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
                >
                  Ajouter
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats row */}
      {memoryStats && memoryStats.total > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-5 gap-2"
        >
          {Object.entries(MEMORY_TYPE_CONFIG).map(([key, conf]) => {
            const count = memoryStats.by_type?.[key] || 0
            return (
              <button
                key={key}
                onClick={() => setFilter(filter === key ? '' : key)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200 text-left',
                  filter === key
                    ? 'border-violet-500/30 bg-violet-500/5'
                    : 'border-border bg-surface-elevated hover:bg-surface'
                )}
              >
                <span className="text-sm">{conf.icon}</span>
                <div>
                  <p className="text-[11px] font-medium text-foreground">{count}</p>
                  <p className="text-[10px] text-foreground-secondary">{conf.label}</p>
                </div>
              </button>
            )
          })}
        </motion.div>
      )}

      {/* Category filter */}
      {memoryStats && memoryStats.total > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilter('')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all',
              !filter ? 'bg-violet-500/15 text-violet-400' : 'text-foreground-secondary hover:bg-surface-elevated'
            )}
          >
            Tous
          </button>
          {Object.entries(MEMORY_CATEGORY_LABELS).map(([key, label]) => {
            const count = memoryStats.by_category?.[key] || 0
            if (count === 0) return null
            return (
              <button
                key={key}
                onClick={() => setFilter(filter === key ? '' : key)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all',
                  filter === key ? 'bg-violet-500/15 text-violet-400' : 'text-foreground-secondary hover:bg-surface-elevated'
                )}
              >
                {label} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* Memory list */}
      <div className="space-y-2">
        {isLoadingMemories ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="text-violet-400 animate-spin" />
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Database size={32} className="text-foreground-tertiary mb-3" />
            <p className="text-sm text-foreground-secondary">
              {memories.length === 0
                ? 'Nova n\'a pas encore de souvenirs'
                : 'Aucun souvenir dans cette catégorie'}
            </p>
            <p className="text-xs text-foreground-tertiary mt-1">
              Les souvenirs sont créés automatiquement lors de vos conversations
            </p>
          </div>
        ) : (
          filteredMemories.map((memory, i) => {
            const typeConf = MEMORY_TYPE_CONFIG[memory.memory_type] ?? MEMORY_TYPE_CONFIG.fact
            return (
              <motion.div
                key={memory.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="group flex items-start gap-3 p-3 rounded-xl bg-surface-elevated border border-border hover:border-violet-500/20 transition-all duration-200"
              >
                <span className="text-lg mt-0.5 flex-shrink-0">{typeConf?.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-relaxed">{memory.content}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={cn('text-[10px] font-medium', typeConf?.color)}>
                      {typeConf?.label}
                    </span>
                    <span className="text-[10px] text-foreground-tertiary">•</span>
                    <span className="text-[10px] text-foreground-tertiary">
                      {MEMORY_CATEGORY_LABELS[memory.category] || memory.category}
                    </span>
                    <span className="text-[10px] text-foreground-tertiary">•</span>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Star
                          key={j}
                          size={8}
                          className={j < Math.round(memory.importance / 2) ? 'text-amber-400 fill-amber-400' : 'text-foreground-tertiary'}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => deleteMemory(memory.id)}
                  className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-red-400 transition-all flex-shrink-0"
                >
                  <X size={14} />
                </button>
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ── Tab config ──────────────────────────────────────────

type Tab = 'chat' | 'memory' | 'simulator' | 'about'

const TABS: { id: Tab; icon: React.ElementType; label: string }[] = [
  { id: 'chat', icon: MessageCircle, label: 'Chat' },
  { id: 'memory', icon: Brain, label: 'Mémoire' },
  { id: 'simulator', icon: Calculator, label: 'Simulateur' },
  { id: 'about', icon: Info, label: 'À propos' },
]

// ── Main Page ───────────────────────────────────────────

export default function NovaPage() {
  const {
    messages,
    conversations,
    currentConversationId,
    isStreaming,
    status,
    suggestions,
    memoryStats,
    sendMessage,
    fetchSuggestions,
    fetchStatus,
    fetchConversations,
    fetchMemoryStats,
    loadConversation,
    deleteConversation,
    pinConversation,
    newConversation,
  } = useAdvisorStore()

  const [tab, setTab] = useState<Tab>('chat')
  const [input, setInput] = useState('')
  const [showSidebar, setShowSidebar] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load data on mount
  useEffect(() => {
    fetchSuggestions()
    fetchStatus()
    fetchMemoryStats()
  }, [fetchSuggestions, fetchStatus, fetchMemoryStats])

  // Auto-focus input when switching to chat tab
  useEffect(() => {
    if (tab === 'chat') {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [tab])

  const handleSend = useCallback(() => {
    const msg = input.trim()
    if (!msg || isStreaming) return
    setInput('')
    sendMessage(msg)
    if (inputRef.current) inputRef.current.style.height = 'auto'
  }, [input, isStreaming, sendMessage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const handleSuggestionClick = (text: string) => {
    if (isStreaming) return
    sendMessage(text)
  }

  const handleTextAreaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px'
    }
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] md:h-[calc(100vh-0px)] lg:h-screen flex flex-col overflow-hidden">
      {/* ── Top header ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex-shrink-0 border-b border-border"
        style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.04), rgba(6, 182, 212, 0.02))',
        }}
      >
        <div className="flex items-center justify-between px-3 sm:px-4 lg:px-6 py-2 sm:py-3">
          {/* Left: Nova branding */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <motion.div
              className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
                boxShadow: '0 0 20px rgba(139, 92, 246, 0.15)',
              }}
              whileHover={{ scale: 1.05 }}
            >
              <motion.div
                className="absolute inset-0 rounded-xl"
                style={{
                  background: 'conic-gradient(from 0deg, #8b5cf640, #06b6d440, #f59e0b40, #ec489940, #8b5cf640)',
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
              />
              <Sparkles size={18} className="text-violet-300 relative z-10" />
            </motion.div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                Nova
                <span className="hidden sm:inline text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                  v2.0 • Omniscient
                </span>
              </h1>
              <p className="text-[10px] sm:text-[11px] text-foreground-secondary truncate">
                {status?.available ? (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    Connecté | {status.rate_limit.remaining}/{status.rate_limit.limit} questions
                    {memoryStats ? ` • ${memoryStats.total} souvenirs` : ''}
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Mode aperçu
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Center: Tab navigation */}
          <div className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-surface border border-border">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200',
                  tab === t.id
                    ? 'bg-violet-500/15 text-violet-400 shadow-sm'
                    : 'text-foreground-secondary hover:text-foreground hover:bg-surface-elevated'
                )}
              >
                <t.icon size={14} />
                {t.label}
                {t.id === 'memory' && memoryStats && memoryStats.total > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400">
                    {memoryStats.total}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {tab === 'chat' && (
              <>
                <button
                  onClick={() => {
                    setShowSidebar(!showSidebar)
                    if (!showSidebar) fetchConversations()
                  }}
                  className={cn(
                    'p-2 rounded-lg transition-all duration-200',
                    showSidebar
                      ? 'bg-violet-500/15 text-violet-400'
                      : 'hover:bg-surface-elevated text-foreground-secondary'
                  )}
                  title="Historique des conversations"
                >
                  <Clock size={16} />
                </button>
                <button
                  onClick={() => {
                    newConversation()
                    setShowSidebar(false)
                  }}
                  className="p-2 rounded-lg hover:bg-surface-elevated text-foreground-secondary transition-all duration-200"
                  title="Nouvelle conversation"
                >
                  <Plus size={16} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mobile tabs */}
        <div className="flex md:hidden items-center gap-1 px-4 pb-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-medium transition-all duration-200',
                tab === t.id
                  ? 'bg-violet-500/15 text-violet-400'
                  : 'text-foreground-secondary hover:text-foreground'
              )}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── Content area ── */}
      <div className="flex-1 flex overflow-hidden">
        <AnimatePresence mode="wait">
          {tab === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex overflow-hidden"
            >
              {/* Conversation history sidebar */}
              <ConversationSidebar
                isOpen={showSidebar}
                conversations={conversations}
                currentId={currentConversationId}
                onLoad={(id) => {
                  loadConversation(id)
                  setShowSidebar(false)
                }}
                onDelete={deleteConversation}
                onPin={pinConversation}
                onNew={() => {
                  newConversation()
                  setShowSidebar(false)
                }}
              />

              {/* Chat area */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto">
                  {messages.length === 0 ? (
                    <WelcomeScreen
                      suggestions={suggestions}
                      onSuggestionClick={handleSuggestionClick}
                      isStreaming={isStreaming}
                      memoryCount={memoryStats?.total || 0}
                    />
                  ) : (
                    <div className="max-w-3xl mx-auto px-4 lg:px-6 py-6 space-y-5">
                      {messages.map((msg, idx) => (
                        <FullMessageBubble
                          key={msg.id}
                          role={msg.role}
                          content={msg.content}
                          isStreaming={msg.isStreaming}
                          index={idx}
                        />
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                {/* Input area */}
                <div
                  className="flex-shrink-0 border-t border-border px-3 sm:px-4 lg:px-6 py-2 sm:py-3"
                  style={{
                    background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.02), transparent)',
                  }}
                >
                  <div className="max-w-3xl mx-auto">
                    <div
                      className={cn(
                        'flex items-end gap-2 sm:gap-3 rounded-2xl border bg-surface-elevated px-3 sm:px-4 py-2 sm:py-3',
                        'border-border focus-within:border-violet-500/40 focus-within:ring-2 focus-within:ring-violet-500/10',
                        'transition-all duration-300 shadow-sm',
                        isStreaming && 'opacity-70'
                      )}
                    >
                      <div className="flex-shrink-0 pb-0.5">
                        <Zap size={16} className="text-violet-400" />
                      </div>
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={handleTextAreaInput}
                        onKeyDown={handleKeyDown}
                        placeholder="Posez votre question à Nova..."
                        disabled={isStreaming}
                        rows={1}
                        className={cn(
                          'flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground-secondary/40',
                          'outline-none resize-none min-h-[24px] max-h-[120px] disabled:opacity-50',
                          'leading-relaxed'
                        )}
                      />
                      <div className="flex items-center gap-1 flex-shrink-0 pb-0.5">
                        <motion.button
                          onClick={handleSend}
                          disabled={!input.trim() || isStreaming}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className={cn(
                            'p-2 rounded-xl transition-all duration-200',
                            input.trim() && !isStreaming
                              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30'
                              : 'text-foreground-secondary/30'
                          )}
                        >
                          {isStreaming ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Send size={16} />
                          )}
                        </motion.button>
                      </div>
                    </div>
                    <p className="text-[10px] text-foreground-secondary/40 text-center mt-2">
                      Nova peut faire des erreurs. Vérifiez les informations importantes.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {tab === 'memory' && (
            <motion.div
              key="memory"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex-1 overflow-y-auto"
            >
              <MemoryPanel />
            </motion.div>
          )}

          {tab === 'simulator' && (
            <motion.div
              key="simulator"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex-1 overflow-y-auto p-4 lg:p-6"
            >
              <div className="max-w-5xl mx-auto">
                <InvestmentSimulator />
              </div>
            </motion.div>
          )}

          {tab === 'about' && (
            <motion.div
              key="about"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex-1 overflow-y-auto p-4 lg:p-6"
            >
              <div className="max-w-2xl mx-auto">
                <NovaAbout />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── About section ───────────────────────────────────────

function NovaAbout() {
  const features = [
    {
      icon: Brain,
      title: 'Contexte omniscient',
      description: 'Nova accède à la totalité de vos données : 26 sources incluant comptes, investissements, crypto, immobilier, dettes, fiscalité, retraite, patrimoine et plus.',
      gradient: 'from-violet-500/10 to-indigo-500/10',
      iconColor: 'text-violet-400',
    },
    {
      icon: Database,
      title: 'Mémoire persistante',
      description: 'Nova se souvient de vos préférences, objectifs et faits importants d\'une conversation à l\'autre. Elle apprend au fil du temps.',
      gradient: 'from-cyan-500/10 to-teal-500/10',
      iconColor: 'text-cyan-400',
    },
    {
      icon: ShieldAlert,
      title: 'Détection d\'anomalies',
      description: 'Identification proactive des transactions inhabituelles, prélèvements suspects et risques de découvert.',
      gradient: 'from-amber-500/10 to-orange-500/10',
      iconColor: 'text-amber-400',
    },
    {
      icon: Target,
      title: 'Suggestions dynamiques',
      description: 'Les questions suggérées s\'adaptent à votre situation réelle : budgets en alerte, investissements, événements à venir.',
      gradient: 'from-emerald-500/10 to-green-500/10',
      iconColor: 'text-emerald-400',
    },
    {
      icon: Sparkles,
      title: 'Titrage automatique',
      description: 'Chaque conversation reçoit un titre intelligent généré par l\'IA, pour retrouver facilement vos échanges.',
      gradient: 'from-pink-500/10 to-rose-500/10',
      iconColor: 'text-pink-400',
    },
    {
      icon: Calculator,
      title: 'Simulations Monte-Carlo',
      description: '1000 trajectoires simulées avec distributions log-normales pour modéliser l\'incertitude des marchés.',
      gradient: 'from-blue-500/10 to-indigo-500/10',
      iconColor: 'text-blue-400',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <NovaOrb size={80} pulse />
        <h2 className="text-2xl font-bold text-foreground mt-4">Nova v2.0</h2>
        <p className="text-sm text-foreground-secondary mt-2 max-w-md mx-auto">
          Intelligence financière omnisciente de nouvelle génération, avec mémoire
          persistante et accès complet à toutes vos données patrimoniales.
        </p>
      </motion.div>

      {/* Features */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {features.map((feat, i) => (
          <motion.div
            key={feat.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08 }}
            className={cn(
              'p-5 rounded-2xl border border-border',
              `bg-gradient-to-br ${feat.gradient}`
            )}
          >
            <feat.icon size={24} className={feat.iconColor} />
            <h3 className="text-sm font-semibold text-foreground mt-3">{feat.title}</h3>
            <p className="text-xs text-foreground-secondary mt-1.5 leading-relaxed">
              {feat.description}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Data sources */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="p-4 rounded-xl bg-surface border border-border"
      >
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
          <Database size={14} className="text-violet-400" />
          26 sources de données
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {[
            'Comptes bancaires', 'Transactions', 'Budgets', 'Abonnements',
            'Portefeuilles bourse', 'Wallets crypto', 'Biens immobiliers',
            'Dettes & crédits', 'Profil fiscal', 'Retraite', 'Patrimoine',
            'Frais bancaires', 'Projets & objectifs', 'Calendrier financier',
            'Alertes', 'Watchlists', 'Coffre-fort numérique',
            'Actifs tangibles', 'NFTs', 'Programmes fidélité', 'Cartes',
            'Dettes P2P', 'Dividendes', 'Autopilot', 'Profil ménage', 'Souvenirs Nova',
          ].map((src) => (
            <span
              key={src}
              className="px-2 py-0.5 rounded-md bg-violet-500/5 border border-violet-500/10 text-[10px] text-foreground-secondary"
            >
              {src}
            </span>
          ))}
        </div>
      </motion.div>

      {/* Privacy notice */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex items-start gap-3 p-4 rounded-xl bg-surface border border-border"
      >
        <ShieldAlert size={18} className="text-green-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground">Confidentialité</p>
          <p className="text-xs text-foreground-secondary mt-1 leading-relaxed">
            Nova respecte rigoureusement vos données. Aucune donnée n&apos;est partagée
            avec des tiers. Les clés API et souvenirs sont stockés localement sur votre instance.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
