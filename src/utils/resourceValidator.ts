import resources from '../data/resources.json'

interface ResourceData {
  id: string
  assetId: string
  priority: string
  preload: boolean
  enabled: boolean
}

export function validateResources(): string[] {
  const errors: string[] = []

  ;(resources as ResourceData[]).forEach(
    (resource, index) => {
      if (!resource.id) {
        errors.push(
          `resource ${index}: id missing`
        )
      }

      if (!resource.assetId) {
        errors.push(
          `resource ${index}: assetId missing`
        )
      }

      if (
        !['high', 'normal', 'low'].includes(
          resource.priority
        )
      ) {
        errors.push(
          `resource ${index}: priority invalid`
        )
      }

      if (
        typeof resource.preload !== 'boolean'
      ) {
        errors.push(
          `resource ${index}: preload invalid`
        )
      }

      if (
        typeof resource.enabled !== 'boolean'
      ) {
        errors.push(
          `resource ${index}: enabled invalid`
        )
      }
    }
  )

  return errors
}