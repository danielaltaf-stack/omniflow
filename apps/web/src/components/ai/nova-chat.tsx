'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Send,
  Sparkles,
  MessageSquare,
  Trash2,
  Plus,
  ChevronDown,
  Zap,
  Loader2,
  Maximize2,
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
  Pin,
  AlertTriangle,
  Repeat,
  CreditCard,
  Receipt,
  Sunset,
  Landmark,
  Calendar,
  Scissors,
  Brain,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAdvisorStore } from '@/stores/advisor-store'
import { cn } from '@/lib/utils'

// ── Icon mapping for suggestions ────────────────────────

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

function SuggestionIcon({ name, size = 14 }: { name: string; size?: number }) {
  const Icon = SUGGESTION_ICONS[name] || Zap
  return <Icon size={size} />
}

// ── Nova orb animation particles ────────────────────────

function NovaOrb({ size = 56, pulse = false }: { size?: number; pulse?: boolean }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Outer glow rings */}
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
      {/* Inner orb */}
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
    <div className="flex items-center gap-1 px-3 py-2">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-violet-400"
          animate={{
            y: [0, -4, 0],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

// ── Message bubble ──────────────────────────────────────

function MessageBubble({
  role,
  content,
  isStreaming,
}: {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}) {
  const isUser = role === 'user'

  const renderContent = (text: string) => {
    if (isUser) return <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{text}</p>

    const lines = text.split('\n')
    const elements: JSX.Element[] = []

    lines.forEach((line, i) => {
      if (line.startsWith('# ')) {
        elements.push(
          <h3 key={i} className="text-base font-bold mt-3 mb-1 first:mt-0 text-foreground">
            {line.slice(2)}
          </h3>
        )
      } else if (line.startsWith('## ')) {
        elements.push(
          <h4 key={i} className="text-sm font-semibold mt-2.5 mb-1 text-foreground">
            {line.slice(3)}
          </h4>
        )
      } else if (line.startsWith('### ')) {
        elements.push(
          <h5 key={i} className="text-[13px] font-semibold mt-2 mb-0.5 text-foreground">
            {line.slice(4)}
          </h5>
        )
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        elements.push(
          <li key={i} className="text-[13px] leading-relaxed ml-3 list-disc text-foreground-secondary">
            {renderInline(line.slice(2))}
          </li>
        )
      } else if (line.startsWith('---')) {
        elements.push(<hr key={i} className="my-2 border-border" />)
      } else if (line.trim() === '') {
        elements.push(<div key={i} className="h-1.5" />)
      } else {
        elements.push(
          <p key={i} className="text-[13px] leading-relaxed text-foreground-secondary">
            {renderInline(line)}
          </p>
        )
      }
    })

    return <div className="space-y-0.5">{elements}</div>
  }

  const renderInline = (text: string) => {
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
          <code key={i} className="px-1 py-0.5 rounded bg-surface-elevated text-[12px] font-mono text-violet-400">
            {part.slice(1, -1)}
          </code>
        )
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn(
        'flex gap-2 max-w-full',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="flex-shrink-0 mt-0.5">
          <div className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
            }}
          >
            <Bot size={12} className="text-white" />
          </div>
        </div>
      )}

      <div
        className={cn(
          'rounded-2xl px-3.5 py-2.5 max-w-[85%]',
          isUser
            ? 'bg-violet-600 text-white rounded-tr-sm'
            : 'bg-surface-elevated border border-border rounded-tl-sm'
        )}
      >
        {renderContent(content)}
        {isStreaming && !content && <TypingIndicator />}
        {isStreaming && content && (
          <motion.span
            className="inline-block w-1.5 h-4 bg-violet-400 ml-0.5 rounded-full"
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.6, repeat: Infinity }}
          />
        )}
      </div>
    </motion.div>
  )
}

// ── Main Nova Chat Widget ───────────────────────────────

export function NovaChatWidget() {
  const router = useRouter()
  const {
    messages,
    conversations,
    isStreaming,
    isChatOpen,
    status,
    suggestions,
    toggleChat,
    closeChat,
    sendMessage,
    fetchSuggestions,
    fetchStatus,
    fetchConversations,
    loadConversation,
    deleteConversation,
    pinConversation,
    newConversation,
  } = useAdvisorStore()

  const [input, setInput] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when chat opens
  useEffect(() => {
    if (isChatOpen) {
      fetchSuggestions()
      fetchStatus()
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isChatOpen, fetchSuggestions, fetchStatus])

  const handleSend = useCallback(() => {
    const msg = input.trim()
    if (!msg || isStreaming) return
    setInput('')
    sendMessage(msg)
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

  const navigateToFullPage = () => {
    closeChat()
    router.push('/nova')
  }

  return (
    <>
      {/* Floating bubble button */}
      <AnimatePresence>
        {!isChatOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-50 flex flex-col items-end gap-2"
          >
            {/* Tooltip label */}
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5, duration: 0.3 }}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-border shadow-lg text-[11px] text-foreground-secondary"
            >
              <Sparkles size={11} className="text-violet-400" />
              <span>Demandez à Nova</span>
            </motion.div>
            {/* Orb button */}
            <motion.button
              onClick={toggleChat}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              className="relative"
              aria-label="Ouvrir Nova"
            >
              <NovaOrb size={52} pulse />
              {/* Notification dot */}
              <motion.div
                className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-violet-500 border-2 border-background"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={cn(
              'fixed z-50 flex flex-col bg-background border border-border shadow-2xl',
              'inset-0 lg:inset-auto',
              'lg:bottom-6 lg:right-6 lg:w-[420px] lg:h-[600px] lg:max-h-[80vh]',
              'lg:rounded-2xl overflow-hidden'
            )}
            style={{
              boxShadow: '0 0 40px rgba(139, 92, 246, 0.1), 0 25px 50px rgba(0, 0, 0, 0.3)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b border-border"
              style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(6, 182, 212, 0.05))',
              }}
            >
              <div className="flex items-center gap-3">
                <NovaOrb size={32} />
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    Nova
                    <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                      AI
                    </span>
                  </h3>
                  <p className="text-[11px] text-foreground-secondary">
                    {status?.available ? (
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        Connecté | {status.rate_limit.remaining} restantes
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
              <div className="flex items-center gap-1">
                {/* Open full page button */}
                <button
                  onClick={navigateToFullPage}
                  className="p-1.5 rounded-lg hover:bg-violet-500/10 text-foreground-secondary hover:text-violet-400 transition-colors"
                  title="Ouvrir en plein écran"
                >
                  <Maximize2 size={16} />
                </button>
                <button
                  onClick={() => {
                    setShowHistory(!showHistory)
                    if (!showHistory) fetchConversations()
                  }}
                  className="p-1.5 rounded-lg hover:bg-surface-elevated text-foreground-secondary transition-colors"
                  title="Historique"
                >
                  <MessageSquare size={16} />
                </button>
                <button
                  onClick={() => {
                    newConversation()
                    setShowHistory(false)
                  }}
                  className="p-1.5 rounded-lg hover:bg-surface-elevated text-foreground-secondary transition-colors"
                  title="Nouvelle conversation"
                >
                  <Plus size={16} />
                </button>
                <button
                  onClick={closeChat}
                  className="p-1.5 rounded-lg hover:bg-surface-elevated text-foreground-secondary transition-colors"
                  title="Fermer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* History sidebar (slide panel) */}
            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border-b border-border overflow-hidden"
                >
                  <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                    {conversations.length === 0 ? (
                      <p className="text-[12px] text-foreground-secondary text-center py-3">
                        Aucune conversation
                      </p>
                    ) : (
                      conversations.map((conv) => (
                        <div
                          key={conv.id}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-surface-elevated cursor-pointer group transition-colors"
                          onClick={() => {
                            loadConversation(conv.id)
                            setShowHistory(false)
                          }}
                        >
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            {conv.is_pinned && (
                              <Pin size={10} className="text-violet-400 flex-shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-[12px] font-medium text-foreground truncate">
                                {conv.title}
                              </p>
                              <p className="text-[10px] text-foreground-secondary">
                                {conv.message_count} messages
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                pinConversation(conv.id)
                              }}
                              className={cn(
                                'p-1 rounded transition-all',
                                conv.is_pinned
                                  ? 'text-violet-400 opacity-100'
                                  : 'opacity-0 group-hover:opacity-100 text-foreground-secondary hover:text-violet-400'
                              )}
                            >
                              <Pin size={10} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteConversation(conv.id)
                              }}
                              className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-red-400 transition-all"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-full py-6 overflow-y-auto">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.1 }}
                  >
                    <NovaOrb size={56} pulse />
                  </motion.div>
                  <motion.h3
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mt-4 text-base font-semibold text-foreground"
                  >
                    Bonjour, je suis Nova
                  </motion.h3>
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-1 text-[13px] text-foreground-secondary text-center max-w-[260px]"
                  >
                    Votre conseiller financier omniscient. Je connais toutes vos données et je m&apos;en souviens.
                  </motion.p>

                  {/* Full page link */}
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    onClick={navigateToFullPage}
                    className={cn(
                      'mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium',
                      'text-violet-400 bg-violet-500/10 border border-violet-500/20',
                      'hover:bg-violet-500/20 transition-all duration-200'
                    )}
                  >
                    <Maximize2 size={12} />
                    Ouvrir en plein écran
                  </motion.button>

                  {/* Suggestion chips */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="mt-5 grid grid-cols-1 gap-1.5 w-full max-w-[320px]"
                  >
                    {suggestions.slice(0, 4).map((s, i) => (
                      <motion.button
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + i * 0.08 }}
                        onClick={() => handleSuggestionClick(s.text)}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-xl text-left',
                          'bg-surface-elevated border border-border',
                          'hover:border-violet-500/30 hover:bg-violet-500/5',
                          'transition-all duration-200 group'
                        )}
                      >
                        <div className="w-6 h-6 rounded-md bg-violet-500/10 flex items-center justify-center flex-shrink-0 text-violet-400 group-hover:bg-violet-500/20 transition-colors">
                          <SuggestionIcon name={s.icon} size={13} />
                        </div>
                        <span className="text-[12px] text-foreground-secondary group-hover:text-foreground transition-colors line-clamp-2">
                          {s.text}
                        </span>
                      </motion.button>
                    ))}
                  </motion.div>
                </div>
              ) : (
                messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    isStreaming={msg.isStreaming}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-border px-3 py-2">
              <div
                className={cn(
                  'flex items-center gap-2 rounded-xl border border-border bg-surface-elevated px-2.5 py-1.5',
                  'focus-within:border-violet-500/50 focus-within:ring-1 focus-within:ring-violet-500/20',
                  'transition-all duration-200'
                )}
              >
                <Zap size={13} className="text-violet-400 flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Demandez à Nova..."
                  disabled={isStreaming}
                  className={cn(
                    'flex-1 bg-transparent text-[13px] text-foreground placeholder:text-foreground-secondary/50',
                    'outline-none disabled:opacity-50'
                  )}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming}
                  className={cn(
                    'p-1 rounded-lg transition-all duration-200',
                    input.trim() && !isStreaming
                      ? 'bg-violet-600 text-white hover:bg-violet-500 scale-100'
                      : 'text-foreground-secondary/30 scale-95'
                  )}
                >
                  {isStreaming ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Send size={13} />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
