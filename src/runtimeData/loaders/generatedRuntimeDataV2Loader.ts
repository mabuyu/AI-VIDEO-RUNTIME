import type { RuntimeDataV2 } from '../types'

export interface GeneratedRuntimeDataV2Artifact {
  readonly schemaVersion?: string | number
  readonly runtimeSchemaVersion?: string | number
  readonly source?: unknown
  readonly artifact?: unknown
  readonly generation?: unknown
  readonly runtimeData: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function loadGeneratedRuntimeDataV2(artifact: unknown): RuntimeDataV2 {
  if (!isRecord(artifact)) {
    throw new Error('Generated RuntimeDataV2 artifact must be an object')
  }

  if (!Object.prototype.hasOwnProperty.call(artifact, 'runtimeData')) {
    throw new Error('Generated RuntimeDataV2 artifact is missing runtimeData')
  }

  return artifact.runtimeData as RuntimeDataV2
}
