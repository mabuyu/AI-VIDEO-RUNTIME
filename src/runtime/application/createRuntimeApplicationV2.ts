import {
  createRuntimeDataV2Consumption,
  createRuntimeDataV2Readers,
  resolveRuntimeDataSourceV2,
  validateRuntimeDataV2,
} from '../../runtimeData'
import { createRuntimeBootstrapV2 } from '../bootstrap'
import { createRuntimeContextV2 } from '../context'
import { createRuntimeDebugSnapshotV2 } from '../debug'
import { createRuntimeDataV2Services } from '../services'
import type { RuntimeApplicationOptions, RuntimeApplicationV2 } from './types'

export function createRuntimeApplicationV2(
  options?: RuntimeApplicationOptions,
): RuntimeApplicationV2 {
  if (!options || !Object.prototype.hasOwnProperty.call(options, 'source')) {
    throw new Error('RuntimeApplicationV2 requires an explicit source')
  }

  const candidate = resolveRuntimeDataSourceV2(options.source)
  const validation = validateRuntimeDataV2(candidate)

  if (!validation.ok) {
    return {
      ok: false,
      issues: validation.issues,
    }
  }

  const consumption = createRuntimeDataV2Consumption(validation.data)
  const bootstrap = createRuntimeBootstrapV2(consumption)
  const readers = createRuntimeDataV2Readers(bootstrap)
  const services = createRuntimeDataV2Services(readers)
  const context = createRuntimeContextV2({
    bootstrap,
    readers,
    services,
  })

  return {
    ok: true,
    context,
    debugSnapshot: createRuntimeDebugSnapshotV2(context),
  }
}
