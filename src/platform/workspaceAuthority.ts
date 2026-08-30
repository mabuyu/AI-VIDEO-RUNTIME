import type {
  CreateWorkspaceInput,
  PlatformAuthorityIssue,
  Workspace,
  WorkspaceAuthority,
  WorkspaceMutationResult,
} from './contracts'
import {
  authorizeWorkspace,
  isAuthorizedPlatformUser,
  isAuthorizedWorkspace,
} from './authorityProvenance'

function failure(
  code: PlatformAuthorityIssue['code'],
  message: string,
  path?: string,
): WorkspaceMutationResult {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([Object.freeze({ code, message, path })]),
  })
}

function isBoundaryString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() === value && value.length > 0
}

function isTimestamp(value: unknown): value is string {
  return isBoundaryString(value) && Number.isFinite(Date.parse(value))
}

function validateWorkspace(workspace: Workspace): WorkspaceMutationResult | undefined {
  const value: unknown = workspace
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    !isAuthorizedWorkspace(value)
  ) {
    return failure(
      'INVALID_WORKSPACE',
      'Workspace mutation requires an authorized immutable snapshot',
    )
  }
  return undefined
}

function validateMutation(
  workspace: Workspace,
  updatedAt: string,
): WorkspaceMutationResult | undefined {
  const invalidWorkspace = validateWorkspace(workspace)
  if (invalidWorkspace !== undefined) return invalidWorkspace
  if (workspace.status === 'ARCHIVED') {
    return failure('WORKSPACE_ARCHIVED', 'Archived Workspace cannot mutate')
  }
  if (!isTimestamp(updatedAt)) {
    return failure('INVALID_TIMESTAMP', 'updatedAt must be a valid timestamp', 'updatedAt')
  }
  if (Date.parse(updatedAt) < Date.parse(workspace.updatedAt)) {
    return failure('TIMESTAMP_REGRESSION', 'updatedAt cannot precede the current snapshot', 'updatedAt')
  }
  return undefined
}

function success(workspace: Workspace): WorkspaceMutationResult {
  return Object.freeze({ ok: true, workspace })
}

export function createWorkspaceAuthority(): WorkspaceAuthority {
  return Object.freeze({
    createWorkspace(input: CreateWorkspaceInput) {
      const value: unknown = input
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return failure('INVALID_INPUT', 'Workspace input must be an object')
      }
      const candidate = value as unknown as Record<string, unknown>
      if (
        Object.keys(candidate).length !== 4 ||
        !['workspaceId', 'owner', 'name', 'createdAt'].every((key) => key in candidate)
      ) {
        return failure('INVALID_INPUT', 'Workspace input must contain only the authoritative fields')
      }
      if (!isBoundaryString(candidate.workspaceId)) {
        return failure('INVALID_INPUT', 'workspaceId must be a non-empty string', 'workspaceId')
      }
      if (!isBoundaryString(candidate.name)) {
        return failure('INVALID_INPUT', 'name must be a non-empty string', 'name')
      }
      if (!isTimestamp(candidate.createdAt)) {
        return failure('INVALID_TIMESTAMP', 'createdAt must be a valid timestamp', 'createdAt')
      }
      if (
        typeof candidate.owner !== 'object' ||
        candidate.owner === null ||
        !isAuthorizedPlatformUser(candidate.owner)
      ) {
        return failure('INVALID_USER', 'Workspace owner must be an authorized PlatformUser', 'owner')
      }
      const owner = candidate.owner as { readonly userId: string; readonly status: unknown }
      if (owner.status !== 'ACTIVE') {
        return failure('USER_DISABLED', 'Disabled PlatformUser cannot own a new Workspace', 'owner')
      }

      return success(authorizeWorkspace({
        workspaceId: candidate.workspaceId,
        ownerUserId: owner.userId,
        name: candidate.name,
        status: 'ACTIVE',
        version: 0,
        createdAt: candidate.createdAt,
        updatedAt: candidate.createdAt,
      }))
    },

    renameWorkspace(workspace: Workspace, name: string, updatedAt: string) {
      const invalidMutation = validateMutation(workspace, updatedAt)
      if (invalidMutation !== undefined) return invalidMutation
      if (!isBoundaryString(name)) {
        return failure('INVALID_INPUT', 'name must be a non-empty string', 'name')
      }
      return success(authorizeWorkspace({
        ...workspace,
        name,
        version: workspace.version + 1,
        updatedAt,
      }))
    },

    archiveWorkspace(workspace: Workspace, updatedAt: string) {
      const invalidMutation = validateMutation(workspace, updatedAt)
      if (invalidMutation !== undefined) return invalidMutation
      return success(authorizeWorkspace({
        ...workspace,
        status: 'ARCHIVED',
        version: workspace.version + 1,
        updatedAt,
      }))
    },
  })
}
