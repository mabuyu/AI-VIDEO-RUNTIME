import {
  authorizeWorkspaceMembership,
  isAuthorizedPlatformUser,
  isAuthorizedWorkspace,
  isAuthorizedWorkspaceMembership,
} from './authorityProvenance'
import type {
  CreateWorkspaceMembershipInput,
  Workspace,
  WorkspaceMembership,
  WorkspaceMembershipAuthority,
  WorkspaceMembershipAuthorityIssue,
  WorkspaceMembershipAuthorityIssueCode,
  WorkspaceMembershipMutationResult,
  WorkspaceMembershipRole,
} from './contracts'

const MEMBERSHIP_ROLES: readonly WorkspaceMembershipRole[] = Object.freeze([
  'OWNER',
  'EDITOR',
  'VIEWER',
])
const CREATE_INPUT_KEYS = Object.freeze([
  'workspace',
  'user',
  'role',
  'createdAt',
  'actorMembership',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value === value.trim() &&
    Number.isFinite(Date.parse(value))
  )
}

function freezeIssues(
  issues: readonly WorkspaceMembershipAuthorityIssue[],
): readonly WorkspaceMembershipAuthorityIssue[] {
  return Object.freeze(
    issues.map((issue) =>
      Object.freeze({
        code: issue.code,
        message: issue.message,
        ...(issue.path === undefined ? {} : { path: issue.path }),
      }),
    ),
  )
}

function failure(
  code: WorkspaceMembershipAuthorityIssueCode,
  message: string,
  path?: string,
): WorkspaceMembershipMutationResult {
  return Object.freeze({
    ok: false,
    issues: freezeIssues([
      { code, message, ...(path === undefined ? {} : { path }) },
    ]),
  })
}

function success(
  membership: WorkspaceMembership,
): WorkspaceMembershipMutationResult {
  return Object.freeze({ ok: true, membership })
}

function validateWorkspace(
  value: unknown,
): WorkspaceMembershipMutationResult | undefined {
  if (!isRecord(value) || !isAuthorizedWorkspace(value)) {
    return failure(
      'INVALID_WORKSPACE',
      'Membership mutation requires an authorized Workspace',
      'workspace',
    )
  }
  if ((value as unknown as Workspace).status !== 'ACTIVE') {
    return failure(
      'WORKSPACE_ARCHIVED',
      'Archived Workspace membership cannot mutate',
      'workspace',
    )
  }
  return undefined
}

function validateMembership(
  value: unknown,
  path: string,
): WorkspaceMembershipMutationResult | undefined {
  if (!isRecord(value) || !isAuthorizedWorkspaceMembership(value)) {
    return failure(
      'INVALID_MEMBERSHIP',
      'Membership mutation requires an authorized immutable snapshot',
      path,
    )
  }
  return undefined
}

function validateActor(
  workspace: Workspace,
  actorMembership: WorkspaceMembership,
): WorkspaceMembershipMutationResult | undefined {
  const invalidActor = validateMembership(actorMembership, 'actorMembership')
  if (invalidActor !== undefined) return invalidActor
  if (actorMembership.workspaceId !== workspace.workspaceId) {
    return failure(
      'MEMBERSHIP_MISMATCH',
      'Managing membership must belong to the target Workspace',
      'actorMembership.workspaceId',
    )
  }
  if (actorMembership.status !== 'ACTIVE') {
    return failure(
      'MEMBERSHIP_REVOKED',
      'Revoked membership cannot manage membership',
      'actorMembership',
    )
  }
  if (actorMembership.role !== 'OWNER') {
    return failure(
      'MEMBERSHIP_MANAGEMENT_DENIED',
      'Only OWNER membership can manage membership',
      'actorMembership.role',
    )
  }
  return undefined
}

function validateTarget(
  workspace: Workspace,
  membership: WorkspaceMembership,
  updatedAt: string,
): WorkspaceMembershipMutationResult | undefined {
  const invalidMembership = validateMembership(membership, 'membership')
  if (invalidMembership !== undefined) return invalidMembership
  if (membership.workspaceId !== workspace.workspaceId) {
    return failure(
      'MEMBERSHIP_MISMATCH',
      'Target membership must belong to the target Workspace',
      'membership.workspaceId',
    )
  }
  if (membership.status !== 'ACTIVE') {
    return failure(
      'MEMBERSHIP_REVOKED',
      'Revoked membership cannot mutate',
      'membership',
    )
  }
  if (!isTimestamp(updatedAt)) {
    return failure(
      'INVALID_TIMESTAMP',
      'updatedAt must be a valid timestamp',
      'updatedAt',
    )
  }
  if (Date.parse(updatedAt) < Date.parse(membership.updatedAt)) {
    return failure(
      'TIMESTAMP_REGRESSION',
      'updatedAt cannot precede the current membership snapshot',
      'updatedAt',
    )
  }
  return undefined
}

export function workspaceMembershipId(
  workspaceId: string,
  userId: string,
): string {
  return `workspace-membership:${workspaceId}:${userId}`
}

export function createWorkspaceMembershipAuthority(): WorkspaceMembershipAuthority {
  return Object.freeze({
    createMembership(input: CreateWorkspaceMembershipInput) {
      const value: unknown = input
      if (!isRecord(value)) {
        return failure('INVALID_INPUT', 'Membership input must be an object')
      }
      const actualKeys = Object.keys(value)
      if (
        actualKeys.some((key) => !CREATE_INPUT_KEYS.includes(key)) ||
        !['workspace', 'user', 'role', 'createdAt'].every((key) => key in value)
      ) {
        return failure(
          'INVALID_INPUT',
          'Membership input contains invalid or missing fields',
        )
      }

      const invalidWorkspace = validateWorkspace(value.workspace)
      if (invalidWorkspace !== undefined) return invalidWorkspace
      if (!isRecord(value.user) || !isAuthorizedPlatformUser(value.user)) {
        return failure(
          'INVALID_USER',
          'Membership requires an authorized PlatformUser',
          'user',
        )
      }
      const workspace = value.workspace as unknown as Workspace
      const user = value.user as unknown as CreateWorkspaceMembershipInput['user']
      if (user.status !== 'ACTIVE') {
        return failure(
          'USER_DISABLED',
          'Disabled PlatformUser cannot receive membership',
          'user',
        )
      }
      if (!MEMBERSHIP_ROLES.includes(value.role as WorkspaceMembershipRole)) {
        return failure('INVALID_INPUT', 'Membership role is unsupported', 'role')
      }
      if (!isTimestamp(value.createdAt)) {
        return failure(
          'INVALID_TIMESTAMP',
          'createdAt must be a valid timestamp',
          'createdAt',
        )
      }

      const role = value.role as WorkspaceMembershipRole
      const isOwnerBootstrap =
        value.actorMembership === undefined &&
        user.userId === workspace.ownerUserId
      if (isOwnerBootstrap) {
        if (role !== 'OWNER') {
          return failure(
            'OWNER_ROLE_REQUIRED',
            'Workspace owner identity must receive OWNER membership',
            'role',
          )
        }
      } else {
        if (value.actorMembership === undefined) {
          return failure(
            'MEMBERSHIP_MANAGEMENT_DENIED',
            'Creating membership requires an ACTIVE OWNER membership',
            'actorMembership',
          )
        }
        const invalidActor = validateActor(
          workspace,
          value.actorMembership as WorkspaceMembership,
        )
        if (invalidActor !== undefined) return invalidActor
        if (user.userId === workspace.ownerUserId && role !== 'OWNER') {
          return failure(
            'OWNER_ROLE_REQUIRED',
            'Workspace owner identity must remain OWNER',
            'role',
          )
        }
      }

      return success(
        authorizeWorkspaceMembership({
          membershipId: workspaceMembershipId(
            workspace.workspaceId,
            user.userId,
          ),
          workspaceId: workspace.workspaceId,
          userId: user.userId,
          role,
          status: 'ACTIVE',
          version: 0,
          createdAt: value.createdAt,
          updatedAt: value.createdAt,
        }),
      )
    },

    changeRole(
      workspace: Workspace,
      actorMembership: WorkspaceMembership,
      membership: WorkspaceMembership,
      role: WorkspaceMembershipRole,
      updatedAt: string,
    ) {
      const invalidWorkspace = validateWorkspace(workspace)
      if (invalidWorkspace !== undefined) return invalidWorkspace
      const invalidActor = validateActor(workspace, actorMembership)
      if (invalidActor !== undefined) return invalidActor
      const invalidTarget = validateTarget(workspace, membership, updatedAt)
      if (invalidTarget !== undefined) return invalidTarget
      if (!MEMBERSHIP_ROLES.includes(role)) {
        return failure('INVALID_INPUT', 'Membership role is unsupported', 'role')
      }
      if (membership.userId === workspace.ownerUserId && role !== 'OWNER') {
        return failure(
          'OWNER_MEMBERSHIP_PROTECTED',
          'Workspace owner membership cannot be downgraded',
          'role',
        )
      }

      return success(
        authorizeWorkspaceMembership({
          ...membership,
          role,
          version: membership.version + 1,
          updatedAt,
        }),
      )
    },

    revokeMembership(
      workspace: Workspace,
      actorMembership: WorkspaceMembership,
      membership: WorkspaceMembership,
      updatedAt: string,
    ) {
      const invalidWorkspace = validateWorkspace(workspace)
      if (invalidWorkspace !== undefined) return invalidWorkspace
      const invalidActor = validateActor(workspace, actorMembership)
      if (invalidActor !== undefined) return invalidActor
      const invalidTarget = validateTarget(workspace, membership, updatedAt)
      if (invalidTarget !== undefined) return invalidTarget
      if (membership.userId === workspace.ownerUserId) {
        return failure(
          'OWNER_MEMBERSHIP_PROTECTED',
          'Workspace owner membership cannot be revoked',
          'membership',
        )
      }

      return success(
        authorizeWorkspaceMembership({
          ...membership,
          status: 'REVOKED',
          version: membership.version + 1,
          updatedAt,
        }),
      )
    },
  })
}
