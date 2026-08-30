import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

function expectSuccess(result, label) {
  assert.equal(result.ok, true, `${label} should succeed`)
  assert.equal(Object.isFrozen(result), true, `${label} result must be immutable`)
  assert.equal(Object.isFrozen(result.value), true, `${label} view must be immutable`)
  return result.value
}

function expectFailure(result, code, label) {
  assert.equal(result.ok, false, `${label} should fail`)
  assert.equal(result.error.code, code, `${label} error code`)
}

function transition(authority, job, command) {
  const result = authority.transition(job, command)
  assert.equal(result.ok, true, `${command.type} should succeed`)
  return result.job
}

try {
  const application = await server.ssrLoadModule('/src/application/index.ts')
  const jobs = await server.ssrLoadModule('/src/jobs/index.ts')

  const plan = Object.freeze({
    planId: 'production-plan:request:wp16',
    requestId: 'request:wp16',
    tasks: Object.freeze([
      Object.freeze({
        taskId: 'generation-task:request:wp16',
        requestId: 'request:wp16',
        providerId: 'provider:wp16',
        generationIntent: 'Validate immutable product projections',
        outputSpecification: Object.freeze({ mediaType: 'video', format: 'mp4' }),
      }),
    ]),
  })
  const creation = jobs.createProductionJob(plan, {
    createdAt: '2026-08-30T01:00:00.000Z',
  })
  assert.equal(creation.ok, true)
  const created = creation.job
  const authority = jobs.createProductionJobStateAuthority()
  const scheduled = transition(authority, created, {
    type: 'SCHEDULE',
    updatedAt: '2026-08-30T01:01:00.000Z',
  })
  const claimed = transition(authority, scheduled, {
    type: 'CLAIM',
    workerId: 'worker:wp16',
    leaseId: 'lease:wp16',
    updatedAt: '2026-08-30T01:02:00.000Z',
    expiresAt: '2026-08-30T01:12:00.000Z',
  })
  const running = transition(authority, claimed, {
    type: 'START',
    updatedAt: '2026-08-30T01:03:00.000Z',
  })
  const completed = transition(authority, running, {
    type: 'COMPLETE',
    updatedAt: '2026-08-30T01:04:00.000Z',
  })
  const failed = transition(authority, running, {
    type: 'FAIL',
    updatedAt: '2026-08-30T01:04:00.000Z',
  })

  const statusProjection = application.createProductionStatusProjection()
  for (const job of [created, scheduled, running, completed, failed]) {
    const before = JSON.stringify(job)
    const view = expectSuccess(
      statusProjection.project({
        projectId: 'project:wp16',
        requestId: job.requestId,
        planId: job.planId,
        jobId: job.jobId,
        job,
      }),
      `${job.status} projection`,
    )
    assert.equal(view.status, job.status)
    assert.equal(view.attemptCount, job.attemptCount)
    assert.equal(view.requestId, job.requestId)
    assert.equal(view.planId, job.planId)
    assert.equal(view.jobId, job.jobId)
    assert.equal(view.updatedAt, job.updatedAt)
    assert.equal(JSON.stringify(job), before, `${job.status} Job was mutated`)
  }

  expectFailure(
    statusProjection.project({
      projectId: 'project:wp16',
      requestId: 'request:forged',
      planId: completed.planId,
      jobId: completed.jobId,
      job: completed,
    }),
    'CONFLICT',
    'mismatched correlation',
  )
  expectFailure(
    statusProjection.project({
      projectId: 'project:wp16',
      requestId: completed.requestId,
      planId: completed.planId,
      jobId: completed.jobId,
      job: Object.freeze({ ...completed }),
    }),
    'INVALID_REQUEST',
    'forged Job snapshot',
  )

  const reference = Object.freeze({
    artifactId: 'artifact:wp16-ready',
    mediaType: 'video',
    format: 'mp4',
    resourceReference: 'artifact-storage://wp16-ready.mp4',
  })
  const deliveryRecord = Object.freeze({
    projectId: 'project:wp16',
    requestId: completed.requestId,
    jobId: completed.jobId,
    reference,
  })
  const deliveryProjection = application.createProductDeliveryProjection()
  const jobBeforeDelivery = JSON.stringify(completed)
  const referenceBeforeDelivery = JSON.stringify(reference)
  const delivery = expectSuccess(
    deliveryProjection.project({
      projectId: deliveryRecord.projectId,
      requestId: deliveryRecord.requestId,
      jobId: deliveryRecord.jobId,
      job: completed,
      delivery: deliveryRecord,
    }),
    'READY Runtime Reference delivery projection',
  )
  assert.deepEqual(delivery, {
    projectId: 'project:wp16',
    requestId: completed.requestId,
    jobId: completed.jobId,
    artifactId: reference.artifactId,
    mediaType: reference.mediaType,
    format: reference.format,
    resourceReference: reference.resourceReference,
  })
  assert.equal(JSON.stringify(completed), jobBeforeDelivery)
  assert.equal(JSON.stringify(reference), referenceBeforeDelivery)
  expectFailure(
    deliveryProjection.project({
      projectId: 'project:wrong',
      requestId: deliveryRecord.requestId,
      jobId: deliveryRecord.jobId,
      job: completed,
      delivery: deliveryRecord,
    }),
    'CONFLICT',
    'mismatched delivery correlation',
  )
  expectFailure(
    deliveryProjection.project({
      projectId: deliveryRecord.projectId,
      requestId: deliveryRecord.requestId,
      jobId: deliveryRecord.jobId,
      job: running,
      delivery: deliveryRecord,
    }),
    'CONFLICT',
    'non-completed delivery',
  )

  const deliverySource = application.createInMemoryArtifactDeliveryQuerySource([
    deliveryRecord,
  ])
  assert.deepEqual(await deliverySource.getByJobId(completed.jobId), deliveryRecord)
  assert.equal(await deliverySource.getByJobId('production-job:missing'), undefined)
  assert.deepEqual(
    await deliverySource.findByRequestId(completed.requestId),
    deliveryRecord,
  )
  assert.deepEqual(Object.keys(deliverySource), ['getByJobId', 'findByRequestId'])

  console.log('Production Status / Delivery Projection Validation')
  console.log('CREATED / SCHEDULED / RUNNING / COMPLETED / FAILED: PASS')
  console.log('attemptCount and correlation preserved: PASS')
  console.log('immutable projections: PASS')
  console.log('forged / mismatched correlation: REJECTED')
  console.log('READY Runtime Reference -> ProductDeliveryView: PASS')
  console.log('missing delivery: NOT_FOUND source result')
  console.log('Job / Artifact reference mutation: ABSENT')
  console.log('Artifact publication / Runtime touch: ABSENT')
} finally {
  await server.close()
}
