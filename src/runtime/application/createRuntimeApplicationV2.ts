import {
  createRuntimeDataV2Consumption,
  createRuntimeDataV2Readers,
  loadStaticRuntimeDataV2,
  validateRuntimeDataV2,
} from '../../runtimeData'
import { createRuntimeBootstrapV2 } from '../bootstrap'
import { createRuntimeContextV2 } from '../context'
import { createRuntimeDebugSnapshotV2 } from '../debug'
import { createRuntimeDataV2Services } from '../services'
import type { RuntimeApplicationV2 } from './types'

export function createRuntimeApplicationV2(): RuntimeApplicationV2 {
  const validation = validateRuntimeDataV2(loadStaticRuntimeDataV2())

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
