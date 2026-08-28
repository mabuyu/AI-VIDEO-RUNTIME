import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

function assertDeepFrozen(value, label, seen = new WeakSet()) {
  if (typeof value !== 'object' || value === null || seen.has(value)) return
  seen.add(value)
  assert.equal(Object.isFrozen(value), true, `${label} must be frozen`)
  for (const [key, child] of Object.entries(value)) {
    assertDeepFrozen(child, `${label}.${key}`, seen)
  }
}

function createPlan(suffix) {
  return Object.freeze({
    planId: `plan-wp11-${suffix}`,
    requestId: `request-wp11-${suffix}`,
    tasks: Object.freeze([
      Object.freeze({
        taskId: `task-wp11-${suffix}`,
        requestId: `request-wp11-${suffix}`,
        providerId: 'provider-wp11-fixture',
        generationIntent: 'Validate retry and recovery infrastructure',
        outputSpecification: Object.freeze({
          mediaType: 'video',
          format: 'mp4',
        }),
      }),
    ]),
  })
}

function failedExecutionResult(planId, suffix) {
  return Object.freeze({
    executionId: `execution:${planId}:${suffix}`,
    planId,
    status: 'FAILED',
    results: Object.freeze([]),
    generationOutputs: Object.freeze([]),
    errors: Object.freeze([
      Object.freeze({
        code: 'PROVIDER_EXECUTION_FAILED',
        message: `WP11 ${suffix} failure fixture`,
      }),
    ]),
  })
}

function transition(authority, job, command, expectedStatus) {
  const result = authority.transition(job, command)
  assert.equal(result.ok, true, `${command.type} transition must succeed`)
  assert.equal(result.job.status, expectedStatus)
  return result.job
}

function createLifecycle(jobs, suffix, maxAttempts = 3) {
  const plan = createPlan(suffix)
  const authority = jobs.createProductionJobStateAuthority()
  const creation = jobs.createProductionJob(plan, {
    maxAttempts,
    createdAt: '2026-08-28T00:00:00.000Z',
  })
  assert.equal(creation.ok, true)
  const created = creation.job
  const scheduled = transition(
    authority,
    created,
    { type: 'SCHEDULE', updatedAt: '2026-08-28T00:01:00.000Z' },
    'SCHEDULED',
  )
  const claimed = transition(
    authority,
    scheduled,
    {
      type: 'CLAIM',
      workerId: `worker-wp11-${suffix}`,
      leaseId: `lease-wp11-${suffix}`,
      expiresAt: '2026-08-28T01:00:00.000Z',
      updatedAt: '2026-08-28T00:02:00.000Z',
    },
    'CLAIMED',
  )
  const running = transition(
    authority,
    claimed,
    { type: 'START', updatedAt: '2026-08-28T00:03:00.000Z' },
    'RUNNING',
  )
  return { plan, authority, created, scheduled, claimed, running }
}

function createFailureFixture(infrastructure, running, classification, suffix) {
  const executionResult = failedExecutionResult(running.planId, suffix)
  const failure = infrastructure.createProductionExecutionFailureEvidence({
    executionResult,
    code: `FAILURE_${suffix.toUpperCase()}`,
    message: `Failure evidence ${suffix}`,
    classification,
    occurredAt: '2026-08-28T00:05:00.000Z',
  })
  const attempt = infrastructure.createProductionAttemptRecord({
    job: running,
    executionId: executionResult.executionId,
    outcome: 'FAILED',
    startedAt: '2026-08-28T00:03:00.000Z',
    finishedAt: '2026-08-28T00:05:00.000Z',
    failureClassification: classification,
  })
  return { executionResult, failure, attempt }
}

async function readTypeScriptSources(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryUrl = new URL(
        `${entry.name}${entry.isDirectory() ? '/' : ''}`,
        directoryUrl,
      )
      if (entry.isDirectory()) return readTypeScriptSources(entryUrl)
      if (entry.isFile() && entry.name.endsWith('.ts')) {
        return [{ url: entryUrl.href, source: await readFile(entryUrl, 'utf8') }]
      }
      return []
    }),
  )
  return nested.flat()
}

try {
  const jobs = await server.ssrLoadModule('/src/jobs/index.ts')
  const queueApi = await server.ssrLoadModule('/src/queue/index.ts')
  const workerApi = await server.ssrLoadModule('/src/worker/index.ts')
  const infrastructure = await server.ssrLoadModule(
    '/src/jobInfrastructure/index.ts',
  )

  assert.deepEqual(Object.keys(jobs).sort(), [
    'createProductionJob',
    'createProductionJobStateAuthority',
  ])
  assert.deepEqual(Object.keys(infrastructure).sort(), [
    'createFixedProductionJobRetryPolicy',
    'createInMemoryJobDispatchOutbox',
    'createInMemoryProductionJobRepository',
    'createInMemoryProductionJobRetryScheduleStore',
    'createProductionAttemptRecord',
    'createProductionExecutionFailureEvidence',
    'createProductionJobOutboxDispatcher',
    'createProductionJobRecoveryCoordinator',
    'isProductionJobRecord',
  ])

  const repositoryLifecycle = createLifecycle(jobs, 'repository')
  const repository = infrastructure.createInMemoryProductionJobRepository()
  assert.equal(await repository.exists(repositoryLifecycle.created.jobId), false)
  assert.equal(await repository.save(repositoryLifecycle.created, null), true)
  assert.equal(await repository.exists(repositoryLifecycle.created.jobId), true)

  const rehydratedCreated = await repository.getById(
    repositoryLifecycle.created.jobId,
  )
  assert.notEqual(rehydratedCreated, repositoryLifecycle.created)
  assert.deepEqual(rehydratedCreated, repositoryLifecycle.created)
  assertDeepFrozen(rehydratedCreated, 'rehydrated CREATED Job')
  const rehydratedSchedule = jobs
    .createProductionJobStateAuthority()
    .transition(rehydratedCreated, {
      type: 'SCHEDULE',
      updatedAt: '2026-08-28T00:01:00.000Z',
    })
  assert.equal(rehydratedSchedule.ok, true, 'rehydrated Job must remain trusted')
  assert.equal(
    await repository.save(rehydratedSchedule.job, rehydratedCreated.version),
    true,
  )
  assert.equal(
    await repository.save(rehydratedSchedule.job, rehydratedCreated.version),
    false,
    'stale CAS must be rejected',
  )

  const loadedScheduledA = await repository.getById(
    repositoryLifecycle.created.jobId,
  )
  const loadedScheduledB = await repository.getById(
    repositoryLifecycle.created.jobId,
  )
  assert.notEqual(loadedScheduledA, loadedScheduledB)
  assert.deepEqual(loadedScheduledA, loadedScheduledB)
  assert.equal(
    infrastructure.isProductionJobRecord({ ...loadedScheduledA }),
    true,
  )
  const rehydratedClaim = jobs
    .createProductionJobStateAuthority()
    .transition(loadedScheduledA, {
      type: 'CLAIM',
      workerId: 'worker-wp11-rehydrated',
      leaseId: 'lease-wp11-rehydrated',
      expiresAt: '2026-08-28T01:00:00.000Z',
      updatedAt: '2026-08-28T00:02:00.000Z',
    })
  assert.equal(rehydratedClaim.ok, true)
  assert.equal(
    await repository.save(rehydratedClaim.job, loadedScheduledA.version),
    true,
  )

  const forgedScheduled = Object.freeze({ ...repositoryLifecycle.scheduled })
  assert.equal(
    await repository.save(forgedScheduled, repositoryLifecycle.created.version),
    false,
  )
  const forgedTransition = jobs
    .createProductionJobStateAuthority()
    .transition(forgedScheduled, {
      type: 'CLAIM',
      workerId: 'worker-forged',
      leaseId: 'lease-forged',
      expiresAt: '2026-08-28T01:00:00.000Z',
      updatedAt: '2026-08-28T00:02:00.000Z',
    })
  assert.equal(forgedTransition.ok, false)
  assert.equal(forgedTransition.issues[0].code, 'INVALID_JOB')

  const retryLifecycle = createLifecycle(jobs, 'retry-policy')
  const retryFailure = createFailureFixture(
    infrastructure,
    retryLifecycle.running,
    'RETRYABLE',
    'retryable',
  )
  assertDeepFrozen(retryFailure.attempt, 'ProductionAttemptRecord')
  assert.equal(
    retryFailure.attempt.attemptId,
    retryLifecycle.running.currentAttemptId,
  )
  assert.equal(
    retryFailure.attempt.attemptNumber,
    retryLifecycle.running.attemptCount,
  )
  assertDeepFrozen(retryFailure.failure, 'failure evidence')

  const retryPolicy = infrastructure.createFixedProductionJobRetryPolicy({
    delayMilliseconds: 60_000,
  })
  const retryJobBefore = JSON.parse(JSON.stringify(retryLifecycle.running))
  const retryDecision = retryPolicy.decide({
    job: retryLifecycle.running,
    failure: retryFailure.failure,
    attempt: retryFailure.attempt,
  })
  assert.deepEqual(retryDecision, {
    decision: 'RETRY',
    reason: 'RETRYABLE_FAILURE',
    nextAvailableAt: '2026-08-28T00:06:00.000Z',
  })
  assert.deepEqual(retryLifecycle.running, retryJobBefore)
  assertDeepFrozen(retryDecision, 'retry decision')

  const exhaustedLifecycle = createLifecycle(jobs, 'budget', 1)
  const exhaustedFailure = createFailureFixture(
    infrastructure,
    exhaustedLifecycle.running,
    'RETRYABLE',
    'budget',
  )
  const exhaustedDecision = retryPolicy.decide({
    job: exhaustedLifecycle.running,
    failure: exhaustedFailure.failure,
    attempt: exhaustedFailure.attempt,
  })
  assert.equal(exhaustedDecision.decision, 'FAIL')
  assert.equal(exhaustedDecision.reason, 'ATTEMPT_BUDGET_EXHAUSTED')

  const nonRetryLifecycle = createLifecycle(jobs, 'non-retryable')
  const nonRetryFailure = createFailureFixture(
    infrastructure,
    nonRetryLifecycle.running,
    'NON_RETRYABLE',
    'non-retryable',
  )
  const nonRetryDecision = retryPolicy.decide({
    job: nonRetryLifecycle.running,
    failure: nonRetryFailure.failure,
    attempt: nonRetryFailure.attempt,
  })
  assert.equal(nonRetryDecision.decision, 'FAIL')
  assert.equal(nonRetryDecision.reason, 'NON_RETRYABLE_FAILURE')

  const retryRepository =
    infrastructure.createInMemoryProductionJobRepository([
      retryLifecycle.running,
    ])
  const retrySchedules =
    infrastructure.createInMemoryProductionJobRetryScheduleStore()
  const retryOutbox = infrastructure.createInMemoryJobDispatchOutbox()
  const retryCommands = []
  const retryAuthority = jobs.createProductionJobStateAuthority()
  const retryCoordinator = infrastructure.createProductionJobRecoveryCoordinator({
    stateAuthority: Object.freeze({
      transition(job, command) {
        retryCommands.push(command.type)
        return retryAuthority.transition(job, command)
      },
    }),
    repository: retryRepository,
    retryPolicy,
    retrySchedules,
    outbox: retryOutbox,
  })

  const retryWait = await retryCoordinator.reportExecutionFailure({
    jobId: retryLifecycle.running.jobId,
    expectedVersion: retryLifecycle.running.version,
    failure: retryFailure.failure,
    attempt: retryFailure.attempt,
    updatedAt: '2026-08-28T00:05:00.000Z',
  })
  assert.equal(retryWait.outcome, 'RETRY_WAIT')
  assert.equal(retryWait.job.status, 'RETRY_WAIT')
  assert.equal(
    (await retryRepository.getById(retryLifecycle.running.jobId)).status,
    'RETRY_WAIT',
  )
  assert.deepEqual(retryCommands, ['WAIT_FOR_RETRY'])
  assertDeepFrozen(retryWait, 'retry coordinator result')
  const persistedSchedule = await retrySchedules.getByJobId(
    retryLifecycle.running.jobId,
  )
  assert.deepEqual(persistedSchedule, {
    jobId: retryLifecycle.running.jobId,
    jobVersion: retryWait.job.version,
    availableAt: retryDecision.nextAvailableAt,
  })
  assertDeepFrozen(persistedSchedule, 'persisted retry schedule')

  const notDue = await retryCoordinator.processDueRetry({
    jobId: retryWait.job.jobId,
    expectedVersion: retryWait.job.version,
    updatedAt: '2026-08-28T00:05:30.000Z',
  })
  assert.equal(notDue.outcome, 'NOT_DUE')

  const rescheduled = await retryCoordinator.processDueRetry({
    jobId: retryWait.job.jobId,
    expectedVersion: retryWait.job.version,
    updatedAt: '2026-08-28T00:06:00.000Z',
  })
  assert.equal(rescheduled.outcome, 'SCHEDULED')
  assert.equal(rescheduled.job.status, 'SCHEDULED')
  assert.equal(
    rescheduled.dispatch.dispatchId,
    `production-job-dispatch:${rescheduled.job.jobId}:${rescheduled.job.version}`,
  )
  assert.equal(rescheduled.dispatch.expectedVersion, rescheduled.job.version)
  assert.deepEqual(retryCommands, ['WAIT_FOR_RETRY', 'RESCHEDULE'])
  assert.equal(await retrySchedules.getByJobId(rescheduled.job.jobId), null)

  const staleRecovery = await retryCoordinator.processDueRetry({
    jobId: rescheduled.job.jobId,
    expectedVersion: retryWait.job.version,
    updatedAt: '2026-08-28T00:07:00.000Z',
  })
  assert.equal(staleRecovery.outcome, 'STALE_VERSION')

  const pendingRetryDispatches = await retryOutbox.listPending()
  assert.equal(pendingRetryDispatches.length, 1)
  assert.equal(pendingRetryDispatches[0].status, 'PENDING')
  assertDeepFrozen(pendingRetryDispatches, 'outbox pending entries')
  const duplicateOutboxEntry = await retryOutbox.append(
    rescheduled.dispatch,
    '2026-08-28T00:06:00.000Z',
  )
  assert.deepEqual(duplicateOutboxEntry, pendingRetryDispatches[0])

  const dispatchQueue = queueApi.createInMemoryProductionJobQueue()
  const outboxDispatcher = infrastructure.createProductionJobOutboxDispatcher({
    outbox: retryOutbox,
    queue: dispatchQueue,
  })
  const outboxDispatchResult = await outboxDispatcher.dispatchPending(
    '2026-08-28T00:07:00.000Z',
  )
  assert.deepEqual(outboxDispatchResult, {
    dispatchedCount: 1,
    failedCount: 0,
  })
  assertDeepFrozen(outboxDispatchResult, 'outbox dispatcher result')
  assert.equal((await retryOutbox.listPending()).length, 0)
  const queuedRetryDispatch = await dispatchQueue.receive()
  assert.deepEqual(queuedRetryDispatch, rescheduled.dispatch)
  assert.equal(await dispatchQueue.ack(queuedRetryDispatch.dispatchId), true)

  const claimedRecoveryLifecycle = createLifecycle(jobs, 'claimed-recovery')
  const claimedRepository =
    infrastructure.createInMemoryProductionJobRepository([
      claimedRecoveryLifecycle.claimed,
    ])
  const claimedOutbox = infrastructure.createInMemoryJobDispatchOutbox()
  const claimedCoordinator = infrastructure.createProductionJobRecoveryCoordinator({
    stateAuthority: jobs.createProductionJobStateAuthority(),
    repository: claimedRepository,
    retryPolicy,
    retrySchedules:
      infrastructure.createInMemoryProductionJobRetryScheduleStore(),
    outbox: claimedOutbox,
  })
  const claimedPending = await claimedCoordinator.recoverExpiredLease({
    jobId: claimedRecoveryLifecycle.claimed.jobId,
    expectedVersion: claimedRecoveryLifecycle.claimed.version,
    updatedAt: '2026-08-28T02:00:00.000Z',
  })
  assert.equal(claimedPending.outcome, 'RECOVERY_PENDING')
  assert.equal(claimedPending.job.status, 'RECOVERY_PENDING')
  assert.equal(claimedPending.job.lease, null)
  const claimedRescheduled = await claimedCoordinator.resolveRecovery({
    jobId: claimedPending.job.jobId,
    expectedVersion: claimedPending.job.version,
    action: 'RESCHEDULE',
    updatedAt: '2026-08-28T02:01:00.000Z',
    availableAt: '2026-08-28T02:01:00.000Z',
  })
  assert.equal(claimedRescheduled.outcome, 'SCHEDULED')
  assert.equal(claimedRescheduled.job.status, 'SCHEDULED')
  assert.equal((await claimedOutbox.listPending()).length, 1)

  const runningRecoveryLifecycle = createLifecycle(jobs, 'running-recovery')
  const runningRepository =
    infrastructure.createInMemoryProductionJobRepository([
      runningRecoveryLifecycle.running,
    ])
  const runningCoordinator = infrastructure.createProductionJobRecoveryCoordinator({
    stateAuthority: jobs.createProductionJobStateAuthority(),
    repository: runningRepository,
    retryPolicy,
    retrySchedules:
      infrastructure.createInMemoryProductionJobRetryScheduleStore(),
    outbox: infrastructure.createInMemoryJobDispatchOutbox(),
  })
  const runningPending = await runningCoordinator.recoverExpiredLease({
    jobId: runningRecoveryLifecycle.running.jobId,
    expectedVersion: runningRecoveryLifecycle.running.version,
    updatedAt: '2026-08-28T02:00:00.000Z',
  })
  assert.equal(runningPending.outcome, 'RECOVERY_PENDING')
  assert.equal(runningPending.job.status, 'RECOVERY_PENDING')
  const recoveryFailed = await runningCoordinator.resolveRecovery({
    jobId: runningPending.job.jobId,
    expectedVersion: runningPending.job.version,
    action: 'FAIL',
    updatedAt: '2026-08-28T02:01:00.000Z',
  })
  assert.equal(recoveryFailed.outcome, 'FAILED')
  assert.equal(recoveryFailed.job.status, 'FAILED')
  assert.equal(
    (await runningRepository.getById(recoveryFailed.job.jobId)).status,
    'FAILED',
  )

  const nonRetryRepository =
    infrastructure.createInMemoryProductionJobRepository([
      nonRetryLifecycle.running,
    ])
  const nonRetryCoordinator = infrastructure.createProductionJobRecoveryCoordinator({
    stateAuthority: jobs.createProductionJobStateAuthority(),
    repository: nonRetryRepository,
    retryPolicy,
    retrySchedules:
      infrastructure.createInMemoryProductionJobRetryScheduleStore(),
    outbox: infrastructure.createInMemoryJobDispatchOutbox(),
  })
  const terminalFailure = await nonRetryCoordinator.reportExecutionFailure({
    jobId: nonRetryLifecycle.running.jobId,
    expectedVersion: nonRetryLifecycle.running.version,
    failure: nonRetryFailure.failure,
    attempt: nonRetryFailure.attempt,
    updatedAt: '2026-08-28T00:05:00.000Z',
  })
  assert.equal(terminalFailure.outcome, 'FAILED')
  assert.equal(terminalFailure.job.status, 'FAILED')

  const infrastructureSources = await readTypeScriptSources(
    new URL('../src/jobInfrastructure/', import.meta.url),
  )
  const infrastructureSource = infrastructureSources
    .map(({ source }) => source)
    .join('\n')
  const queueSources = await readTypeScriptSources(
    new URL('../src/queue/', import.meta.url),
  )
  const workerSources = await readTypeScriptSources(
    new URL('../src/worker/', import.meta.url),
  )
  const queueSource = queueSources.map(({ source }) => source).join('\n')
  const workerSource = workerSources.map(({ source }) => source).join('\n')
  const repositorySource = await readFile(
    new URL(
      '../src/jobInfrastructure/inMemoryProductionJobRepository.ts',
      import.meta.url,
    ),
    'utf8',
  )
  const retryPolicySource = await readFile(
    new URL(
      '../src/jobInfrastructure/productionJobRetryPolicy.ts',
      import.meta.url,
    ),
    'utf8',
  )
  const outboxSource = await readFile(
    new URL(
      '../src/jobInfrastructure/inMemoryJobDispatchOutbox.ts',
      import.meta.url,
    ),
    'utf8',
  )
  const jobsIndexSource = await readFile(
    new URL('../src/jobs/index.ts', import.meta.url),
    'utf8',
  )

  assert.equal(/createAuthorizedRehydrated/.test(jobsIndexSource), false)
  assert.equal(/isAuthorizedProductionJobSnapshot/.test(jobsIndexSource), false)
  assert.equal(/ArtifactRepository/.test(repositorySource), false)
  assert.equal(/ProductionJobQueue/.test(outboxSource), false)
  assert.equal(/\.enqueue\s*\(/.test(outboxSource), false)
  assert.equal(/\.transition\s*\(/.test(retryPolicySource), false)
  assert.equal(/\.save\s*\(/.test(retryPolicySource), false)
  assert.equal(/\bRetryPolicy\b/.test(queueSource), false)
  assert.equal(/\bRetryPolicy\b/.test(workerSource), false)

  const forbiddenPatterns = [
    ['Artifact authority integration', /\b(?:ArtifactLifecycleAuthority|ArtifactCreationBoundary)\b/],
    ['Runtime integration', /(?:from\s+['"][^'"]*\/runtime|\bRuntimeContext\b|\bRuntimeDataV2\b)/],
    ['Provider execution', /\b(?:ProviderAdapter|ProviderRegistry|GenerationPipeline)\b/],
    ['filesystem persistence', /(?:node:fs|writeFile|createWriteStream)/],
    ['network operation', /\bfetch\s*\(/],
    ['timer process', /\b(?:setTimeout|setInterval)\s*\(/],
    ['random identity', /(?:randomUUID|Math\.random)/],
    ['external broker', /\b(?:Redis|Kafka|RabbitMQ|BullMQ)\b/i],
    ['real database', /\b(?:PostgreSQL|SQLite|database migration)\b/i],
  ]
  for (const [label, pattern] of forbiddenPatterns) {
    assert.equal(
      pattern.test(infrastructureSource),
      false,
      `Forbidden WP11 ${label}`,
    )
  }

  const importSpecifiers = Array.from(
    infrastructureSource.matchAll(/from\s+['"]([^'"]+)['"]/g),
    (match) => match[1],
  )
  for (const forbiddenImport of [
    '/artifacts',
    '/runtime',
    '/runtimeData',
    '/providers',
    'production/types/productionJob',
  ]) {
    assert.equal(
      importSpecifiers.some((specifier) => specifier.includes(forbiddenImport)),
      false,
      `Forbidden WP11 import boundary: ${forbiddenImport}`,
    )
  }

  console.log('Production Infrastructure Retry / Recovery validation passed')
  console.log('jobSaveLoadRehydrate = PASS')
  console.log('repositoryCAS = PASS')
  console.log('staleCAS = REJECTED')
  console.log('rehydratedJobTrusted = PASS')
  console.log('forgedJob = REJECTED')
  console.log('attemptRecord = PASS')
  console.log('retryableFailureDecision = RETRY')
  console.log('attemptBudgetExhaustedDecision = FAIL')
  console.log('nonRetryableDecision = FAIL')
  console.log('retryPolicyJobMutation = ABSENT')
  console.log('runningToRetryWaitViaAuthority = PASS')
  console.log('dueRetryWaitToScheduled = PASS')
  console.log('newDispatchDeterministic = PASS')
  console.log('expiredClaimedToRecoveryPending = PASS')
  console.log('expiredRunningToRecoveryPending = PASS')
  console.log('recoveryPendingToScheduled = PASS')
  console.log('recoveryFailureToFailed = PASS')
  console.log('outboxAppendListMark = PASS')
  console.log('outboxQueueDirectCall = ABSENT')
  console.log('repositoryArtifactRepositoryCoupling = ABSENT')
  console.log('queueRetryOwnership = ABSENT')
  console.log('workerRetryOwnership = ABSENT')
  console.log('runtimeInteraction = ABSENT')
  console.log('artifactAuthorityChanges = ABSENT')
  console.log('legacyProductionJobDependency = ABSENT')
} finally {
  await server.close()
}
