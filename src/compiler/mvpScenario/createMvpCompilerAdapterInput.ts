import type { RuntimeDataV2CompilerAdapterInput } from '../runtimeDataV2'
import type { MvpScenarioArtifactMetadata, MvpScenarioCompilerOutput } from './types'

export function createMvpCompilerAdapterInput(output: MvpScenarioCompilerOutput, metadata: MvpScenarioArtifactMetadata): RuntimeDataV2CompilerAdapterInput {
  return { ...output, ...metadata }
}
