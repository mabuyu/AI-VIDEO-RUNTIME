import {
  type Asset,
  getAssetById,
  getAssets,
  getPreloadAssets,
} from './assetParser'

export function getAssetRegistry(): Record<
  string,
  Asset
> {
  return getAssets().reduce(
    (registry, asset) => {
      registry[asset.id] = asset
      return registry
    },
    {} as Record<string, Asset>
  )
}

export function resolveAsset(
  assetId: string
): string | null {
  const asset = getAssetById(assetId)

  return asset?.src ?? null
}

export function getAssetCount(): number {
  return getAssets().length
}

export function getPreloadAssetCount(): number {
  return getPreloadAssets().length
}

export function hasAsset(assetId: string): boolean {
  return Boolean(getAssetById(assetId))
}