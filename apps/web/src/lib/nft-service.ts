/**
 * NFT Service — Fetches real NFT data from public APIs
 * Uses Alchemy or direct OpenSea API as fallback
 */

export interface NFTMetadata {
  name: string
  collection: string
  tokenId: string
  blockchain: string
  imageUrl: string
  thumbnailUrl?: string
  contractAddress: string
  floorPriceEth?: number
  lastSaleEth?: number
  traits: Array<{ trait_type: string; value: string }>
  marketplace: string
  permalink?: string
}

/** Fetch NFTs for a wallet address using Alchemy's free API */
export async function fetchNFTsForWallet(
  walletAddress: string,
  chain: 'ethereum' | 'polygon' | 'arbitrum' = 'ethereum'
): Promise<NFTMetadata[]> {
  // Use the free Alchemy NFT API (demo key for basic lookups)
  const chainMap = {
    ethereum: 'eth-mainnet',
    polygon: 'polygon-mainnet',
    arbitrum: 'arb-mainnet',
  }
  const network = chainMap[chain]

  try {
    const res = await fetch(
      `https://eth-mainnet.g.alchemy.com/nft/v3/demo/getNFTsForOwner?owner=${walletAddress}&withMetadata=true&pageSize=50`,
      { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) throw new Error(`Alchemy API ${res.status}`)
    const data = await res.json()

    return (data.ownedNfts || []).map((nft: any) => ({
      name: nft.name || nft.title || `#${nft.tokenId}`,
      collection: nft.contract?.name || nft.contract?.openSeaMetadata?.collectionName || 'Unknown',
      tokenId: nft.tokenId,
      blockchain: chain,
      imageUrl: nft.image?.cachedUrl || nft.image?.originalUrl || nft.image?.pngUrl || '',
      thumbnailUrl: nft.image?.thumbnailUrl || nft.image?.cachedUrl || '',
      contractAddress: nft.contract?.address || '',
      floorPriceEth: nft.contract?.openSeaMetadata?.floorPrice || undefined,
      lastSaleEth: nft.contract?.openSeaMetadata?.lastIngestedAt ? undefined : undefined,
      traits: (nft.raw?.metadata?.attributes || []).map((t: any) => ({
        trait_type: t.trait_type || t.key || '',
        value: String(t.value || ''),
      })),
      marketplace: 'OpenSea',
      permalink: `https://opensea.io/assets/${chain}/${nft.contract?.address}/${nft.tokenId}`,
    }))
  } catch (err) {
    console.warn('NFT fetch failed:', err)
    return []
  }
}

/** Fetch metadata for a single NFT by contract + tokenId */
export async function fetchSingleNFT(
  contractAddress: string,
  tokenId: string,
  chain: 'ethereum' | 'polygon' | 'arbitrum' = 'ethereum'
): Promise<NFTMetadata | null> {
  try {
    const res = await fetch(
      `https://eth-mainnet.g.alchemy.com/nft/v3/demo/getNFTMetadata?contractAddress=${contractAddress}&tokenId=${tokenId}&refreshCache=false`,
      { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return null
    const nft = await res.json()

    return {
      name: nft.name || nft.title || `#${tokenId}`,
      collection: nft.contract?.name || nft.contract?.openSeaMetadata?.collectionName || 'Unknown',
      tokenId,
      blockchain: chain,
      imageUrl: nft.image?.cachedUrl || nft.image?.originalUrl || '',
      thumbnailUrl: nft.image?.thumbnailUrl || '',
      contractAddress,
      floorPriceEth: nft.contract?.openSeaMetadata?.floorPrice || undefined,
      traits: (nft.raw?.metadata?.attributes || []).map((t: any) => ({
        trait_type: t.trait_type || '',
        value: String(t.value || ''),
      })),
      marketplace: 'OpenSea',
      permalink: `https://opensea.io/assets/${chain}/${contractAddress}/${tokenId}`,
    }
  } catch {
    return null
  }
}

/** Popular NFT collections for quick-add */
export const POPULAR_COLLECTIONS = [
  { name: 'Bored Ape Yacht Club', contract: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D', image: '🐵' },
  { name: 'CryptoPunks', contract: '0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB', image: '👾' },
  { name: 'Azuki', contract: '0xED5AF388653567Af2F388E6224dC7C4b3241C544', image: '🎌' },
  { name: 'Doodles', contract: '0x8a90CAb2b38dba80c64b7734e58Ee1dB38B8992e', image: '🌈' },
  { name: 'Moonbirds', contract: '0x23581767a106ae21c074b2276D25e5C3e136a68b', image: '🦉' },
  { name: 'CloneX', contract: '0x49cF6f5d44E70224e2E23fDcdd2C053F30aDA28B', image: '🤖' },
  { name: 'Pudgy Penguins', contract: '0xBd3531dA5CF5857e7CfAA92426877b022e612cf8', image: '🐧' },
  { name: 'World of Women', contract: '0xe785E82358879F061BC3dcAC6f0444462D4b5330', image: '👩' },
  { name: 'Art Blocks', contract: '0xa7d8d9ef8D8Ce8992Df33D8b8CF4Aebabd5bD270', image: '🎨' },
  { name: 'Otherdeed', contract: '0x34d85c9CDeB23FA97cb08333b511ac86E1C4E258', image: '🌍' },
]

/** Blockchain options */
export const BLOCKCHAIN_OPTIONS = [
  { value: 'ethereum', label: 'Ethereum', icon: '⟠', color: 'text-blue-400' },
  { value: 'polygon', label: 'Polygon', icon: '⬟', color: 'text-purple-400' },
  { value: 'solana', label: 'Solana', icon: '◎', color: 'text-green-400' },
  { value: 'arbitrum', label: 'Arbitrum', icon: '🔵', color: 'text-blue-300' },
  { value: 'base', label: 'Base', icon: '🔵', color: 'text-blue-500' },
  { value: 'optimism', label: 'Optimism', icon: '🔴', color: 'text-red-400' },
]
