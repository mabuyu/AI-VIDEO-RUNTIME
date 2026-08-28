import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

const CONTEXT = Object.freeze({
  workerId: 'worker-wp10-001',
  leaseId: 'lease-wp10-001',
  now: '2026-08-28T00:02:00.000Z',
  leaseExpiresAt: '2026-08-28T01:00:00.000Z',
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
    planId: `plan-wp10-${suffix}`,
    requestId: `request-wp10-${suffix}`,
    tasks: Object.freeze([
      Object.freeze({
        taskId: `task-wp10-${suffix}`,
        requestId: `request-wp10-${suffix}`,
        providerId: 'provider-wp10-boundary-fixture',
        generationIntent: 'Validate queue and worker execution boundaries',
        outputSpecification: Object.freeze({
          mediaType: 'video',
          format: 'mp4',
        }),
      }),
    ]),
  })
}

function terminalExecutionResult(planId, status = 'COMPLETED') {
  return Object.freeze({
    executionId: `execution:${planId}`,
    planId,
    status,
    results: Object.freeze([]),
    generationOutputs: Object.freeze([]),
    errors: Object.freeze(
      status === 'FAILED'
        ? [
            Object.freeze({
              code: 'PROVIDER_EXECUTION_FAILED',
              message: 'Deterministic WP10 execution failure fixture',
            }),
          ]
        : [],
    ),
  })
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
  const executionApi = await server.ssrLoadModule('/src/execution/index.ts')

  assert.deepEqual(Object.keys(jobs).sort(), [
    'createProductionJob',
    'createProductionJobStateAuthority',
  ])
  assert.deepEqual(Object.keys(queueApi).sort(), [
    'createInMemoryProductionJobQueue',
    'createProductionJobDispatch',
  ])
  assert.deepEqual(Object.keys(workerApi).sort(), [
    'createInMemoryProductionJobStore',
    'createInMemoryProductionPlanSource',
    'createProductionJobWorker',
  ])
  assert.deepEqual(Object.keys(executionApi), ['createExecutionManager'])

  function createScheduledJob(plan) {
    const creation = jobs.createProductionJob(plan, {
      maxAttempts: 3,
      createdAt: '2026-08-28T00:00:00.000Z',
    })
    assert.equal(creation.ok, true)
    const scheduled = jobs.createProductionJobStateAuthority().transition(
      creation.job,
      {
        type: 'SCHEDULE',
        updatedAt: '2026-08-28T00:01:00.000Z',
      },
    )
    assert.equal(scheduled.ok, true)
    return scheduled.job
  }

  async function runWorkerCase({
    plan,
    initialJob,
    dispatch,
    plans = [plan],
    execute,
  }) {
    const queue = queueApi.createInMemoryProductionJobQueue()
    await queue.enqueue(dispatch)

    const baseStore = workerApi.createInMemoryProductionJobStore([initialJob])
    const replacements = []
    const jobStore = Object.freeze({
      getById: (jobId) => baseStore.getById(jobId),
      async replace(job, expectedVersion) {
        const replaced = await baseStore.replace(job, expectedVersion)
        if (replaced) replacements.push(job)
        return replaced
      },
    })

    const transitionCommands = []
    const authority = jobs.createProductionJobStateAuthority()
    const stateAuthority = Object.freeze({
      transition(job, command) {
        transitionCommands.push(command.type)
        return authority.transition(job, command)
      },
    })

    const executionCalls = []
    const executionManager = Object.freeze({
      async execute(resolvedPlan) {
        executionCalls.push(resolvedPlan)
        return execute(resolvedPlan)
      },
    })

    const worker = workerApi.createProductionJobWorker({
      stateAuthority,
      jobStore,
      planSource: workerApi.createInMemoryProductionPlanSource(plans),
      queue,
      executionManager,
    })
    assert.equal(Object.isFrozen(worker), true)

    const result = await worker.processNext(CONTEXT)
    assertDeepFrozen(result, 'ProductionJobWorkerResult')

    return {
      result,
      queue,
      store: baseStore,
      replacements,
      transitionCommands,
      executionCalls,
    }
  }

  const dispatchPlan = createPlan('dispatch')
  const dispatchJob = createScheduledJob(dispatchPlan)
  const dispatchBefore = JSON.parse(JSON.stringify(dispatchJob))
  const dispatchA = queueApi.createProductionJobDispatch(
    dispatchJob,
    '2026-08-28T00:01:00.000Z',
  )
  const dispatchB = queueApi.createProductionJobDispatch(
    dispatchJob,
    '2026-08-28T00:01:00.000Z',
  )
  assert.deepEqual(Object.keys(dispatchA), [
    'dispatchId',
    'jobId',
    'expectedVersion',
    'availableAt',
  ])
  assert.equal(
    dispatchA.dispatchId,
    `production-job-dispatch:${dispatchJob.jobId}:${dispatchJob.version}`,
  )
  assert.deepEqual(dispatchA, dispatchB)
  assertDeepFrozen(dispatchA, 'ProductionJobDispatch')
  for (const forbiddenField of [
    'plan',
    'productionPlan',
    'executionResult',
    'providerId',
    'artifactId',
  ]) {
    assert.equal(forbiddenField in dispatchA, false)
  }
  assert.deepEqual(dispatchJob, dispatchBefore, 'Dispatch factory mutated Job')

  const queue = queueApi.createInMemoryProductionJobQueue()
  const mutableDispatch = { ...dispatchA }
  await queue.enqueue(mutableDispatch)
  mutableDispatch.jobId = 'production-job:mutated-after-enqueue'
  mutableDispatch.availableAt = '2030-01-01T00:00:00.000Z'
  const received = await queue.receive()
  assert.deepEqual(received, dispatchA)
  assert.notEqual(received, mutableDispatch)
  assertDeepFrozen(received, 'received dispatch')
  assert.equal(await queue.release(received.dispatchId), true)
  const redelivered = await queue.receive()
  assert.deepEqual(redelivered, dispatchA)
  assert.notEqual(redelivered, received)
  assert.equal(await queue.ack(redelivered.dispatchId), true)
  assert.equal(await queue.receive(), null)
  assert.deepEqual(dispatchJob, dispatchBefore, 'Queue modified Job state')

  const happyPlan = createPlan('completed')
  const happyJob = createScheduledJob(happyPlan)
  const happyDispatch = queueApi.createProductionJobDispatch(
    happyJob,
    '2026-08-28T00:01:00.000Z',
  )
  const happy = await runWorkerCase({
    plan: happyPlan,
    initialJob: happyJob,
    dispatch: happyDispatch,
    execute: (plan) => terminalExecutionResult(plan.planId),
  })
  assert.equal(happy.result.outcome, 'COMPLETED')
  assert.equal(happy.result.job.status, 'COMPLETED')
  assert.deepEqual(happy.transitionCommands, ['CLAIM', 'START', 'COMPLETE'])
  assert.deepEqual(
    happy.replacements.map((job) => job.status),
    ['CLAIMED', 'RUNNING', 'COMPLETED'],
  )
  const [claimedJob, runningJob, completedJob] = happy.replacements
  assert.equal(claimedJob.attemptCount, happyJob.attemptCount + 1)
  assert.equal(
    claimedJob.currentAttemptId,
    `production-attempt:${happyJob.jobId}:1`,
  )
  assert.deepEqual(claimedJob.lease, {
    leaseId: CONTEXT.leaseId,
    workerId: CONTEXT.workerId,
    expiresAt: CONTEXT.leaseExpiresAt,
  })
  assert.deepEqual(runningJob.lease, claimedJob.lease)
  assert.notEqual(runningJob.lease, claimedJob.lease)
  assert.equal(completedJob.lease, null)
  assert.equal(happy.executionCalls.length, 1)
  assert.deepEqual(happy.executionCalls[0], happyPlan)
  assert.equal(happy.result.executionResult.planId, happyJob.planId)
  assert.equal((await happy.store.getById(happyJob.jobId)).status, 'COMPLETED')
  assert.equal(await happy.queue.receive(), null, 'Completed dispatch was not acked')

  const failedPlan = createPlan('execution-failed')
  const failedJob = createScheduledJob(failedPlan)
  const failed = await runWorkerCase({
    plan: failedPlan,
    initialJob: failedJob,
    dispatch: queueApi.createProductionJobDispatch(
      failedJob,
      '2026-08-28T00:01:00.000Z',
    ),
    execute: (plan) => terminalExecutionResult(plan.planId, 'FAILED'),
  })
  assert.equal(failed.result.outcome, 'EXECUTION_FAILED')
  assert.equal(failed.result.job.status, 'RUNNING')
  assert.equal((await failed.store.getById(failedJob.jobId)).status, 'RUNNING')
  assert.equal(failed.transitionCommands.includes('FAIL'), false)
  assert.equal(failed.transitionCommands.includes('WAIT_FOR_RETRY'), false)
  assert.deepEqual(failed.transitionCommands, ['CLAIM', 'START'])
  assert.equal(await failed.queue.receive(), null, 'Failed dispatch was not acked')

  const mismatchPlan = createPlan('result-mismatch')
  const mismatchJob = createScheduledJob(mismatchPlan)
  const mismatch = await runWorkerCase({
    plan: mismatchPlan,
    initialJob: mismatchJob,
    dispatch: queueApi.createProductionJobDispatch(
      mismatchJob,
      '2026-08-28T00:01:00.000Z',
    ),
    execute: () => terminalExecutionResult('plan-wp10-wrong-result'),
  })
  assert.equal(mismatch.result.outcome, 'EXECUTION_ERROR')
  assert.equal(
    mismatch.result.issues[0].code,
    'EXECUTION_RESULT_CORRELATION_MISMATCH',
  )
  assert.equal((await mismatch.store.getById(mismatchJob.jobId)).status, 'RUNNING')
  assert.deepEqual(mismatch.transitionCommands, ['CLAIM', 'START'])

  const errorPlan = createPlan('execution-error')
  const errorJob = createScheduledJob(errorPlan)
  const executionError = await runWorkerCase({
    plan: errorPlan,
    initialJob: errorJob,
    dispatch: queueApi.createProductionJobDispatch(
      errorJob,
      '2026-08-28T00:01:00.000Z',
    ),
    execute: () => {
      throw new Error('Execution boundary fixture')
    },
  })
  assert.equal(executionError.result.outcome, 'EXECUTION_ERROR')
  assert.equal(executionError.result.issues[0].code, 'EXECUTION_MANAGER_ERROR')
  assert.equal((await executionError.store.getById(errorJob.jobId)).status, 'RUNNING')
  assert.equal(await executionError.queue.receive(), null)

  const missingPlan = createPlan('missing-plan')
  const missingPlanJob = createScheduledJob(missingPlan)
  const noPlan = await runWorkerCase({
    plan: missingPlan,
    initialJob: missingPlanJob,
    dispatch: queueApi.createProductionJobDispatch(
      missingPlanJob,
      '2026-08-28T00:01:00.000Z',
    ),
    plans: [],
    execute: () => terminalExecutionResult(missingPlan.planId),
  })
  assert.equal(noPlan.result.outcome, 'PLAN_NOT_FOUND')
  assert.equal(noPlan.executionCalls.length, 0)
  assert.equal((await noPlan.store.getById(missingPlanJob.jobId)).status, 'RUNNING')
  assert.equal(await noPlan.queue.receive(), null)

  const missingJobPlan = createPlan('missing-job')
  const missingJob = createScheduledJob(missingJobPlan)
  const missingJobDispatch = queueApi.createProductionJobDispatch(
    missingJob,
    '2026-08-28T00:01:00.000Z',
  )
  const missingJobQueue = queueApi.createInMemoryProductionJobQueue([
    missingJobDispatch,
  ])
  let missingJobExecutionCalls = 0
  const missingJobWorker = workerApi.createProductionJobWorker({
    stateAuthority: jobs.createProductionJobStateAuthority(),
    jobStore: workerApi.createInMemoryProductionJobStore(),
    planSource: workerApi.createInMemoryProductionPlanSource([missingJobPlan]),
    queue: missingJobQueue,
    executionManager: Object.freeze({
      async execute() {
        missingJobExecutionCalls += 1
        return terminalExecutionResult(missingJobPlan.planId)
      },
    }),
  })
  const missingJobResult = await missingJobWorker.processNext(CONTEXT)
  assert.equal(missingJobResult.outcome, 'JOB_NOT_FOUND')
  assert.equal(missingJobExecutionCalls, 0)
  assert.equal(await missingJobQueue.receive(), null)

  const stalePlan = createPlan('stale')
  const staleJob = createScheduledJob(stalePlan)
  const staleDispatch = Object.freeze({
    dispatchId: `production-job-dispatch:${staleJob.jobId}:0`,
    jobId: staleJob.jobId,
    expectedVersion: 0,
    availableAt: '2026-08-28T00:01:00.000Z',
  })
  const stale = await runWorkerCase({
    plan: stalePlan,
    initialJob: staleJob,
    dispatch: staleDispatch,
    execute: (plan) => terminalExecutionResult(plan.planId),
  })
  assert.equal(stale.result.outcome, 'DISPATCH_REJECTED')
  assert.equal(stale.result.issues[0].code, 'STALE_DISPATCH')
  assert.equal(stale.executionCalls.length, 0)
  assert.equal((await stale.store.getById(staleJob.jobId)).status, 'SCHEDULED')

  const wrongJobPlan = createPlan('wrong-job')
  const wrongStoredJob = createScheduledJob(wrongJobPlan)
  const wrongJobId = 'production-job:wrong-dispatch-target'
  const wrongDispatch = Object.freeze({
    dispatchId: `production-job-dispatch:${wrongJobId}:${wrongStoredJob.version}`,
    jobId: wrongJobId,
    expectedVersion: wrongStoredJob.version,
    availableAt: '2026-08-28T00:01:00.000Z',
  })
  const wrongQueue = queueApi.createInMemoryProductionJobQueue([wrongDispatch])
  let wrongExecutionCalls = 0
  const wrongWorker = workerApi.createProductionJobWorker({
    stateAuthority: jobs.createProductionJobStateAuthority(),
    jobStore: Object.freeze({
      async getById() {
        return wrongStoredJob
      },
      async replace() {
        throw new Error('replace must not be reached')
      },
    }),
    planSource: workerApi.createInMemoryProductionPlanSource([wrongJobPlan]),
    queue: wrongQueue,
    executionManager: Object.freeze({
      async execute() {
        wrongExecutionCalls += 1
        return terminalExecutionResult(wrongJobPlan.planId)
      },
    }),
  })
  const wrongResult = await wrongWorker.processNext(CONTEXT)
  assert.equal(wrongResult.outcome, 'DISPATCH_REJECTED')
  assert.equal(wrongResult.issues[0].code, 'JOB_CORRELATION_MISMATCH')
  assert.equal(wrongExecutionCalls, 0)
  assert.equal(await wrongQueue.receive(), null)

  const forgedPlan = createPlan('forged')
  const genuineScheduled = createScheduledJob(forgedPlan)
  const forgedJob = Object.freeze({ ...genuineScheduled })
  const forged = await runWorkerCase({
    plan: forgedPlan,
    initialJob: forgedJob,
    dispatch: queueApi.createProductionJobDispatch(
      forgedJob,
      '2026-08-28T00:01:00.000Z',
    ),
    execute: (plan) => terminalExecutionResult(plan.planId),
  })
  assert.equal(forged.result.outcome, 'CLAIM_FAILED')
  assert.equal(forged.result.issues[0].code, 'CLAIM_TRANSITION_FAILED')
  assert.equal(forged.executionCalls.length, 0)
  assert.equal((await forged.store.getById(forgedJob.jobId)).status, 'SCHEDULED')

  const planSource = workerApi.createInMemoryProductionPlanSource([dispatchPlan])
  const resolvedPlan = await planSource.resolve(dispatchPlan.planId)
  assert.notEqual(resolvedPlan, dispatchPlan)
  assert.deepEqual(resolvedPlan, dispatchPlan)
  assertDeepFrozen(resolvedPlan, 'resolved ProductionPlan')
  assert.equal(await planSource.resolve('plan-does-not-exist'), null)

  const casStore = workerApi.createInMemoryProductionJobStore([dispatchJob])
  const casAuthority = jobs.createProductionJobStateAuthority()
  const casClaim = casAuthority.transition(dispatchJob, {
    type: 'CLAIM',
    workerId: CONTEXT.workerId,
    leaseId: 'lease-wp10-cas',
    expiresAt: CONTEXT.leaseExpiresAt,
    updatedAt: CONTEXT.now,
  })
  assert.equal(casClaim.ok, true)
  assert.equal(await casStore.replace(casClaim.job, 0), false)
  assert.equal(await casStore.replace(casClaim.job, dispatchJob.version), true)
  assert.equal(await casStore.getById(dispatchJob.jobId), casClaim.job)

  const queueSources = await readTypeScriptSources(
    new URL('../src/queue/', import.meta.url),
  )
  const workerSources = await readTypeScriptSources(
    new URL('../src/worker/', import.meta.url),
  )
  const queueSource = queueSources.map(({ source }) => source).join('\n')
  const workerSource = workerSources.map(({ source }) => source).join('\n')
  const wp10Source = `${queueSource}\n${workerSource}`

  assert.equal(/\bProductionJobStateAuthority\b/.test(queueSource), false)
  assert.equal(/\.transition\s*\(/.test(queueSource), false)
  assert.equal(/\bRetryPolicy\b/.test(queueSource), false)
  assert.equal(/\.release\s*\(/.test(workerSource), false)

  const forbiddenPatterns = [
    ['direct ProviderAdapter use', /\bProviderAdapter\b/],
    ['direct ProviderRegistry use', /\bProviderRegistry\b/],
    ['GenerationPipeline use', /\b(?:GenerationPipeline|createGenerationPipeline)\b/],
    ['Artifact creation use', /\bArtifactCreationBoundary\b/],
    ['Artifact lifecycle use', /\bArtifactLifecycleAuthority\b/],
    ['filesystem operation', /(?:node:fs|writeFile|createWriteStream)/],
    ['network operation', /\bfetch\s*\(/],
    ['timer scheduler', /\b(?:setTimeout|setInterval)\s*\(/],
    ['random identity', /(?:randomUUID|Math\.random)/],
    ['external broker', /\b(?:Redis|Kafka|RabbitMQ|BullMQ)\b/i],
    ['database implementation', /\b(?:PostgreSQL|SQLite|database|SQL)\b/i],
  ]
  for (const [label, pattern] of forbiddenPatterns) {
    assert.equal(pattern.test(wp10Source), false, `Forbidden WP10 ${label}`)
  }

  const importSpecifiers = Array.from(
    wp10Source.matchAll(/from\s+['"]([^'"]+)['"]/g),
    (match) => match[1],
  )
  for (const forbiddenImport of [
    '/providers',
    '/artifacts',
    '/runtime',
    '/runtimeData',
    'execution/pipeline',
    'production/types/productionJob',
  ]) {
    assert.equal(
      importSpecifiers.some((specifier) => specifier.includes(forbiddenImport)),
      false,
      `Forbidden WP10 import boundary: ${forbiddenImport}`,
    )
  }
  assert.equal(
    importSpecifiers.some(
      (specifier) =>
        specifier === '../production' || specifier === '../../production',
    ),
    false,
    'WP10 must not consume the legacy production barrel',
  )
  assert.equal(
    workerSource.match(/executionManager\.execute\s*\(/g)?.length,
    1,
    'Worker must have exactly one production execution call site',
  )

  console.log('Production Job Queue / Worker Boundary validation passed')
  console.log('A scheduledJobToDispatch = PASS')
  console.log('B deterministicDispatch = PASS')
  console.log('C queueEnqueueReceiveAckRelease = PASS')
  console.log('D queueDefensiveImmutability = PASS')
  console.log('E workerClaimViaStateAuthority = PASS')
  console.log('F claimCreatesAttempt = PASS')
  console.log('G leasePreservedIntoRunning = PASS')
  console.log('H executionManagerOnlyInvocation = PASS')
  console.log('I completedExecutionToCompletedJob = PASS')
  console.log('J executionResultPlanCorrelation = PASS')
  console.log('K executionFailedDoesNotFailJob = PASS')
  console.log('L executionFailedDoesNotWaitForRetry = PASS')
  console.log('M missingJob = REJECTED')
  console.log('N missingPlan = REJECTED')
  console.log('O staleExpectedVersion = REJECTED')
  console.log('P wrongJobId = REJECTED')
  console.log('Q forgedJobStoreSnapshot = REJECTED')
  console.log('R directProviderExecution = ABSENT')
  console.log('S generationPipelineUse = ABSENT')
  console.log('T artifactLifecycleUse = ABSENT')
  console.log('U queueJobStateMutation = ABSENT')
  console.log('V queueRetryPolicy = ABSENT')
  console.log('W runtimeInteraction = ABSENT')
  console.log('executionFailureDispatch = ACKED')
  console.log('queueReleaseBusinessRetry = ABSENT')
  console.log('legacyProductionJobDependency = ABSENT')
} finally {
  await server.close()
}
