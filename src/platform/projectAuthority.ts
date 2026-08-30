import type {
  CreateProjectInput,
  PlatformAuthorityIssue,
  Project,
  ProjectAuthority,
  ProjectMutationResult,
} from './contracts'
import {
  authorizeProject,
  isAuthorizedProject,
  isAuthorizedWorkspace,
} from './authorityProvenance'

function failure(
  code: PlatformAuthorityIssue['code'],
  message: string,
  path?: string,
): ProjectMutationResult {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([Object.freeze({ code, message, path })]),
  })
}

function success(project: Project): ProjectMutationResult {
  return Object.freeze({ ok: true, project })
}

function isBoundaryString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() === value && value.length > 0
}

function isTimestamp(value: unknown): value is string {
  return isBoundaryString(value) && Number.isFinite(Date.parse(value))
}

function validateMutation(
  project: Project,
  updatedAt: string,
): ProjectMutationResult | undefined {
  const value: unknown = project
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    !isAuthorizedProject(value)
  ) {
    return failure(
      'INVALID_PROJECT',
      'Project mutation requires an authorized immutable snapshot',
    )
  }
  if (project.status === 'ARCHIVED') {
    return failure('PROJECT_ARCHIVED', 'Archived Project cannot mutate')
  }
  if (!isTimestamp(updatedAt)) {
    return failure('INVALID_TIMESTAMP', 'updatedAt must be a valid timestamp', 'updatedAt')
  }
  if (Date.parse(updatedAt) < Date.parse(project.updatedAt)) {
    return failure('TIMESTAMP_REGRESSION', 'updatedAt cannot precede the current snapshot', 'updatedAt')
  }
  return undefined
}

export function createProjectAuthority(): ProjectAuthority {
  return Object.freeze({
    createProject(input: CreateProjectInput) {
      const value: unknown = input
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return failure('INVALID_INPUT', 'Project input must be an object')
      }
      const candidate = value as unknown as Record<string, unknown>
      if (
        Object.keys(candidate).length !== 4 ||
        !['projectId', 'workspace', 'name', 'createdAt'].every((key) => key in candidate)
      ) {
        return failure('INVALID_INPUT', 'Project input must contain only the authoritative fields')
      }
      if (!isBoundaryString(candidate.projectId)) {
        return failure('INVALID_INPUT', 'projectId must be a non-empty string', 'projectId')
      }
      if (!isBoundaryString(candidate.name)) {
        return failure('INVALID_INPUT', 'name must be a non-empty string', 'name')
      }
      if (!isTimestamp(candidate.createdAt)) {
        return failure('INVALID_TIMESTAMP', 'createdAt must be a valid timestamp', 'createdAt')
      }
      if (
        typeof candidate.workspace !== 'object' ||
        candidate.workspace === null ||
        !isAuthorizedWorkspace(candidate.workspace)
      ) {
        return failure('INVALID_WORKSPACE', 'Project requires an authorized Workspace', 'workspace')
      }
      const workspace = candidate.workspace as { readonly workspaceId: string; readonly status: unknown }
      if (workspace.status === 'ARCHIVED') {
        return failure('WORKSPACE_ARCHIVED', 'Archived Workspace cannot accept a new Project', 'workspace')
      }

      return success(authorizeProject({
        projectId: candidate.projectId,
        workspaceId: workspace.workspaceId,
        name: candidate.name,
        status: 'ACTIVE',
        version: 0,
        createdAt: candidate.createdAt,
        updatedAt: candidate.createdAt,
      }))
    },

    renameProject(project: Project, name: string, updatedAt: string) {
      const invalidMutation = validateMutation(project, updatedAt)
      if (invalidMutation !== undefined) return invalidMutation
      if (!isBoundaryString(name)) {
        return failure('INVALID_INPUT', 'name must be a non-empty string', 'name')
      }
      return success(authorizeProject({
        ...project,
        name,
        version: project.version + 1,
        updatedAt,
      }))
    },

    archiveProject(project: Project, updatedAt: string) {
      const invalidMutation = validateMutation(project, updatedAt)
      if (invalidMutation !== undefined) return invalidMutation
      return success(authorizeProject({
        ...project,
        status: 'ARCHIVED',
        version: project.version + 1,
        updatedAt,
      }))
    },
  })
}
