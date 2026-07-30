import type {
  GenerationResult,
  GenerationTask,
} from '../../production/contracts'
import type { ProviderMetadata } from './providerMetadata'

export interface ProviderAdapter {
  readonly metadata: ProviderMetadata
  generate(task: GenerationTask): Promise<GenerationResult>
  getStatus(
    task: GenerationTask,
    providerTaskId: string,
  ): Promise<GenerationResult>
  cancel(
    task: GenerationTask,
    providerTaskId: string,
  ): Promise<GenerationResult>
}
