import {
  createProjectAuthority,
  createWorkspaceAuthority,
  createWorkspaceMembershipAuthority,
  createWorkspacePermissionEvaluator,
  createWorkspaceWithOwnerMembership,
} from '../platform'
import type {
  PlatformAuthorityIssue,
  ProductRepositoryIssue,
  ProjectAuthority,
  ProjectProductionAdmissionIssue,
  ProjectProductionOrchestrator,
  ProjectRepository,
  PlatformUser,
  WorkspaceMembership,
  WorkspaceMembershipAuthorityIssue,
  WorkspaceMembershipRepository,
  WorkspacePermissionEvaluator,
  WorkspaceRepository,
} from '../platform'
import { applicationFailure, applicationSuccess } from './applicationResult'
import type {
  ApplicationCommandContext,
  ApplicationErrorCode,
  ApplicationResult,
  PlatformUserSource,
  ProductApplicationService,
  ProductionJobAdmissionStore,
} from './contracts'

type DomainIssue =
  | PlatformAuthorityIssue
  | WorkspaceMembershipAuthorityIssue
  | ProjectProductionAdmissionIssue

export interface ProductApplicationServiceDependencies {
  readonly users: PlatformUserSource
  readonly workspaces: WorkspaceRepository
  readonly memberships: WorkspaceMembershipRepository
  readonly projects: ProjectRepository
  readonly productionJobs: ProductionJobAdmissionStore
  readonly projectAuthority?: ProjectAuthority
  readonly permissionEvaluator?: WorkspacePermissionEvaluator
  readonly productionOrchestrator: ProjectProductionOrchestrator
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

function validContext(context: ApplicationCommandContext): boolean {
  return (
    typeof context === 'object' &&
    context !== null &&
    typeof context.actor === 'object' &&
    context.actor !== null &&
    isBoundaryString(context.actor.userId) &&
    isBoundaryString(context.occurredAt) &&
    Number.isFinite(Date.parse(context.occurredAt))
  )
}

function issueCode(issue: DomainIssue): ApplicationErrorCode {
  if (
    issue.code.includes('DENIED') ||
    issue.code === 'MEMBERSHIP_REVOKED' ||
    issue.code === 'USER_DISABLED'
  ) {
    return 'FORBIDDEN'
  }
  if (
    issue.code === 'INVALID_INPUT' ||
    issue.code === 'INVALID_TIMESTAMP' ||
    issue.code === 'TIMESTAMP_REGRESSION' ||
    issue.code === 'INVALID_PROJECT_PRODUCTION_REQUEST'
  ) {
    return 'INVALID_REQUEST'
  }
  return 'DOMAIN_REJECTED'
}

function domainFailure<T>(issues: readonly DomainIssue[]): ApplicationResult<T> {
  const issue = issues[0]
  return applicationFailure(
    issue === undefined ? 'DOMAIN_REJECTED' : issueCode(issue),
    issue?.message ?? 'Domain authority rejected the request',
  )
}

function persistenceFailure<T>(
  issues: readonly ProductRepositoryIssue[],
): ApplicationResult<T> {
  const conflict = issues.some(
    (issue) =>
      issue.code === 'VERSION_CONFLICT' ||
      issue.code === 'VERSION_SEQUENCE_INVALID',
  )
  return applicationFailure(
    conflict ? 'CONFLICT' : 'DOMAIN_REJECTED',
    issues[0]?.message ?? 'Product persistence rejected the snapshot',
  )
}

export function createProductApplicationService(
  dependencies: ProductApplicationServiceDependencies,
): ProductApplicationService {
  const projectAuthority =
    dependencies.projectAuthority ?? createProjectAuthority()
  const workspaceAuthority = createWorkspaceAuthority()
  const membershipAuthority = createWorkspaceMembershipAuthority()
  const permissions =
    dependencies.permissionEvaluator ?? createWorkspacePermissionEvaluator()

  function actor(
    context: ApplicationCommandContext,
  ): ApplicationResult<PlatformUser> {
    if (!validContext(context)) {
      return applicationFailure('INVALID_REQUEST', 'Application context is invalid')
    }
    const user = dependencies.users.getById(context.actor.userId)
    return user === undefined
      ? applicationFailure('NOT_FOUND', 'Application actor was not found')
      : applicationSuccess(user)
  }

  function activeMembership(
    workspaceId: string,
    userId: string,
  ): ApplicationResult<WorkspaceMembership> {
    const membership = dependencies.memberships.getByWorkspaceAndUser(
      workspaceId,
      userId,
    )
    if (membership === undefined) {
      return applicationFailure('FORBIDDEN', 'Workspace membership is required')
    }
    if (membership.status !== 'ACTIVE') {
      return applicationFailure('FORBIDDEN', 'Workspace membership is revoked')
    }
    return applicationSuccess(membership)
  }

  const service: ProductApplicationService = {
    async createWorkspace(command) {
      const actorResult = actor(command.context)
      if (!actorResult.ok) return actorResult
      if (
        dependencies.workspaces.exists(command.workspaceId) ||
        dependencies.memberships.getByWorkspaceAndUser(
          command.workspaceId,
          actorResult.value.userId,
        ) !== undefined
      ) {
        return applicationFailure('CONFLICT', 'Workspace identity already exists')
      }

      const created = createWorkspaceWithOwnerMembership({
        workspaceId: command.workspaceId,
        owner: actorResult.value,
        name: command.name,
        createdAt: command.context.occurredAt,
      })
      if (!created.ok) return domainFailure(created.issues)

      const workspaceSave = dependencies.workspaces.save(created.workspace, null)
      if (!workspaceSave.ok) return persistenceFailure(workspaceSave.issues)
      const membershipSave = dependencies.memberships.save(
        created.ownerMembership,
        null,
      )
      if (!membershipSave.ok) return persistenceFailure(membershipSave.issues)

      return applicationSuccess(
        Object.freeze({
          workspace: created.workspace,
          ownerMembership: created.ownerMembership,
        }),
      )
    },

    async renameWorkspace(command) {
      const actorResult = actor(command.context)
      if (!actorResult.ok) return actorResult
      const workspace = dependencies.workspaces.getById(command.workspaceId)
      if (workspace === undefined) {
        return applicationFailure('NOT_FOUND', 'Workspace was not found')
      }
      const membershipResult = activeMembership(
        workspace.workspaceId,
        actorResult.value.userId,
      )
      if (!membershipResult.ok) return membershipResult
      if (!permissions.canManageWorkspace(membershipResult.value)) {
        return applicationFailure('FORBIDDEN', 'Workspace management is denied')
      }
      const result = workspaceAuthority.renameWorkspace(
        workspace,
        command.name,
        command.context.occurredAt,
      )
      if (!result.ok) return domainFailure(result.issues)
      const saved = dependencies.workspaces.save(
        result.workspace,
        command.expectedVersion,
      )
      return saved.ok
        ? applicationSuccess(result.workspace)
        : persistenceFailure(saved.issues)
    },

    async archiveWorkspace(command) {
      const actorResult = actor(command.context)
      if (!actorResult.ok) return actorResult
      const workspace = dependencies.workspaces.getById(command.workspaceId)
      if (workspace === undefined) {
        return applicationFailure('NOT_FOUND', 'Workspace was not found')
      }
      const membershipResult = activeMembership(
        workspace.workspaceId,
        actorResult.value.userId,
      )
      if (!membershipResult.ok) return membershipResult
      if (!permissions.canManageWorkspace(membershipResult.value)) {
        return applicationFailure('FORBIDDEN', 'Workspace management is denied')
      }
      const result = workspaceAuthority.archiveWorkspace(
        workspace,
        command.context.occurredAt,
      )
      if (!result.ok) return domainFailure(result.issues)
      const saved = dependencies.workspaces.save(
        result.workspace,
        command.expectedVersion,
      )
      return saved.ok
        ? applicationSuccess(result.workspace)
        : persistenceFailure(saved.issues)
    },

    async addWorkspaceMember(command) {
      const actorResult = actor(command.context)
      if (!actorResult.ok) return actorResult
      const workspace = dependencies.workspaces.getById(command.workspaceId)
      if (workspace === undefined) {
        return applicationFailure('NOT_FOUND', 'Workspace was not found')
      }
      const actorMembership = activeMembership(
        workspace.workspaceId,
        actorResult.value.userId,
      )
      if (!actorMembership.ok) return actorMembership
      if (!permissions.canManageMembership(actorMembership.value)) {
        return applicationFailure('FORBIDDEN', 'Membership management is denied')
      }
      const targetUser = dependencies.users.getById(command.userId)
      if (targetUser === undefined) {
        return applicationFailure('NOT_FOUND', 'Membership target user was not found')
      }
      if (
        dependencies.memberships.getByWorkspaceAndUser(
          workspace.workspaceId,
          targetUser.userId,
        ) !== undefined
      ) {
        return applicationFailure('CONFLICT', 'Workspace membership already exists')
      }
      const result = membershipAuthority.createMembership({
        workspace,
        user: targetUser,
        role: command.role,
        createdAt: command.context.occurredAt,
        actorMembership: actorMembership.value,
      })
      if (!result.ok) return domainFailure(result.issues)
      const saved = dependencies.memberships.save(result.membership, null)
      return saved.ok
        ? applicationSuccess(result.membership)
        : persistenceFailure(saved.issues)
    },

    async changeWorkspaceMemberRole(command) {
      const actorResult = actor(command.context)
      if (!actorResult.ok) return actorResult
      const target = dependencies.memberships.getById(command.membershipId)
      if (target === undefined) {
        return applicationFailure('NOT_FOUND', 'Workspace membership was not found')
      }
      const workspace = dependencies.workspaces.getById(target.workspaceId)
      if (workspace === undefined) {
        return applicationFailure('NOT_FOUND', 'Workspace was not found')
      }
      const actorMembership = activeMembership(
        workspace.workspaceId,
        actorResult.value.userId,
      )
      if (!actorMembership.ok) return actorMembership
      if (!permissions.canManageMembership(actorMembership.value)) {
        return applicationFailure('FORBIDDEN', 'Membership management is denied')
      }
      const result = membershipAuthority.changeRole(
        workspace,
        actorMembership.value,
        target,
        command.role,
        command.context.occurredAt,
      )
      if (!result.ok) return domainFailure(result.issues)
      const saved = dependencies.memberships.save(
        result.membership,
        command.expectedVersion,
      )
      return saved.ok
        ? applicationSuccess(result.membership)
        : persistenceFailure(saved.issues)
    },

    async revokeWorkspaceMember(command) {
      const actorResult = actor(command.context)
      if (!actorResult.ok) return actorResult
      const target = dependencies.memberships.getById(command.membershipId)
      if (target === undefined) {
        return applicationFailure('NOT_FOUND', 'Workspace membership was not found')
      }
      const workspace = dependencies.workspaces.getById(target.workspaceId)
      if (workspace === undefined) {
        return applicationFailure('NOT_FOUND', 'Workspace was not found')
      }
      const actorMembership = activeMembership(
        workspace.workspaceId,
        actorResult.value.userId,
      )
      if (!actorMembership.ok) return actorMembership
      if (!permissions.canManageMembership(actorMembership.value)) {
        return applicationFailure('FORBIDDEN', 'Membership management is denied')
      }
      const result = membershipAuthority.revokeMembership(
        workspace,
        actorMembership.value,
        target,
        command.context.occurredAt,
      )
      if (!result.ok) return domainFailure(result.issues)
      const saved = dependencies.memberships.save(
        result.membership,
        command.expectedVersion,
      )
      return saved.ok
        ? applicationSuccess(result.membership)
        : persistenceFailure(saved.issues)
    },

    async createProject(command) {
      const actorResult = actor(command.context)
      if (!actorResult.ok) return actorResult
      const workspace = dependencies.workspaces.getById(command.workspaceId)
      if (workspace === undefined) {
        return applicationFailure('NOT_FOUND', 'Workspace was not found')
      }
      const membershipResult = activeMembership(
        workspace.workspaceId,
        actorResult.value.userId,
      )
      if (!membershipResult.ok) return membershipResult
      if (!permissions.canCreateProject(membershipResult.value)) {
        return applicationFailure('FORBIDDEN', 'Project creation is denied')
      }
      if (dependencies.projects.exists(command.projectId)) {
        return applicationFailure('CONFLICT', 'Project identity already exists')
      }
      const result = projectAuthority.createProject({
        projectId: command.projectId,
        workspace,
        name: command.name,
        createdAt: command.context.occurredAt,
      })
      if (!result.ok) return domainFailure(result.issues)
      const saved = dependencies.projects.save(result.project, null)
      return saved.ok
        ? applicationSuccess(result.project)
        : persistenceFailure(saved.issues)
    },

    async renameProject(command) {
      const actorResult = actor(command.context)
      if (!actorResult.ok) return actorResult
      const project = dependencies.projects.getById(command.projectId)
      if (project === undefined) {
        return applicationFailure('NOT_FOUND', 'Project was not found')
      }
      const membershipResult = activeMembership(
        project.workspaceId,
        actorResult.value.userId,
      )
      if (!membershipResult.ok) return membershipResult
      if (!permissions.canEditProject(membershipResult.value)) {
        return applicationFailure('FORBIDDEN', 'Project editing is denied')
      }
      const result = projectAuthority.renameProject(
        project,
        command.name,
        command.context.occurredAt,
      )
      if (!result.ok) return domainFailure(result.issues)
      const saved = dependencies.projects.save(result.project, command.expectedVersion)
      return saved.ok
        ? applicationSuccess(result.project)
        : persistenceFailure(saved.issues)
    },

    async archiveProject(command) {
      const actorResult = actor(command.context)
      if (!actorResult.ok) return actorResult
      const project = dependencies.projects.getById(command.projectId)
      if (project === undefined) {
        return applicationFailure('NOT_FOUND', 'Project was not found')
      }
      const membershipResult = activeMembership(
        project.workspaceId,
        actorResult.value.userId,
      )
      if (!membershipResult.ok) return membershipResult
      if (!permissions.canArchiveProject(membershipResult.value)) {
        return applicationFailure('FORBIDDEN', 'Project archival is denied')
      }
      const result = projectAuthority.archiveProject(
        project,
        command.context.occurredAt,
      )
      if (!result.ok) return domainFailure(result.issues)
      const saved = dependencies.projects.save(result.project, command.expectedVersion)
      return saved.ok
        ? applicationSuccess(result.project)
        : persistenceFailure(saved.issues)
    },

    async requestProjectProduction(command) {
      const actorResult = actor(command.context)
      if (!actorResult.ok) return actorResult
      const project = dependencies.projects.getById(command.projectId)
      if (project === undefined) {
        return applicationFailure('NOT_FOUND', 'Project was not found')
      }
      const workspace = dependencies.workspaces.getById(project.workspaceId)
      if (workspace === undefined) {
        return applicationFailure('NOT_FOUND', 'Workspace was not found')
      }
      const membershipResult = activeMembership(
        workspace.workspaceId,
        actorResult.value.userId,
      )
      if (!membershipResult.ok) return membershipResult
      if (!permissions.canRequestProduction(membershipResult.value)) {
        return applicationFailure('FORBIDDEN', 'Production request is denied')
      }
      const admission = dependencies.productionOrchestrator.admit({
        user: actorResult.value,
        workspace,
        project,
        membership: membershipResult.value,
        request: Object.freeze({
          requestId: command.requestId,
          projectId: project.projectId,
          workspaceId: workspace.workspaceId,
          requestedByUserId: actorResult.value.userId,
          productionIntent: command.productionIntent,
          outputSpecification: Object.freeze({
            mediaType: command.outputSpecification.mediaType,
            format: command.outputSpecification.format,
          }),
        }),
      })
      if (!admission.ok) return domainFailure(admission.issues)
      if (
        admission.job.status !== 'CREATED' ||
        admission.job.requestId !== admission.requestId ||
        admission.job.planId !== admission.plan.planId
      ) {
        return applicationFailure(
          'DOMAIN_REJECTED',
          'Production admission returned an invalid Job correlation',
        )
      }
      const stored = await dependencies.productionJobs.save(admission.job, null)
      if (!stored) {
        return applicationFailure(
          'CONFLICT',
          'Production Job admission conflicted with persisted state',
        )
      }
      return applicationSuccess(
        Object.freeze({
          projectId: admission.projectId,
          workspaceId: admission.workspaceId,
          requestId: admission.requestId,
          planId: admission.plan.planId,
          job: Object.freeze({
            jobId: admission.job.jobId,
            planId: admission.job.planId,
            requestId: admission.job.requestId,
            status: admission.job.status,
            attemptCount: admission.job.attemptCount,
            updatedAt: admission.job.updatedAt,
          }),
        }),
      )
    },
  }
  return Object.freeze(service)
}
