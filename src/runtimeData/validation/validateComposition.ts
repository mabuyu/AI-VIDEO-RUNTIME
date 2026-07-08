import { RUNTIME_VALIDATION_CODES } from './types'
import type { RuntimeValidationIssue } from './types'
import { validateTimedPresetTracks } from './validateTimedPresetTracks'

const COMPOSITION_PRESETS = ['hook', 'problem', 'value', 'contrast'] as const

export function validateComposition(composition: unknown): RuntimeValidationIssue[] {
  return validateTimedPresetTracks(composition, {
    domain: 'composition',
    arrayRequiredCode: RUNTIME_VALIDATION_CODES.compositionArrayRequired,
    objectRequiredCode: RUNTIME_VALIDATION_CODES.compositionObjectRequired,
    duplicateIdCode: RUNTIME_VALIDATION_CODES.duplicateCompositionId,
    overlapCode: RUNTIME_VALIDATION_CODES.compositionOverlap,
    presets: COMPOSITION_PRESETS,
  })
}
