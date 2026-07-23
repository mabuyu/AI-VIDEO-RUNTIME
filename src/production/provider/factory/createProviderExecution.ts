import type {
  GenerationRequest,
  ProviderExecutionIssue,
  ProviderExecutionResult,
  VideoProvider,
} from '../types/providerExecution'
import type {
  ProviderMetadataValue,
  VideoReference,
} from '../types/videoReference'
import {
  isGenerationRequest,
  isVideoReference,
  validateGenerationRequest,
  validateProviderExecution,
  validateVideoReference,
} from '../validation/validateProviderExecution'

export interface CreateProviderExecutionInput {
  readonly requestId: string
  readonly generationIntent: string
  readonly outputSpecification: {
    readonly mediaType: 'video'
    readonly format: string
  }
}

function freezeIssues(
  issues: readonly ProviderExecutionIssue[],
): readonly ProviderExecutionIssue[] {
  return Object.freeze(issues.map((issue) => Object.freeze({ ...issue })))
}

function failure(
  issues: readonly ProviderExecutionIssue[],
): ProviderExecutionResult {
  const result: ProviderExecutionResult = Object.freeze({
    ok: false,
    issues: freezeIssues(issues),
  })

  return validateProviderExecution(result).valid
    ? result
    : Object.freeze({
        ok: false,
        issues: Object.freeze([
          Object.freeze({
            code: 'PROVIDER_EXECUTION_FAILED',
            message: 'Provider execution failed without a valid boundary result',
          }),
        ]),
      })
}

function freezeMetadataValue(
  value: ProviderMetadataValue,
): ProviderMetadataValue {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(freezeMetadataValue))
  }

  if (typeof value === 'object' && value !== null) {
    return Object.freeze(
      Object.fromEntries(
        Object.entries(value).map(([key, nestedValue]) => [
          key,
          freezeMetadataValue(nestedValue),
        ]),
      ),
    )
  }

  return value
}

function freezeReference(reference: VideoReference): VideoReference {
  const metadata =
    reference.metadata === undefined
      ? undefined
      : Object.freeze(
          Object.fromEntries(
            Object.entries(reference.metadata).map(([key, value]) => [
              key,
              freezeMetadataValue(value),
            ]),
          ),
        )

  return Object.freeze({
    referenceId: reference.referenceId,
    sourceType: reference.sourceType,
    location: reference.location,
    ...(metadata === undefined ? {} : { metadata }),
  })
}

export async function createProviderExecution(
  input: CreateProviderExecutionInput,
  provider: VideoProvider,
): Promise<ProviderExecutionResult> {
  const inputRecord =
    typeof input === 'object' && input !== null
      ? (input as Partial<CreateProviderExecutionInput>)
      : {}
  const outputSpecification =
    typeof inputRecord.outputSpecification === 'object' &&
    inputRecord.outputSpecification !== null
      ? inputRecord.outputSpecification
      : undefined
  const requestCandidate = {
    requestId: inputRecord.requestId,
    generationIntent: inputRecord.generationIntent,
    outputSpecification: {
      mediaType: outputSpecification?.mediaType,
      format: outputSpecification?.format,
    },
  }

  const requestValidation = validateGenerationRequest(requestCandidate)
  if (!requestValidation.valid) {
    return failure(requestValidation.issues)
  }

  if (!isGenerationRequest(requestCandidate)) {
    return failure([
      {
        code: 'INVALID_REQUEST',
        message: 'Provider request could not be narrowed to GenerationRequest',
      },
    ])
  }

  const request: GenerationRequest = Object.freeze({
    requestId: requestCandidate.requestId,
    generationIntent: requestCandidate.generationIntent,
    outputSpecification: Object.freeze({
      mediaType: 'video',
      format: requestCandidate.outputSpecification.format,
    }),
  })

  let providerOutput: unknown
  try {
    providerOutput = await provider.generate(request)
  } catch {
    return failure([
      {
        code: 'PROVIDER_EXECUTION_FAILED',
        message: 'VideoProvider execution failed',
      },
    ])
  }

  const referenceValidation = validateVideoReference(providerOutput)
  if (!referenceValidation.valid) {
    return failure(referenceValidation.issues)
  }

  if (!isVideoReference(providerOutput)) {
    return failure([
      {
        code: 'INVALID_VIDEO_REFERENCE',
        message: 'Provider output could not be narrowed to VideoReference',
      },
    ])
  }

  const reference = freezeReference(providerOutput)
  const result: ProviderExecutionResult = Object.freeze({
    ok: true,
    reference,
  })
  const resultValidation = validateProviderExecution(result)

  return resultValidation.valid ? result : failure(resultValidation.issues)
}
