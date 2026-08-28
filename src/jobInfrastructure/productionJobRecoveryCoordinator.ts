import type { ProductionJob } from '../jobs'
import { createProductionJobDispatch } from '../queue'
import type {
  ProcessDueProductionJobRetryCommand,
  ProductionJobRecoveryCoordinator,
  ProductionJobRecoveryCoordinatorDependencies,
  ProductionJobRecoveryOutcome,
  ProductionJobRecoveryResult,
  ProductionJobRetryDecision,
  RecoverExpiredProductionJobCommand,
  ReportProductionExecutionFailureCommand,
  ResolveProductionJobRecoveryCommand,
} from './contracts'

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value === value.trim() &&
    Number.isFinite(Date.parse(value))
  )
}

function copyDecision(
  decision: ProductionJobRetryDecision | null,
): ProductionJobRetryDecision | null {
  return decision === null ? null : Object.freeze({ ...decision })
}

function recoveryResult(
  outcome: ProductionJobRecoveryOutcome,
  job: ProductionJob | null,
  decision: ProductionJobRetryDecision | null = null,
  dispatch: ProductionJobRecoveryResult['dispatch'] = null,
  issues: readonly string[] = [],
): ProductionJobRecoveryResult {
  return Object.freeze({
    outcome,
    job,
    decision: copyDecision(decision),
    dispatch,
    issues: Object.freeze([...issues]),
  })
}

function firstTransitionIssue(
  transition: { readonly issues: readonly { readonly message: string }[] },
  fallback: string,
): string {
  return transition.issues[0]?.message ?? fallback
}

export function createProductionJobRecoveryCoordinator(
  dependencies: ProductionJobRecoveryCoordinatorDependencies,
): ProductionJobRecoveryCoordinator {
  const { stateAuthority, repository, retryPolicy, retrySchedules, outbox } =
    dependencies

  async function loadExpected(
    jobId: string,
    expectedVersion: number,
  ): Promise<ProductionJobRecoveryResult | ProductionJob> {
    if (
      typeof jobId !== 'string' ||
      jobId.length === 0 ||
      !Number.isSafeInteger(expectedVersion) ||
      expectedVersion < 0
    ) {
      return recoveryResult('REJECTED', null, null, null, [
        'Recovery command identity is invalid',
      ])
    }

    let job: ProductionJob | null
    try {
      job = await repository.getById(jobId)
    } catch {
      return recoveryResult('REJECTED', null, null, null, [
        'ProductionJob repository lookup failed',
      ])
    }
    if (job === null) return recoveryResult('JOB_NOT_FOUND', null)
    if (job.jobId !== jobId || job.version !== expectedVersion) {
      return recoveryResult('STALE_VERSION', job)
    }
    return job
  }

  async function saveTransition(
    previous: ProductionJob,
    next: ProductionJob,
  ): Promise<boolean> {
    try {
      return await repository.save(next, previous.version)
    } catch {
      return false
    }
  }

  async function appendScheduledDispatch(
    job: ProductionJob,
    availableAt: string,
    createdAt: string,
  ) {
    const dispatch = createProductionJobDispatch(job, availableAt)
    await outbox.append(dispatch, createdAt)
    return dispatch
  }

  return Object.freeze({
    async reportExecutionFailure(
      command: ReportProductionExecutionFailureCommand,
    ): Promise<ProductionJobRecoveryResult> {
      const loaded = await loadExpected(command.jobId, command.expectedVersion)
      if ('outcome' in loaded) return loaded
      const runningJob = loaded

      if (
        !isTimestamp(command.updatedAt) ||
        runningJob.status !== 'RUNNING' ||
        command.failure.planId !== runningJob.planId ||
        command.attempt.jobId !== runningJob.jobId ||
        command.attempt.attemptId !== runningJob.currentAttemptId ||
        command.attempt.attemptNumber !== runningJob.attemptCount ||
        command.attempt.executionId !== command.failure.executionId ||
        command.attempt.outcome !== 'FAILED' ||
        command.attempt.failureClassification !==
          command.failure.classification
      ) {
        return recoveryResult('REJECTED', runningJob, null, null, [
          'Execution failure correlation is invalid',
        ])
      }

      let decision: ProductionJobRetryDecision
      try {
        decision = retryPolicy.decide({
          job: runningJob,
          failure: command.failure,
          attempt: command.attempt,
        })
      } catch {
        return recoveryResult('REJECTED', runningJob, null, null, [
          'Retry policy rejected execution failure evidence',
        ])
      }

      const transition = stateAuthority.transition(
        runningJob,
        decision.decision === 'RETRY'
          ? { type: 'WAIT_FOR_RETRY', updatedAt: command.updatedAt }
          : { type: 'FAIL', updatedAt: command.updatedAt },
      )
      if (!transition.ok) {
        return recoveryResult('REJECTED', runningJob, decision, null, [
          firstTransitionIssue(
            transition,
            'Execution failure state transition was rejected',
          ),
        ])
      }
      if (!(await saveTransition(runningJob, transition.job))) {
        return recoveryResult('STALE_VERSION', runningJob, decision)
      }

      if (decision.decision === 'FAIL') {
        return recoveryResult('FAILED', transition.job, decision)
      }

      const scheduled = await retrySchedules.save({
        jobId: transition.job.jobId,
        jobVersion: transition.job.version,
        availableAt: decision.nextAvailableAt,
      })
      if (!scheduled) {
        return recoveryResult('REJECTED', transition.job, decision, null, [
          'Retry schedule could not be persisted',
        ])
      }
      return recoveryResult('RETRY_WAIT', transition.job, decision)
    },

    async recoverExpiredLease(
      command: RecoverExpiredProductionJobCommand,
    ): Promise<ProductionJobRecoveryResult> {
      const loaded = await loadExpected(command.jobId, command.expectedVersion)
      if ('outcome' in loaded) return loaded
      const activeJob = loaded

      if (
        !isTimestamp(command.updatedAt) ||
        (activeJob.status !== 'CLAIMED' && activeJob.status !== 'RUNNING') ||
        activeJob.lease === null
      ) {
        return recoveryResult('REJECTED', activeJob, null, null, [
          'Lease recovery requires an active leased Job',
        ])
      }
      if (
        Date.parse(activeJob.lease.expiresAt) > Date.parse(command.updatedAt)
      ) {
        return recoveryResult('NOT_DUE', activeJob)
      }

      const transition = stateAuthority.transition(activeJob, {
        type: 'MARK_RECOVERY_PENDING',
        updatedAt: command.updatedAt,
      })
      if (!transition.ok) {
        return recoveryResult('REJECTED', activeJob, null, null, [
          firstTransitionIssue(transition, 'Lease recovery was rejected'),
        ])
      }
      if (!(await saveTransition(activeJob, transition.job))) {
        return recoveryResult('STALE_VERSION', activeJob)
      }
      return recoveryResult('RECOVERY_PENDING', transition.job)
    },

    async processDueRetry(
      command: ProcessDueProductionJobRetryCommand,
    ): Promise<ProductionJobRecoveryResult> {
      const loaded = await loadExpected(command.jobId, command.expectedVersion)
      if ('outcome' in loaded) return loaded
      const retryWaitJob = loaded

      if (!isTimestamp(command.updatedAt) || retryWaitJob.status !== 'RETRY_WAIT') {
        return recoveryResult('REJECTED', retryWaitJob, null, null, [
          'Due retry processing requires a RETRY_WAIT Job and timestamp',
        ])
      }

      const schedule = await retrySchedules.getByJobId(retryWaitJob.jobId)
      if (
        schedule === null ||
        schedule.jobVersion !== retryWaitJob.version
      ) {
        return recoveryResult('REJECTED', retryWaitJob, null, null, [
          'Retry schedule does not match the current Job version',
        ])
      }
      if (Date.parse(command.updatedAt) < Date.parse(schedule.availableAt)) {
        return recoveryResult('NOT_DUE', retryWaitJob)
      }

      const transition = stateAuthority.transition(retryWaitJob, {
        type: 'RESCHEDULE',
        updatedAt: command.updatedAt,
      })
      if (!transition.ok) {
        return recoveryResult('REJECTED', retryWaitJob, null, null, [
          firstTransitionIssue(transition, 'Retry reschedule was rejected'),
        ])
      }
      if (!(await saveTransition(retryWaitJob, transition.job))) {
        return recoveryResult('STALE_VERSION', retryWaitJob)
      }
      if (!(await retrySchedules.remove(retryWaitJob.jobId, retryWaitJob.version))) {
        return recoveryResult('REJECTED', transition.job, null, null, [
          'Consumed retry schedule could not be removed',
        ])
      }

      try {
        const dispatch = await appendScheduledDispatch(
          transition.job,
          schedule.availableAt,
          command.updatedAt,
        )
        return recoveryResult('SCHEDULED', transition.job, null, dispatch)
      } catch {
        return recoveryResult('REJECTED', transition.job, null, null, [
          'Rescheduled dispatch could not be recorded in the outbox',
        ])
      }
    },

    async resolveRecovery(
      command: ResolveProductionJobRecoveryCommand,
    ): Promise<ProductionJobRecoveryResult> {
      const loaded = await loadExpected(command.jobId, command.expectedVersion)
      if ('outcome' in loaded) return loaded
      const recoveryJob = loaded

      if (!isTimestamp(command.updatedAt) || recoveryJob.status !== 'RECOVERY_PENDING') {
        return recoveryResult('REJECTED', recoveryJob, null, null, [
          'Recovery resolution requires a RECOVERY_PENDING Job',
        ])
      }
      if (
        command.action === 'RESCHEDULE' &&
        !isTimestamp(command.availableAt)
      ) {
        return recoveryResult('REJECTED', recoveryJob, null, null, [
          'Recovery dispatch availableAt is invalid',
        ])
      }

      const transition = stateAuthority.transition(
        recoveryJob,
        command.action === 'RESCHEDULE'
          ? { type: 'RESCHEDULE', updatedAt: command.updatedAt }
          : { type: 'FAIL', updatedAt: command.updatedAt },
      )
      if (!transition.ok) {
        return recoveryResult('REJECTED', recoveryJob, null, null, [
          firstTransitionIssue(transition, 'Recovery resolution was rejected'),
        ])
      }
      if (!(await saveTransition(recoveryJob, transition.job))) {
        return recoveryResult('STALE_VERSION', recoveryJob)
      }

      if (command.action === 'FAIL') {
        return recoveryResult('FAILED', transition.job)
      }

      try {
        const dispatch = await appendScheduledDispatch(
          transition.job,
          command.availableAt,
          command.updatedAt,
        )
        return recoveryResult('SCHEDULED', transition.job, null, dispatch)
      } catch {
        return recoveryResult('REJECTED', transition.job, null, null, [
          'Recovery dispatch could not be recorded in the outbox',
        ])
      }
    },
  })
}
