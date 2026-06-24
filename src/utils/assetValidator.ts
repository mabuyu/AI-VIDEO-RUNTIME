import assets from '../data/assets.json'

interface AssetData {
  id: string
  type: string
  src: string
  preload: boolean
}

export function validateAssets(): string[] {
  const errors: string[] = []

  ;(assets as AssetData[]).forEach((asset, index) => {
    if (!asset.id) {
      errors.push(`asset ${index}: id missing`)
    }

    if (
      !['image', 'svg', 'video', 'audio'].includes(asset.type)
    ) {
      errors.push(`asset ${index}: invalid type`)
    }

    if (!asset.src) {
      errors.push(`asset ${index}: src missing`)
    }

    if (typeof asset.preload !== 'boolean') {
      errors.push(`asset ${index}: preload invalid`)
    }
  })

  return errors
}