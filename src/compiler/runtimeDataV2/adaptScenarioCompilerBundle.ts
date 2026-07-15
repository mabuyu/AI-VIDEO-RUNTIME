import type { CompilerAdapterResult, ScenarioCompilerAdapterHandoffInput } from './types'
import { adaptCompilerOutputToRuntimeDataV2 } from './adaptCompilerOutputToRuntimeDataV2'

function failure(code: string, message: string, path: string): CompilerAdapterResult {
  return {
    success: false,
    issues: [{ source: 'compiler-adapter', level: 'error', code, message, path }],
  }
}

export function adaptScenarioCompilerBundle(input: unknown): CompilerAdapterResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return failure('INVALID_ADAPTER_INPUT', 'Scenario Compiler handoff must be an object', 'input')
  }

  const candidate = input as Partial<ScenarioCompilerAdapterHandoffInput>
  if (typeof candidate.generationId !== 'string' || candidate.generationId.length === 0) {
    return failure('MISSING_GENERATION_ID', 'Adapter input generationId is required', 'generationId')
  }
  if (typeof candidate.bundle !== 'object' || candidate.bundle === null) {
    return failure('INCOMPLETE_COMPILER_BUNDLE', 'CompilerDomainOutputBundle is required', 'bundle')
  }
  if (candidate.bundle.generationId !== candidate.generationId) {
    return failure(
      'GENERATION_ID_MISMATCH',
      'CompilerDomainOutputBundle generationId must match Adapter input generationId',
      'bundle.generationId',
    )
  }

  const { bundle } = candidate
  const requiredDomains = ['scene', 'timeline', 'camera', 'effect', 'depth', 'composition', 'audio'] as const
  for (const domain of requiredDomains) {
    if (bundle[domain] === undefined || bundle[domain] === null) {
      return failure('INCOMPLETE_COMPILER_BUNDLE', `${domain} domain is required`, `bundle.${domain}`)
    }
  }

  for (const domain of ['effect', 'depth', 'composition'] as const) {
    const parameterIndex = bundle[domain].tracks.findIndex((track) => Object.keys(track.parameters).length > 0)
    if (parameterIndex >= 0) {
      return failure(
        'UNMAPPABLE_DOMAIN_PARAMETERS',
        `${domain} parameters cannot be represented by the current RuntimeDataV2 contract`,
        `bundle.${domain}.tracks[${parameterIndex}].parameters`,
      )
    }
  }

  return adaptCompilerOutputToRuntimeDataV2({
    generationId: candidate.generationId,
    project: bundle.scene.project,
    scenes: bundle.scene.scenes,
    subtitles: bundle.scene.subtitles,
    timeline: bundle.timeline.timeline,
    camera: bundle.camera.tracks,
    effect: {
      success: true,
      value: { tracks: bundle.effect.tracks.map((track) => ({ id: track.id, start: track.start, duration: track.duration, preset: track.effect })) },
      issues: [],
    },
    depth: {
      success: true,
      value: { tracks: bundle.depth.tracks.map((track) => ({ id: track.id, start: track.start, duration: track.duration, preset: track.depth })) },
      issues: [],
    },
    composition: {
      success: true,
      value: { tracks: bundle.composition.tracks.map((track) => ({ id: track.id, start: track.start, duration: track.duration, preset: track.composition })) },
      issues: [],
    },
    audio: { success: true, value: bundle.audio, issues: [] },
    artifact: candidate.artifact,
    compatibility: candidate.compatibility,
    generation: candidate.generation,
    diagnostics: candidate.diagnostics,
  })
}
