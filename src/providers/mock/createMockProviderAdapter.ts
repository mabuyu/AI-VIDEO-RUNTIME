import type {
  GenerationResult,
  GenerationTask,
} from '../../production/contracts'
import type { ProviderAdapter } from '../contracts'
import { MOCK_PROVIDER_METADATA } from '../metadata'

function succeededResult(
  task: GenerationTask,
  providerTaskId: string,
): GenerationResult {
  return Object.freeze({
    taskId: task.taskId,
    providerId: MOCK_PROVIDER_METADATA.id,
    providerTaskId,
    status: 'SUCCEEDED',
    output: Object.freeze({
      mediaType: 'video',
      format: task.outputSpecification.format,
      reference: `mock-provider://generation/${providerTaskId}`,
    }),
    issues: Object.freeze([]),
  })
}

export function createMockProviderAdapter(): ProviderAdapter {
  return Object.freeze({
    metadata: MOCK_PROVIDER_METADATA,

    async generate(task: GenerationTask): Promise<GenerationResult> {
      return succeededResult(task, `mock-${task.taskId}`)
    },

    async getStatus(
      task: GenerationTask,
      providerTaskId: string,
    ): Promise<GenerationResult> {
      return succeededResult(task, providerTaskId)
    },

    async cancel(
      task: GenerationTask,
      providerTaskId: string,
    ): Promise<GenerationResult> {
      return Object.freeze({
        taskId: task.taskId,
        providerId: MOCK_PROVIDER_METADATA.id,
        providerTaskId,
        status: 'CANCELLED',
        output: null,
        issues: Object.freeze([]),
      })
    },
  })
}
