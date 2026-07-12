import {
  loadGeneratedRuntimeDataV2,
  loadStaticRuntimeDataV2,
} from '../../loaders'
import type { RuntimeDataV2 } from '../../types'
import type { RuntimeDataSourceV2 } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function resolveRuntimeDataSourceV2(source: RuntimeDataSourceV2): RuntimeDataV2 {
  if (!isRecord(source) || typeof source.type !== 'string') {
    throw new Error('RuntimeDataSourceV2 must be an object with a type')
  }

  if (source.type === 'static') {
    if (typeof source.sourceId !== 'string' || typeof source.revision !== 'string') {
      throw new Error('Static RuntimeDataSourceV2 is malformed')
    }

    return loadStaticRuntimeDataV2()
  }

  if (source.type === 'generated') {
    if (
      typeof source.artifactId !== 'string' ||
      typeof source.artifactRevision !== 'string' ||
      !Object.prototype.hasOwnProperty.call(source, 'artifact')
    ) {
      throw new Error('Generated RuntimeDataSourceV2 is malformed')
    }

    return loadGeneratedRuntimeDataV2(source.artifact)
  }

  if (source.type === 'remote') {
    throw new Error('Remote RuntimeDataSourceV2 loading is not implemented')
  }

  throw new Error(`Unknown RuntimeDataSourceV2 type: ${source.type}`)
}
