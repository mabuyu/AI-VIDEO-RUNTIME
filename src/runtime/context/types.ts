import type { RuntimeDataSourceKind, RuntimeValidationIssue } from '../../runtimeData'
import type { RuntimeServices } from '../services'

export interface RuntimeContext {
  readonly sourceKind: RuntimeDataSourceKind
  readonly services: RuntimeServices
  readonly validationIssues: readonly RuntimeValidationIssue[]
}
