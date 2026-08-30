import type { ProductionJob } from '../../jobs'
import type {
  ProductionOutputSpecification,
  ProductionPlan,
  ProductionRequest,
} from '../../production/contracts'
import type { PlatformUser, Project, Workspace } from './platform'
import type { WorkspaceMembership } from './workspaceMembership'

export interface ProjectProductionRequest {
  readonly requestId: string
  readonly projectId: string
  readonly workspaceId: string
  readonly requestedByUserId: string
  readonly productionIntent: string
  readonly outputSpecification: ProductionOutputSpecification
}

export interface ProjectProductionAdmissionInput {
  readonly user: PlatformUser
  readonly workspace: Workspace
  readonly project: Project
  readonly membership: WorkspaceMembership
  readonly request: ProjectProductionRequest
}

export interface ProductionPlanningBoundary {
  readonly createPlan: (request: ProductionRequest) => ProductionPlan
}

export type ProjectProductionAdmissionIssueCode =
  | 'INVALID_INPUT'
  | 'INVALID_PROJECT_PRODUCTION_REQUEST'
  | 'INVALID_USER'
  | 'USER_DISABLED'
  | 'INVALID_WORKSPACE'
  | 'WORKSPACE_ARCHIVED'
  | 'INVALID_PROJECT'
  | 'PROJECT_ARCHIVED'
  | 'INVALID_MEMBERSHIP'
  | 'MEMBERSHIP_REVOKED'
  | 'MEMBERSHIP_MISMATCH'
  | 'OWNER_MEMBERSHIP_INCONSISTENT'
  | 'WORKSPACE_MISMATCH'
  | 'PROJECT_MISMATCH'
  | 'REQUESTER_MISMATCH'
  | 'PRODUCTION_PERMISSION_DENIED'
  | 'PRODUCTION_PLANNING_FAILED'
  | 'PRODUCTION_JOB_ADMISSION_FAILED'

export interface ProjectProductionAdmissionIssue {
  readonly code: ProjectProductionAdmissionIssueCode
  readonly message: string
  readonly path?: string
}

export type ProjectProductionAdmissionResult =
  | {
      readonly ok: true
      readonly projectId: string
      readonly workspaceId: string
      readonly requestId: string
      readonly plan: ProductionPlan
      readonly job: ProductionJob
    }
  | {
      readonly ok: false
      readonly issues: readonly ProjectProductionAdmissionIssue[]
    }

export interface ProjectProductionOrchestrator {
  readonly admit: (
    input: ProjectProductionAdmissionInput,
  ) => ProjectProductionAdmissionResult
}
