import type { ProductionArtifactRuntimeReference } from '../artifacts/runtime'
import type { ProductionJob, ProductionJobStatus } from '../jobs'
import type {
  PlatformUser,
  Project,
  Workspace,
  WorkspaceMembership,
  WorkspaceMembershipRole,
} from '../platform'
import type { ProductionOutputSpecification } from '../production/contracts'

export type ApplicationErrorCode =
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'INVALID_REQUEST'
  | 'DOMAIN_REJECTED'

export interface ApplicationError {
  readonly code: ApplicationErrorCode
  readonly message: string
}

export type ApplicationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ApplicationError }

export interface ApplicationActor {
  readonly userId: string
}

export interface ApplicationCommandContext {
  readonly actor: ApplicationActor
  readonly occurredAt: string
}

export type ApplicationQueryContext = ApplicationCommandContext

export interface PlatformUserSource {
  readonly getById: (userId: string) => PlatformUser | undefined
}

export interface ProductionJobQuerySource {
  readonly getById: (
    jobId: string,
  ) => ProductionJob | null | undefined | Promise<ProductionJob | null | undefined>
  readonly findByRequestId: (
    requestId: string,
  ) => ProductionJob | null | undefined | Promise<ProductionJob | null | undefined>
}

export interface ProductionJobAdmissionStore extends ProductionJobQuerySource {
  readonly save: (
    job: ProductionJob,
    expectedVersion: number | null,
  ) => boolean | Promise<boolean>
}

export interface ArtifactDeliveryRecord {
  readonly projectId: string
  readonly requestId: string
  readonly jobId: string
  readonly reference: ProductionArtifactRuntimeReference
}

export interface ArtifactDeliveryQuerySource {
  readonly getByJobId: (
    jobId: string,
  ) =>
    | ArtifactDeliveryRecord
    | null
    | undefined
    | Promise<ArtifactDeliveryRecord | null | undefined>
  readonly findByRequestId: (
    requestId: string,
  ) =>
    | ArtifactDeliveryRecord
    | null
    | undefined
    | Promise<ArtifactDeliveryRecord | null | undefined>
}

export interface ProductProductionStatusView {
  readonly projectId: string
  readonly requestId: string
  readonly planId: string
  readonly jobId: string
  readonly status: ProductionJobStatus
  readonly attemptCount: number
  readonly updatedAt: string
}

export interface ProductionStatusProjectionInput {
  readonly projectId: string
  readonly requestId: string
  readonly planId: string
  readonly jobId: string
  readonly job: ProductionJob
}

export interface ProductionStatusProjection {
  readonly project: (
    input: ProductionStatusProjectionInput,
  ) => ApplicationResult<ProductProductionStatusView>
}

export interface ProductDeliveryView {
  readonly projectId: string
  readonly requestId: string
  readonly jobId: string
  readonly artifactId: string
  readonly mediaType: 'video'
  readonly format: string
  readonly resourceReference: string
}

export interface ProductDeliveryProjectionInput {
  readonly projectId: string
  readonly requestId: string
  readonly jobId: string
  readonly job: ProductionJob
  readonly delivery: ArtifactDeliveryRecord
}

export interface ProductDeliveryProjection {
  readonly project: (
    input: ProductDeliveryProjectionInput,
  ) => ApplicationResult<ProductDeliveryView>
}

export interface ProductProductionAdmission {
  readonly projectId: string
  readonly workspaceId: string
  readonly requestId: string
  readonly planId: string
  readonly job: {
    readonly jobId: string
    readonly planId: string
    readonly requestId: string
    readonly status: 'CREATED'
    readonly attemptCount: number
    readonly updatedAt: string
  }
}

export interface CreateWorkspaceCommand {
  readonly context: ApplicationCommandContext
  readonly workspaceId: string
  readonly name: string
}

export interface RenameWorkspaceCommand {
  readonly context: ApplicationCommandContext
  readonly workspaceId: string
  readonly name: string
  readonly expectedVersion: number
}

export interface ArchiveWorkspaceCommand {
  readonly context: ApplicationCommandContext
  readonly workspaceId: string
  readonly expectedVersion: number
}

export interface AddWorkspaceMemberCommand {
  readonly context: ApplicationCommandContext
  readonly workspaceId: string
  readonly userId: string
  readonly role: WorkspaceMembershipRole
}

export interface ChangeWorkspaceMemberRoleCommand {
  readonly context: ApplicationCommandContext
  readonly membershipId: string
  readonly role: WorkspaceMembershipRole
  readonly expectedVersion: number
}

export interface RevokeWorkspaceMemberCommand {
  readonly context: ApplicationCommandContext
  readonly membershipId: string
  readonly expectedVersion: number
}

export interface CreateProjectCommand {
  readonly context: ApplicationCommandContext
  readonly projectId: string
  readonly workspaceId: string
  readonly name: string
}

export interface RenameProjectCommand {
  readonly context: ApplicationCommandContext
  readonly projectId: string
  readonly name: string
  readonly expectedVersion: number
}

export interface ArchiveProjectCommand {
  readonly context: ApplicationCommandContext
  readonly projectId: string
  readonly expectedVersion: number
}

export interface RequestProjectProductionCommand {
  readonly context: ApplicationCommandContext
  readonly requestId: string
  readonly projectId: string
  readonly productionIntent: string
  readonly outputSpecification: ProductionOutputSpecification
}

export interface ProductApplicationService {
  readonly createWorkspace: (
    command: CreateWorkspaceCommand,
  ) => Promise<ApplicationResult<{
    readonly workspace: Workspace
    readonly ownerMembership: WorkspaceMembership
  }>>
  readonly renameWorkspace: (
    command: RenameWorkspaceCommand,
  ) => Promise<ApplicationResult<Workspace>>
  readonly archiveWorkspace: (
    command: ArchiveWorkspaceCommand,
  ) => Promise<ApplicationResult<Workspace>>
  readonly addWorkspaceMember: (
    command: AddWorkspaceMemberCommand,
  ) => Promise<ApplicationResult<WorkspaceMembership>>
  readonly changeWorkspaceMemberRole: (
    command: ChangeWorkspaceMemberRoleCommand,
  ) => Promise<ApplicationResult<WorkspaceMembership>>
  readonly revokeWorkspaceMember: (
    command: RevokeWorkspaceMemberCommand,
  ) => Promise<ApplicationResult<WorkspaceMembership>>
  readonly createProject: (
    command: CreateProjectCommand,
  ) => Promise<ApplicationResult<Project>>
  readonly renameProject: (
    command: RenameProjectCommand,
  ) => Promise<ApplicationResult<Project>>
  readonly archiveProject: (
    command: ArchiveProjectCommand,
  ) => Promise<ApplicationResult<Project>>
  readonly requestProjectProduction: (
    command: RequestProjectProductionCommand,
  ) => Promise<ApplicationResult<ProductProductionAdmission>>
}

export interface GetWorkspaceQuery {
  readonly context: ApplicationQueryContext
  readonly workspaceId: string
}

export interface GetProjectQuery {
  readonly context: ApplicationQueryContext
  readonly projectId: string
}

export interface GetProductionStatusQuery {
  readonly context: ApplicationQueryContext
  readonly projectId: string
  readonly requestId: string
  readonly jobId: string
}

export type GetProductionDeliveryQuery = GetProductionStatusQuery

export interface ProductApplicationQueryService {
  readonly getWorkspace: (
    query: GetWorkspaceQuery,
  ) => Promise<ApplicationResult<Workspace>>
  readonly getProject: (
    query: GetProjectQuery,
  ) => Promise<ApplicationResult<Project>>
  readonly getProductionStatus: (
    query: GetProductionStatusQuery,
  ) => Promise<ApplicationResult<ProductProductionStatusView>>
  readonly getProductionDelivery: (
    query: GetProductionDeliveryQuery,
  ) => Promise<ApplicationResult<ProductDeliveryView>>
}
