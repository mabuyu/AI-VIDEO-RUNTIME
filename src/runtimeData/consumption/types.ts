import type { RuntimeReaders } from '../readers'
import type { RuntimeValidationIssue } from '../validation'

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
