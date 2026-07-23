import { createArtifactHandoffRequest } from '../artifact'
import type { ArtifactHandoffIssue } from '../artifact'
import type {
  ProductionActivationIssue,
  ProductionActivationRequest,
  ProductionActivationRequestCreationResult,
  ProductionActivationRequestInput,
} from './productionActivationTypes'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function freezeIssues(
  issues: readonly ProductionActivationIssue[],
): readonly ProductionActivationIssue[] {
  return Object.freeze(issues.map((issue) => Object.freeze({ ...issue })))
}

function failure(
  issues: readonly ProductionActivationIssue[],
): ProductionActivationRequestCreationResult {
  return Object.freeze({
    ok: false,
    issues: freezeIssues(issues),
  })
}

function mapHandoffIssue(
  issue: ArtifactHandoffIssue,
): ProductionActivationIssue {
  const path =
    issue.path === 'handoffId'
      ? 'activationId'
      : issue.path

  switch (issue.code) {
    case 'INVALID_HANDOFF_ID':
      return {
        code: 'INVALID_ACTIVATION_ID',
        message: 'Production Activation requires a non-empty activationId',
        ...(path === undefined ? {} : { path }),
      }
    case 'INVALID_VIDEO_REFERENCE':
      return {
        code: 'INVALID_VIDEO_REFERENCE',
        message: issue.message,
        ...(path === undefined ? {} : { path }),
      }
    case 'FORBIDDEN_FIELD':
      return {
        code: 'FORBIDDEN_FIELD',
        message: issue.message,
        ...(path === undefined ? {} : { path }),
      }
    default:
      return {
        code: 'INVALID_ACTIVATION_REQUEST',
        message: 'Production Activation request is invalid',
        ...(path === undefined ? {} : { path }),
      }
  }
}

export function createActivationRequest(
  input: unknown,
): ProductionActivationRequestCreationResult {
  if (
    !isRecord(input) ||
    !Object.keys(input).every((key) =>
      ['activationId', 'attempt', 'videoReference'].includes(key),
    )
  ) {
    return failure([
      {
        code: 'INVALID_ACTIVATION_INPUT',
        message:
          'Production Activation input must contain only activationId, attempt, and videoReference',
      },
    ])
  }

  const candidate = input as unknown as ProductionActivationRequestInput
  if (
    !isRecord(candidate.attempt) ||
    !isNonEmptyString(candidate.attempt.attemptId) ||
    !isNonEmptyString(candidate.attempt.jobId)
  ) {
    return failure([
      {
        code: 'INVALID_PRODUCTION_ATTEMPT',
        message:
          'Production Activation requires a valid correlated ProductionAttempt',
        path: 'attempt',
      },
    ])
  }

  if (candidate.attempt.status !== 'COMPLETED') {
    return failure([
      {
        code: 'ATTEMPT_NOT_COMPLETED',
        message:
          'Production Activation accepts only a COMPLETED ProductionAttempt',
        path: 'attempt.status',
      },
    ])
  }

  const handoffCreation = createArtifactHandoffRequest({
    handoffId: candidate.activationId,
    productionJobId: candidate.attempt.jobId,
    productionAttemptId: candidate.attempt.attemptId,
    videoReference: candidate.videoReference,
  })

  if (!handoffCreation.ok) {
    return failure(handoffCreation.issues.map(mapHandoffIssue))
  }

  const request: ProductionActivationRequest = Object.freeze({
    activationId: handoffCreation.request.handoffId,
    productionJobId: handoffCreation.request.productionJobId,
    productionAttemptId: handoffCreation.request.productionAttemptId,
    videoReference: handoffCreation.request.videoReference,
  })

  return Object.freeze({
    ok: true,
    request,
  })
}
