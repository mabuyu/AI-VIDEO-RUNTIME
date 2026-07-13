import type { CompilerArtifactOutput } from '../runtimeDataV2'
import type {
  CompilerArtifactPackagingIssue,
  CompilerArtifactPackagingResult,
} from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isVersion(value: unknown): value is string | number {
  return isNonEmptyString(value) || (typeof value === 'number' && Number.isFinite(value))
}

function isTimestamp(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value))
}

function issue(
  code: CompilerArtifactPackagingIssue['code'],
  message: string,
  path?: string,
): CompilerArtifactPackagingIssue {
  return {
    source: 'compiler-artifact-packaging',
    level: 'error',
    code,
    message,
    ...(path === undefined ? {} : { path }),
  }
}

export function packageCompilerArtifactOutput(input: unknown): CompilerArtifactPackagingResult {
  if (!isRecord(input)) {
    return {
      success: false,
      issues: [issue('INVALID_COMPILER_ARTIFACT_OUTPUT', 'CompilerArtifactOutput must be an object')],
    }
  }

  const issues: CompilerArtifactPackagingIssue[] = []

  if (!Object.prototype.hasOwnProperty.call(input, 'artifact') || input.artifact == null) {
    issues.push(issue('MISSING_ARTIFACT', 'artifact is required', 'artifact'))
  } else if (
    !isRecord(input.artifact)
    || !isNonEmptyString(input.artifact.id)
    || !isNonEmptyString(input.artifact.revision)
    || !isTimestamp(input.artifact.createdAt)
  ) {
    issues.push(issue('INVALID_METADATA', 'artifact metadata is invalid', 'artifact'))
  }

  if (!Object.prototype.hasOwnProperty.call(input, 'compatibility') || input.compatibility == null) {
    issues.push(issue('MISSING_COMPATIBILITY', 'compatibility is required', 'compatibility'))
  } else if (
    !isRecord(input.compatibility)
    || !isVersion(input.compatibility.schemaVersion)
    || !isVersion(input.compatibility.runtimeSchemaVersion)
  ) {
    issues.push(issue('INVALID_METADATA', 'compatibility metadata is invalid', 'compatibility'))
  }

  if (!Object.prototype.hasOwnProperty.call(input, 'runtimeData') || input.runtimeData == null) {
    issues.push(issue('MISSING_RUNTIME_DATA', 'runtimeData is required', 'runtimeData'))
  }

  if (
    !isRecord(input.generation)
    || !isNonEmptyString(input.generation.compilerVersion)
    || !isVersion(input.generation.promptContractVersion)
    || !isTimestamp(input.generation.generatedAt)
  ) {
    issues.push(issue('INVALID_METADATA', 'generation metadata is invalid', 'generation'))
  }

  if (issues.length > 0) return { success: false, issues }

  const output = input as unknown as CompilerArtifactOutput
  return {
    success: true,
    envelope: {
      artifact: output.artifact,
      schemaVersion: output.compatibility.schemaVersion,
      runtimeSchemaVersion: output.compatibility.runtimeSchemaVersion,
      generation: output.generation,
      runtimeData: output.runtimeData,
    },
  }
}
