import type { RuntimeDataV2 } from '../../runtimeData/types'
import type {
  CompilerArtifactOutput,
  RuntimeDataV2CompilerAdapterInput,
} from './types'

export function createCompilerArtifactOutput(
  input: RuntimeDataV2CompilerAdapterInput,
  runtimeData: RuntimeDataV2,
): CompilerArtifactOutput {
  return {
    artifact: input.artifact,
    compatibility: input.compatibility,
    generation: input.generation,
    runtimeData,
    diagnostics: input.diagnostics.map(({ level, code, message, path, suggestion }) => ({
      level: level === 'error' ? 'warning' : level,
      code,
      message,
      ...(path === undefined ? {} : { path }),
      ...(suggestion === undefined ? {} : { suggestion }),
    })),
  }
}
