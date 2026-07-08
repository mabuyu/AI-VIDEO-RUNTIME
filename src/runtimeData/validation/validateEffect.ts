import { RUNTIME_VALIDATION_CODES } from './types'
import type { RuntimeValidationIssue } from './types'
import { validateTimedPresetTracks } from './validateTimedPresetTracks'

const EFFECT_PRESETS = ['cinematic', 'dramatic', 'clean', 'dream'] as const

export function validateEffect(effect: unknown): RuntimeValidationIssue[] {
  return validateTimedPresetTracks(effect, {
    domain: 'effect',
    arrayRequiredCode: RUNTIME_VALIDATION_CODES.effectArrayRequired,
    objectRequiredCode: RUNTIME_VALIDATION_CODES.effectObjectRequired,
    duplicateIdCode: RUNTIME_VALIDATION_CODES.duplicateEffectId,
    overlapCode: RUNTIME_VALIDATION_CODES.effectOverlap,
    presets: EFFECT_PRESETS,
  })
}
