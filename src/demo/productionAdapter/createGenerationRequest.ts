import type {
  GenerationQualityTier,
  GenerationRequest,
} from './types'

const qualityTiers: readonly GenerationQualityTier[] = Object.freeze([
  'BASIC',
  'STANDARD',
  'PROFESSIONAL',
  'ENTERPRISE',
])

function requireNonEmptyString(value: string, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${field} must be a non-empty string`)
  }

  return value
}

function requirePositiveFiniteNumber(
  value: number,
  field: string,
): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${field} must be a positive finite number`)
  }

  return value
}

function requirePositiveInteger(value: number, field: string): number {
  requirePositiveFiniteNumber(value, field)
  if (!Number.isInteger(value)) {
    throw new TypeError(`${field} must be an integer`)
  }

  return value
}

export function createGenerationRequest(
  input: GenerationRequest,
): GenerationRequest {
  if (typeof input !== 'object' || input === null) {
    throw new TypeError('Generation Request is invalid')
  }
  if (!qualityTiers.includes(input.qualityTier)) {
    throw new TypeError('qualityTier is unsupported')
  }

  return Object.freeze({
    requestId: requireNonEmptyString(input.requestId, 'requestId'),
    prompt: requireNonEmptyString(input.prompt, 'prompt'),
    style: requireNonEmptyString(input.style, 'style'),
    duration: requirePositiveFiniteNumber(input.duration, 'duration'),
    sceneCount: requirePositiveInteger(input.sceneCount, 'sceneCount'),
    qualityTier: input.qualityTier,
  })
}
