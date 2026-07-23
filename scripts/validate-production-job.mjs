import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

function assertSuccess(result, expectedStatus, label) {
  assert.equal(result.ok, true, `${label}: expected success`)
  assert.equal(result.job.status, expectedStatus, `${label}: unexpected status`)
  assert.equal(Object.isFrozen(result), true, `${label}: result is mutable`)
  assert.equal(Object.isFrozen(result.job), true, `${label}: job is mutable`)
  assert.equal(
    Object.isFrozen(result.job.attemptsSummary),
    true,
    `${label}: attemptsSummary is mutable`,
  )
  return result.job
}

function assertFailure(result, code, label) {
  assert.equal(result.ok, false, `${label}: expected failure`)
  assert.equal('job' in result, false, `${label}: partial job leaked`)
  assert.equal(result.issues[0]?.code, code, `${label}: unexpected issue`)
  assert.equal(Object.isFrozen(result), true, `${label}: result is mutable`)
  assert.equal(Object.isFrozen(result.issues), true, `${label}: issues are mutable`)
  assert.equal(Object.isFrozen(result.issues[0]), true, `${label}: issue is mutable`)
}

try {
  const {
    createProductionJob,
    transitionProductionJob,
    validateProductionJobTransition,
  } = await server.ssrLoadModule('/src/production/index.ts')

  const creation = createProductionJob({
    jobId: 'job-001',
    commandId: 'command-001',
    createdAt: '2026-07-23T08:00:00.000Z',
    status: 'READY',
    artifactEnvelope: { status: 'READY' },
    runtimeData: { forbidden: true },
  })
  const created = assertSuccess(creation, 'CREATED', 'ProductionJob creation')

  assert.deepEqual(
    Object.keys(created),
    [
      'jobId',
      'commandId',
      'status',
      'attemptsSummary',
      'createdAt',
      'updatedAt',
    ],
    'ProductionJob contract field leakage',
  )
  assert.deepEqual(created.attemptsSummary, [])
  assert.equal(JSON.stringify(created).includes('artifact'), false)
  assert.equal(JSON.stringify(created).includes('runtime'), false)
  assert.equal(JSON.stringify(created).includes('provider'), false)

  const scheduled = assertSuccess(
    transitionProductionJob(
      created,
      'SCHEDULED',
      '2026-07-23T08:01:00.000Z',
    ),
    'SCHEDULED',
    'CREATED -> SCHEDULED',
  )
  const running = assertSuccess(
    transitionProductionJob(
      scheduled,
      'RUNNING',
      '2026-07-23T08:02:00.000Z',
    ),
    'RUNNING',
    'SCHEDULED -> RUNNING',
  )
  const completed = assertSuccess(
    transitionProductionJob(
      running,
      'COMPLETED',
      '2026-07-23T08:03:00.000Z',
    ),
    'COMPLETED',
    'RUNNING -> COMPLETED',
  )

  const failureRunning = assertSuccess(
    transitionProductionJob(
      scheduled,
      'RUNNING',
      '2026-07-23T08:02:00.000Z',
    ),
    'RUNNING',
    'failure path RUNNING',
  )
  const failed = assertSuccess(
    transitionProductionJob(
      failureRunning,
      'FAILED',
      '2026-07-23T08:03:00.000Z',
    ),
    'FAILED',
    'RUNNING -> FAILED',
  )

  assertFailure(
    transitionProductionJob(
      created,
      'COMPLETED',
      '2026-07-23T08:01:00.000Z',
    ),
    'INVALID_TRANSITION',
    'CREATED -> COMPLETED',
  )
  assertFailure(
    transitionProductionJob(
      created,
      'RUNNING',
      '2026-07-23T08:01:00.000Z',
    ),
    'INVALID_TRANSITION',
    'CREATED -> RUNNING',
  )
  assertFailure(
    transitionProductionJob(
      completed,
      'RUNNING',
      '2026-07-23T08:04:00.000Z',
    ),
    'INVALID_TRANSITION',
    'COMPLETED -> RUNNING',
  )
  assertFailure(
    transitionProductionJob(
      failed,
      'RUNNING',
      '2026-07-23T08:04:00.000Z',
    ),
    'INVALID_TRANSITION',
    'FAILED -> RUNNING',
  )

  assertSuccess(
    transitionProductionJob(
      created,
      'FAILED',
      '2026-07-23T08:01:00.000Z',
    ),
    'FAILED',
    'CREATED -> FAILED',
  )
  assertSuccess(
    transitionProductionJob(
      scheduled,
      'FAILED',
      '2026-07-23T08:02:00.000Z',
    ),
    'FAILED',
    'SCHEDULED -> FAILED',
  )

  const readyValidation = validateProductionJobTransition('CREATED', 'READY')
  assert.equal(readyValidation.valid, false, 'READY must be rejected')
  assert.equal(readyValidation.issues[0]?.code, 'INVALID_TARGET_STATUS')

  assertFailure(
    transitionProductionJob(
      scheduled,
      'RUNNING',
      '2026-07-23T07:59:00.000Z',
    ),
    'TIMESTAMP_REGRESSION',
    'updatedAt regression',
  )

  console.log('ProductionJob MVP verification passed')
  console.log('productionJobCreation = PASS')
  console.log('validTransition = PASS')
  console.log('failureTransition = PASS')
  console.log('invalidTransition = PASS')
  console.log('readyStatusRejection = PASS')
  console.log('artifactFieldLeakage = ABSENT')
} finally {
  await server.close()
}
