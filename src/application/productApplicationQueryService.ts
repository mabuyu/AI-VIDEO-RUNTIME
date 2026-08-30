import { createWorkspacePermissionEvaluator } from '../platform'
import type {
  Project,
  PlatformUser,
  ProjectRepository,
  WorkspaceMembershipRepository,
  WorkspacePermissionEvaluator,
  WorkspaceRepository,
} from '../platform'
import { applicationFailure, applicationSuccess } from './applicationResult'
import type {
  ApplicationQueryContext,
  ApplicationResult,
  ArtifactDeliveryQuerySource,
  PlatformUserSource,
  ProductApplicationQueryService,
  ProductDeliveryProjection,
  ProductionJobQuerySource,
  ProductionStatusProjection,
} from './contracts'
import {
  createProductDeliveryProjection,
  createProductionStatusProjection,
} from './productionProjections'

export interface ProductApplicationQueryServiceDependencies {
  readonly users: PlatformUserSource
  readonly workspaces: WorkspaceRepository
  readonly memberships: WorkspaceMembershipRepository
  readonly projects: ProjectRepository
  readonly productionJobs: ProductionJobQuerySource
  readonly deliveries: ArtifactDeliveryQuerySource
  readonly permissionEvaluator?: WorkspacePermissionEvaluator
  readonly statusProjection?: ProductionStatusProjection
  readonly deliveryProjection?: ProductDeliveryProjection
}

function isBoundaryString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim()
}

function validContext(context: ApplicationQueryContext): boolean {
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

export function createProductApplicationQueryService(
  dependencies: ProductApplicationQueryServiceDependencies,
): ProductApplicationQueryService {
  const permissions =
    dependencies.permissionEvaluator ?? createWorkspacePermissionEvaluator()
  const statusProjection =
    dependencies.statusProjection ?? createProductionStatusProjection()
  const deliveryProjection =
    dependencies.deliveryProjection ?? createProductDeliveryProjection()

  function actor(
    context: ApplicationQueryContext,
  ): ApplicationResult<PlatformUser> {
    if (!validContext(context)) {
      return applicationFailure('INVALID_REQUEST', 'Application query context is invalid')
    }
    const user = dependencies.users.getById(context.actor.userId)
    if (user === undefined) {
      return applicationFailure('NOT_FOUND', 'Application actor was not found')
    }
    if (user.status !== 'ACTIVE') {
      return applicationFailure('FORBIDDEN', 'Disabled actor cannot query product data')
    }
    return applicationSuccess(user)
  }

  function projectReadAccess(project: Project, userId: string) {
    const membership = dependencies.memberships.getByWorkspaceAndUser(
      project.workspaceId,
      userId,
    )
    if (
      membership === undefined ||
      membership.status !== 'ACTIVE' ||
      !permissions.canViewProject(membership)
    ) {
      return applicationFailure('FORBIDDEN', 'Project read permission is denied')
    }
    return applicationSuccess(membership)
  }

  const service: ProductApplicationQueryService = {
    async getWorkspace(query) {
      const actorResult = actor(query.context)
      if (!actorResult.ok) return actorResult
      const workspace = dependencies.workspaces.getById(query.workspaceId)
      if (workspace === undefined) {
        return applicationFailure('NOT_FOUND', 'Workspace was not found')
      }
      const membership = dependencies.memberships.getByWorkspaceAndUser(
        workspace.workspaceId,
        actorResult.value.userId,
      )
      if (membership === undefined || membership.status !== 'ACTIVE') {
        return applicationFailure('FORBIDDEN', 'Workspace read permission is denied')
      }
      return applicationSuccess(workspace)
    },

    async getProject(query) {
      const actorResult = actor(query.context)
      if (!actorResult.ok) return actorResult
      const project = dependencies.projects.getById(query.projectId)
      if (project === undefined) {
        return applicationFailure('NOT_FOUND', 'Project was not found')
      }
      const access = projectReadAccess(project, actorResult.value.userId)
      return access.ok ? applicationSuccess(project) : access
    },

    async getProductionStatus(query) {
      const actorResult = actor(query.context)
      if (!actorResult.ok) return actorResult
      const project = dependencies.projects.getById(query.projectId)
      if (project === undefined) {
        return applicationFailure('NOT_FOUND', 'Project was not found')
      }
      const access = projectReadAccess(project, actorResult.value.userId)
      if (!access.ok) return access
      const job = await dependencies.productionJobs.getById(query.jobId)
      if (job === undefined || job === null) {
        return applicationFailure('NOT_FOUND', 'Production Job was not found')
      }
      return statusProjection.project({
        projectId: project.projectId,
        requestId: query.requestId,
        planId: job.planId,
        jobId: query.jobId,
        job,
      })
    },

    async getProductionDelivery(query) {
      const actorResult = actor(query.context)
      if (!actorResult.ok) return actorResult
      const project = dependencies.projects.getById(query.projectId)
      if (project === undefined) {
        return applicationFailure('NOT_FOUND', 'Project was not found')
      }
      const access = projectReadAccess(project, actorResult.value.userId)
      if (!access.ok) return access
      const job = await dependencies.productionJobs.getById(query.jobId)
      if (job === undefined || job === null) {
        return applicationFailure('NOT_FOUND', 'Production Job was not found')
      }
      const delivery = await dependencies.deliveries.getByJobId(query.jobId)
      if (delivery === undefined || delivery === null) {
        return applicationFailure('NOT_FOUND', 'Production delivery was not found')
      }
      return deliveryProjection.project({
        projectId: project.projectId,
        requestId: query.requestId,
        jobId: query.jobId,
        job,
        delivery,
      })
    },
  }
  return Object.freeze(service)
}
