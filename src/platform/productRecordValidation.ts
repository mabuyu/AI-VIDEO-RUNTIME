import type {
  ProductRepositoryIssue,
  ProductRepositoryIssueCode,
  ProductRepositorySaveResult,
  ProjectRecord,
  WorkspaceMembershipRecord,
  WorkspaceRecord,
} from './contracts'

const WORKSPACE_RECORD_KEYS = Object.freeze([
  'workspaceId',
  'ownerUserId',
  'name',
  'status',
  'version',
  'createdAt',
  'updatedAt',
])
const PROJECT_RECORD_KEYS = Object.freeze([
  'projectId',
  'workspaceId',
  'name',
  'status',
  'version',
  'createdAt',
  'updatedAt',
])
const MEMBERSHIP_RECORD_KEYS = Object.freeze([
  'membershipId',
  'workspaceId',
  'userId',
  'role',
  'status',
  'version',
  'createdAt',
  'updatedAt',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value)
  return (
    actual.length === keys.length && actual.every((key) => keys.includes(key))
  )
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

function isVersion(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function hasValidTimestamps(value: Record<string, unknown>): boolean {
  return (
    isBoundaryString(value.createdAt) &&
    isBoundaryString(value.updatedAt) &&
    Number.isFinite(Date.parse(value.createdAt)) &&
    Number.isFinite(Date.parse(value.updatedAt)) &&
    Date.parse(value.updatedAt) >= Date.parse(value.createdAt)
  )
}

export function isValidWorkspaceRecord(
  value: unknown,
): value is WorkspaceRecord {
  return (
    isRecord(value) &&
    hasExactKeys(value, WORKSPACE_RECORD_KEYS) &&
    isBoundaryString(value.workspaceId) &&
    isBoundaryString(value.ownerUserId) &&
    isBoundaryString(value.name) &&
    (value.status === 'ACTIVE' || value.status === 'ARCHIVED') &&
    isVersion(value.version) &&
    hasValidTimestamps(value)
  )
}

export function isValidProjectRecord(value: unknown): value is ProjectRecord {
  return (
    isRecord(value) &&
    hasExactKeys(value, PROJECT_RECORD_KEYS) &&
    isBoundaryString(value.projectId) &&
    isBoundaryString(value.workspaceId) &&
    isBoundaryString(value.name) &&
    (value.status === 'ACTIVE' || value.status === 'ARCHIVED') &&
    isVersion(value.version) &&
    hasValidTimestamps(value)
  )
}

export function isValidWorkspaceMembershipRecord(
  value: unknown,
): value is WorkspaceMembershipRecord {
  return (
    isRecord(value) &&
    hasExactKeys(value, MEMBERSHIP_RECORD_KEYS) &&
    isBoundaryString(value.membershipId) &&
    isBoundaryString(value.workspaceId) &&
    isBoundaryString(value.userId) &&
    value.membershipId ===
      `workspace-membership:${value.workspaceId}:${value.userId}` &&
    (value.role === 'OWNER' ||
      value.role === 'EDITOR' ||
      value.role === 'VIEWER') &&
    (value.status === 'ACTIVE' || value.status === 'REVOKED') &&
    isVersion(value.version) &&
    hasValidTimestamps(value)
  )
}

export function repositoryFailure(
  code: ProductRepositoryIssueCode,
  message: string,
): ProductRepositorySaveResult {
  const issue: ProductRepositoryIssue = Object.freeze({ code, message })
  return Object.freeze({ ok: false, issues: Object.freeze([issue]) })
}

export function repositorySuccess(): ProductRepositorySaveResult {
  return Object.freeze({ ok: true })
}

export function validateCas(
  currentVersion: number | undefined,
  incomingVersion: number,
  expectedVersion: number | null,
): ProductRepositorySaveResult | undefined {
  if (currentVersion === undefined) {
    if (expectedVersion !== null) {
      return repositoryFailure(
        'VERSION_CONFLICT',
        'New record requires expectedVersion null',
      )
    }
    if (incomingVersion !== 0) {
      return repositoryFailure(
        'VERSION_SEQUENCE_INVALID',
        'New record must begin at version 0',
      )
    }
    return undefined
  }

  if (expectedVersion !== currentVersion) {
    return repositoryFailure(
      'VERSION_CONFLICT',
      'expectedVersion does not match the stored record version',
    )
  }
  if (incomingVersion !== currentVersion + 1) {
    return repositoryFailure(
      'VERSION_SEQUENCE_INVALID',
      'Updated record version must increment exactly once',
    )
  }
  return undefined
}
