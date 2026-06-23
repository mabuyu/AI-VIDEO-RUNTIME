import { compileCamera } from './compileCamera'
import { compileTimeline } from './compileTimeline'
import type { CompilerInput, CompilerOutput } from './types'
import { validateSemanticInput } from './validateSemanticInput'

export function compile(input: CompilerInput): CompilerOutput {
  const diagnostics = validateSemanticInput(input)
  const hasError = diagnostics.some((diagnostic) => diagnostic.level === 'error')

  if (hasError) {
    return {
      timeline: null,
      camera: null,
      diagnostics,
    }
  }

  return {
    timeline: compileTimeline(input),
    camera: compileCamera(input.scenes),
    diagnostics,
  }
}

export type {
  CompiledCameraTrack,
  CompiledTimeline,
  CompiledTimelineTrack,
  CompilerDiagnostic,
  CompilerInput,
  CompilerOutput,
  SceneCameraIntent,
  SemanticProject,
  SemanticScene,
  SemanticSubtitle,
} from './types'
