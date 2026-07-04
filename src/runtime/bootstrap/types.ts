import type { RuntimeServices } from '../services'
import type {
  RuntimeDataSourceKind,
  RuntimeReaders,
  RuntimeValidationIssue,
} from '../../runtimeData'

export type RuntimeBootstrapResult =
  | {
      readonly ok: true
      readonly sourceKind: RuntimeDataSourceKind
      readonly readers: RuntimeReaders
      readonly services: RuntimeServices
      readonly issues: readonly RuntimeValidationIssue[]
    }
  | {
      readonly ok: false
      readonly sourceKind: RuntimeDataSourceKind
      readonly issues: readonly RuntimeValidationIssue[]
    }
