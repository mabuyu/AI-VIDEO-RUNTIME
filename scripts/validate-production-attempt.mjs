import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

function assertSuccess(result, expectedStatus, label) {
  assert.equal(result.ok, true, `${label}: expected success`)
  assert.equal(
    result.attempt.status,
    expectedStatus,
    `${label}: unexpected status`,
  )
  assert.equal(Object.isFrozen(result), true, `${label}: result is mutable`)
  assert.equal(
    Object.isFrozen(result.attempt),
    true,
    `${label}: attempt is mutable`,
  )
  return result.attempt
}

function assertFailure(result, code, label) {
  assert.equal(result.ok, false, `${label}: expected failure`)
  assert.equal('attempt' in result, false, `${label}: partial attempt leaked`)
  assert.equal(result.issues[0]?.code, code, `${label}: unexpected issue`)
  assert.equal(Object.isFrozen(result), true, `${label}: result is mutable`)
  assert.equal(Object.isFrozen(result.issues), true, `${label}: issues are mutable`)
  assert.equal(Object.isFrozen(result.issues[0]), true, `${label}: issue is mutable`)
}

try {
  const {
    createProductionAttempt,
    transitionProductionAttempt,
    validateProductionAttemptTransition,
  } = await server.ssrLoadModule('/src/production/index.ts')

  const creation = createProductionAttempt({
    attemptId: 'attempt-001',
    jobId: 'job-001',
    provider: 'test-provider',
    providerRequestId: 'provider-request-001',
    generationId: 'generation-001',
    createdAt: '2026-07-23T08:00:00.000Z',
    artifactEnvelope: { status: 'READY' },
    artifactRuntimeReference: { artifactId: 'artifact-001' },
    runtimeDataV2: { forbidden: true },
    runtimeContext: { forbidden: true },
    providerResponse: { forbidden: true },
  })
  const created = assertSuccess(
    creation,
    'CREATED',
    'ProductionAttempt creation',
  )

  assert.deepEqual(
    Object.keys(created),
    [
      'attemptId',
      'jobId',
      'provider',
      'providerRequestId',
      'generationId',
      'status',
      'createdAt',
      'updatedAt',
    ],
    'ProductionAttempt contract field leakage',
  )
  assert.equal('artifactEnvelope' in created, false)
  assert.equal('artifactRuntimeReference' in created, false)
  assert.equal('runtimeDataV2' in created, false)
  assert.equal('runtimeContext' in created, false)
  assert.equal('providerResponse' in created, false)

  const running = assertSuccess(
    transitionProductionAttempt(
      created,
      'RUNNING',
      '2026-07-23T08:01:00.000Z',
    ),
    'RUNNING',
    'CREATED -> RUNNING',
  )
  assert.equal(created.status, 'CREATED', 'creation result was mutated')

  const completed = assertSuccess(
    transitionProductionAttempt(
      running,
      'COMPLETED',
      '2026-07-23T08:02:00.000Z',
      {
        generationId: 'generation-001-complete',
        artifactEnvelope: { status: 'READY' },
        runtimeDataV2: { forbidden: true },
        providerResponse: { forbidden: true },
      },
    ),
    'COMPLETED',
    'RUNNING -> COMPLETED',
  )
  assert.equal(running.status, 'RUNNING', 'running attempt was mutated')
  assert.equal(completed.generationId, 'generation-001-complete')
  assert.equal('artifactEnvelope' in completed, false)
  assert.equal('runtimeDataV2' in completed, false)
  assert.equal('providerResponse' in completed, false)

  const failureRunning = assertSuccess(
    transitionProductionAttempt(
      created,
      'RUNNING',
      '2026-07-23T08:01:00.000Z',
    ),
    'RUNNING',
    'failure path RUNNING',
  )
  const failed = assertSuccess(
    transitionProductionAttempt(
      failureRunning,
      'FAILED',
      '2026-07-23T08:02:00.000Z',
      {
        errorInformation: {
          code: 'PROVIDER_UNAVAILABLE',
          message: 'Provider execution failed',
          retryable: true,
          providerPayload: { forbidden: true },
        },
      },
    ),
    'FAILED',
    'RUNNING -> FAILED',
  )
  assert.deepEqual(failed.errorInformation, {
    code: 'PROVIDER_UNAVAILABLE',
    message: 'Provider execution failed',
    retryable: true,
  })
  assert.equal(
    Object.isFrozen(failed.errorInformation),
    true,
    'errorInformation is mutable',
  )
  assert.equal('providerPayload' in failed.errorInformation, false)

  assertFailure(
    transitionProductionAttempt(
      created,
      'COMPLETED',
      '2026-07-23T08:01:00.000Z',
    ),
    'INVALID_TRANSITION',
    'CREATED -> COMPLETED',
  )
  assertFailure(
    transitionProductionAttempt(
      completed,
      'RUNNING',
      '2026-07-23T08:03:00.000Z',
    ),
    'INVALID_TRANSITION',
    'COMPLETED -> RUNNING',
  )
  assertFailure(
    transitionProductionAttempt(
      failed,
      'RUNNING',
      '2026-07-23T08:03:00.000Z',
    ),
    'INVALID_TRANSITION',
    'FAILED -> RUNNING',
  )
  assertFailure(
    transitionProductionAttempt(
      failed,
      'COMPLETED',
      '2026-07-23T08:03:00.000Z',
    ),
    'INVALID_TRANSITION',
    'FAILED -> COMPLETED',
  )

  const readyValidation = validateProductionAttemptTransition(
    'CREATED',
    'READY',
  )
  assert.equal(readyValidation.valid, false, 'READY must be rejected')
  assert.equal(readyValidation.issues[0]?.code, 'INVALID_TARGET_STATUS')
  assertFailure(
    createProductionAttempt({
      attemptId: 'attempt-ready',
      jobId: 'job-001',
      provider: 'test-provider',
      status: 'READY',
      createdAt: '2026-07-23T08:00:00.000Z',
    }),
    'INVALID_INITIAL_STATUS',
    'READY creation',
  )

  assertFailure(
    createProductionAttempt({
      attemptId: ' ',
      jobId: 'job-001',
      provider: 'test-provider',
      createdAt: 'invalid',
    }),
    'INVALID_ATTEMPT_ID',
    'invalid creation',
  )
  assertFailure(
    transitionProductionAttempt(
      running,
      'COMPLETED',
      '2026-07-23T07:59:00.000Z',
    ),
    'TIMESTAMP_REGRESSION',
    'updatedAt regression',
  )

  console.log('ProductionAttempt MVP verification passed')
  console.log('productionAttemptCreation = PASS')
  console.log('createdToRunning = PASS')
  console.log('runningToCompleted = PASS')
  console.log('runningToFailed = PASS')
  console.log('invalidTransition = PASS')
  console.log('readyStatusRejection = PASS')
  console.log('artifactFieldLeakage = ABSENT')
  console.log('runtimeFieldLeakage = ABSENT')
} finally {
  await server.close()
}
