import type { RuntimeDataV2 } from '../../runtimeData/types'
import { createCompilerArtifactOutput } from './createCompilerArtifactOutput'
import type {
  CompilerAdapterIssue,
  CompilerAdapterResult,
  CompilerProducerDomain,
  ProducerResult,
  RuntimeDataV2CompilerAdapterInput,
} from './types'

const REQUIRED_DOMAINS = [
  'project', 'scenes', 'subtitles', 'timeline', 'camera',
  'effect', 'depth', 'composition', 'audio',
] as const
const REQUIRED_TIMELINE_TRACKS = [
  'scene', 'subtitle', 'camera', 'effect', 'depth', 'composition', 'audio',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function issue(code: string, message: string, path?: string): CompilerAdapterIssue {
  return { source: 'compiler-adapter', level: 'error', code, message, ...(path ? { path } : {}) }
}

function checkProducer(
  domain: CompilerProducerDomain,
  value: unknown,
  issues: CompilerAdapterIssue[],
): value is ProducerResult<{ readonly tracks: readonly unknown[] }> {
  if (!isRecord(value) || typeof value.success !== 'boolean' || !Array.isArray(value.issues)) {
    issues.push(issue('INVALID_PRODUCER_RESULT', `${domain} must be a ProducerResult`, domain))
    return false
  }
  if (!value.success) {
    const producerIssues = value.issues.filter(isRecord)
    if (producerIssues.length === 0) {
      issues.push(issue('PRODUCER_FAILURE', `${domain} producer failed`, domain))
    } else {
      producerIssues.forEach((producerIssue) => {
        issues.push({
          source: domain,
          level: 'error',
          code: typeof producerIssue.code === 'string' ? producerIssue.code : 'PRODUCER_FAILURE',
          message: typeof producerIssue.message === 'string' ? producerIssue.message : `${domain} producer failed`,
          path: typeof producerIssue.path === 'string' ? producerIssue.path : domain,
        })
      })
    }
    return false
  }
  if (value.issues.some((producerIssue) => isRecord(producerIssue) && producerIssue.level === 'error')) {
    issues.push(issue('INVALID_PRODUCER_SUCCESS', `${domain} producer success must not contain error issues`, `${domain}.issues`))
    return false
  }
  if (!isRecord(value.value) || !Array.isArray(value.value.tracks)) {
    issues.push(issue('INVALID_DOMAIN_OUTPUT', `${domain} output must contain tracks`, `${domain}.value.tracks`))
    return false
  }
  if (value.value.tracks.length === 0) {
    issues.push(issue('EMPTY_DOMAIN_OUTPUT', `${domain} output tracks must not be empty`, `${domain}.value.tracks`))
    return false
  }
  return true
}

export function adaptCompilerOutputToRuntimeDataV2(input: unknown): CompilerAdapterResult {
  const issues: CompilerAdapterIssue[] = []
  if (!isRecord(input)) {
    return { success: false, issues: [issue('INVALID_ADAPTER_INPUT', 'adapter input must be an object')] }
  }

  for (const domain of REQUIRED_DOMAINS) {
    if (!(domain in input) || input[domain] === undefined || input[domain] === null) {
      issues.push(issue('MISSING_DOMAIN', `${domain} domain is required`, domain))
    }
  }
  if (issues.length > 0) return { success: false, issues }

  if (!isRecord(input.project)) issues.push(issue('INVALID_DOMAIN_OUTPUT', 'project must be an object', 'project'))
  if (!Array.isArray(input.scenes)) issues.push(issue('INVALID_DOMAIN_OUTPUT', 'scenes must be an array', 'scenes'))
  if (!Array.isArray(input.subtitles)) issues.push(issue('INVALID_DOMAIN_OUTPUT', 'subtitles must be an array', 'subtitles'))
  if (!isRecord(input.timeline) || !Array.isArray(input.timeline.tracks)) issues.push(issue('INVALID_DOMAIN_OUTPUT', 'timeline must contain tracks', 'timeline'))
  if (!Array.isArray(input.camera)) issues.push(issue('INVALID_DOMAIN_OUTPUT', 'camera must be an array', 'camera'))
  if (!isRecord(input.artifact) || typeof input.artifact.id !== 'string' || typeof input.artifact.revision !== 'string' || typeof input.artifact.createdAt !== 'string') {
    issues.push(issue('INVALID_ARTIFACT_IDENTITY', 'artifact identity requires id, revision, and createdAt strings', 'artifact'))
  }
  if (!isRecord(input.compatibility) || !('schemaVersion' in input.compatibility) || !('runtimeSchemaVersion' in input.compatibility)) {
    issues.push(issue('INVALID_COMPATIBILITY', 'compatibility requires schemaVersion and runtimeSchemaVersion', 'compatibility'))
  }
  if (!isRecord(input.generation) || typeof input.generation.compilerVersion !== 'string' || !('promptContractVersion' in input.generation) || typeof input.generation.generatedAt !== 'string') {
    issues.push(issue('INVALID_GENERATION_METADATA', 'generation metadata is incomplete', 'generation'))
  }
  if (!Array.isArray(input.diagnostics)) issues.push(issue('INVALID_DIAGNOSTICS', 'diagnostics must be an array', 'diagnostics'))

  const effectOk = checkProducer('effect', input.effect, issues)
  const depthOk = checkProducer('depth', input.depth, issues)
  const compositionOk = checkProducer('composition', input.composition, issues)
  const audioOk = checkProducer('audio', input.audio, issues)

  if (isRecord(input.timeline) && isRecord(input.project)) {
    if (input.timeline.fps !== input.project.fps) issues.push(issue('TIMELINE_FPS_MISMATCH', 'project and timeline fps must match', 'timeline.fps'))
    if (input.timeline.duration !== input.project.duration) issues.push(issue('TIMELINE_DURATION_MISMATCH', 'project and timeline duration must match', 'timeline.duration'))
    if (Array.isArray(input.timeline.tracks)) {
      for (const type of REQUIRED_TIMELINE_TRACKS) {
        const registrations = input.timeline.tracks.filter((track) => isRecord(track) && track.type === type && track.enabled === true)
        if (registrations.length !== 1) issues.push(issue('TIMELINE_TRACK_REGISTRATION_INVALID', `timeline requires exactly one enabled ${type} track`, 'timeline.tracks'))
      }
    }
  }

  if (Array.isArray(input.scenes) && Array.isArray(input.camera)) {
    const cameraTracks = input.camera
    if (input.scenes.length !== cameraTracks.length) {
      issues.push(issue('CAMERA_COUNT_MISMATCH', 'camera count must match scene count', 'camera'))
    } else {
      input.scenes.forEach((scene, index) => {
        const camera = cameraTracks[index]
        if (!isRecord(scene) || !isRecord(camera) || scene.start !== camera.start || scene.duration !== camera.duration) {
          issues.push(issue('CAMERA_SCENE_ALIGNMENT_MISMATCH', 'camera timing must match its scene', `camera[${index}]`))
        }
      })
    }
  }

  const audioResult = input.audio
  if (audioOk && isRecord(audioResult) && isRecord(audioResult.value) && isRecord(input.project) && audioResult.value.duration !== input.project.duration) {
    issues.push(issue('AUDIO_DURATION_MISMATCH', 'audio duration must match project and timeline duration', 'audio.value.duration'))
  }

  if (Array.isArray(input.diagnostics) && input.diagnostics.some((diagnostic) => isRecord(diagnostic) && diagnostic.level === 'error')) {
    issues.push(issue('COMPILER_ERROR_DIAGNOSTIC', 'compiler error diagnostics prevent artifact creation', 'diagnostics'))
  }
  if (issues.length > 0 || !effectOk || !depthOk || !compositionOk || !audioOk) return { success: false, issues }

  const typedInput = input as unknown as RuntimeDataV2CompilerAdapterInput
  const effect = typedInput.effect as Extract<typeof typedInput.effect, { readonly success: true }>
  const depth = typedInput.depth as Extract<typeof typedInput.depth, { readonly success: true }>
  const composition = typedInput.composition as Extract<typeof typedInput.composition, { readonly success: true }>
  const audio = typedInput.audio as Extract<typeof typedInput.audio, { readonly success: true }>
  const runtimeData: RuntimeDataV2 = {
    project: typedInput.project,
    scenes: typedInput.scenes,
    subtitles: typedInput.subtitles,
    timeline: typedInput.timeline,
    camera: typedInput.camera,
    effect: effect.value.tracks,
    depth: depth.value.tracks,
    composition: composition.value.tracks,
    audio: audio.value.tracks,
  }
  return { success: true, output: createCompilerArtifactOutput(typedInput, runtimeData) }
}
