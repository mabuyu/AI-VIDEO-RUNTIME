import type {
  CompilerArtifactIdentity,
  CompilerGenerationMetadata,
} from '../runtimeDataV2'
import type { RuntimeDataV2 } from '../../runtimeData/types'

export interface GeneratedArtifactEnvelope {
  readonly artifact: CompilerArtifactIdentity
  readonly schemaVersion: string | number
  readonly runtimeSchemaVersion: string | number
  readonly generation: CompilerGenerationMetadata
  readonly runtimeData: RuntimeDataV2
}

export interface CompilerArtifactPackagingIssue {
  readonly source: 'compiler-artifact-packaging'
  readonly level: 'error'
  readonly code:
    | 'INVALID_COMPILER_ARTIFACT_OUTPUT'
    | 'MISSING_ARTIFACT'
    | 'MISSING_COMPATIBILITY'
    | 'MISSING_RUNTIME_DATA'
    | 'INVALID_METADATA'
  readonly message: string
  readonly path?: string
}

export type CompilerArtifactPackagingResult =
  | { readonly success: true; readonly envelope: GeneratedArtifactEnvelope }
  | { readonly success: false; readonly issues: readonly CompilerArtifactPackagingIssue[] }
