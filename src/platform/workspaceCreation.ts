import type {
  CreateWorkspaceInput,
  WorkspaceWithOwnerMembershipResult,
} from './contracts'
import { createWorkspaceAuthority } from './workspaceAuthority'
import { createWorkspaceMembershipAuthority } from './workspaceMembershipAuthority'

export function createWorkspaceWithOwnerMembership(
  input: CreateWorkspaceInput,
): WorkspaceWithOwnerMembershipResult {
  const workspaceResult = createWorkspaceAuthority().createWorkspace(input)
  if (!workspaceResult.ok) return workspaceResult

  const membershipResult =
    createWorkspaceMembershipAuthority().createMembership({
      workspace: workspaceResult.workspace,
      user: input.owner,
      role: 'OWNER',
      createdAt: input.createdAt,
    })
  if (!membershipResult.ok) return membershipResult

  return Object.freeze({
    ok: true,
    workspace: workspaceResult.workspace,
    ownerMembership: membershipResult.membership,
  })
}
