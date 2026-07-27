import { createGenerationRequest } from './createGenerationRequest'
import { createGenerationResult } from './createGenerationResult'
import type {
  GenerationProviderAdapter,
  GenerationRequest,
  GenerationResult,
  ProductionAdapterService,
} from './types'

function createFailedResult(
  requestId: string,
  code: string,
  message: string,
): GenerationResult {
  return createGenerationResult({
    generationId: `failed-generation-${requestId}`,
    status: 'FAILED',
    outputs: [],
    issues: [{ code, message }],
  })
}

export function createProductionAdapterService(
  provider: GenerationProviderAdapter,
): ProductionAdapterService {
  if (
    typeof provider !== 'object' ||
    provider === null ||
    typeof provider.generate !== 'function'
  ) {
    throw new TypeError('Generation Provider Adapter is required')
  }

  return Object.freeze({
    async generate(request: GenerationRequest): Promise<GenerationResult> {
      const safeRequest = createGenerationRequest(request)

      try {
        const providerResult = await provider.generate(safeRequest)
        const safeResult = createGenerationResult(providerResult)

        if (safeResult.status !== 'COMPLETED') {
          return createFailedResult(
            safeRequest.requestId,
            'GENERATION_NOT_COMPLETED',
            `Provider returned non-terminal success status: ${safeResult.status}`,
          )
        }

        return safeResult
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Generation Provider failed'

        return createFailedResult(
          safeRequest.requestId,
          'GENERATION_PROVIDER_FAILURE',
          message,
        )
      }
    },
  })
}
