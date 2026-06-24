import assets from '../data/assets.json'

export interface Asset {
  id: string
  type: 'image' | 'svg' | 'video' | 'audio'
  src: string
  preload: boolean
}

export function getAssets(): Asset[] {
  return assets as Asset[]
}

export function getPreloadAssets(): Asset[] {
  return getAssets().filter(
    (asset) => asset.preload
  )
}

export function getAssetById(
  assetId: string
): Asset | null {
  const asset = getAssets().find(
    (asset) => asset.id === assetId
  )

  return asset ?? null
}