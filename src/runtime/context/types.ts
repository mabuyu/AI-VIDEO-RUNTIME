import type { RuntimeDataSourceKind, RuntimeValidationIssue } from '../../runtimeData'
import type { RuntimeDataV2Readers } from '../../runtimeData'
import type { RuntimeBootstrapV2 } from '../bootstrap'
import type { RuntimeDataV2Services, RuntimeServices } from '../services'

export interface RuntimeContext {
  readonly sourceKind: RuntimeDataSourceKind
  readonly services: RuntimeServices
  readonly validationIssues: readonly RuntimeValidationIssue[]
}

export interface RuntimeStateV2 {
  readonly status: 'ready'
}

export interface RuntimeContextV2 {
  readonly bootstrap: RuntimeBootstrapV2
  readonly readiness: {
    readonly ready: true
  }
  readonly readers: RuntimeDataV2Readers
  readonly services: RuntimeDataV2Services
  readonly state: RuntimeStateV2
}

export interface RuntimeContextV2Dependencies {
  readonly bootstrap: RuntimeBootstrapV2
  readonly readers: RuntimeDataV2Readers
  readonly services: RuntimeDataV2Services
}
