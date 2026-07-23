import type {
  ProductionAttemptIssue,
  ProductionAttemptStatus,
  ProductionAttemptTransitionValidationResult,
} from '../types/productionAttempt'

const productionAttemptStatuses: readonly ProductionAttemptStatus[] =
  Object.freeze(['CREATED', 'RUNNING', 'COMPLETED', 'FAILED'])

const allowedTransitions: Readonly<
  Record<ProductionAttemptStatus, readonly ProductionAttemptStatus[]>
> = Object.freeze({
  CREATED: Object.freeze<ProductionAttemptStatus[]>(['RUNNING']),
  RUNNING: Object.freeze<ProductionAttemptStatus[]>(['COMPLETED', 'FAILED']),
  COMPLETED: Object.freeze<ProductionAttemptStatus[]>([]),
  FAILED: Object.freeze<ProductionAttemptStatus[]>([]),
})

function isProductionAttemptStatus(
  status: unknown,
): status is ProductionAttemptStatus {
  return productionAttemptStatuses.some((candidate) => candidate === status)
}

function failure(
  issue: ProductionAttemptIssue,
): ProductionAttemptTransitionValidationResult {
  return Object.freeze({
    valid: false,
    issues: Object.freeze([Object.freeze(issue)]),
  })
}

export function validateProductionAttemptTransition(
  currentStatus: unknown,
  targetStatus: unknown,
): ProductionAttemptTransitionValidationResult {
  if (!isProductionAttemptStatus(currentStatus)) {
    return failure({
      code: 'INVALID_CURRENT_STATUS',
      message: `Unsupported ProductionAttempt current status: ${String(currentStatus)}`,
    })
  }

  if (!isProductionAttemptStatus(targetStatus)) {
    return failure({
      code: 'INVALID_TARGET_STATUS',
      message: `Unsupported ProductionAttempt target status: ${String(targetStatus)}`,
    })
  }

  if (!allowedTransitions[currentStatus].includes(targetStatus)) {
    return failure({
      code: 'INVALID_TRANSITION',
      message: `ProductionAttempt transition ${currentStatus} -> ${targetStatus} is not allowed`,
    })
  }

  return Object.freeze({ valid: true })
}
