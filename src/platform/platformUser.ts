import type {
  CreatePlatformUserInput,
  PlatformAuthorityIssue,
  PlatformUserCreationResult,
  PlatformUserStatus,
} from './contracts'
import { authorizePlatformUser } from './authorityProvenance'

const USER_STATUSES: readonly PlatformUserStatus[] = Object.freeze([
  'ACTIVE',
  'DISABLED',
])

function failure(
  code: PlatformAuthorityIssue['code'],
  message: string,
  path?: string,
): PlatformUserCreationResult {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([Object.freeze({ code, message, path })]),
  })
}

function isBoundaryString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() === value && value.length > 0
}

export function createPlatformUser(
  input: CreatePlatformUserInput,
): PlatformUserCreationResult {
  const value: unknown = input
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return failure('INVALID_INPUT', 'PlatformUser input must be an object')
  }

  const candidate = value as Record<string, unknown>
  const allowedKeys = ['userId', 'status', 'createdAt']
  if (Object.keys(candidate).some((key) => !allowedKeys.includes(key))) {
    return failure('INVALID_INPUT', 'PlatformUser input contains unknown fields')
  }
  if (!isBoundaryString(candidate.userId)) {
    return failure('INVALID_INPUT', 'userId must be a non-empty string', 'userId')
  }
  const status = candidate.status ?? 'ACTIVE'
  if (!USER_STATUSES.includes(status as PlatformUserStatus)) {
    return failure('INVALID_INPUT', 'PlatformUser status is unsupported', 'status')
  }
  if (
    !isBoundaryString(candidate.createdAt) ||
    !Number.isFinite(Date.parse(candidate.createdAt))
  ) {
    return failure('INVALID_TIMESTAMP', 'createdAt must be a valid timestamp', 'createdAt')
  }

  const user = authorizePlatformUser({
    userId: candidate.userId,
    status: status as PlatformUserStatus,
    createdAt: candidate.createdAt,
  })
  return Object.freeze({ ok: true, user })
}
