'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User,
  Link2,
  Shield,
  Palette,
  Trash2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  XCircle,
  LogOut,
  Moon,
  Sun,
  ChevronRight,
  Users,
  Plus,
  LinkIcon,
  Unlink,
  UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth-store'
import { useBankStore } from '@/stores/bank-store'
import { useCryptoStore } from '@/stores/crypto-store'
import { useStockStore } from '@/stores/stock-store'
import { useRealEstateStore } from '@/stores/realestate-store'
import { useProfileStore } from '@/stores/profile-store'
import { useSettingsStore } from '@/stores/settings-store'
import { formatAmount } from '@/lib/format'
import { useTheme } from 'next-themes'
import { RGPDSection } from '@/components/settings/rgpd-section'
import { ConsentSection } from '@/components/settings/consent-section'
import { AuditSection } from '@/components/settings/audit-section'
import { AboutSection } from '@/components/settings/about-section'
import type { Profile } from '@/types/api'

type SettingsSection = 'profile' | 'profiles' | 'connections' | 'preferences' | 'security' | 'rgpd' | 'consent' | 'audit' | 'about' | 'danger'

const SECTIONS = [
  { id: 'profile' as const, label: 'Profil', icon: User },
  { id: 'profiles' as const, label: 'Profils & Comptes', icon: Users },
  { id: 'connections' as const, label: 'Connexions', icon: Link2 },
  { id: 'preferences' as const, label: 'Pr\u00e9f\u00e9rences', icon: Palette },
  { id: 'security' as const, label: 'S\u00e9curit\u00e9', icon: Shield },
  { id: 'rgpd' as const, label: 'Mes donn\u00e9es', icon: Shield },
  { id: 'consent' as const, label: 'Consentements', icon: Shield },
  { id: 'audit' as const, label: 'Journal', icon: Shield },
  { id: 'about' as const, label: '\u00c0 propos', icon: Shield },
  { id: 'danger' as const, label: 'Zone dangereuse', icon: Trash2 },
]

const PROFILE_TYPES = [
  { value: 'personal', label: 'Personnel', color: '#6366f1' },
  { value: 'partner', label: 'Conjoint(e)', color: '#ec4899' },
  { value: 'child', label: 'Enfant', color: '#f59e0b' },
  { value: 'other', label: 'Autre', color: '#14b8a6' },
]

const AVATAR_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#14b8a6', '#3b82f6',
  '#ef4444', '#8b5cf6', '#10b981', '#f97316', '#06b6d4',
]

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const { user, logout } = useAuthStore()
  const { connections, accounts, syncConnection, deleteConnection } = useBankStore()
  const { portfolio: cryptoPortfolio } = useCryptoStore()
  const { summary: stockSummary } = useStockStore()
  const { summary: realestateSummary } = useRealEstateStore()
  const {
    profiles, jointAccounts, isLoading: profilesLoading,
    fetchProfiles, createProfile, updateProfile, deleteProfile,
    linkAccount, unlinkAccount, fetchJointAccounts,
  } = useProfileStore()
  const { theme, setTheme } = useTheme()

  // Profile form state
  const [showNewProfile, setShowNewProfile] = useState(false)
  const [newProfileName, setNewProfileName] = useState('')
  const [newProfileType, setNewProfileType] = useState('partner')
  const [newProfileColor, setNewProfileColor] = useState('#ec4899')
  const [linkingProfileId, setLinkingProfileId] = useState<string | null>(null)

  useEffect(() => {
    fetchProfiles()
    fetchJointAccounts()
  }, [])

  const statusConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    active: { icon: CheckCircle, color: 'text-gain', label: 'Actif' },
    syncing: { icon: RefreshCw, color: 'text-brand', label: 'Synchronisation...' },
    error: { icon: XCircle, color: 'text-loss', label: 'Erreur' },
    sca_required: { icon: AlertCircle, color: 'text-warning', label: 'Validation requise' },
  }

  return (
    <div className="mx-auto max-w-5xl px-3 sm:px-5 py-4 sm:py-5">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-xl font-bold text-foreground">Réglages</h1>
        <p className="text-sm text-foreground-secondary mt-1">
          Gérez votre profil, connexions et préférences.
        </p>
      </motion.div>

      <div className="mt-5 flex flex-col md:flex-row gap-5">
        {/* Sidebar navigation */}
        <nav className="md:w-56 flex-shrink-0">
          <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            {SECTIONS.map((section) => {
              const Icon = section.icon
              const isActive = activeSection === section.id
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`
                    flex items-center gap-2.5 px-3 py-2.5 rounded-omni-sm text-sm font-medium
                    whitespace-nowrap transition-all duration-150 relative
                    ${isActive
                      ? 'bg-brand/10 text-brand'
                      : 'text-foreground-secondary hover:text-foreground hover:bg-surface-elevated'
                    }
                    ${section.id === 'danger' ? 'md:mt-4' : ''}
                  `}
                >
                  <Icon size={16} className={section.id === 'danger' && !isActive ? 'text-loss' : ''} />
                  <span>{section.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="settings-active"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-brand rounded-r-full hidden md:block"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </nav>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {/* ── Profile Section ──────────────────── */}
              {activeSection === 'profile' && (
                <div className="space-y-6">
                  <SectionCard title="Informations personnelles">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="h-16 w-16 rounded-full bg-brand/20 flex items-center justify-center text-brand font-bold text-2xl">
                        {user?.name?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-foreground">{user?.name}</p>
                        <p className="text-sm text-foreground-secondary">{user?.email}</p>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-sm font-medium text-foreground-secondary mb-1.5 block">Nom</label>
                        <Input value={user?.name || ''} disabled className="bg-surface" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground-secondary mb-1.5 block">Email</label>
                        <Input value={user?.email || ''} disabled className="bg-surface" />
                      </div>
                    </div>
                    <p className="text-xs text-foreground-tertiary mt-3">
                      La modification du profil sera disponible dans une prochaine mise à jour.
                    </p>
                  </SectionCard>

                  <SectionCard title="Statistiques du compte">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <MiniStat label="Connexions bancaires" value={String(connections.length)} />
                      <MiniStat label="Wallets crypto" value={String(cryptoPortfolio?.wallets.length ?? 0)} />
                      <MiniStat label="Positions bourse" value={String(stockSummary?.positions.length ?? 0)} />
                      <MiniStat label="Biens immobiliers" value={String(realestateSummary?.properties_count ?? 0)} />
                    </div>
                  </SectionCard>
                </div>
              )}

              {/* ── Profiles & Joint Accounts Section ── */}
              {activeSection === 'profiles' && (
                <div className="space-y-6">
                  {/* Existing Profiles */}
                  <SectionCard title="Profils financiers">
                    <p className="text-xs text-foreground-tertiary mb-4">
                      Créez des profils pour chaque membre du foyer et attribuez-leur des comptes bancaires.
                      Un compte partagé entre 2+ profils devient automatiquement un &quot;compte joint&quot;.
                    </p>

                    {profilesLoading ? (
                      <div className="space-y-3">
                        {[1, 2].map(i => (
                          <div key={i} className="p-3 rounded-omni-sm border border-border bg-surface">
                            <Skeleton className="h-5 w-32 mb-2" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {profiles.map((profile) => (
                          <div
                            key={profile.id}
                            className="p-4 rounded-omni-sm border border-border bg-surface"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div
                                  className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                                  style={{ backgroundColor: profile.avatar_color }}
                                >
                                  {profile.name[0]?.toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-foreground">{profile.name}</p>
                                  <p className="text-xs text-foreground-tertiary">
                                    {PROFILE_TYPES.find(t => t.value === profile.type)?.label || profile.type}
                                    {profile.is_default && ' · Par défaut'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setLinkingProfileId(
                                    linkingProfileId === profile.id ? null : profile.id
                                  )}
                                  title="Lier un compte"
                                >
                                  <LinkIcon className="h-3.5 w-3.5" />
                                </Button>
                                {!profile.is_default && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteProfile(profile.id)}
                                    className="text-loss hover:text-loss"
                                    title="Supprimer ce profil"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Linked accounts */}
                            {profile.accounts.length > 0 ? (
                              <div className="space-y-1.5 ml-13">
                                {profile.accounts.map((link) => {
                                  const account = accounts.find(a => a.id === link.account_id)
                                  return (
                                    <div key={link.link_id} className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded bg-surface-elevated">
                                      <span className="text-foreground-secondary">
                                        {account?.label || 'Compte inconnu'}
                                        {link.share_pct < 100 && (
                                          <span className="text-foreground-tertiary ml-1">({link.share_pct}%)</span>
                                        )}
                                      </span>
                                      <button
                                        onClick={() => unlinkAccount(profile.id, link.account_id)}
                                        className="text-foreground-tertiary hover:text-loss transition-colors"
                                        title="Délier ce compte"
                                      >
                                        <Unlink className="h-3 w-3" />
                                      </button>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-foreground-tertiary ml-13">
                                Aucun compte lié. Cliquez sur l&apos;icône de lien pour en ajouter.
                              </p>
                            )}

                            {/* Account linking dropdown */}
                            {linkingProfileId === profile.id && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-3 p-3 rounded-omni-sm border border-brand/20 bg-brand/5"
                              >
                                <p className="text-xs font-medium text-foreground mb-2">Sélectionner un compte à lier :</p>
                                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                  {accounts
                                    .filter(a => !profile.accounts.some(l => l.account_id === a.id))
                                    .map(account => (
                                      <button
                                        key={account.id}
                                        onClick={async () => {
                                          await linkAccount(profile.id, account.id)
                                          setLinkingProfileId(null)
                                        }}
                                        className="flex items-center justify-between w-full p-2 rounded text-xs hover:bg-surface transition-colors text-left"
                                      >
                                        <span className="text-foreground">{account.label}</span>
                                        <span className="text-foreground-tertiary tabular-nums">{formatAmount(account.balance)}</span>
                                      </button>
                                    ))
                                  }
                                  {accounts.filter(a => !profile.accounts.some(l => l.account_id === a.id)).length === 0 && (
                                    <p className="text-xs text-foreground-tertiary text-center py-2">Tous les comptes sont déjà liés.</p>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add new profile */}
                    {!showNewProfile ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowNewProfile(true)}
                        className="mt-4 w-full border border-dashed border-border hover:border-brand/40"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Ajouter un profil
                      </Button>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 p-4 rounded-omni-sm border border-border bg-surface"
                      >
                        <p className="text-sm font-medium text-foreground mb-3">Nouveau profil</p>
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-medium text-foreground-secondary mb-1 block">Nom</label>
                            <Input
                              value={newProfileName}
                              onChange={(e) => setNewProfileName(e.target.value)}
                              placeholder="ex: Marie, Thomas..."
                              className="bg-surface-elevated"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-foreground-secondary mb-1 block">Type</label>
                            <div className="flex gap-2 flex-wrap">
                              {PROFILE_TYPES.filter(t => t.value !== 'personal').map(t => (
                                <button
                                  key={t.value}
                                  onClick={() => {
                                    setNewProfileType(t.value)
                                    setNewProfileColor(t.color)
                                  }}
                                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                    newProfileType === t.value
                                      ? 'bg-brand text-white'
                                      : 'bg-surface-elevated text-foreground-secondary hover:text-foreground'
                                  }`}
                                >
                                  {t.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-foreground-secondary mb-1 block">Couleur</label>
                            <div className="flex gap-2 flex-wrap">
                              {AVATAR_COLORS.map(color => (
                                <button
                                  key={color}
                                  onClick={() => setNewProfileColor(color)}
                                  className={`h-7 w-7 rounded-full transition-all ${
                                    newProfileColor === color ? 'ring-2 ring-offset-2 ring-brand' : ''
                                  }`}
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button
                            size="sm"
                            onClick={async () => {
                              if (!newProfileName.trim()) return
                              await createProfile({
                                name: newProfileName.trim(),
                                type: newProfileType,
                                avatar_color: newProfileColor,
                              })
                              setNewProfileName('')
                              setShowNewProfile(false)
                            }}
                            disabled={!newProfileName.trim()}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1.5" />
                            Créer
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setShowNewProfile(false)
                              setNewProfileName('')
                            }}
                          >
                            Annuler
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </SectionCard>

                  {/* Joint Accounts */}
                  {jointAccounts.length > 0 && (
                    <SectionCard title="Comptes joints">
                      <p className="text-xs text-foreground-tertiary mb-3">
                        Ces comptes sont partagés entre plusieurs profils.
                      </p>
                      <div className="space-y-3">
                        {jointAccounts.map(ja => (
                          <div
                            key={ja.account_id}
                            className="p-3 rounded-omni-sm border border-border bg-surface"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-medium text-foreground">{ja.account_label}</p>
                              <span className="text-sm font-medium text-foreground tabular-nums">
                                {formatAmount(ja.balance)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {ja.profiles.map(p => (
                                <div
                                  key={p.profile_id}
                                  className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs"
                                  style={{ backgroundColor: p.avatar_color + '20' }}
                                >
                                  <div
                                    className="h-4 w-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                                    style={{ backgroundColor: p.avatar_color }}
                                  >
                                    {p.profile_name[0]}
                                  </div>
                                  <span className="text-foreground-secondary">
                                    {p.profile_name} · {p.share_pct}%
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </SectionCard>
                  )}
                </div>
              )}

              {/* ── Connections Section ──────────────── */}
              {activeSection === 'connections' && (
                <div className="space-y-6">
                  <SectionCard title="Connexions bancaires (Woob)">
                    {connections.length === 0 ? (
                      <p className="text-sm text-foreground-tertiary py-4 text-center">
                        Aucune connexion bancaire configurée.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {connections.map((conn) => {
                          const status = statusConfig[conn.status] || statusConfig.error
                          const StatusIcon = status!.icon
                          return (
                            <div
                              key={conn.id}
                              className="flex items-center justify-between p-3 rounded-omni-sm border border-border bg-surface"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                                  <Link2 className="h-4 w-4 text-blue-500" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{conn.bank_name}</p>
                                  <div className="flex items-center gap-1.5">
                                    <StatusIcon className={`h-3 w-3 ${status!.color}`} />
                                    <span className={`text-xs ${status!.color}`}>{status!.label}</span>
                                    {conn.last_sync_at && (
                                      <span className="text-[11px] text-foreground-tertiary">
                                        · {new Date(conn.last_sync_at).toLocaleDateString('fr-FR')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => syncConnection(conn.id)}
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteConnection(conn.id)}
                                  className="text-loss hover:text-loss"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </SectionCard>

                  <SectionCard title="Crypto, Bourse & Immobilier">
                    <div className="space-y-2">
                      <ConnectionSummaryRow
                        label="Wallets crypto"
                        count={cryptoPortfolio?.wallets.length ?? 0}
                        href="/crypto"
                      />
                      <ConnectionSummaryRow
                        label="Portefeuilles bourse"
                        count={stockSummary?.portfolios.length ?? 0}
                        href="/stocks"
                      />
                      <ConnectionSummaryRow
                        label="Biens immobiliers"
                        count={realestateSummary?.properties_count ?? 0}
                        href="/realestate"
                      />
                    </div>
                  </SectionCard>
                </div>
              )}

              {/* ── Preferences Section ──────────────── */}
              {activeSection === 'preferences' && (
                <div className="space-y-6">
                  <SectionCard title="Apparence">
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">Thème</p>
                        <p className="text-xs text-foreground-tertiary">Choisissez entre le mode sombre et clair</p>
                      </div>
                      <div className="flex items-center gap-1 p-1 rounded-full bg-surface border border-border">
                        <button
                          onClick={() => setTheme('dark')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            theme === 'dark' ? 'bg-brand text-white' : 'text-foreground-secondary hover:text-foreground'
                          }`}
                        >
                          <Moon className="h-3.5 w-3.5" />
                          Sombre
                        </button>
                        <button
                          onClick={() => setTheme('light')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            theme === 'light' ? 'bg-brand text-white' : 'text-foreground-secondary hover:text-foreground'
                          }`}
                        >
                          <Sun className="h-3.5 w-3.5" />
                          Clair
                        </button>
                        <button
                          onClick={() => setTheme('system')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            theme === 'system' ? 'bg-brand text-white' : 'text-foreground-secondary hover:text-foreground'
                          }`}
                        >
                          Système
                        </button>
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard title="Devise">
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">Devise de base</p>
                        <p className="text-xs text-foreground-tertiary">Tous les montants seront convertis dans cette devise</p>
                      </div>
                      <div className="flex items-center gap-1 p-1 rounded-full bg-surface border border-border">
                        <button className="px-3 py-1.5 rounded-full text-xs font-medium bg-brand text-white">
                          EUR €
                        </button>
                        <button className="px-3 py-1.5 rounded-full text-xs font-medium text-foreground-secondary hover:text-foreground transition-colors">
                          USD $
                        </button>
                      </div>
                    </div>
                  </SectionCard>
                </div>
              )}

              {/* ── Security Section (wired password change) ─── */}
              {activeSection === 'security' && (
                <SecuritySection />
              )}

              {/* ── RGPD Section ─────────────────────── */}
              {activeSection === 'rgpd' && <RGPDSection />}

              {/* ── Consent Section ──────────────────── */}
              {activeSection === 'consent' && <ConsentSection />}

              {/* ── Audit Section ────────────────────── */}
              {activeSection === 'audit' && <AuditSection />}

              {/* ── About Section ────────────────────── */}
              {activeSection === 'about' && <AboutSection />}

              {/* ── Danger Zone ──────────────────────── */}
              {activeSection === 'danger' && (
                <div className="space-y-6">
                  <div className="rounded-omni-lg border border-loss/30 bg-loss/5 p-6">
                    <h3 className="text-base font-semibold text-loss">Zone dangereuse</h3>
                    <p className="text-sm text-foreground-secondary mt-2">
                      Ces actions sont irréversibles. Procédez avec précaution.
                    </p>

                    <div className="mt-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">Déconnexion de tous les appareils</p>
                          <p className="text-xs text-foreground-tertiary">Invalide tous les tokens de session actifs</p>
                        </div>
                        <Button variant="secondary" size="sm" onClick={logout}>
                          <LogOut className="h-3.5 w-3.5 mr-1.5" />
                          Tout déconnecter
                        </Button>
                      </div>

                      <div className="border-t border-loss/20" />

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-loss">Supprimer le compte</p>
                          <p className="text-xs text-foreground-tertiary">Supprime définitivement toutes vos données</p>
                        </div>
                        {!showDeleteConfirm ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowDeleteConfirm(true)}
                            className="text-loss hover:bg-loss/10 hover:text-loss"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                            Supprimer
                          </Button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-loss">Êtes-vous sûr ?</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowDeleteConfirm(false)}
                            >
                              Annuler
                            </Button>
                            <Button
                              size="sm"
                              className="bg-loss hover:bg-loss/90 text-white"
                            >
                              Confirmer la suppression
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

// ── Helper Components ─────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-omni-lg border border-border bg-background-tertiary p-5">
      <h3 className="text-base font-semibold text-foreground mb-4">{title}</h3>
      {children}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center p-3 rounded-omni-sm bg-surface">
      <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
      <p className="text-xs text-foreground-tertiary mt-1">{label}</p>
    </div>
  )
}

function ConnectionSummaryRow({ label, count, href }: { label: string; count: number; href: string }) {
  return (
    <a
      href={href}
      className="flex items-center justify-between p-3 rounded-omni-sm hover:bg-surface transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm text-foreground">{label}</span>
        <span className="text-xs text-foreground-tertiary bg-surface px-2 py-0.5 rounded-full">{count}</span>
      </div>
      <ChevronRight className="h-4 w-4 text-foreground-tertiary" />
    </a>
  )
}

function SecuritySection() {
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const { isChangingPassword, changePassword } = useSettingsStore()

  const handleChange = async () => {
    setError(null)
    if (newPwd !== confirmPwd) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    if (newPwd.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    try {
      await changePassword(currentPwd, newPwd)
      setSuccess(true)
      setCurrentPwd('')
      setNewPwd('')
      setConfirmPwd('')
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du changement de mot de passe')
    }
  }

  return (
    <div className="space-y-6">
      <SectionCard title="Mot de passe">
        <div className="grid gap-4 sm:grid-cols-2 max-w-md">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-foreground-secondary mb-1.5 block">Mot de passe actuel</label>
            <Input type="password" placeholder="••••••••" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground-secondary mb-1.5 block">Nouveau mot de passe</label>
            <Input type="password" placeholder="••••••••" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground-secondary mb-1.5 block">Confirmer</label>
            <Input type="password" placeholder="••••••••" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} />
          </div>
        </div>
        {error && <p className="text-xs text-loss mt-2">{error}</p>}
        {success && <p className="text-xs text-gain mt-2">Mot de passe mis à jour avec succès !</p>}
        <Button size="sm" className="mt-4" onClick={handleChange} disabled={isChangingPassword || !currentPwd || !newPwd || !confirmPwd}>
          {isChangingPassword ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
        </Button>
      </SectionCard>

      <SectionCard title="Sessions actives">
        <div className="flex items-center justify-between p-3 rounded-omni-sm border border-border bg-surface">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gain/10 flex items-center justify-center">
              <CheckCircle className="h-4 w-4 text-gain" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Session actuelle</p>
              <p className="text-xs text-foreground-tertiary">Connecté maintenant</p>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
