import type { RuntimeReaders } from '../readers'
import type {
  RuntimeValidationIssue,
  ValidatedRuntimeDataV2,
} from '../validation'

export interface RuntimeDataV2Consumption {
  readonly data: ValidatedRuntimeDataV2
}

export type CreateValidatedRuntimeReadersResult =
  | {
      readonly ok: true
      readonly readers: RuntimeReaders
      readonly issues: readonly RuntimeValidationIssue[]
    }
  | {
      readonly ok: false
      readonly issues: readonly RuntimeValidationIssue[]
    }
