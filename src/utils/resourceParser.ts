import resources from '../data/resources.json'

export interface Resource {
  id: string
  assetId: string
  priority: 'high' | 'normal' | 'low'
  preload: boolean
  enabled: boolean
}

export function getResources(): Resource[] {
  return resources as Resource[]
}

export function getEnabledResources(): Resource[] {
  return getResources().filter(
    (resource) => resource.enabled
  )
}

export function getResourceById(
  resourceId: string
): Resource | null {
  const resource = getResources().find(
    (resource) => resource.id === resourceId
  )

  return resource ?? null
}

export function getPreloadResources(): Resource[] {
  return getResources().filter(
    (resource) => resource.preload
  )
}