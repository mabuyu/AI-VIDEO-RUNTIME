import type { GenerationOutput } from '../../artifacts/contracts'
import type { GenerationResult } from '../../production/contracts'
import { validateGenerationResult } from '../../production/validation'

export interface GenerationOutputAdaptationIssue {
  readonly code:
    | 'INVALID_GENERATION_RESULT'
    | 'GENERATION_RESULT_NOT_SUCCEEDED'
  readonly message: string
}

export type GenerationOutputAdaptationResult =
  | {
      readonly ok: true
      readonly output: GenerationOutput
    }
  | {
      readonly ok: false
      readonly issues: readonly GenerationOutputAdaptationIssue[]
    }

function failure(
  code: GenerationOutputAdaptationIssue['code'],
  message: string,
): GenerationOutputAdaptationResult {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([Object.freeze({ code, message })]),
  })
}

export function adaptGenerationResultToOutput(
  candidate: unknown,
): GenerationOutputAdaptationResult {
  const validation = validateGenerationResult(candidate)
  if (!validation.valid) {
    return failure(
      'INVALID_GENERATION_RESULT',
      validation.issues[0]?.message ??
        'GenerationOutput requires a valid GenerationResult',
    )
  }

  const result = candidate as GenerationResult
  if (
    result.status !== 'SUCCEEDED' ||
    result.output === null ||
    result.providerTaskId === null
  ) {
    return failure(
      'GENERATION_RESULT_NOT_SUCCEEDED',
      'GenerationOutput requires a successful GenerationResult',
    )
  }

  const generationResultId =
    `generation-result:${result.providerId}:${result.providerTaskId}`

  return Object.freeze({
    ok: true,
    output: Object.freeze({
      id: `generation-output:${result.providerId}:${result.providerTaskId}`,
      generationResultId,
      providerId: result.providerId,
      outputReference: result.output.reference,
      metadata: Object.freeze({
        mediaType: result.output.mediaType,
        format: result.output.format,
        taskId: result.taskId,
        providerTaskId: result.providerTaskId,
      }),
    }),
  })
}
