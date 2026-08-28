import type {
  ProductionJobDispatch,
  ProductionJobDispatchId,
} from './contracts'

const DISPATCH_KEYS: readonly string[] = Object.freeze([
  'dispatchId',
  'jobId',
  'expectedVersion',
  'availableAt',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isBoundaryString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value === value.trim() &&
    !Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0)
      return codePoint !== undefined && (codePoint <= 31 || codePoint === 127)
    })
  )
}

function isValidTimestamp(value: unknown): value is string {
  return isBoundaryString(value) && Number.isFinite(Date.parse(value))
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function materializeRecord(candidate: unknown): Record<string, unknown> | null {
  if (!isRecord(candidate)) return null

  try {
    const keys = Reflect.ownKeys(candidate)
    if (
      keys.length !== DISPATCH_KEYS.length ||
      !keys.every(
        (key) => typeof key === 'string' && DISPATCH_KEYS.includes(key),
      )
    ) {
      return null
    }

    const value: Record<string, unknown> = Object.create(null) as Record<
      string,
      unknown
    >
    for (const key of DISPATCH_KEYS) value[key] = candidate[key]
    return value
  } catch {
    return null
  }
}

export function materializeProductionJobDispatch(
  candidate: unknown,
): ProductionJobDispatch | null {
  const value = materializeRecord(candidate)
  if (
    value === null ||
    !isBoundaryString(value.jobId) ||
    !isNonNegativeSafeInteger(value.expectedVersion) ||
    !isValidTimestamp(value.availableAt)
  ) {
    return null
  }

  const expectedDispatchId: ProductionJobDispatchId =
    `production-job-dispatch:${value.jobId}:${value.expectedVersion}`
  if (value.dispatchId !== expectedDispatchId) return null

  return Object.freeze({
    dispatchId: expectedDispatchId,
    jobId: value.jobId,
    expectedVersion: value.expectedVersion,
    availableAt: value.availableAt,
  })
}
