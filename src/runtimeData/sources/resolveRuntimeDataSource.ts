import { loadStaticRuntimeData } from '../loaders'
import type { RuntimeDataV1 } from '../types'
import type { RuntimeDataSource } from './types'

export function resolveRuntimeDataSource(
  source: RuntimeDataSource,
): RuntimeDataV1 {
  if (source.kind === 'static') {
    return loadStaticRuntimeData()
  }

  return source.data
}
