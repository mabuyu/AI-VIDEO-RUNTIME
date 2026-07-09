import type { ValidatedRuntimeDataV2 } from '../validation'
import type { RuntimeDataV2Consumption } from './types'

export function createRuntimeDataV2Consumption(
  runtimeData: ValidatedRuntimeDataV2,
): RuntimeDataV2Consumption {
  return {
    data: runtimeData,
  }
}
