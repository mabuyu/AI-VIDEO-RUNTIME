import type { RuntimeServices } from '../services'
import type {
  RuntimeDataV2Consumption,
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

export interface RuntimeBootstrapV2 {
  readonly ready: true
  readonly consumption: RuntimeDataV2Consumption
}
