import { RUNTIME_VALIDATION_CODES } from './types'
import type { RuntimeValidationIssue } from './types'
import { validateTimedPresetTracks } from './validateTimedPresetTracks'

const DEPTH_PRESETS = ['near', 'balanced', 'deep', 'cinematic'] as const

export function validateDepth(depth: unknown): RuntimeValidationIssue[] {
  return validateTimedPresetTracks(depth, {
    domain: 'depth',
    arrayRequiredCode: RUNTIME_VALIDATION_CODES.depthArrayRequired,
    objectRequiredCode: RUNTIME_VALIDATION_CODES.depthObjectRequired,
    duplicateIdCode: RUNTIME_VALIDATION_CODES.duplicateDepthId,
    overlapCode: RUNTIME_VALIDATION_CODES.depthOverlap,
    presets: DEPTH_PRESETS,
  })
}
