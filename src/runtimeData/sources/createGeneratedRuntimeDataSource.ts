import type { RuntimeDataV1 } from '../types'
import type { GeneratedRuntimeDataSource } from './types'

export function createGeneratedRuntimeDataSource(
  data: RuntimeDataV1,
): GeneratedRuntimeDataSource {
  return {
    kind: 'generated',
    data,
  }
}
