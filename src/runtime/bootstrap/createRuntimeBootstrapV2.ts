import type { RuntimeDataV2Consumption } from '../../runtimeData'
import type { RuntimeBootstrapV2 } from './types'

export function createRuntimeBootstrapV2(
  consumption: RuntimeDataV2Consumption,
): RuntimeBootstrapV2 {
  return {
    ready: true,
    consumption,
  }
}
