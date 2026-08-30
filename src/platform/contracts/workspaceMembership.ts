import type { PlatformUser, Workspace } from './platform'

export type WorkspaceMembershipRole = 'OWNER' | 'EDITOR' | 'VIEWER'

export type WorkspaceMembershipStatus = 'ACTIVE' | 'REVOKED'

export interface WorkspaceMembership {
  readonly membershipId: string
  readonly workspaceId: string
  readonly userId: string
  readonly role: WorkspaceMembershipRole
  readonly status: WorkspaceMembershipStatus
  readonly version: number
  readonly createdAt: string
  readonly updatedAt: string
}

export interface CreateWorkspaceMembershipInput {
  readonly workspace: Workspace
  readonly user: PlatformUser
  readonly role: WorkspaceMembershipRole
  readonly createdAt: string
  readonly actorMembership?: WorkspaceMembership
}

export type WorkspaceMembershipAuthorityIssueCode =
  | 'INVALID_INPUT'
  | 'INVALID_USER'
  | 'USER_DISABLED'
  | 'INVALID_WORKSPACE'
  | 'WORKSPACE_ARCHIVED'
  | 'INVALID_MEMBERSHIP'
  | 'MEMBERSHIP_REVOKED'
  | 'MEMBERSHIP_MISMATCH'
  | 'MEMBERSHIP_MANAGEMENT_DENIED'
  | 'OWNER_ROLE_REQUIRED'
  | 'OWNER_MEMBERSHIP_PROTECTED'
  | 'INVALID_TIMESTAMP'
  | 'TIMESTAMP_REGRESSION'

export interface WorkspaceMembershipAuthorityIssue {
  readonly code: WorkspaceMembershipAuthorityIssueCode
  readonly message: string
  readonly path?: string
}

export type WorkspaceMembershipMutationResult =
  | { readonly ok: true; readonly membership: WorkspaceMembership }
  | {
      readonly ok: false
      readonly issues: readonly WorkspaceMembershipAuthorityIssue[]
    }

export interface WorkspaceMembershipAuthority {
  readonly createMembership: (
    input: CreateWorkspaceMembershipInput,
  ) => WorkspaceMembershipMutationResult
  readonly changeRole: (
    workspace: Workspace,
    actorMembership: WorkspaceMembership,
    membership: WorkspaceMembership,
    role: WorkspaceMembershipRole,
    updatedAt: string,
  ) => WorkspaceMembershipMutationResult
  readonly revokeMembership: (
    workspace: Workspace,
    actorMembership: WorkspaceMembership,
    membership: WorkspaceMembership,
    updatedAt: string,
  ) => WorkspaceMembershipMutationResult
}

export interface WorkspacePermissionEvaluator {
  readonly canManageWorkspace: (
    membership: WorkspaceMembership,
  ) => boolean
  readonly canManageMembership: (
    membership: WorkspaceMembership,
  ) => boolean
  readonly canCreateProject: (membership: WorkspaceMembership) => boolean
  readonly canEditProject: (membership: WorkspaceMembership) => boolean
  readonly canArchiveProject: (membership: WorkspaceMembership) => boolean
  readonly canRequestProduction: (
    membership: WorkspaceMembership,
  ) => boolean
  readonly canViewProject: (membership: WorkspaceMembership) => boolean
}

export type WorkspaceWithOwnerMembershipResult =
  | {
      readonly ok: true
      readonly workspace: Workspace
      readonly ownerMembership: WorkspaceMembership
    }
  | {
      readonly ok: false
      readonly issues: readonly (
        | import('./platform').PlatformAuthorityIssue
        | WorkspaceMembershipAuthorityIssue
      )[]
    }
