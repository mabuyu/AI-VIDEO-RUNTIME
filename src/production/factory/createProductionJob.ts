import type {
  ProductionJob,
  ProductionJobCreationResult,
  ProductionJobIssue,
} from '../types/productionJob'

export interface CreateProductionJobInput {
  readonly jobId: string
  readonly commandId: string
  readonly createdAt: string
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isValidTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    Number.isFinite(Date.parse(value))
  )
}

function freezeIssues(
  issues: readonly ProductionJobIssue[],
): readonly ProductionJobIssue[] {
  return Object.freeze(issues.map((issue) => Object.freeze({ ...issue })))
}

export function createProductionJob(
  input: CreateProductionJobInput,
): ProductionJobCreationResult {
  const issues: ProductionJobIssue[] = []

  if (!isNonEmptyString(input.jobId)) {
    issues.push({
      code: 'INVALID_JOB_ID',
      message: 'ProductionJob requires a non-empty jobId',
    })
  }

  if (!isNonEmptyString(input.commandId)) {
    issues.push({
      code: 'INVALID_COMMAND_ID',
      message: 'ProductionJob requires a non-empty commandId',
    })
  }

  if (!isValidTimestamp(input.createdAt)) {
    issues.push({
      code: 'INVALID_TIMESTAMP',
      message: 'ProductionJob requires a valid createdAt timestamp',
    })
  }

  if (issues.length > 0) {
    return Object.freeze({
      ok: false,
      issues: freezeIssues(issues),
    })
  }

  const job: ProductionJob = Object.freeze({
    jobId: input.jobId,
    commandId: input.commandId,
    status: 'CREATED',
    attemptsSummary: Object.freeze([]),
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  })

  return Object.freeze({
    ok: true,
    job,
  })
}
