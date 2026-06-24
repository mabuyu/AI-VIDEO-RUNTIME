import { getProjectConfig } from './projectParser'
import { getAssetCount } from './assetRegistry'
import { getResourceCount } from './resourceManager'
import { isAIPlanReady } from './aiManager'

export interface RuntimeSummary {
  projectTitle: string
  assetCount: number
  resourceCount: number
  aiReady: boolean
}

export function getRuntimeSummary(): RuntimeSummary {
  const project = getProjectConfig()

  return {
    projectTitle: project.title,
    assetCount: getAssetCount(),
    resourceCount: getResourceCount(),
    aiReady: isAIPlanReady(),
  }
}