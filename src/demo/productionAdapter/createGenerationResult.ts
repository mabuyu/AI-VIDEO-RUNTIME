import type {
  GenerationIssue,
  GenerationOutput,
  GenerationResult,
  GenerationStatus,
} from './types'

const generationStatuses: readonly GenerationStatus[] = Object.freeze([
  'CREATED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
])

function requireNonEmptyString(value: string, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${field} must be a non-empty string`)
  }

  return value
}

function copyOutput(output: GenerationOutput): GenerationOutput {
  if (typeof output !== 'object' || output === null) {
    throw new TypeError('Generation Output is invalid')
  }
  if (output.mediaType !== 'video') {
    throw new TypeError('Generation Output mediaType is unsupported')
  }

  return Object.freeze({
    outputId: requireNonEmptyString(output.outputId, 'outputId'),
    mediaType: output.mediaType,
    format: requireNonEmptyString(output.format, 'format'),
  })
}

function copyIssue(issue: GenerationIssue): GenerationIssue {
  if (typeof issue !== 'object' || issue === null) {
    throw new TypeError('Generation Issue is invalid')
  }

  return Object.freeze({
    code: requireNonEmptyString(issue.code, 'issue.code'),
    message: requireNonEmptyString(issue.message, 'issue.message'),
  })
}

export function createGenerationResult(
  input: GenerationResult,
): GenerationResult {
  if (typeof input !== 'object' || input === null) {
    throw new TypeError('Generation Result is invalid')
  }
  if (!generationStatuses.includes(input.status)) {
    throw new TypeError('Generation Result status is unsupported')
  }
  if (!Array.isArray(input.outputs) || !Array.isArray(input.issues)) {
    throw new TypeError('Generation Result collections are invalid')
  }

  const outputs = Object.freeze(input.outputs.map(copyOutput))
  const issues = Object.freeze(input.issues.map(copyIssue))

  if (input.status === 'COMPLETED' && outputs.length === 0) {
    throw new TypeError('Completed Generation Result requires an output')
  }
  if (input.status === 'FAILED' && issues.length === 0) {
    throw new TypeError('Failed Generation Result requires an issue')
  }
  if (input.status !== 'COMPLETED' && outputs.length > 0) {
    throw new TypeError(
      'Only a completed Generation Result may contain outputs',
    )
  }

  return Object.freeze({
    generationId: requireNonEmptyString(
      input.generationId,
      'generationId',
    ),
    status: input.status,
    outputs,
    issues,
  })
}
