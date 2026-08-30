export type PlatformUserStatus = 'ACTIVE' | 'DISABLED'

export interface PlatformUser {
  readonly userId: string
  readonly status: PlatformUserStatus
  readonly createdAt: string
}

export interface CreatePlatformUserInput {
  readonly userId: string
  readonly status?: PlatformUserStatus
  readonly createdAt: string
}

export type WorkspaceStatus = 'ACTIVE' | 'ARCHIVED'

export interface Workspace {
  readonly workspaceId: string
  readonly ownerUserId: string
  readonly name: string
  readonly status: WorkspaceStatus
  readonly version: number
  readonly createdAt: string
  readonly updatedAt: string
}

export interface CreateWorkspaceInput {
  readonly workspaceId: string
  readonly owner: PlatformUser
  readonly name: string
  readonly createdAt: string
}

export type ProjectStatus = 'ACTIVE' | 'ARCHIVED'

export interface Project {
  readonly projectId: string
  readonly workspaceId: string
  readonly name: string
  readonly status: ProjectStatus
  readonly version: number
  readonly createdAt: string
  readonly updatedAt: string
}

export interface CreateProjectInput {
  readonly projectId: string
  readonly workspace: Workspace
  readonly name: string
  readonly createdAt: string
}

export type PlatformAuthorityIssueCode =
  | 'INVALID_INPUT'
  | 'INVALID_USER'
  | 'USER_DISABLED'
  | 'INVALID_WORKSPACE'
  | 'WORKSPACE_ARCHIVED'
  | 'INVALID_PROJECT'
  | 'PROJECT_ARCHIVED'
  | 'INVALID_TIMESTAMP'
  | 'TIMESTAMP_REGRESSION'

export interface PlatformAuthorityIssue {
  readonly code: PlatformAuthorityIssueCode
  readonly message: string
  readonly path?: string
}

export type PlatformUserCreationResult =
  | { readonly ok: true; readonly user: PlatformUser }
  | { readonly ok: false; readonly issues: readonly PlatformAuthorityIssue[] }

export type WorkspaceMutationResult =
  | { readonly ok: true; readonly workspace: Workspace }
  | { readonly ok: false; readonly issues: readonly PlatformAuthorityIssue[] }

export type ProjectMutationResult =
  | { readonly ok: true; readonly project: Project }
  | { readonly ok: false; readonly issues: readonly PlatformAuthorityIssue[] }

export interface WorkspaceAuthority {
  readonly createWorkspace: (
    input: CreateWorkspaceInput,
  ) => WorkspaceMutationResult
  readonly renameWorkspace: (
    workspace: Workspace,
    name: string,
    updatedAt: string,
  ) => WorkspaceMutationResult
  readonly archiveWorkspace: (
    workspace: Workspace,
    updatedAt: string,
  ) => WorkspaceMutationResult
}

export interface ProjectAuthority {
  readonly createProject: (input: CreateProjectInput) => ProjectMutationResult
  readonly renameProject: (
    project: Project,
    name: string,
    updatedAt: string,
  ) => ProjectMutationResult
  readonly archiveProject: (
    project: Project,
    updatedAt: string,
  ) => ProjectMutationResult
}
