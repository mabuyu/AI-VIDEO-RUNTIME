import type { ExecutionResult } from '../execution/types'
import type { ProductionJob } from '../jobs'
import type { ProductionJobDispatch } from '../queue'
import { materializeProductionJobDispatch } from '../queue/productionJobDispatchSnapshot'
import { materializeImmutableBoundaryValue } from './boundarySnapshot'
import type {
  ProductionJobWorker,
  ProductionJobWorkerDependencies,
  ProductionJobWorkerExecutionContext,
  ProductionJobWorkerIssue,
  ProductionJobWorkerIssueCode,
  ProductionJobWorkerOutcome,
  ProductionJobWorkerResult,
} from './contracts'

const EXECUTION_RESULT_KEYS: readonly string[] = Object.freeze([
  'executionId',
  'planId',
  'status',
  'results',
  'generationOutputs',
  'errors',
])
const EXECUTION_STATUSES: readonly string[] = Object.freeze([
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
])
const CONTEXT_KEYS: readonly string[] = Object.freeze([
  'workerId',
  'leaseId',
  'now',
  'leaseExpiresAt',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const keys = Reflect.ownKeys(value)
  return (
    keys.length === expectedKeys.length &&
    keys.every(
      (key) => typeof key === 'string' && expectedKeys.includes(key),
    )
  )
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

function materializeContext(
  candidate: unknown,
): ProductionJobWorkerExecutionContext | null {
  let value: unknown
  try {
    value = materializeImmutableBoundaryValue(candidate)
  } catch {
    return null
  }

  if (
    !isRecord(value) ||
    !hasExactKeys(value, CONTEXT_KEYS) ||
    !isBoundaryString(value.workerId) ||
    !isBoundaryString(value.leaseId) ||
    !isBoundaryString(value.now) ||
    !Number.isFinite(Date.parse(value.now)) ||
    !isBoundaryString(value.leaseExpiresAt) ||
    !Number.isFinite(Date.parse(value.leaseExpiresAt)) ||
    Date.parse(value.leaseExpiresAt) <= Date.parse(value.now)
  ) {
    return null
  }

  return value as unknown as ProductionJobWorkerExecutionContext
}

function materializeExecutionResult(candidate: unknown): ExecutionResult | null {
  let value: unknown
  try {
    value = materializeImmutableBoundaryValue(candidate)
  } catch {
    return null
  }

  if (
    !isRecord(value) ||
    !hasExactKeys(value, EXECUTION_RESULT_KEYS) ||
    !isBoundaryString(value.executionId) ||
    !isBoundaryString(value.planId) ||
    typeof value.status !== 'string' ||
    !EXECUTION_STATUSES.includes(value.status) ||
    !Array.isArray(value.results) ||
    !Array.isArray(value.generationOutputs) ||
    !Array.isArray(value.errors)
  ) {
    return null
  }

  return value as unknown as ExecutionResult
}

function issue(
  code: ProductionJobWorkerIssueCode,
  message: string,
): ProductionJobWorkerIssue {
  return Object.freeze({ code, message })
}

function isDeepFrozen(
  value: unknown,
  seen: WeakSet<object> = new WeakSet<object>(),
): boolean {
  if (typeof value !== 'object' || value === null || seen.has(value)) {
    return true
  }

  try {
    if (!Object.isFrozen(value)) return false
    seen.add(value)
    return Object.values(value).every((child) => isDeepFrozen(child, seen))
  } catch {
    return false
  }
}

function workerResult(
  outcome: ProductionJobWorkerOutcome,
  dispatch: ProductionJobDispatch | null,
  job: ProductionJob | null,
  executionResult: ExecutionResult | null,
  issues: readonly ProductionJobWorkerIssue[],
): ProductionJobWorkerResult {
  return Object.freeze({
    outcome,
    dispatch:
      dispatch === null ? null : materializeProductionJobDispatch(dispatch),
    job: job !== null && isDeepFrozen(job) ? job : null,
    executionResult,
    issues: Object.freeze(
      issues.map((entry) => Object.freeze({ ...entry })),
    ),
  })
}

function transitionMessage(candidate: unknown, fallback: string): string {
  try {
    if (
      isRecord(candidate) &&
      Array.isArray(candidate.issues) &&
      isRecord(candidate.issues[0]) &&
      typeof candidate.issues[0].message === 'string'
    ) {
      return candidate.issues[0].message
    }
  } catch {
    return fallback
  }
  return fallback
}

export function createProductionJobWorker(
  dependencies: ProductionJobWorkerDependencies,
): ProductionJobWorker {
  const { stateAuthority, jobStore, planSource, queue, executionManager } =
    dependencies

  async function finalize(
    dispatch: ProductionJobDispatch,
    result: ProductionJobWorkerResult,
  ): Promise<ProductionJobWorkerResult> {
    try {
      const acknowledged = await queue.ack(dispatch.dispatchId)
      if (acknowledged) return result
    } catch {
      // Converted below into a boundary-safe result.
    }

    return workerResult(
      'EXECUTION_ERROR',
      dispatch,
      result.job,
      result.executionResult,
      [
        ...result.issues,
        issue(
          'QUEUE_ACK_FAILED',
          'ProductionJob dispatch could not be acknowledged',
        ),
      ],
    )
  }

  return Object.freeze({
    async processNext(
      contextCandidate: ProductionJobWorkerExecutionContext,
    ): Promise<ProductionJobWorkerResult> {
      let received: ProductionJobDispatch | null
      try {
        received = await queue.receive()
      } catch {
        return workerResult('EXECUTION_ERROR', null, null, null, [
          issue(
            'QUEUE_RECEIVE_FAILED',
            'ProductionJob dispatch could not be received',
          ),
        ])
      }

      if (received === null) {
        return workerResult('NO_DISPATCH', null, null, null, [])
      }

      const dispatch = materializeProductionJobDispatch(received)
      if (dispatch === null) {
        return workerResult('DISPATCH_REJECTED', null, null, null, [
          issue('INVALID_DISPATCH', 'Queue returned an invalid dispatch'),
        ])
      }

      const context = materializeContext(contextCandidate)
      if (context === null) {
        return finalize(
          dispatch,
          workerResult('CLAIM_FAILED', dispatch, null, null, [
            issue(
              'INVALID_EXECUTION_CONTEXT',
              'Worker claim context is invalid',
            ),
          ]),
        )
      }

      let scheduledJob: ProductionJob | null
      try {
        scheduledJob = await jobStore.getById(dispatch.jobId)
      } catch {
        return finalize(
          dispatch,
          workerResult('EXECUTION_ERROR', dispatch, null, null, [
            issue('JOB_LOOKUP_FAILED', 'ProductionJob lookup failed'),
          ]),
        )
      }

      if (scheduledJob === null) {
        return finalize(
          dispatch,
          workerResult('JOB_NOT_FOUND', dispatch, null, null, [
            issue('JOB_NOT_FOUND', 'ProductionJob was not found'),
          ]),
        )
      }

      try {
        if (scheduledJob.jobId !== dispatch.jobId) {
          return finalize(
            dispatch,
            workerResult(
              'DISPATCH_REJECTED',
              dispatch,
              scheduledJob,
              null,
              [
                issue(
                  'JOB_CORRELATION_MISMATCH',
                  'Dispatch jobId does not match the stored ProductionJob',
                ),
              ],
            ),
          )
        }
        if (scheduledJob.version !== dispatch.expectedVersion) {
          return finalize(
            dispatch,
            workerResult(
              'DISPATCH_REJECTED',
              dispatch,
              scheduledJob,
              null,
              [
                issue(
                  'STALE_DISPATCH',
                  'Dispatch expectedVersion does not match the stored ProductionJob',
                ),
              ],
            ),
          )
        }
      } catch {
        return finalize(
          dispatch,
          workerResult('DISPATCH_REJECTED', dispatch, null, null, [
            issue(
              'JOB_CORRELATION_MISMATCH',
              'Stored ProductionJob correlation fields could not be read',
            ),
          ]),
        )
      }

      let claimResult
      try {
        claimResult = stateAuthority.transition(scheduledJob, {
          type: 'CLAIM',
          workerId: context.workerId,
          leaseId: context.leaseId,
          expiresAt: context.leaseExpiresAt,
          updatedAt: context.now,
        })
      } catch {
        return finalize(
          dispatch,
          workerResult('CLAIM_FAILED', dispatch, scheduledJob, null, [
            issue(
              'CLAIM_TRANSITION_FAILED',
              'ProductionJob claim authority failed',
            ),
          ]),
        )
      }

      if (!claimResult.ok) {
        return finalize(
          dispatch,
          workerResult('CLAIM_FAILED', dispatch, scheduledJob, null, [
            issue(
              'CLAIM_TRANSITION_FAILED',
              transitionMessage(
                claimResult,
                'ProductionJob claim was rejected by the state authority',
              ),
            ),
          ]),
        )
      }

      const claimedJob = claimResult.job
      let claimStored: boolean
      try {
        claimStored = await jobStore.replace(claimedJob, scheduledJob.version)
      } catch {
        claimStored = false
      }
      if (!claimStored) {
        return finalize(
          dispatch,
          workerResult('CLAIM_FAILED', dispatch, scheduledJob, null, [
            issue(
              'CLAIM_STORE_CONFLICT',
              'Claimed ProductionJob snapshot could not replace its expected version',
            ),
          ]),
        )
      }

      let startResult
      try {
        startResult = stateAuthority.transition(claimedJob, {
          type: 'START',
          updatedAt: context.now,
        })
      } catch {
        return finalize(
          dispatch,
          workerResult('CLAIM_FAILED', dispatch, claimedJob, null, [
            issue(
              'START_TRANSITION_FAILED',
              'ProductionJob start authority failed',
            ),
          ]),
        )
      }

      if (!startResult.ok) {
        return finalize(
          dispatch,
          workerResult('CLAIM_FAILED', dispatch, claimedJob, null, [
            issue(
              'START_TRANSITION_FAILED',
              transitionMessage(
                startResult,
                'ProductionJob start was rejected by the state authority',
              ),
            ),
          ]),
        )
      }

      const runningJob = startResult.job
      let runningStored: boolean
      try {
        runningStored = await jobStore.replace(runningJob, claimedJob.version)
      } catch {
        runningStored = false
      }
      if (!runningStored) {
        return finalize(
          dispatch,
          workerResult('CLAIM_FAILED', dispatch, claimedJob, null, [
            issue(
              'START_STORE_CONFLICT',
              'Running ProductionJob snapshot could not replace its expected version',
            ),
          ]),
        )
      }

      let plan
      try {
        plan = await planSource.resolve(runningJob.planId)
      } catch {
        return finalize(
          dispatch,
          workerResult('EXECUTION_ERROR', dispatch, runningJob, null, [
            issue('PLAN_LOOKUP_FAILED', 'ProductionPlan lookup failed'),
          ]),
        )
      }

      if (plan === null) {
        return finalize(
          dispatch,
          workerResult('PLAN_NOT_FOUND', dispatch, runningJob, null, [
            issue('PLAN_NOT_FOUND', 'ProductionPlan was not found'),
          ]),
        )
      }

      try {
        if (
          plan.planId !== runningJob.planId ||
          plan.requestId !== runningJob.requestId
        ) {
          return finalize(
            dispatch,
            workerResult('PLAN_NOT_FOUND', dispatch, runningJob, null, [
              issue(
                'PLAN_CORRELATION_MISMATCH',
                'ProductionPlan does not match the ProductionJob correlation fields',
              ),
            ]),
          )
        }
      } catch {
        return finalize(
          dispatch,
          workerResult('PLAN_NOT_FOUND', dispatch, runningJob, null, [
            issue(
              'PLAN_CORRELATION_MISMATCH',
              'ProductionPlan correlation fields could not be read',
            ),
          ]),
        )
      }

      let executionCandidate: unknown
      try {
        executionCandidate = await executionManager.execute(plan)
      } catch {
        return finalize(
          dispatch,
          workerResult('EXECUTION_ERROR', dispatch, runningJob, null, [
            issue(
              'EXECUTION_MANAGER_ERROR',
              'ExecutionManager.execute failed at the worker boundary',
            ),
          ]),
        )
      }

      const executionResult = materializeExecutionResult(executionCandidate)
      if (executionResult === null) {
        return finalize(
          dispatch,
          workerResult('EXECUTION_ERROR', dispatch, runningJob, null, [
            issue(
              'INVALID_EXECUTION_RESULT',
              'ExecutionManager returned an invalid ExecutionResult',
            ),
          ]),
        )
      }

      if (executionResult.planId !== runningJob.planId) {
        return finalize(
          dispatch,
          workerResult(
            'EXECUTION_ERROR',
            dispatch,
            runningJob,
            executionResult,
            [
              issue(
                'EXECUTION_RESULT_CORRELATION_MISMATCH',
                'ExecutionResult planId does not match the ProductionJob',
              ),
            ],
          ),
        )
      }

      if (executionResult.status === 'FAILED') {
        return finalize(
          dispatch,
          workerResult(
            'EXECUTION_FAILED',
            dispatch,
            runningJob,
            executionResult,
            [],
          ),
        )
      }

      if (executionResult.status !== 'COMPLETED') {
        return finalize(
          dispatch,
          workerResult(
            'EXECUTION_ERROR',
            dispatch,
            runningJob,
            executionResult,
            [
              issue(
                'NON_TERMINAL_EXECUTION_RESULT',
                'ExecutionManager returned a non-terminal ExecutionResult',
              ),
            ],
          ),
        )
      }

      let completionResult
      try {
        completionResult = stateAuthority.transition(runningJob, {
          type: 'COMPLETE',
          updatedAt: context.now,
        })
      } catch {
        return finalize(
          dispatch,
          workerResult(
            'COMPLETION_FAILED',
            dispatch,
            runningJob,
            executionResult,
            [
              issue(
                'COMPLETION_TRANSITION_FAILED',
                'ProductionJob completion authority failed',
              ),
            ],
          ),
        )
      }

      if (!completionResult.ok) {
        return finalize(
          dispatch,
          workerResult(
            'COMPLETION_FAILED',
            dispatch,
            runningJob,
            executionResult,
            [
              issue(
                'COMPLETION_TRANSITION_FAILED',
                transitionMessage(
                  completionResult,
                  'ProductionJob completion was rejected by the state authority',
                ),
              ),
            ],
          ),
        )
      }

      const completedJob = completionResult.job
      let completionStored: boolean
      try {
        completionStored = await jobStore.replace(
          completedJob,
          runningJob.version,
        )
      } catch {
        completionStored = false
      }
      if (!completionStored) {
        return finalize(
          dispatch,
          workerResult(
            'COMPLETION_FAILED',
            dispatch,
            runningJob,
            executionResult,
            [
              issue(
                'COMPLETION_STORE_CONFLICT',
                'Completed ProductionJob snapshot could not replace its expected version',
              ),
            ],
          ),
        )
      }

      return finalize(
        dispatch,
        workerResult(
          'COMPLETED',
          dispatch,
          completedJob,
          executionResult,
          [],
        ),
      )
    },
  })
}
