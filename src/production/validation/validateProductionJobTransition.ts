import type {
  ProductionJobIssue,
  ProductionJobStatus,
  ProductionJobTransitionValidationResult,
} from '../types/productionJob'

const productionJobStatuses: readonly ProductionJobStatus[] = Object.freeze([
  'CREATED',
  'SCHEDULED',
  'RUNNING',
  'COMPLETED',
  'FAILED',
])

const allowedTransitions: Readonly<
  Record<ProductionJobStatus, readonly ProductionJobStatus[]>
> = Object.freeze({
  CREATED: Object.freeze<ProductionJobStatus[]>(['SCHEDULED', 'FAILED']),
  SCHEDULED: Object.freeze<ProductionJobStatus[]>(['RUNNING', 'FAILED']),
  RUNNING: Object.freeze<ProductionJobStatus[]>(['COMPLETED', 'FAILED']),
  COMPLETED: Object.freeze<ProductionJobStatus[]>([]),
  FAILED: Object.freeze<ProductionJobStatus[]>([]),
})

function isProductionJobStatus(
  status: unknown,
): status is ProductionJobStatus {
  return productionJobStatuses.some((candidate) => candidate === status)
}

function failure(
  issue: ProductionJobIssue,
): ProductionJobTransitionValidationResult {
  return Object.freeze({
    valid: false,
    issues: Object.freeze([Object.freeze(issue)]),
  })
}

export function validateProductionJobTransition(
  currentStatus: unknown,
  targetStatus: unknown,
): ProductionJobTransitionValidationResult {
  if (!isProductionJobStatus(currentStatus)) {
    return failure({
      code: 'INVALID_CURRENT_STATUS',
      message: `Unsupported ProductionJob current status: ${String(currentStatus)}`,
    })
  }

  if (!isProductionJobStatus(targetStatus)) {
    return failure({
      code: 'INVALID_TARGET_STATUS',
      message: `Unsupported ProductionJob target status: ${String(targetStatus)}`,
    })
  }

  if (!allowedTransitions[currentStatus].includes(targetStatus)) {
    return failure({
      code: 'INVALID_TRANSITION',
      message: `ProductionJob transition ${currentStatus} -> ${targetStatus} is not allowed`,
    })
  }

  return Object.freeze({ valid: true })
}
