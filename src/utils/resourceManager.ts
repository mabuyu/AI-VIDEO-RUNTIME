import {
  type Resource,
  getEnabledResources,
  getPreloadResources,
  getResources,
} from './resourceParser'

export function getResourceCount(): number {
  return getResources().length
}

export function getEnabledResourceCount(): number {
  return getEnabledResources().length
}

export function getPreloadResourceCount(): number {
  return getPreloadResources().length
}

export function getHighPriorityResources(): Resource[] {
  return getResources().filter(
    (resource) => resource.priority === 'high'
  )
}

export function getHighPriorityResourceCount(): number {
  return getHighPriorityResources().length
}

export function getResourcesByAssetId(
  assetId: string
): Resource[] {
  return getResources().filter(
    (resource) => resource.assetId === assetId
  )
}

export function hasEnabledResource(
  resourceId: string
): boolean {
  return getEnabledResources().some(
    (resource) => resource.id === resourceId
  )
}