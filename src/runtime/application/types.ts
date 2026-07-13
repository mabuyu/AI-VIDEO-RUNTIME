import type { RuntimeValidationIssue } from '../../runtimeData'
import type { RuntimeDataSourceV2 } from '../../runtimeData'
import type { RuntimeContextV2 } from '../context'
import type { RuntimeDebugSnapshotV2 } from '../debug'

export interface RuntimeApplicationOptions {
  readonly source: RuntimeDataSourceV2
}

export type RuntimeApplicationV2 =
  | {
      readonly ok: true
      readonly context: RuntimeContextV2
      readonly debugSnapshot: RuntimeDebugSnapshotV2
    }
  | {
      readonly ok: false
      readonly issues: readonly RuntimeValidationIssue[]
    }
