import { createProductionJob } from '../jobs'
import type {
  ProductionOutputSpecification,
  ProductionPlan,
  ProductionRequest,
} from '../production/contracts'
import {
  validateProductionPlan,
  validateProductionRequest,
} from '../production/validation'
import {
  isAuthorizedPlatformUser,
  isAuthorizedProject,
  isAuthorizedWorkspace,
  isAuthorizedWorkspaceMembership,
} from './authorityProvenance'
import type {
  PlatformUser,
  ProductionPlanningBoundary,
  Project,
  ProjectProductionAdmissionInput,
  ProjectProductionAdmissionIssue,
  ProjectProductionAdmissionIssueCode,
  ProjectProductionAdmissionResult,
  ProjectProductionOrchestrator,
  ProjectProductionRequest,
  Workspace,
  WorkspaceMembership,
  WorkspacePermissionEvaluator,
} from './contracts'
import { createDeterministicProductionPlanningBoundary } from './projectProductionPlanning'
import { createWorkspacePermissionEvaluator } from './workspacePermissionEvaluator'

const ADMISSION_INPUT_KEYS = Object.freeze([
  'user',
  'workspace',
  'project',
  'membership',
  'request',
])
const PROJECT_PRODUCTION_REQUEST_KEYS = Object.freeze([
  'requestId',
  'projectId',
  'workspaceId',
  'requestedByUserId',
  'productionIntent',
  'outputSpecification',
])
const OUTPUT_SPECIFICATION_KEYS = Object.freeze(['mediaType', 'format'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value)
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key) => expectedKeys.includes(key))
  )
}

function isBoundaryString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim()
}

function isStableBoundaryString(value: unknown): value is string {
  return (
    isBoundaryString(value) &&
    !Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0)
      return codePoint !== undefined && (codePoint <= 31 || codePoint === 127)
    })
  )
}

function freezeIssues(
  issues: readonly ProjectProductionAdmissionIssue[],
): readonly ProjectProductionAdmissionIssue[] {
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
  code: ProjectProductionAdmissionIssueCode,
  message: string,
  path?: string,
): ProjectProductionAdmissionResult {
  return Object.freeze({
    ok: false,
    issues: freezeIssues([
      {
        code,
        message,
        ...(path === undefined ? {} : { path }),
      },
    ]),
  })
}

function snapshotProjectProductionRequest(
  value: unknown,
): ProjectProductionRequest | undefined {
  if (!isRecord(value) || !hasExactKeys(value, PROJECT_PRODUCTION_REQUEST_KEYS)) {
    return undefined
  }

  if (
    !isStableBoundaryString(value.requestId) ||
    !isStableBoundaryString(value.projectId) ||
    !isStableBoundaryString(value.workspaceId) ||
    !isStableBoundaryString(value.requestedByUserId) ||
    !isBoundaryString(value.productionIntent) ||
    !isRecord(value.outputSpecification) ||
    !hasExactKeys(value.outputSpecification, OUTPUT_SPECIFICATION_KEYS) ||
    value.outputSpecification.mediaType !== 'video' ||
    !isBoundaryString(value.outputSpecification.format)
  ) {
    return undefined
  }

  const outputSpecification: ProductionOutputSpecification = Object.freeze({
    mediaType: value.outputSpecification.mediaType,
    format: value.outputSpecification.format,
  })

  return Object.freeze({
    requestId: value.requestId,
    projectId: value.projectId,
    workspaceId: value.workspaceId,
    requestedByUserId: value.requestedByUserId,
    productionIntent: value.productionIntent,
    outputSpecification,
  })
}

function createProductionRequest(
  request: ProjectProductionRequest,
): ProductionRequest | undefined {
  const productionRequest: ProductionRequest = Object.freeze({
    requestId: request.requestId,
    generationIntent: request.productionIntent,
    outputSpecification: Object.freeze({
      mediaType: request.outputSpecification.mediaType,
      format: request.outputSpecification.format,
    }),
  })

  return validateProductionRequest(productionRequest).valid
    ? productionRequest
    : undefined
}

function snapshotProductionPlan(candidate: unknown): ProductionPlan | undefined {
  try {
    const candidateValidation = validateProductionPlan(candidate)
    if (!candidateValidation.valid) return undefined

    const source = candidate as ProductionPlan
    const plan: ProductionPlan = Object.freeze({
      planId: source.planId,
      requestId: source.requestId,
      tasks: Object.freeze(
        source.tasks.map((task) =>
          Object.freeze({
            taskId: task.taskId,
            requestId: task.requestId,
            providerId: task.providerId,
            generationIntent: task.generationIntent,
            outputSpecification: Object.freeze({
              mediaType: task.outputSpecification.mediaType,
              format: task.outputSpecification.format,
            }),
          }),
        ),
      ),
    })

    return validateProductionPlan(plan).valid ? plan : undefined
  } catch {
    return undefined
  }
}

function validateProductContext(
  user: PlatformUser,
  workspace: Workspace,
  project: Project,
  membership: WorkspaceMembership,
  permissionEvaluator: WorkspacePermissionEvaluator,
  request: ProjectProductionRequest,
): ProjectProductionAdmissionResult | undefined {
  if (user.status !== 'ACTIVE') {
    return failure('USER_DISABLED', 'Disabled PlatformUser cannot request production', 'user')
  }
  if (workspace.status !== 'ACTIVE') {
    return failure('WORKSPACE_ARCHIVED', 'Archived Workspace cannot admit production', 'workspace')
  }
  if (project.status !== 'ACTIVE') {
    return failure('PROJECT_ARCHIVED', 'Archived Project cannot admit production', 'project')
  }
  if (membership.status !== 'ACTIVE') {
    return failure(
      'MEMBERSHIP_REVOKED',
      'Revoked WorkspaceMembership cannot request production',
      'membership',
    )
  }
  if (
    membership.workspaceId !== workspace.workspaceId ||
    membership.userId !== user.userId
  ) {
    return failure(
      'MEMBERSHIP_MISMATCH',
      'WorkspaceMembership must identify the admitted Workspace and PlatformUser',
      'membership',
    )
  }
  if (
    user.userId === workspace.ownerUserId &&
    membership.role !== 'OWNER'
  ) {
    return failure(
      'OWNER_MEMBERSHIP_INCONSISTENT',
      'Workspace owner identity must have ACTIVE OWNER membership',
      'membership.role',
    )
  }
  if (project.workspaceId !== workspace.workspaceId) {
    return failure(
      'WORKSPACE_MISMATCH',
      'Project must belong to the admitted Workspace',
      'project.workspaceId',
    )
  }
  if (request.workspaceId !== workspace.workspaceId) {
    return failure(
      'WORKSPACE_MISMATCH',
      'ProjectProductionRequest must identify the admitted Workspace',
      'request.workspaceId',
    )
  }
  if (request.projectId !== project.projectId) {
    return failure(
      'PROJECT_MISMATCH',
      'ProjectProductionRequest must identify the admitted Project',
      'request.projectId',
    )
  }
  if (!permissionEvaluator.canRequestProduction(membership)) {
    return failure(
      'PRODUCTION_PERMISSION_DENIED',
      'WorkspaceMembership does not permit production requests',
      'membership.role',
    )
  }
  if (request.requestedByUserId !== user.userId) {
    return failure(
      'REQUESTER_MISMATCH',
      'ProjectProductionRequest must identify the admitted PlatformUser',
      'request.requestedByUserId',
    )
  }

  return undefined
}

export function createProjectProductionOrchestrator(
  planningBoundary: ProductionPlanningBoundary =
    createDeterministicProductionPlanningBoundary(),
): ProjectProductionOrchestrator {
  const permissionEvaluator = createWorkspacePermissionEvaluator()
  return Object.freeze({
    admit(
      input: ProjectProductionAdmissionInput,
    ): ProjectProductionAdmissionResult {
      const value: unknown = input
      if (!isRecord(value) || !hasExactKeys(value, ADMISSION_INPUT_KEYS)) {
        return failure(
          'INVALID_INPUT',
          'Project production admission requires user, workspace, project, membership, and request',
        )
      }

      if (!isRecord(value.user) || !isAuthorizedPlatformUser(value.user)) {
        return failure(
          'INVALID_USER',
          'Project production admission requires an authorized PlatformUser',
          'user',
        )
      }
      if (!isRecord(value.workspace) || !isAuthorizedWorkspace(value.workspace)) {
        return failure(
          'INVALID_WORKSPACE',
          'Project production admission requires an authorized Workspace',
          'workspace',
        )
      }
      if (!isRecord(value.project) || !isAuthorizedProject(value.project)) {
        return failure(
          'INVALID_PROJECT',
          'Project production admission requires an authorized Project',
          'project',
        )
      }
      if (
        !isRecord(value.membership) ||
        !isAuthorizedWorkspaceMembership(value.membership)
      ) {
        return failure(
          'INVALID_MEMBERSHIP',
          'Project production admission requires an authorized WorkspaceMembership',
          'membership',
        )
      }

      const request = snapshotProjectProductionRequest(value.request)
      if (request === undefined) {
        return failure(
          'INVALID_PROJECT_PRODUCTION_REQUEST',
          'ProjectProductionRequest must contain only valid product production fields',
          'request',
        )
      }

      const user = value.user as unknown as PlatformUser
      const workspace = value.workspace as unknown as Workspace
      const project = value.project as unknown as Project
      const membership = value.membership as unknown as WorkspaceMembership
      const invalidContext = validateProductContext(
        user,
        workspace,
        project,
        membership,
        permissionEvaluator,
        request,
      )
      if (invalidContext !== undefined) return invalidContext

      const productionRequest = createProductionRequest(request)
      if (productionRequest === undefined) {
        return failure(
          'INVALID_PROJECT_PRODUCTION_REQUEST',
          'ProjectProductionRequest could not be mapped to a ProductionRequest',
          'request',
        )
      }

      let plannedValue: unknown
      try {
        plannedValue = planningBoundary.createPlan(productionRequest)
      } catch {
        return failure(
          'PRODUCTION_PLANNING_FAILED',
          'ProductionPlanningBoundary could not create a ProductionPlan',
        )
      }

      const plan = snapshotProductionPlan(plannedValue)
      if (
        plan === undefined ||
        plan.requestId !== productionRequest.requestId ||
        plan.planId !== `production-plan:${productionRequest.requestId}`
      ) {
        return failure(
          'PRODUCTION_PLANNING_FAILED',
          'ProductionPlanningBoundary returned an invalid, uncorrelated, or unstable ProductionPlan',
        )
      }

      const jobResult = createProductionJob(plan)
      if (!jobResult.ok) {
        return failure(
          'PRODUCTION_JOB_ADMISSION_FAILED',
          'The authoritative ProductionJob admission rejected the ProductionPlan',
        )
      }
      if (
        jobResult.job.status !== 'CREATED' ||
        jobResult.job.planId !== plan.planId ||
        jobResult.job.requestId !== plan.requestId
      ) {
        return failure(
          'PRODUCTION_JOB_ADMISSION_FAILED',
          'The authoritative ProductionJob admission returned an uncorrelated Job',
        )
      }

      return Object.freeze({
        ok: true,
        projectId: project.projectId,
        workspaceId: workspace.workspaceId,
        requestId: request.requestId,
        plan,
        job: jobResult.job,
      })
    },
  })
}
