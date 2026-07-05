import type { RuntimeBootstrapResult } from '../bootstrap'
import type { RuntimeContext } from './types'

type SuccessfulRuntimeBootstrap = Extract<RuntimeBootstrapResult, { readonly ok: true }>

export function createRuntimeContext(
  bootstrap: SuccessfulRuntimeBootstrap,
): RuntimeContext {
  return {
    sourceKind: bootstrap.sourceKind,
    services: bootstrap.services,
    validationIssues: bootstrap.issues,
  }
}
