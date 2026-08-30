import type { Project, Workspace } from './platform'
import type { WorkspaceMembership } from './workspaceMembership'

export interface WorkspaceRecord {
  readonly workspaceId: string
  readonly ownerUserId: string
  readonly name: string
  readonly status: Workspace['status']
  readonly version: number
  readonly createdAt: string
  readonly updatedAt: string
}

export interface ProjectRecord {
  readonly projectId: string
  readonly workspaceId: string
  readonly name: string
  readonly status: Project['status']
  readonly version: number
  readonly createdAt: string
  readonly updatedAt: string
}

export interface WorkspaceMembershipRecord {
  readonly membershipId: string
  readonly workspaceId: string
  readonly userId: string
  readonly role: WorkspaceMembership['role']
  readonly status: WorkspaceMembership['status']
  readonly version: number
  readonly createdAt: string
  readonly updatedAt: string
}

export type ProductRepositoryIssueCode =
  | 'INVALID_SNAPSHOT'
  | 'INVALID_RECORD'
  | 'VERSION_CONFLICT'
  | 'VERSION_SEQUENCE_INVALID'

export interface ProductRepositoryIssue {
  readonly code: ProductRepositoryIssueCode
  readonly message: string
}

export type ProductRepositorySaveResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly ProductRepositoryIssue[] }

export interface WorkspaceRepository {
  readonly save: (
    workspace: Workspace,
    expectedVersion: number | null,
  ) => ProductRepositorySaveResult
  readonly getById: (workspaceId: string) => Workspace | undefined
  readonly exists: (workspaceId: string) => boolean
}

export interface ProjectRepository {
  readonly save: (
    project: Project,
    expectedVersion: number | null,
  ) => ProductRepositorySaveResult
  readonly getById: (projectId: string) => Project | undefined
  readonly exists: (projectId: string) => boolean
}

export interface WorkspaceMembershipRepository {
  readonly save: (
    membership: WorkspaceMembership,
    expectedVersion: number | null,
  ) => ProductRepositorySaveResult
  readonly getById: (
    membershipId: string,
  ) => WorkspaceMembership | undefined
  readonly getByWorkspaceAndUser: (
    workspaceId: string,
    userId: string,
  ) => WorkspaceMembership | undefined
  readonly exists: (membershipId: string) => boolean
}
