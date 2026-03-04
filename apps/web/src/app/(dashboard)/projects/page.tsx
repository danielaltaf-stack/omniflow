'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target,
  Plus,
  Trash2,
  Pause,
  Play,
  Archive,
  Calendar,
  TrendingUp,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatAmount } from '@/lib/format'
import { useAuthStore } from '@/stores/auth-store'
import { useProjectStore } from '@/stores/project-store'
import type { ProjectBudget } from '@/types/api'

const PROJECT_ICONS = [
  { name: 'target', icon: Target, label: 'Objectif' },
  { name: 'home', icon: Target, label: 'Maison' },
  { name: 'plane', icon: Target, label: 'Voyage' },
  { name: 'car', icon: Target, label: 'Voiture' },
  { name: 'graduation-cap', icon: Target, label: 'Études' },
  { name: 'gift', icon: Target, label: 'Cadeau' },
]

const PROJECT_COLORS = [
  '#6366f1', '#3b82f6', '#06b6d4', '#14b8a6', '#10b981',
  '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#8b5cf6',
]

export default function ProjectsPage() {
  const { isAuthenticated } = useAuthStore()
  const {
    projects, isLoading, fetchProjects,
    createProject, updateProject, deleteProject,
    archiveProject, addContribution,
  } = useProjectStore()

  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [contributionProjectId, setContributionProjectId] = useState<string | null>(null)
  const [contributionAmount, setContributionAmount] = useState('')
  const [contributionNote, setContributionNote] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  // Create form state
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newTarget, setNewTarget] = useState('')
  const [newDeadline, setNewDeadline] = useState('')
  const [newColor, setNewColor] = useState('#6366f1')
  const [newIcon, setNewIcon] = useState('target')

  useEffect(() => {
    if (isAuthenticated) {
      fetchProjects(showArchived)
    }
  }, [isAuthenticated, showArchived])

  const activeProjects = useMemo(
    () => projects.filter(p => p.status === 'active'),
    [projects]
  )
  const completedProjects = useMemo(
    () => projects.filter(p => p.status === 'completed'),
    [projects]
  )
  const otherProjects = useMemo(
    () => projects.filter(p => !['active', 'completed'].includes(p.status)),
    [projects]
  )

  const totalTarget = projects.reduce((s, p) => s + p.target_amount, 0)
  const totalSaved = projects.reduce((s, p) => s + p.current_amount, 0)
  const globalProgress = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0

  const handleCreate = async () => {
    if (!newName.trim() || !newTarget) return
    const targetCentimes = Math.round(parseFloat(newTarget) * 100)
    if (isNaN(targetCentimes) || targetCentimes <= 0) return

    await createProject({
      name: newName.trim(),
      description: newDescription.trim() || undefined,
      icon: newIcon,
      color: newColor,
      target_amount: targetCentimes,
      deadline: newDeadline || undefined,
    })

    setNewName('')
    setNewDescription('')
    setNewTarget('')
    setNewDeadline('')
    setNewColor('#6366f1')
    setNewIcon('target')
    setShowCreate(false)
  }

  const handleContribution = async (projectId: string) => {
    if (!contributionAmount) return
    const amountCentimes = Math.round(parseFloat(contributionAmount) * 100)
    if (isNaN(amountCentimes) || amountCentimes === 0) return

    await addContribution(projectId, {
      amount: amountCentimes,
      date: new Date().toISOString().split('T')[0] ?? '',
      note: contributionNote.trim() || undefined,
    })

    setContributionAmount('')
    setContributionNote('')
    setContributionProjectId(null)
  }

  return (
    <div className="mx-auto max-w-5xl px-3 sm:px-5 py-4 sm:py-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div>
          <h1 className="text-xl font-bold text-foreground">Projets d&apos;épargne</h1>
          <p className="text-sm text-foreground-secondary mt-1">
            Définissez des objectifs et suivez votre progression.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              showArchived
                ? 'bg-brand text-white'
                : 'bg-surface border border-border text-foreground-secondary hover:text-foreground'
            }`}
          >
            <Archive className="h-3 w-3 inline mr-1" />
            Archivés
          </button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Nouveau projet
          </Button>
        </div>
      </motion.div>

      {/* Global stats */}
      {!isLoading && projects.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mt-5 grid gap-2.5 grid-cols-2 sm:grid-cols-4"
        >
          <MiniCard
            label="Projets actifs"
            value={String(activeProjects.length)}
            icon={Target}
            color="text-brand"
          />
          <MiniCard
            label="Total épargné"
            value={formatAmount(totalSaved)}
            icon={DollarSign}
            color="text-gain"
          />
          <MiniCard
            label="Objectif total"
            value={formatAmount(totalTarget)}
            icon={TrendingUp}
            color="text-foreground"
          />
          <MiniCard
            label="Progression"
            value={`${globalProgress}%`}
            icon={CheckCircle2}
            color="text-brand"
          />
        </motion.div>
      )}

      {/* Create form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-5 rounded-omni-lg border border-brand/20 bg-background-tertiary p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-foreground">Nouveau projet</h3>
                <button onClick={() => setShowCreate(false)} className="text-foreground-tertiary hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-foreground-secondary mb-1.5 block">Nom du projet</label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="ex: Vacances été 2026, Apport maison..."
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-foreground-secondary mb-1.5 block">Description (optionnel)</label>
                  <Input
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Notes, détails..."
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground-secondary mb-1.5 block">Objectif (€)</label>
                  <Input
                    type="number"
                    value={newTarget}
                    onChange={(e) => setNewTarget(e.target.value)}
                    placeholder="5000"
                    min="1"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground-secondary mb-1.5 block">Échéance (optionnel)</label>
                  <Input
                    type="date"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-foreground-secondary mb-1.5 block">Couleur</label>
                  <div className="flex gap-2 flex-wrap">
                    {PROJECT_COLORS.map(color => (
                      <button
                        key={color}
                        onClick={() => setNewColor(color)}
                        className={`h-7 w-7 rounded-full transition-all ${
                          newColor === color ? 'ring-2 ring-offset-2 ring-brand ring-offset-background-tertiary' : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <Button onClick={handleCreate} disabled={!newName.trim() || !newTarget}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Créer le projet
                </Button>
                <Button variant="ghost" onClick={() => setShowCreate(false)}>
                  Annuler
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading state */}
      {isLoading ? (
        <div className="mt-5 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-omni-lg border border-border bg-background-tertiary p-5">
              <Skeleton className="h-5 w-40 mb-3" />
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        /* Empty state */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-16 flex flex-col items-center text-center py-16"
        >
          <div className="h-16 w-16 rounded-full bg-brand/10 flex items-center justify-center">
            <Target className="h-8 w-8 text-brand" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-foreground">Aucun projet</h2>
          <p className="mt-2 text-sm text-foreground-secondary max-w-md">
            Créez votre premier projet d&apos;épargne pour suivre vos objectifs financiers.
          </p>
          <Button size="sm" className="mt-4" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Créer un projet
          </Button>
        </motion.div>
      ) : (
        <div className="mt-5 space-y-3">
          {/* Active Projects */}
          {activeProjects.length > 0 && (
            <div className="space-y-3">
              {activeProjects.map((project, i) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  index={i}
                  expanded={expandedId === project.id}
                  onToggle={() => setExpandedId(expandedId === project.id ? null : project.id)}
                  onPause={() => updateProject(project.id, { status: 'paused' })}
                  onArchive={() => archiveProject(project.id)}
                  onDelete={() => deleteProject(project.id)}
                  showContribution={contributionProjectId === project.id}
                  onToggleContribution={() =>
                    setContributionProjectId(contributionProjectId === project.id ? null : project.id)
                  }
                  contributionAmount={contributionAmount}
                  onContributionAmountChange={setContributionAmount}
                  contributionNote={contributionNote}
                  onContributionNoteChange={setContributionNote}
                  onSubmitContribution={() => handleContribution(project.id)}
                />
              ))}
            </div>
          )}

          {/* Completed Projects */}
          {completedProjects.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-foreground-secondary mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-gain" />
                Terminés ({completedProjects.length})
              </h3>
              <div className="space-y-3">
                {completedProjects.map((project, i) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    index={i}
                    expanded={expandedId === project.id}
                    onToggle={() => setExpandedId(expandedId === project.id ? null : project.id)}
                    onArchive={() => archiveProject(project.id)}
                    onDelete={() => deleteProject(project.id)}
                    completed
                  />
                ))}
              </div>
            </div>
          )}

          {/* Other (paused, cancelled) */}
          {otherProjects.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-foreground-secondary mb-3 flex items-center gap-2">
                <Pause className="h-4 w-4" />
                En pause / Annulés ({otherProjects.length})
              </h3>
              <div className="space-y-3">
                {otherProjects.map((project, i) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    index={i}
                    expanded={expandedId === project.id}
                    onToggle={() => setExpandedId(expandedId === project.id ? null : project.id)}
                    onResume={() => updateProject(project.id, { status: 'active' })}
                    onDelete={() => deleteProject(project.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Project Card ─────────────────────────────────────────

interface ProjectCardProps {
  project: ProjectBudget
  index: number
  expanded: boolean
  onToggle: () => void
  onPause?: () => void
  onResume?: () => void
  onArchive?: () => void
  onDelete: () => void
  completed?: boolean
  showContribution?: boolean
  onToggleContribution?: () => void
  contributionAmount?: string
  onContributionAmountChange?: (v: string) => void
  contributionNote?: string
  onContributionNoteChange?: (v: string) => void
  onSubmitContribution?: () => void
}

function ProjectCard({
  project,
  index,
  expanded,
  onToggle,
  onPause,
  onResume,
  onArchive,
  onDelete,
  completed,
  showContribution,
  onToggleContribution,
  contributionAmount,
  onContributionAmountChange,
  contributionNote,
  onContributionNoteChange,
  onSubmitContribution,
}: ProjectCardProps) {
  const remaining = Math.max(0, project.target_amount - project.current_amount)
  const progressClamp = Math.min(100, project.progress_pct)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`rounded-omni-lg border bg-background-tertiary overflow-hidden ${
        completed ? 'border-gain/30' : 'border-border'
      }`}
    >
      {/* Main row */}
      <div
        className="p-4 sm:p-5 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: project.color + '20' }}
            >
              <Target className="h-5 w-5" style={{ color: project.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                {project.name}
                {completed && (
                  <CheckCircle2 className="h-4 w-4 text-gain inline ml-2" />
                )}
              </p>
              <p className="text-xs text-foreground-tertiary">
                {formatAmount(project.current_amount)} / {formatAmount(project.target_amount)}
                {project.deadline && (
                  <span className="ml-2">
                    <Calendar className="h-3 w-3 inline mr-0.5" />
                    {new Date(project.deadline).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-sm font-bold tabular-nums" style={{ color: project.color }}>
              {project.progress_pct.toFixed(0)}%
            </span>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-foreground-tertiary" />
            ) : (
              <ChevronDown className="h-4 w-4 text-foreground-tertiary" />
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-2.5 rounded-full bg-surface overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressClamp}%` }}
            transition={{ delay: 0.1 + index * 0.04, duration: 0.6, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ backgroundColor: project.color }}
          />
        </div>

        {/* Quick info row */}
        {project.monthly_target && project.status === 'active' && (
          <p className="mt-2 text-xs text-foreground-tertiary">
            <TrendingUp className="h-3 w-3 inline mr-0.5" />
            {formatAmount(project.monthly_target)}/mois recommandé
            {remaining > 0 && (
              <span className="ml-2">· Reste {formatAmount(remaining)}</span>
            )}
          </p>
        )}
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-border pt-4 space-y-4">
              {/* Description */}
              {project.description && (
                <p className="text-sm text-foreground-secondary">{project.description}</p>
              )}

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="text-center p-2.5 rounded-omni-sm bg-surface">
                  <p className="text-lg font-bold text-foreground tabular-nums">
                    {formatAmount(project.current_amount)}
                  </p>
                  <p className="text-xs text-foreground-tertiary">Épargné</p>
                </div>
                <div className="text-center p-2.5 rounded-omni-sm bg-surface">
                  <p className="text-lg font-bold text-foreground tabular-nums">
                    {formatAmount(remaining)}
                  </p>
                  <p className="text-xs text-foreground-tertiary">Restant</p>
                </div>
                <div className="text-center p-2.5 rounded-omni-sm bg-surface">
                  <p className="text-lg font-bold text-foreground tabular-nums">
                    {project.monthly_target ? formatAmount(project.monthly_target) : '—'}
                  </p>
                  <p className="text-xs text-foreground-tertiary">Mensuel cible</p>
                </div>
                <div className="text-center p-2.5 rounded-omni-sm bg-surface">
                  <p className="text-lg font-bold text-foreground tabular-nums">
                    {project.contributions_count}
                  </p>
                  <p className="text-xs text-foreground-tertiary">Contributions</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {project.status === 'active' && (
                  <>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleContribution?.()
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Ajouter une contribution
                    </Button>
                    {onPause && (
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onPause() }}>
                        <Pause className="h-3.5 w-3.5 mr-1" />
                        Pause
                      </Button>
                    )}
                  </>
                )}
                {onResume && (
                  <Button size="sm" onClick={(e) => { e.stopPropagation(); onResume() }}>
                    <Play className="h-3.5 w-3.5 mr-1" />
                    Reprendre
                  </Button>
                )}
                {onArchive && (
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onArchive() }}>
                    <Archive className="h-3.5 w-3.5 mr-1" />
                    Archiver
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onDelete() }}
                  className="text-loss hover:text-loss"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Supprimer
                </Button>
              </div>

              {/* Contribution form */}
              {showContribution && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-omni-sm border border-brand/20 bg-brand/5"
                >
                  <p className="text-xs font-medium text-foreground mb-2">Nouvelle contribution</p>
                  <div className="flex gap-2 flex-col sm:flex-row">
                    <Input
                      type="number"
                      value={contributionAmount}
                      onChange={(e) => onContributionAmountChange?.(e.target.value)}
                      placeholder="Montant (€)"
                      className="sm:w-32"
                      step="0.01"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Input
                      value={contributionNote}
                      onChange={(e) => onContributionNoteChange?.(e.target.value)}
                      placeholder="Note (optionnel)"
                      className="flex-1"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSubmitContribution?.()
                      }}
                      disabled={!contributionAmount}
                    >
                      Ajouter
                    </Button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Mini Card ─────────────────────────────────────────────

function MiniCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="rounded-omni-lg border border-border bg-background-tertiary p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-xs text-foreground-secondary">{label}</span>
      </div>
      <p className={`text-base sm:text-lg font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}
