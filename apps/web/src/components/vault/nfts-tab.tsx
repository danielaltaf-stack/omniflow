'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, TrendingUp, TrendingDown, ExternalLink, Wallet, Search, Hexagon, Loader2 } from 'lucide-react'
import { useVaultStore } from '@/stores/vault-store'
import { VaultWizard, WizardField, WizardGrid, WizardSection, wizardInputCls, wizardSelectCls, ImageDropZone } from '@/components/vault/vault-wizard'
import { Button } from '@/components/ui/button'
import { fetchNFTsForWallet, fetchSingleNFT, BLOCKCHAIN_OPTIONS, POPULAR_COLLECTIONS, type NFTMetadata } from '@/lib/nft-service'
import type { NFTAsset } from '@/types/api'

const fmt = (c: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(c / 100)
const fmtEth = (v?: number) => v != null ? `${v.toFixed(4)} ETH` : '—'

const WIZARD_STEPS = [
  { id: 'source', label: 'Source' },
  { id: 'details', label: 'Détails' },
  { id: 'financial', label: 'Valorisation' },
]

type ImportMode = 'manual' | 'wallet' | 'contract'

export default function NFTsTab() {
  const { nfts, createNFT, deleteNFT, isLoading } = useVaultStore()
  const [showWizard, setShowWizard] = useState(false)
  const [step, setStep] = useState(0)
  const [search, setSearch] = useState('')
  const [importMode, setImportMode] = useState<ImportMode>('manual')

  // Wallet import state
  const [walletAddress, setWalletAddress] = useState('')
  const [walletChain, setWalletChain] = useState<'ethereum' | 'polygon' | 'arbitrum'>('ethereum')
  const [fetchedNFTs, setFetchedNFTs] = useState<NFTMetadata[]>([])
  const [isFetching, setIsFetching] = useState(false)
  const [selectedNFT, setSelectedNFT] = useState<NFTMetadata | null>(null)

  // Contract lookup state
  const [contractAddress, setContractAddress] = useState('')
  const [tokenId, setTokenId] = useState('')

  const [form, setForm] = useState({
    name: '', collection_name: '', token_id: '', blockchain: 'ethereum',
    contract_address: '', image_url: '', purchase_price_eth: '',
    purchase_price_eur: '', current_floor_eur: '', marketplace: 'OpenSea',
    traits: '{}',
  })

  const resetForm = () => {
    setForm({ name: '', collection_name: '', token_id: '', blockchain: 'ethereum', contract_address: '', image_url: '', purchase_price_eth: '', purchase_price_eur: '', current_floor_eur: '', marketplace: 'OpenSea', traits: '{}' })
    setStep(0)
    setImportMode('manual')
    setFetchedNFTs([])
    setSelectedNFT(null)
    setWalletAddress('')
    setContractAddress('')
    setTokenId('')
  }

  // Fetch from wallet
  const handleFetchWallet = useCallback(async () => {
    if (!walletAddress) return
    setIsFetching(true)
    try {
      const results = await fetchNFTsForWallet(walletAddress, walletChain)
      setFetchedNFTs(results)
    } finally {
      setIsFetching(false)
    }
  }, [walletAddress, walletChain])

  // Fetch by contract
  const handleFetchContract = useCallback(async () => {
    if (!contractAddress || !tokenId) return
    setIsFetching(true)
    try {
      const result = await fetchSingleNFT(contractAddress, tokenId)
      if (result) {
        setSelectedNFT(result)
        setForm((f) => ({
          ...f,
          name: result.name,
          collection_name: result.collection,
          token_id: result.tokenId,
          contract_address: result.contractAddress,
          image_url: result.imageUrl,
          blockchain: result.blockchain,
          purchase_price_eth: result.floorPriceEth?.toString() || '',
        }))
        setStep(1)
      }
    } finally {
      setIsFetching(false)
    }
  }, [contractAddress, tokenId])

  // Select fetched NFT
  const selectFetchedNFT = useCallback((nft: NFTMetadata) => {
    setSelectedNFT(nft)
    setForm((f) => ({
      ...f,
      name: nft.name,
      collection_name: nft.collection,
      token_id: nft.tokenId,
      contract_address: nft.contractAddress,
      image_url: nft.imageUrl || nft.thumbnailUrl || '',
      blockchain: nft.blockchain,
      marketplace: nft.marketplace,
      traits: JSON.stringify(nft.traits.reduce((acc, t) => ({ ...acc, [t.trait_type]: t.value }), {})),
    }))
    setStep(1)
  }, [])

  const handleCreate = useCallback(async () => {
    if (!form.name || !form.collection_name) return
    let parsedTraits = {}
    try { parsedTraits = JSON.parse(form.traits) } catch { /* ignore */ }
    await createNFT({
      name: form.name,
      collection_name: form.collection_name,
      token_id: form.token_id || '',
      blockchain: form.blockchain,
      contract_address: form.contract_address || undefined,
      image_url: form.image_url || undefined,
      purchase_price_eth: form.purchase_price_eth ? parseFloat(form.purchase_price_eth) : undefined,
      purchase_price_eur: form.purchase_price_eur ? Math.round(parseFloat(form.purchase_price_eur) * 100) : undefined,
      current_floor_eur: form.current_floor_eur ? Math.round(parseFloat(form.current_floor_eur) * 100) : undefined,
      marketplace: form.marketplace || undefined,
      traits: parsedTraits,
    })
    setShowWizard(false)
    resetForm()
  }, [form, createNFT])

  const canAdvance = step === 0 ? true : step === 1 ? !!(form.name && form.collection_name) : true

  const filtered = nfts.filter((n) => {
    if (!search) return true
    const q = search.toLowerCase()
    return n.name.toLowerCase().includes(q) || n.collection_name.toLowerCase().includes(q)
  })

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-tertiary" />
          <input className={`${wizardInputCls} pl-9`} placeholder="Rechercher un NFT..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button onClick={() => setShowWizard(true)}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter un NFT
        </Button>
      </div>

      {/* NFT Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-foreground-tertiary">
          <Hexagon className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-lg font-medium">Aucun NFT</p>
          <p className="text-sm">Importez vos NFTs depuis votre wallet ou ajoutez-les manuellement</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {filtered.map((nft, i) => (
              <NFTCard key={nft.id} nft={nft} index={i} onDelete={deleteNFT} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Wizard */}
      <VaultWizard
        open={showWizard}
        onClose={() => { setShowWizard(false); resetForm() }}
        title="Ajouter un NFT"
        subtitle="Importez depuis votre wallet ou ajoutez manuellement"
        steps={WIZARD_STEPS}
        currentStep={step}
        onStepChange={setStep}
        onSubmit={handleCreate}
        canAdvance={canAdvance}
        isSubmitting={isLoading}
        accent="bg-purple-500"
      >
        {step === 0 && (
          <WizardSection>
            {/* Import mode selector */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {([
                { mode: 'manual' as ImportMode, icon: '✏️', label: 'Manuel' },
                { mode: 'wallet' as ImportMode, icon: '👛', label: 'Wallet' },
                { mode: 'contract' as ImportMode, icon: '📜', label: 'Contrat' },
              ]).map(({ mode, icon, label }) => (
                <button
                  key={mode}
                  onClick={() => setImportMode(mode)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-omni border-2 transition-all ${importMode === mode ? 'border-purple-500 bg-purple-500/10' : 'border-border hover:border-foreground-tertiary'}`}
                >
                  <span className="text-2xl">{icon}</span>
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>

            {importMode === 'manual' && (
              <div className="p-4 rounded-omni bg-surface border border-border text-sm text-foreground-secondary">
                <p>Vous remplirez manuellement les informations du NFT à l&apos;étape suivante.</p>
                <p className="mt-1 text-foreground-tertiary">Cliquez sur Suivant pour continuer.</p>
              </div>
            )}

            {importMode === 'wallet' && (
              <div className="space-y-4">
                <WizardField label="Adresse du wallet" required>
                  <input className={wizardInputCls} value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} placeholder="0x..." />
                </WizardField>
                <WizardField label="Blockchain">
                  <div className="flex gap-2">
                    {(['ethereum', 'polygon', 'arbitrum'] as const).map((ch) => {
                      const opt = BLOCKCHAIN_OPTIONS.find((b) => b.value === ch)!
                      return (
                        <button key={ch} onClick={() => setWalletChain(ch)} className={`flex items-center gap-1.5 px-3 py-2 rounded-omni-sm border-2 text-sm transition-all ${walletChain === ch ? 'border-purple-500 bg-purple-500/10' : 'border-border'}`}>
                          <span>{opt.icon}</span> {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </WizardField>
                <Button onClick={handleFetchWallet} isLoading={isFetching} disabled={!walletAddress}>
                  <Wallet className="h-4 w-4 mr-1" /> Scanner le wallet
                </Button>

                {fetchedNFTs.length > 0 && (
                  <div className="max-h-60 overflow-y-auto space-y-2 mt-4">
                    <p className="text-sm font-medium text-foreground-secondary">{fetchedNFTs.length} NFTs trouvés — sélectionnez :</p>
                    {fetchedNFTs.map((nft, i) => (
                      <button
                        key={`${nft.contractAddress}-${nft.tokenId}`}
                        onClick={() => selectFetchedNFT(nft)}
                        className="w-full flex items-center gap-3 p-3 rounded-omni-sm bg-background hover:bg-surface border border-border hover:border-purple-500/50 transition-all text-left"
                      >
                        {nft.thumbnailUrl ? (
                          <img src={nft.thumbnailUrl} alt={nft.name} className="w-10 h-10 rounded-omni-sm object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-omni-sm bg-purple-500/20 flex items-center justify-center"><Hexagon className="h-5 w-5 text-purple-400" /></div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{nft.name}</p>
                          <p className="text-xs text-foreground-tertiary truncate">{nft.collection}</p>
                        </div>
                        {nft.floorPriceEth && <span className="text-xs text-foreground-secondary">{fmtEth(nft.floorPriceEth)}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {importMode === 'contract' && (
              <div className="space-y-4">
                <WizardField label="Adresse du contrat" required>
                  <input className={wizardInputCls} value={contractAddress} onChange={(e) => setContractAddress(e.target.value)} placeholder="0x..." />
                </WizardField>
                <WizardField label="Token ID" required>
                  <input className={wizardInputCls} value={tokenId} onChange={(e) => setTokenId(e.target.value)} placeholder="1234" />
                </WizardField>

                <p className="text-xs text-foreground-tertiary font-medium">Collections populaires :</p>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_COLLECTIONS.map((col) => (
                    <button key={col.contract} onClick={() => setContractAddress(col.contract)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-border hover:border-purple-500/50 text-xs transition-all">
                      <span>{col.image}</span>{col.name}
                    </button>
                  ))}
                </div>

                <Button onClick={handleFetchContract} isLoading={isFetching} disabled={!contractAddress || !tokenId}>
                  <Search className="h-4 w-4 mr-1" /> Rechercher
                </Button>
              </div>
            )}
          </WizardSection>
        )}

        {step === 1 && (
          <WizardSection title="Informations du NFT">
            {(selectedNFT?.imageUrl || form.image_url) && (
              <div className="w-full h-48 rounded-omni overflow-hidden bg-background-tertiary mb-4">
                <img src={selectedNFT?.imageUrl || form.image_url} alt={form.name} className="w-full h-full object-contain" />
              </div>
            )}
            <WizardGrid>
              <WizardField label="Nom" required>
                <input className={wizardInputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Bored Ape #1234" />
              </WizardField>
              <WizardField label="Collection" required>
                <input className={wizardInputCls} value={form.collection_name} onChange={(e) => setForm((f) => ({ ...f, collection_name: e.target.value }))} placeholder="Bored Ape Yacht Club" />
              </WizardField>
            </WizardGrid>
            <WizardGrid>
              <WizardField label="Token ID">
                <input className={wizardInputCls} value={form.token_id} onChange={(e) => setForm((f) => ({ ...f, token_id: e.target.value }))} placeholder="1234" />
              </WizardField>
              <WizardField label="Blockchain">
                <select className={wizardSelectCls} value={form.blockchain} onChange={(e) => setForm((f) => ({ ...f, blockchain: e.target.value }))}>
                  {BLOCKCHAIN_OPTIONS.map((b) => <option key={b.value} value={b.value}>{b.icon} {b.label}</option>)}
                </select>
              </WizardField>
            </WizardGrid>
            {importMode === 'manual' && (
              <ImageDropZone value={form.image_url} onChange={(url) => setForm((f) => ({ ...f, image_url: url }))} placeholder="Image du NFT" />
            )}
          </WizardSection>
        )}

        {step === 2 && (
          <WizardSection title="Valorisation">
            <WizardGrid>
              <WizardField label="Prix d'achat (ETH)">
                <input type="number" step="0.0001" className={wizardInputCls} value={form.purchase_price_eth} onChange={(e) => setForm((f) => ({ ...f, purchase_price_eth: e.target.value }))} placeholder="0.5" />
              </WizardField>
              <WizardField label="Prix d'achat (€)">
                <input type="number" step="0.01" className={wizardInputCls} value={form.purchase_price_eur} onChange={(e) => setForm((f) => ({ ...f, purchase_price_eur: e.target.value }))} placeholder="1500" />
              </WizardField>
            </WizardGrid>
            <WizardField label="Floor price actuel (€)" hint="Sera mis à jour automatiquement si possible">
              <input type="number" step="0.01" className={wizardInputCls} value={form.current_floor_eur} onChange={(e) => setForm((f) => ({ ...f, current_floor_eur: e.target.value }))} placeholder="2000" />
            </WizardField>
            <WizardField label="Marketplace">
              <select className={wizardSelectCls} value={form.marketplace} onChange={(e) => setForm((f) => ({ ...f, marketplace: e.target.value }))}>
                <option value="OpenSea">OpenSea</option>
                <option value="Blur">Blur</option>
                <option value="Magic Eden">Magic Eden</option>
                <option value="LooksRare">LooksRare</option>
                <option value="Rarible">Rarible</option>
                <option value="Foundation">Foundation</option>
                <option value="Other">Autre</option>
              </select>
            </WizardField>
          </WizardSection>
        )}
      </VaultWizard>
    </div>
  )
}

/* ── NFT Card ────────────────────────────────────────── */

function NFTCard({ nft, index, onDelete }: { nft: NFTAsset; index: number; onDelete: (id: string) => void }) {
  const [hovered, setHovered] = useState(false)
  const hasGain = (nft.gain_loss_eur ?? 0) > 0
  const hasLoss = (nft.gain_loss_eur ?? 0) < 0
  const chain = BLOCKCHAIN_OPTIONS.find((b) => b.value === nft.blockchain)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.04 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="group bg-surface rounded-omni-lg border border-border overflow-hidden hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/5 transition-all"
    >
      {/* Image */}
      <div className="aspect-square bg-background-tertiary overflow-hidden relative">
        {nft.image_url ? (
          <motion.img
            src={nft.image_url}
            alt={nft.name}
            className="w-full h-full object-cover"
            animate={{ scale: hovered ? 1.05 : 1 }}
            transition={{ duration: 0.4 }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/50 to-indigo-900/50">
            <Hexagon className="h-16 w-16 text-purple-400/40" />
          </div>
        )}
        {/* Blockchain badge */}
        {chain && (
          <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm text-xs">
            <span className={chain.color}>{chain.icon}</span>
          </div>
        )}
        {/* Delete overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          {nft.contract_address && (
            <a href={`https://opensea.io/assets/${nft.blockchain}/${nft.contract_address}/${nft.token_id}`} target="_blank" rel="noreferrer" className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors">
              <ExternalLink className="h-4 w-4 text-white" />
            </a>
          )}
          <button onClick={() => onDelete(nft.id)} className="p-2 rounded-full bg-loss/80 hover:bg-loss transition-colors">
            <Trash2 className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-xs text-purple-400 font-medium truncate">{nft.collection_name}</p>
        <h3 className="font-semibold text-sm truncate mt-0.5">{nft.name}</h3>

        <div className="flex items-center justify-between mt-2">
          <div>
            <p className="text-xs text-foreground-tertiary">Floor</p>
            <p className="text-sm font-bold">{nft.current_floor_eur ? fmt(nft.current_floor_eur) : '—'}</p>
          </div>
          {nft.gain_loss_pct != null && (
            <div className={`flex items-center gap-0.5 text-xs font-medium ${hasGain ? 'text-gain' : hasLoss ? 'text-loss' : 'text-foreground-tertiary'}`}>
              {hasGain ? <TrendingUp className="h-3 w-3" /> : hasLoss ? <TrendingDown className="h-3 w-3" /> : null}
              {nft.gain_loss_pct > 0 ? '+' : ''}{nft.gain_loss_pct.toFixed(1)}%
            </div>
          )}
        </div>

        {/* Traits */}
        {nft.traits && Object.keys(nft.traits).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {Object.entries(nft.traits).slice(0, 3).map(([k, v]) => (
              <span key={k} className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/10 text-purple-300 truncate max-w-[80px]">
                {String(v)}
              </span>
            ))}
            {Object.keys(nft.traits).length > 3 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-surface text-foreground-tertiary">+{Object.keys(nft.traits).length - 3}</span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
