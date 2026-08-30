import type {
  WorkspaceMembership,
  WorkspacePermissionEvaluator,
} from './contracts'
import { isAuthorizedWorkspaceMembership } from './authorityProvenance'

function isActiveRole(
  membership: WorkspaceMembership,
  roles: readonly WorkspaceMembership['role'][],
): boolean {
  return (
    typeof membership === 'object' &&
    membership !== null &&
    isAuthorizedWorkspaceMembership(membership) &&
    membership.status === 'ACTIVE' &&
    roles.includes(membership.role)
  )
}

export function createWorkspacePermissionEvaluator(): WorkspacePermissionEvaluator {
  return Object.freeze({
    canManageWorkspace: (membership: WorkspaceMembership) =>
      isActiveRole(membership, ['OWNER']),
    canManageMembership: (membership: WorkspaceMembership) =>
      isActiveRole(membership, ['OWNER']),
    canCreateProject: (membership: WorkspaceMembership) =>
      isActiveRole(membership, ['OWNER', 'EDITOR']),
    canEditProject: (membership: WorkspaceMembership) =>
      isActiveRole(membership, ['OWNER', 'EDITOR']),
    canArchiveProject: (membership: WorkspaceMembership) =>
      isActiveRole(membership, ['OWNER', 'EDITOR']),
    canRequestProduction: (membership: WorkspaceMembership) =>
      isActiveRole(membership, ['OWNER', 'EDITOR']),
    canViewProject: (membership: WorkspaceMembership) =>
      isActiveRole(membership, ['OWNER', 'EDITOR', 'VIEWER']),
  })
}
