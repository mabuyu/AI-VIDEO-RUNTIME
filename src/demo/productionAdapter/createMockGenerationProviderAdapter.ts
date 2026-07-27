import { createGenerationRequest } from './createGenerationRequest'
import { createGenerationResult } from './createGenerationResult'
import type {
  GenerationProviderAdapter,
  GenerationRequest,
} from './types'

export function createMockGenerationProviderAdapter(): GenerationProviderAdapter {
  return Object.freeze({
    async generate(request: GenerationRequest) {
      const safeRequest = createGenerationRequest(request)

      return createGenerationResult({
        generationId: `mock-generation-${safeRequest.requestId}`,
        status: 'COMPLETED',
        outputs: [
          {
            outputId: `mock-output-${safeRequest.requestId}`,
            mediaType: 'video',
            format: 'mp4',
          },
        ],
        issues: [],
      })
    },
  })
}
