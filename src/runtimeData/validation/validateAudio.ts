import { RUNTIME_VALIDATION_CODES } from './types'
import type { RuntimeValidationIssue } from './types'
import { validateTimedPresetTracks } from './validateTimedPresetTracks'

const AUDIO_PRESETS = ['impact', 'dramatic', 'clean', 'cinematic'] as const

export function validateAudio(audio: unknown): RuntimeValidationIssue[] {
  return validateTimedPresetTracks(audio, {
    domain: 'audio',
    arrayRequiredCode: RUNTIME_VALIDATION_CODES.audioArrayRequired,
    objectRequiredCode: RUNTIME_VALIDATION_CODES.audioObjectRequired,
    duplicateIdCode: RUNTIME_VALIDATION_CODES.duplicateAudioId,
    overlapCode: RUNTIME_VALIDATION_CODES.audioOverlap,
    presets: AUDIO_PRESETS,
  })
}
