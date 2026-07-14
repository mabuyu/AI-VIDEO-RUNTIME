import type { CompilerInputCandidate } from '../input'
import type { ProducerResult } from '../runtimeDataV2'
import type { RuntimeAudioTrack, RuntimeCompositionTrack, RuntimeDepthTrack, RuntimeEffectTrack } from '../../runtimeData/types'
import { isCompilerInputCandidate } from './types'
import type { MvpScenarioCompilerIssue, MvpScenarioCompilerResult } from './types'

const DURATION = 30_000
const PHASES = [
  { id: 'intro', start: 0, duration: 6_000, scene: 'hook', composition: 'hook' },
  { id: 'feature', start: 6_000, duration: 18_000, scene: 'value', composition: 'value' },
  { id: 'outro', start: 24_000, duration: 6_000, scene: 'contrast', composition: 'contrast' },
] as const

function issue(code: MvpScenarioCompilerIssue['code'], message: string, path?: string): MvpScenarioCompilerIssue {
  return { source: 'mvp-scenario-compiler', level: 'error', code, message, ...(path ? { path } : {}) }
}

function durationMs(value: { readonly value: number; readonly unit: 'seconds' | 'minutes' }): number {
  return value.value * (value.unit === 'minutes' ? 60_000 : 1_000)
}

function produced<T>(tracks: readonly T[], extra: Record<string, unknown> = {}): ProducerResult<{ readonly tracks: readonly T[] }> {
  return { success: true, value: { tracks, ...extra }, issues: [] }
}

export function compileMvpScenario(candidate: unknown): MvpScenarioCompilerResult {
  if (!isCompilerInputCandidate(candidate)) {
    return { success: false, issues: [issue('INVALID_COMPILER_INPUT', 'CompilerInputCandidate is incomplete')] }
  }
  const input: CompilerInputCandidate = candidate
  const issues: MvpScenarioCompilerIssue[] = []
  if (durationMs(input.projectIntent.targetDuration) !== DURATION) {
    issues.push(issue('UNSUPPORTED_SCENARIO', 'MVP scenario requires a 30 second project duration', 'projectIntent.targetDuration'))
  }
  if (input.sceneIntents.length !== PHASES.length) {
    issues.push(issue('UNSUPPORTED_SCENARIO', 'MVP scenario requires exactly intro, feature, and outro scene intents', 'sceneIntents'))
  }
  if (issues.length > 0) return { success: false, issues }

  const cameraPlan = [
    { scaleFrom: 1, scaleTo: 1.04, xFrom: 0, xTo: 0, yFrom: 0, yTo: 0, shake: 0 },
    { scaleFrom: 1.04, scaleTo: 1.1, xFrom: 0, xTo: -12, yFrom: 0, yTo: 0, shake: 0 },
    { scaleFrom: 1.1, scaleTo: 1, xFrom: -12, xTo: 0, yFrom: 0, yTo: 0, shake: 0 },
  ] as const
  const scenes = PHASES.map((phase, index) => {
    const semantic = input.sceneIntents[index]
    const camera = cameraPlan[index]
    return { scene: phase.scene, start: phase.start, duration: phase.duration, text: semantic.message, highlight: semantic.message, background: '#0b1020', position: 'center', animation: semantic.transitionIntent, camera }
  })
  const camera = PHASES.map((phase, index) => ({ id: `camera-${phase.id}`, start: phase.start, duration: phase.duration, ...cameraPlan[index] }))
  const subtitles = PHASES.map((phase, index) => ({ id: `subtitle-${phase.id}`, start: phase.start, duration: phase.duration, text: input.sceneIntents[index].message }))
  const effectTracks: readonly RuntimeEffectTrack[] = PHASES.map((phase, index) => ({ id: `effect-${phase.id}`, start: phase.start, duration: phase.duration, preset: index === 1 ? 'clean' : 'cinematic' }))
  const depthTracks: readonly RuntimeDepthTrack[] = PHASES.map((phase) => ({ id: `depth-${phase.id}`, start: phase.start, duration: phase.duration, preset: phase.id === 'feature' ? 'deep' : 'balanced' }))
  const compositionTracks: readonly RuntimeCompositionTrack[] = PHASES.map((phase) => ({ id: `composition-${phase.id}`, start: phase.start, duration: phase.duration, preset: phase.composition }))
  const wantsSilence = /^(silence|silent)$/i.test(input.audioIntent.intent.trim())
  const audioTracks: readonly RuntimeAudioTrack[] = wantsSilence
    ? [{ id: 'audio-main', type: 'silence', start: 0, duration: DURATION, volume: 0, segments: [{ start: 0, duration: DURATION }] }]
    : [{ id: 'audio-main', type: 'generated-audio', start: 0, duration: DURATION, volume: 0.8, segments: [{ start: 0, duration: DURATION, audioRef: 'generated-audio://mvp/product-promo-main' }] }]
  const trackTypes = ['scene', 'subtitle', 'camera', 'effect', 'depth', 'composition', 'audio'] as const

  return {
    success: true,
    output: {
      project: { title: input.projectIntent.title, author: 'MVP Scenario Compiler', version: '2', fps: 30, width: 1080, height: 1920, duration: DURATION, background: '#0b1020' },
      scenes,
      subtitles,
      timeline: { fps: 30, duration: DURATION, tracks: trackTypes.map((type) => ({ id: `${type}-main`, type, source: `${type === 'scene' ? 'scenes' : type === 'subtitle' ? 'subtitles' : type}.json`, enabled: true })) },
      camera,
      effect: produced(effectTracks),
      depth: produced(depthTracks),
      composition: produced(compositionTracks),
      audio: { success: true, value: { tracks: audioTracks, duration: DURATION }, issues: [] },
      diagnostics: [],
    },
  }
}
