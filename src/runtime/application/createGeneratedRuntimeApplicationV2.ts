import { createGeneratedRuntimeDataV2Source } from '../../runtimeData'
import { createRuntimeApplicationV2 } from './createRuntimeApplicationV2'
import type { RuntimeApplicationV2 } from './types'

export function createGeneratedRuntimeApplicationV2(): RuntimeApplicationV2 {
  return createRuntimeApplicationV2({ source: createGeneratedRuntimeDataV2Source() })
}
