import { getRuntimeSummary } from './runtimeSummary'

export interface RuntimeIntegration {
  projectTitle: string
  assetCount: number
  resourceCount: number
  aiReady: boolean
  integrationReady: boolean
}

export function getRuntimeIntegration(): RuntimeIntegration {
  const summary = getRuntimeSummary()

  return {
    projectTitle: summary.projectTitle,
    assetCount: summary.assetCount,
    resourceCount: summary.resourceCount,
    aiReady: summary.aiReady,
    integrationReady:
      summary.aiReady &&
      summary.assetCount > 0 &&
      summary.resourceCount > 0,
  }
}