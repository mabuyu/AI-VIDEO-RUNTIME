import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

const JOB_KEYS = Object.freeze([
  'jobId',
  'planId',
  'requestId',
  'status',
  'version',
  'attemptCount',
  'maxAttempts',
  'currentAttemptId',
  'lease',
  'createdAt',
  'updatedAt',
])
const LEASE_KEYS = Object.freeze(['leaseId', 'workerId', 'expiresAt'])
const STATUSES = Object.freeze([
  'CREATED',
  'SCHEDULED',
  'CLAIMED',
  'RUNNING',
  'RETRY_WAIT',
  'RECOVERY_PENDING',
  'COMPLETED',
  'FAILED',
])
const COMMAND_TYPES = Object.freeze([
  'SCHEDULE',
  'CLAIM',
  'START',
  'COMPLETE',
  'WAIT_FOR_RETRY',
  'MARK_RECOVERY_PENDING',
  'RESCHEDULE',
  'FAIL',
])
const COMMAND_TARGETS = Object.freeze({
  SCHEDULE: 'SCHEDULED',
  CLAIM: 'CLAIMED',
  START: 'RUNNING',
  COMPLETE: 'COMPLETED',
  WAIT_FOR_RETRY: 'RETRY_WAIT',
  MARK_RECOVERY_PENDING: 'RECOVERY_PENDING',
  RESCHEDULE: 'SCHEDULED',
  FAIL: 'FAILED',
})
const ALLOWED_COMMANDS = Object.freeze({
  CREATED: new Set(['SCHEDULE']),
  SCHEDULED: new Set(['CLAIM']),
  CLAIMED: new Set(['START', 'MARK_RECOVERY_PENDING']),
  RUNNING: new Set([
    'COMPLETE',
    'WAIT_FOR_RETRY',
    'MARK_RECOVERY_PENDING',
    'FAIL',
  ]),
  RETRY_WAIT: new Set(['RESCHEDULE']),
  RECOVERY_PENDING: new Set(['RESCHEDULE', 'FAIL']),
  COMPLETED: new Set(),
  FAILED: new Set(),
})
const EXPECTED_ALLOWED_EDGES = new Set([
  'CREATED->SCHEDULED',
  'SCHEDULED->CLAIMED',
  'CLAIMED->RUNNING',
  'CLAIMED->RECOVERY_PENDING',
  'RUNNING->COMPLETED',
  'RUNNING->RETRY_WAIT',
  'RUNNING->RECOVERY_PENDING',
  'RUNNING->FAILED',
  'RETRY_WAIT->SCHEDULED',
  'RECOVERY_PENDING->SCHEDULED',
  'RECOVERY_PENDING->FAILED',
])

function assertDeepFrozen(value, label) {
  if (typeof value !== 'object' || value === null) return

  assert.equal(Object.isFrozen(value), true, `${label} must be frozen`)
  for (const [key, child] of Object.entries(value)) {
    assertDeepFrozen(child, `${label}.${key}`)
  }
}

function cloneSnapshot(value) {
  return JSON.parse(JSON.stringify(value))
}

function timestampAfter(timestamp, milliseconds = 1_000) {
  return new Date(Date.parse(timestamp) + milliseconds).toISOString()
}

function assertJobShape(job, expectedStatus, label) {
  assert.deepEqual(Object.keys(job), JOB_KEYS, `${label}: exact Job fields`)
  assert.equal(job.status, expectedStatus, `${label}: status`)
  assert.equal(
    job.jobId,
    `production-job:${job.planId}`,
    `${label}: deterministic jobId`,
  )

  if (job.currentAttemptId !== null) {
    assert.equal(
      job.currentAttemptId,
      `production-attempt:${job.jobId}:${job.attemptCount}`,
      `${label}: deterministic attemptId`,
    )
  }

  if (job.lease !== null) {
    assert.deepEqual(
      Object.keys(job.lease),
      LEASE_KEYS,
      `${label}: exact Lease fields`,
    )
  }

  for (const forbiddenField of [
    'execution',
    'executionResult',
    'generationResult',
    'providerAdapter',
    'artifact',
    'queue',
    'worker',
    'retryPolicy',
    'runtimeReference',
  ]) {
    assert.equal(
      forbiddenField in job,
      false,
      `${label}: forbidden field ${forbiddenField}`,
    )
  }

  assertDeepFrozen(job, label)
}

function assertCreationSuccess(result, label) {
  assert.equal(result.ok, true, `${label}: expected creation success`)
  assert.deepEqual(Object.keys(result), ['ok', 'job'])
  assertJobShape(result.job, 'CREATED', `${label}.job`)
  assertDeepFrozen(result, `${label}.result`)
  return result.job
}

function assertCreationFailure(result, expectedCode, label) {
  assert.equal(result.ok, false, `${label}: expected creation failure`)
  assert.deepEqual(Object.keys(result), ['ok', 'issues'])
  assert.equal('job' in result, false, `${label}: partial Job leaked`)
  assert.equal(
    result.issues.some((issue) => issue.code === expectedCode),
    true,
    `${label}: expected ${expectedCode}`,
  )
  assertDeepFrozen(result, `${label}.result`)
}

function assertTransitionSuccess(
  authority,
  source,
  command,
  expectedStatus,
  label,
) {
  const before = cloneSnapshot(source)
  const result = authority.transition(source, command)

  assert.equal(result.ok, true, `${label}: expected transition success`)
  assert.deepEqual(Object.keys(result), ['ok', 'job'])
  assert.notEqual(result.job, source, `${label}: requires a new snapshot`)
  assert.equal(
    result.job.version,
    source.version + 1,
    `${label}: version must increment exactly once`,
  )
  assert.equal(result.job.jobId, source.jobId, `${label}: jobId changed`)
  assert.equal(result.job.planId, source.planId, `${label}: planId changed`)
  assert.equal(
    result.job.requestId,
    source.requestId,
    `${label}: requestId changed`,
  )
  assert.equal(
    result.job.maxAttempts,
    source.maxAttempts,
    `${label}: maxAttempts changed`,
  )
  assert.equal(
    result.job.createdAt,
    source.createdAt,
    `${label}: createdAt changed`,
  )
  assert.equal(result.job.updatedAt, command.updatedAt, `${label}: updatedAt`)

  if (command.type === 'CLAIM') {
    assert.equal(result.job.attemptCount, source.attemptCount + 1)
    assert.equal(
      result.job.currentAttemptId,
      `production-attempt:${source.jobId}:${source.attemptCount + 1}`,
    )
    assert.deepEqual(result.job.lease, {
      leaseId: command.leaseId,
      workerId: command.workerId,
      expiresAt: command.expiresAt,
    })
  } else {
    assert.equal(result.job.attemptCount, source.attemptCount)
    assert.equal(result.job.currentAttemptId, source.currentAttemptId)
  }

  if (command.type === 'START') {
    assert.deepEqual(result.job.lease, source.lease)
    assert.notEqual(
      result.job.lease,
      source.lease,
      `${label}: Lease must be copied into the new snapshot`,
    )
  } else if (command.type !== 'CLAIM') {
    assert.equal(result.job.lease, null, `${label}: Lease must be cleared`)
  }

  assertJobShape(result.job, expectedStatus, `${label}.job`)
  assertDeepFrozen(result, `${label}.result`)
  assert.deepEqual(source, before, `${label}: source snapshot mutated`)
  return result.job
}

function assertTransitionFailure(
  authority,
  source,
  command,
  expectedCode,
  label,
) {
  const before = cloneSnapshot(source)
  const versionBefore = source.version
  const result = authority.transition(source, command)

  assert.equal(result.ok, false, `${label}: expected transition failure`)
  assert.deepEqual(Object.keys(result), ['ok', 'issues'])
  assert.equal('job' in result, false, `${label}: partial Job leaked`)
  assert.equal(
    result.issues.some((issue) => issue.code === expectedCode),
    true,
    `${label}: expected ${expectedCode}`,
  )
  assertDeepFrozen(result, `${label}.result`)
  assert.deepEqual(source, before, `${label}: source snapshot mutated`)
  assert.equal(source.version, versionBefore, `${label}: source version changed`)
  return result
}

function commandFor(type, job) {
  const updatedAt = timestampAfter(job.updatedAt)
  if (type === 'CLAIM') {
    return {
      type,
      workerId: `worker-${job.status.toLowerCase()}`,
      leaseId: `lease-${job.status.toLowerCase()}-${job.version}`,
      expiresAt: timestampAfter(updatedAt, 60_000),
      updatedAt,
    }
  }
  return { type, updatedAt }
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

const productionPlan = Object.freeze({
  planId: 'plan-wp09-001',
  requestId: 'request-wp09-001',
  tasks: Object.freeze([
    Object.freeze({
      taskId: 'task-wp09-001',
      requestId: 'request-wp09-001',
      providerId: 'provider-wp09',
      generationIntent: 'Validate the ProductionJob orchestration aggregate',
      outputSpecification: Object.freeze({
        mediaType: 'video',
        format: 'mp4',
      }),
    }),
  ]),
})

try {
  const jobs = await server.ssrLoadModule('/src/jobs/index.ts')
  assert.deepEqual(Object.keys(jobs).sort(), [
    'createProductionJob',
    'createProductionJobStateAuthority',
  ])

  const creation = jobs.createProductionJob(productionPlan, {
    maxAttempts: 3,
    createdAt: '2026-08-27T00:00:00.000Z',
  })
  const created = assertCreationSuccess(
    creation,
    'ProductionPlan -> ProductionJob(CREATED)',
  )
  assert.equal(created.planId, productionPlan.planId)
  assert.equal(created.requestId, productionPlan.requestId)
  assert.equal(created.jobId, 'production-job:plan-wp09-001')
  assert.equal(created.version, 0)
  assert.equal(created.attemptCount, 0)
  assert.equal(created.currentAttemptId, null)
  assert.equal(created.lease, null)
  assert.equal(created.maxAttempts, 3)

  const deterministicPeer = assertCreationSuccess(
    jobs.createProductionJob(productionPlan, {
      maxAttempts: 5,
      createdAt: '2026-08-27T01:00:00.000Z',
    }),
    'deterministic Job identity peer',
  )
  assert.equal(deterministicPeer.jobId, created.jobId)

  let accessorPlanIdReads = 0
  const accessorPlan = Object.freeze({
    get planId() {
      accessorPlanIdReads += 1
      return accessorPlanIdReads === 1
        ? 'plan-accessor-snapshot'
        : 'plan-accessor-tampered'
    },
    requestId: productionPlan.requestId,
    tasks: productionPlan.tasks,
  })
  const accessorCreated = assertCreationSuccess(
    jobs.createProductionJob(accessorPlan, {
      createdAt: '2026-08-27T02:00:00.000Z',
    }),
    'accessor ProductionPlan materialization',
  )
  assert.equal(accessorPlanIdReads, 1)
  assert.equal(accessorCreated.planId, 'plan-accessor-snapshot')
  assert.equal(
    accessorCreated.jobId,
    'production-job:plan-accessor-snapshot',
  )

  const defaultContract = assertCreationSuccess(
    jobs.createProductionJob(productionPlan),
    'default maxAttempts contract',
  )
  assert.equal(defaultContract.maxAttempts, 3)

  assertCreationFailure(
    jobs.createProductionJob(
      { ...productionPlan, planId: '' },
      { createdAt: '2026-08-27T00:00:00.000Z' },
    ),
    'INVALID_PRODUCTION_PLAN',
    'empty planId',
  )
  assertCreationFailure(
    jobs.createProductionJob(
      { ...productionPlan, requestId: '' },
      { createdAt: '2026-08-27T00:00:00.000Z' },
    ),
    'INVALID_PRODUCTION_PLAN',
    'empty requestId',
  )
  assertCreationFailure(
    jobs.createProductionJob(
      {
        ...productionPlan,
        tasks: [
          {
            ...productionPlan.tasks[0],
            requestId: 'request-does-not-match',
          },
        ],
      },
      { createdAt: '2026-08-27T00:00:00.000Z' },
    ),
    'INVALID_PRODUCTION_PLAN',
    'ProductionPlan request correlation',
  )
  assertCreationFailure(
    jobs.createProductionJob(productionPlan, {
      maxAttempts: 0,
      createdAt: '2026-08-27T00:00:00.000Z',
    }),
    'INVALID_MAX_ATTEMPTS',
    'invalid maxAttempts',
  )

  const authority = jobs.createProductionJobStateAuthority()
  assert.deepEqual(Object.keys(authority), ['transition'])
  assert.equal(Object.isFrozen(authority), true)

  const scheduled = assertTransitionSuccess(
    authority,
    created,
    { type: 'SCHEDULE', updatedAt: '2026-08-27T00:01:00.000Z' },
    'SCHEDULED',
    'CREATED -> SCHEDULED',
  )

  let accessorExpiresAtReads = 0
  let accessorUpdatedAtReads = 0
  const accessorClaimCommand = Object.freeze({
    type: 'CLAIM',
    workerId: 'worker-accessor-snapshot',
    leaseId: 'lease-accessor-snapshot',
    get expiresAt() {
      accessorExpiresAtReads += 1
      return accessorExpiresAtReads === 1
        ? '2026-08-27T01:00:00.000Z'
        : '2026-08-26T00:00:00.000Z'
    },
    get updatedAt() {
      accessorUpdatedAtReads += 1
      return accessorUpdatedAtReads === 1
        ? '2026-08-27T00:02:00.000Z'
        : '2026-08-26T00:00:00.000Z'
    },
  })
  const scheduledBeforeAccessorClaim = cloneSnapshot(scheduled)
  const accessorClaimResult = authority.transition(
    scheduled,
    accessorClaimCommand,
  )
  assert.equal(accessorClaimResult.ok, true)
  assert.equal(accessorExpiresAtReads, 1)
  assert.equal(accessorUpdatedAtReads, 1)
  assert.equal(
    accessorClaimResult.job.lease.expiresAt,
    '2026-08-27T01:00:00.000Z',
  )
  assert.equal(
    accessorClaimResult.job.updatedAt,
    '2026-08-27T00:02:00.000Z',
  )
  assert.equal(accessorClaimResult.job.version, scheduled.version + 1)
  assertJobShape(
    accessorClaimResult.job,
    'CLAIMED',
    'accessor CLAIM materialization',
  )
  assertDeepFrozen(accessorClaimResult, 'accessorClaimResult')
  assert.deepEqual(scheduled, scheduledBeforeAccessorClaim)
  assertTransitionSuccess(
    authority,
    accessorClaimResult.job,
    { type: 'START', updatedAt: '2026-08-27T00:03:00.000Z' },
    'RUNNING',
    'accessor CLAIM produces reusable trusted snapshot',
  )
  const claimed = assertTransitionSuccess(
    authority,
    scheduled,
    {
      type: 'CLAIM',
      workerId: 'worker-wp10-001',
      leaseId: 'lease-wp09-001',
      expiresAt: '2026-08-27T01:00:00.000Z',
      updatedAt: '2026-08-27T00:02:00.000Z',
    },
    'CLAIMED',
    'SCHEDULED -> CLAIMED',
  )
  assert.equal(
    claimed.currentAttemptId,
    'production-attempt:production-job:plan-wp09-001:1',
  )
  assert.equal(claimed.attemptCount, 1)
  const running = assertTransitionSuccess(
    authority,
    claimed,
    { type: 'START', updatedAt: '2026-08-27T00:03:00.000Z' },
    'RUNNING',
    'CLAIMED -> RUNNING',
  )
  const completed = assertTransitionSuccess(
    authority,
    running,
    { type: 'COMPLETE', updatedAt: '2026-08-27T00:04:00.000Z' },
    'COMPLETED',
    'RUNNING -> COMPLETED',
  )

  const retryWait = assertTransitionSuccess(
    authority,
    running,
    {
      type: 'WAIT_FOR_RETRY',
      updatedAt: '2026-08-27T00:04:00.000Z',
    },
    'RETRY_WAIT',
    'RUNNING -> RETRY_WAIT',
  )
  const rescheduledFromRetry = assertTransitionSuccess(
    authority,
    retryWait,
    { type: 'RESCHEDULE', updatedAt: '2026-08-27T00:05:00.000Z' },
    'SCHEDULED',
    'RETRY_WAIT -> SCHEDULED',
  )
  const secondClaim = assertTransitionSuccess(
    authority,
    rescheduledFromRetry,
    {
      type: 'CLAIM',
      workerId: 'worker-wp10-002',
      leaseId: 'lease-wp09-002',
      expiresAt: '2026-08-27T02:00:00.000Z',
      updatedAt: '2026-08-27T00:06:00.000Z',
    },
    'CLAIMED',
    'SCHEDULED -> CLAIMED (second attempt)',
  )
  assert.equal(secondClaim.attemptCount, 2)
  assert.equal(
    secondClaim.currentAttemptId,
    'production-attempt:production-job:plan-wp09-001:2',
  )

  const recoveryFromClaimed = assertTransitionSuccess(
    authority,
    claimed,
    {
      type: 'MARK_RECOVERY_PENDING',
      updatedAt: '2026-08-27T00:03:00.000Z',
    },
    'RECOVERY_PENDING',
    'CLAIMED -> RECOVERY_PENDING',
  )
  const recoveryFromRunning = assertTransitionSuccess(
    authority,
    running,
    {
      type: 'MARK_RECOVERY_PENDING',
      updatedAt: '2026-08-27T00:04:00.000Z',
    },
    'RECOVERY_PENDING',
    'RUNNING -> RECOVERY_PENDING',
  )
  const rescheduledFromRecovery = assertTransitionSuccess(
    authority,
    recoveryFromRunning,
    { type: 'RESCHEDULE', updatedAt: '2026-08-27T00:05:00.000Z' },
    'SCHEDULED',
    'RECOVERY_PENDING -> SCHEDULED',
  )
  assert.equal(rescheduledFromRecovery.lease, null)
  const failedFromRecovery = assertTransitionSuccess(
    authority,
    recoveryFromRunning,
    { type: 'FAIL', updatedAt: '2026-08-27T00:05:00.000Z' },
    'FAILED',
    'RECOVERY_PENDING -> FAILED',
  )
  const failedFromRunning = assertTransitionSuccess(
    authority,
    running,
    { type: 'FAIL', updatedAt: '2026-08-27T00:04:00.000Z' },
    'FAILED',
    'RUNNING -> FAILED',
  )

  for (const job of [
    completed,
    retryWait,
    recoveryFromClaimed,
    recoveryFromRunning,
    failedFromRecovery,
    failedFromRunning,
  ]) {
    assert.equal(job.lease, null, `${job.status}: Lease was not cleared`)
  }

  const snapshots = Object.freeze({
    CREATED: created,
    SCHEDULED: scheduled,
    CLAIMED: claimed,
    RUNNING: running,
    RETRY_WAIT: retryWait,
    RECOVERY_PENDING: recoveryFromRunning,
    COMPLETED: completed,
    FAILED: failedFromRunning,
  })
  let allowedCommandCount = 0
  let rejectedCommandCount = 0
  const observedAllowedEdges = new Set()

  for (const status of STATUSES) {
    const source = snapshots[status]
    for (const commandType of COMMAND_TYPES) {
      const command = commandFor(commandType, source)
      const targetStatus = COMMAND_TARGETS[commandType]
      if (ALLOWED_COMMANDS[status].has(commandType)) {
        allowedCommandCount += 1
        observedAllowedEdges.add(`${status}->${targetStatus}`)
        assertTransitionSuccess(
          authority,
          source,
          command,
          targetStatus,
          `${status} + ${commandType}`,
        )
      } else {
        rejectedCommandCount += 1
        assertTransitionFailure(
          authority,
          source,
          command,
          'INVALID_TRANSITION',
          `${status} + ${commandType}`,
        )
      }
    }
  }

  assert.equal(allowedCommandCount, 11)
  assert.equal(rejectedCommandCount, 53)
  assert.deepEqual(observedAllowedEdges, EXPECTED_ALLOWED_EDGES)

  for (const terminal of [completed, failedFromRunning]) {
    for (const commandType of COMMAND_TYPES) {
      assertTransitionFailure(
        authority,
        terminal,
        commandFor(commandType, terminal),
        'INVALID_TRANSITION',
        `${terminal.status} terminal + ${commandType}`,
      )
    }
  }

  const sameStateCases = [
    [scheduled, 'SCHEDULE'],
    [claimed, 'CLAIM'],
    [running, 'START'],
    [retryWait, 'WAIT_FOR_RETRY'],
    [recoveryFromRunning, 'MARK_RECOVERY_PENDING'],
    [completed, 'COMPLETE'],
    [failedFromRunning, 'FAIL'],
  ]
  for (const [source, commandType] of sameStateCases) {
    assert.equal(COMMAND_TARGETS[commandType], source.status)
    assertTransitionFailure(
      authority,
      source,
      commandFor(commandType, source),
      'INVALID_TRANSITION',
      `${source.status} same-state transition`,
    )
  }
  assert.equal(
    Object.values(COMMAND_TARGETS).includes('CREATED'),
    false,
    'No command may target CREATED',
  )

  assertTransitionFailure(
    authority,
    scheduled,
    {
      type: 'CLAIM',
      workerId: '',
      leaseId: 'lease-invalid-worker',
      expiresAt: '2026-08-27T01:00:00.000Z',
      updatedAt: '2026-08-27T00:02:00.000Z',
    },
    'INVALID_LEASE',
    'CLAIM without worker identity',
  )
  assertTransitionFailure(
    authority,
    scheduled,
    {
      type: 'CLAIM',
      workerId: 'worker-invalid-lease',
      leaseId: '',
      expiresAt: '2026-08-27T01:00:00.000Z',
      updatedAt: '2026-08-27T00:02:00.000Z',
    },
    'INVALID_LEASE',
    'CLAIM without lease identity',
  )
  assertTransitionFailure(
    authority,
    scheduled,
    {
      type: 'CLAIM',
      workerId: 'worker-expired-lease',
      leaseId: 'lease-expired-at-claim',
      expiresAt: '2026-08-27T00:02:00.000Z',
      updatedAt: '2026-08-27T00:02:00.000Z',
    },
    'INVALID_LEASE',
    'CLAIM with expired Lease',
  )
  assertTransitionFailure(
    authority,
    scheduled,
    {
      type: 'CLAIM',
      updatedAt: '2026-08-27T00:02:00.000Z',
    },
    'INVALID_COMMAND',
    'CLAIM without Lease contract',
  )
  assertTransitionFailure(
    authority,
    scheduled,
    null,
    'INVALID_COMMAND',
    'null transition command',
  )
  assertTransitionFailure(
    authority,
    scheduled,
    Object.freeze({
      get type() {
        throw new Error('command getter must not escape the validation boundary')
      },
      updatedAt: '2026-08-27T00:02:00.000Z',
    }),
    'INVALID_COMMAND',
    'throwing transition command accessor',
  )

  const shortClaim = assertTransitionSuccess(
    authority,
    scheduled,
    {
      type: 'CLAIM',
      workerId: 'worker-short-lease',
      leaseId: 'lease-short',
      expiresAt: '2026-08-27T00:03:00.000Z',
      updatedAt: '2026-08-27T00:02:00.000Z',
    },
    'CLAIMED',
    'CLAIM with short valid Lease',
  )
  assertTransitionFailure(
    authority,
    shortClaim,
    { type: 'START', updatedAt: '2026-08-27T00:03:00.000Z' },
    'INVALID_LEASE',
    'START after Lease expiration',
  )
  const shortLeaseRunning = assertTransitionSuccess(
    authority,
    shortClaim,
    { type: 'START', updatedAt: '2026-08-27T00:02:30.000Z' },
    'RUNNING',
    'START before short Lease expiration',
  )
  const recoveredAfterLeaseExpiration = assertTransitionSuccess(
    authority,
    shortLeaseRunning,
    {
      type: 'MARK_RECOVERY_PENDING',
      updatedAt: '2026-08-27T00:04:00.000Z',
    },
    'RECOVERY_PENDING',
    'expired active Lease -> RECOVERY_PENDING snapshot',
  )
  assert.equal(recoveredAfterLeaseExpiration.lease, null)

  const singleAttemptCreated = assertCreationSuccess(
    jobs.createProductionJob(
      { ...productionPlan, planId: 'plan-single-attempt' },
      {
        maxAttempts: 1,
        createdAt: '2026-08-27T03:00:00.000Z',
      },
    ),
    'single-attempt Job',
  )
  const singleAttemptScheduled = assertTransitionSuccess(
    authority,
    singleAttemptCreated,
    { type: 'SCHEDULE', updatedAt: '2026-08-27T03:01:00.000Z' },
    'SCHEDULED',
    'single-attempt schedule',
  )
  const singleAttemptClaimed = assertTransitionSuccess(
    authority,
    singleAttemptScheduled,
    {
      type: 'CLAIM',
      workerId: 'worker-single-attempt',
      leaseId: 'lease-single-attempt',
      expiresAt: '2026-08-27T04:00:00.000Z',
      updatedAt: '2026-08-27T03:02:00.000Z',
    },
    'CLAIMED',
    'single-attempt claim',
  )
  const singleAttemptRunning = assertTransitionSuccess(
    authority,
    singleAttemptClaimed,
    { type: 'START', updatedAt: '2026-08-27T03:03:00.000Z' },
    'RUNNING',
    'single-attempt start',
  )
  const singleAttemptRetryWait = assertTransitionSuccess(
    authority,
    singleAttemptRunning,
    {
      type: 'WAIT_FOR_RETRY',
      updatedAt: '2026-08-27T03:04:00.000Z',
    },
    'RETRY_WAIT',
    'single-attempt wait',
  )
  const exhaustedScheduled = assertTransitionSuccess(
    authority,
    singleAttemptRetryWait,
    { type: 'RESCHEDULE', updatedAt: '2026-08-27T03:05:00.000Z' },
    'SCHEDULED',
    'single-attempt reschedule',
  )
  assertTransitionFailure(
    authority,
    exhaustedScheduled,
    {
      type: 'CLAIM',
      workerId: 'worker-over-limit',
      leaseId: 'lease-over-limit',
      expiresAt: '2026-08-27T04:00:00.000Z',
      updatedAt: '2026-08-27T03:06:00.000Z',
    },
    'MAX_ATTEMPTS_REACHED',
    'maxAttempts claim guard',
  )

  assertTransitionFailure(
    authority,
    scheduled,
    { type: 'CLAIM', targetStatus: 'RUNNING', updatedAt: scheduled.updatedAt },
    'INVALID_COMMAND',
    'arbitrary targetStatus command',
  )
  assertTransitionFailure(
    authority,
    scheduled,
    {
      type: 'CLAIM',
      workerId: 'worker-regression',
      leaseId: 'lease-regression',
      expiresAt: '2026-08-27T01:00:00.000Z',
      updatedAt: '2026-08-26T23:59:00.000Z',
    },
    'TIMESTAMP_REGRESSION',
    'updatedAt regression',
  )

  const mutableForgedJob = {
    ...running,
    lease: { ...running.lease },
  }
  assertTransitionFailure(
    authority,
    mutableForgedJob,
    commandFor('COMPLETE', mutableForgedJob),
    'INVALID_JOB',
    'mutable forged Job',
  )

  const deepFrozenForgedJob = Object.freeze({
    ...running,
    lease: Object.freeze({ ...running.lease }),
  })
  assertTransitionFailure(
    authority,
    deepFrozenForgedJob,
    commandFor('COMPLETE', deepFrozenForgedJob),
    'INVALID_JOB',
    'deep-frozen forged Job',
  )

  const throwingForgedJob = Object.freeze({
    get status() {
      throw new Error('forged Job getter must not cross the trust boundary')
    },
  })
  const throwingForgedResult = authority.transition(throwingForgedJob, {
    type: 'SCHEDULE',
    updatedAt: '2026-08-27T00:01:00.000Z',
  })
  assert.equal(throwingForgedResult.ok, false)
  assert.equal(throwingForgedResult.issues[0]?.code, 'INVALID_JOB')
  assertDeepFrozen(throwingForgedResult, 'throwingForgedResult')

  const revokedJobHandle = Proxy.revocable({ status: 'CREATED' }, {})
  revokedJobHandle.revoke()
  const revokedForgedResult = authority.transition(revokedJobHandle.proxy, {
    type: 'SCHEDULE',
    updatedAt: '2026-08-27T00:01:00.000Z',
  })
  assert.equal(revokedForgedResult.ok, false)
  assert.equal(revokedForgedResult.issues[0]?.code, 'INVALID_JOB')
  assertDeepFrozen(revokedForgedResult, 'revokedForgedResult')

  const forgedClaimedWithoutLease = Object.freeze({
    ...claimed,
    lease: null,
  })
  assertTransitionFailure(
    authority,
    forgedClaimedWithoutLease,
    commandFor('START', forgedClaimedWithoutLease),
    'INVALID_JOB',
    'CLAIMED Job without Lease',
  )
  const forgedRunningWithoutLease = Object.freeze({
    ...running,
    lease: null,
  })
  assertTransitionFailure(
    authority,
    forgedRunningWithoutLease,
    commandFor('COMPLETE', forgedRunningWithoutLease),
    'INVALID_JOB',
    'RUNNING Job without Lease',
  )

  assert.throws(() => {
    created.status = 'RUNNING'
  }, TypeError)
  assert.throws(() => {
    claimed.lease.workerId = 'mutated-worker'
  }, TypeError)
  assert.equal(created.status, 'CREATED')
  assert.equal(claimed.lease.workerId, 'worker-wp10-001')

  const contractSource = await readFile(
    new URL('../src/jobs/contracts/productionJob.ts', import.meta.url),
    'utf8',
  )
  const statusContractMatch = contractSource.match(
    /export type ProductionJobStatus =([\s\S]*?)\n\nexport type ProductionAttemptId/,
  )
  assert.notEqual(statusContractMatch, null, 'ProductionJobStatus contract')
  const declaredStatuses = Array.from(
    statusContractMatch[1].matchAll(/'([^']+)'/g),
    (match) => match[1],
  )
  assert.deepEqual(declaredStatuses, STATUSES)
  assert.equal(
    /targetStatus/.test(
      contractSource.match(
        /export type ProductionJobTransitionCommand =([\s\S]*?)\n\nexport type ProductionJobTransitionResult/,
      )[1],
    ),
    false,
    'Transition command must not expose targetStatus',
  )

  const sourceFiles = await readTypeScriptSources(
    new URL('../src/jobs/', import.meta.url),
  )
  const implementationSource = sourceFiles
    .map(({ source }) => source)
    .join('\n')
  const implementationValueExports = Array.from(
    implementationSource.matchAll(
      /export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/g,
    ),
    (match) => match[1],
  ).sort()
  assert.deepEqual(implementationValueExports, [
    'createAuthorizedRehydratedProductionJobSnapshot',
    'createProductionJob',
    'createProductionJobStateAuthority',
    'isAuthorizedProductionJobSnapshot',
  ])
  const jobsIndexSource = await readFile(
    new URL('../src/jobs/index.ts', import.meta.url),
    'utf8',
  )
  assert.equal(
    /(?:createAuthorizedRehydratedProductionJobSnapshot|isAuthorizedProductionJobSnapshot)/.test(
      jobsIndexSource,
    ),
    false,
    'Internal persistence trust capability must not be publicly exported',
  )
  const importSpecifiers = Array.from(
    implementationSource.matchAll(/from\s+['"]([^'"]+)['"]/g),
    (match) => match[1],
  )
  for (const forbiddenImportBoundary of [
    '/execution',
    '/providers',
    '/artifacts',
    '/runtime',
    '/runtimeData',
  ]) {
    assert.equal(
      importSpecifiers.some((specifier) =>
        specifier.includes(forbiddenImportBoundary),
      ),
      false,
      `Forbidden Job import boundary: ${forbiddenImportBoundary}`,
    )
  }

  const forbiddenImplementationPatterns = [
    ['ExecutionManager integration', /\bExecutionManager\b/],
    ['ExecutionResult creation', /\bExecutionResult\b/],
    ['ProviderAdapter integration', /\bProviderAdapter\b/],
    ['Artifact lifecycle integration', /\bProductionArtifact\b/],
    ['queue boundary implementation', /\b(?:QueueBoundary|createQueue)\b/],
    ['worker boundary implementation', /\b(?:WorkerBoundary|createWorker)\b/],
    ['Redis dependency', /\bRedis\b/i],
    ['Kafka dependency', /\bKafka\b/i],
    ['RabbitMQ dependency', /\bRabbitMQ\b/i],
    ['BullMQ dependency', /\bBullMQ\b/i],
    ['database implementation', /\b(?:database|SQL)\b/i],
    ['filesystem persistence', /(?:node:fs|writeFile|createWriteStream)/],
    ['retry policy', /\bRetryPolicy\b/],
    ['backoff algorithm', /\bbackoff\b/i],
    ['recovery scanner', /\bRecoveryScanner\b/],
    ['outbox implementation', /\bOutbox\b/],
    ['real timer', /\b(?:setTimeout|setInterval)\b/],
    ['network operation', /\bfetch\s*\(/],
    ['random identity', /(?:randomUUID|Math\.random)/],
  ]
  for (const [label, pattern] of forbiddenImplementationPatterns) {
    assert.equal(
      pattern.test(implementationSource),
      false,
      `Forbidden WP09 dependency or operation: ${label}`,
    )
  }
  assert.equal(
    sourceFiles.some(({ url }) =>
      /\/(?:queue|worker)(?:\/|\.ts$)/i.test(url),
    ),
    false,
    'Queue/Worker implementation directory must be absent',
  )

  console.log('Production Job & State Authority validation passed')
  console.log('A productionPlanToCreatedJob = PASS')
  console.log('B deterministicJobId = PASS')
  console.log('C initialVersionZero = PASS')
  console.log('D initialAttemptCountZero = PASS')
  console.log('E createdToScheduled = PASS')
  console.log('F scheduledToClaimed = PASS')
  console.log('G deterministicAttemptId = PASS')
  console.log('H claimIncrementsAttemptCount = PASS')
  console.log('I claimedToRunning = PASS')
  console.log('J runningToCompleted = PASS')
  console.log('K runningToRetryWait = PASS')
  console.log('L retryWaitToScheduled = PASS')
  console.log('M claimedToRecoveryPending = PASS')
  console.log('N runningToRecoveryPending = PASS')
  console.log('O recoveryPendingToScheduled = PASS')
  console.log('P recoveryPendingToFailed = PASS')
  console.log('Q runningToFailed = PASS')
  console.log('R allInvalidCommandTransitions = PASS (53/53)')
  console.log('S completedTerminal = PASS')
  console.log('T failedTerminal = PASS')
  console.log('U sameStateRejected = PASS')
  console.log('V successfulVersionIncrementExactlyOnce = PASS')
  console.log('W failedVersionUnchanged = PASS')
  console.log('X originalSnapshotsNeverMutated = PASS')
  console.log('Y snapshotsDeepFrozen = PASS')
  console.log('Z forgedPlainJobRejected = PASS')
  console.log('AA deepFrozenForgedJobRejected = PASS')
  console.log('AB activeStateLeaseRequired = PASS')
  console.log('AC activeStateExitClearsLease = PASS')
  console.log('maxAttemptsFoundation = PASS')
  console.log('externalAccessorMaterialization = PASS')
  console.log('leaseSnapshotRecoverySemantics = PASS')
  console.log('publicSignerOrTrustBypass = ABSENT')
  console.log('executionIntegration = ABSENT (WP09 scope)')
  console.log('queueWorkerImplementation = ABSENT (WP10 scope)')
  console.log('retryPolicyImplementation = ABSENT (WP11 scope)')
} finally {
  await server.close()
}
