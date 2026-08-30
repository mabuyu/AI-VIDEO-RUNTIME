import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

function expectSuccess(result, label) {
  assert.equal(result.ok, true, `${label} should succeed`)
  assert.equal(Object.isFrozen(result), true, `${label} result must be immutable`)
  return result.value
}

function expectFailure(result, code, label) {
  assert.equal(result.ok, false, `${label} should fail`)
  assert.equal(result.error.code, code, `${label} error code`)
}

function nextTimestamp(timestamp, minutes) {
  return new Date(Date.parse(timestamp) + minutes * 60_000).toISOString()
}

try {
  const application = await server.ssrLoadModule('/src/application/index.ts')
  const platform = await server.ssrLoadModule('/src/platform/index.ts')
  const jobs = await server.ssrLoadModule('/src/jobs/index.ts')
  const infrastructure = await server.ssrLoadModule('/src/jobInfrastructure/index.ts')

  const owner = platform.createPlatformUser({
    userId: 'user:wp17-owner',
    createdAt: '2026-08-30T02:00:00.000Z',
  }).user
  const editor = platform.createPlatformUser({
    userId: 'user:wp17-editor',
    createdAt: '2026-08-30T02:00:00.000Z',
  }).user
  const viewer = platform.createPlatformUser({
    userId: 'user:wp17-viewer',
    createdAt: '2026-08-30T02:00:00.000Z',
  }).user
  const users = application.createInMemoryPlatformUserSource([
    owner,
    editor,
    viewer,
  ])
  const workspaces = platform.createInMemoryWorkspaceRepository()
  const memberships = platform.createInMemoryWorkspaceMembershipRepository()
  const projects = platform.createInMemoryProjectRepository()
  const repository = infrastructure.createInMemoryProductionJobRepository()
  const productionJobs = application.createProductionJobApplicationStore(repository)
  const commandService = application.createProductApplicationService({
    users,
    workspaces,
    memberships,
    projects,
    productionJobs,
    productionOrchestrator: platform.createProjectProductionOrchestrator(),
  })
  const context = (user, occurredAt) => Object.freeze({
    actor: Object.freeze({ userId: user.userId }),
    occurredAt,
  })

  const workspaceBundle = expectSuccess(
    await commandService.createWorkspace({
      context: context(owner, '2026-08-30T02:01:00.000Z'),
      workspaceId: 'workspace:wp17',
      name: 'WP17 Workspace',
    }),
    'A-C create Workspace and persist OWNER membership',
  )
  const editorMembership = expectSuccess(
    await commandService.addWorkspaceMember({
      context: context(owner, '2026-08-30T02:02:00.000Z'),
      workspaceId: workspaceBundle.workspace.workspaceId,
      userId: editor.userId,
      role: 'EDITOR',
    }),
    'add EDITOR',
  )
  const viewerMembership = expectSuccess(
    await commandService.addWorkspaceMember({
      context: context(owner, '2026-08-30T02:03:00.000Z'),
      workspaceId: workspaceBundle.workspace.workspaceId,
      userId: viewer.userId,
      role: 'VIEWER',
    }),
    'add VIEWER',
  )
  const project = expectSuccess(
    await commandService.createProject({
      context: context(owner, '2026-08-30T02:04:00.000Z'),
      projectId: 'project:wp17',
      workspaceId: workspaceBundle.workspace.workspaceId,
      name: 'WP17 Project',
    }),
    'D create Project',
  )
  const admission = expectSuccess(
    await commandService.requestProjectProduction({
      context: context(owner, '2026-08-30T02:05:00.000Z'),
      requestId: 'request:wp17',
      projectId: project.projectId,
      productionIntent: 'Complete the external application path',
      outputSpecification: Object.freeze({ mediaType: 'video', format: 'mp4' }),
    }),
    'E-F request Production and return CREATED Job',
  )
  assert.equal(admission.job.status, 'CREATED')
  assert.equal('lease' in admission.job, false)
  assert.equal('maxAttempts' in admission.job, false)
  const admittedJob = await productionJobs.getById(admission.job.jobId)
  assert.ok(admittedJob)

  const emptyDeliveries = application.createInMemoryArtifactDeliveryQuerySource()
  const createdQueryService = application.createProductApplicationQueryService({
    users,
    workspaces,
    memberships,
    projects,
    productionJobs,
    deliveries: emptyDeliveries,
  })
  const query = (user) => ({
    context: context(user, '2026-08-30T02:06:00.000Z'),
    projectId: project.projectId,
    requestId: admission.requestId,
    jobId: admission.job.jobId,
  })
  const createdStatus = expectSuccess(
    await createdQueryService.getProductionStatus(query(owner)),
    'G query CREATED status',
  )
  assert.equal(createdStatus.status, 'CREATED')

  const authority = jobs.createProductionJobStateAuthority()
  let completedJob = admittedJob
  const commands = [
    {
      type: 'SCHEDULE',
      updatedAt: nextTimestamp(completedJob.updatedAt, 1),
    },
    {
      type: 'CLAIM',
      workerId: 'worker:wp17-fixture',
      leaseId: 'lease:wp17-fixture',
      updatedAt: nextTimestamp(completedJob.updatedAt, 2),
      expiresAt: nextTimestamp(completedJob.updatedAt, 12),
    },
    {
      type: 'START',
      updatedAt: nextTimestamp(completedJob.updatedAt, 3),
    },
    {
      type: 'COMPLETE',
      updatedAt: nextTimestamp(completedJob.updatedAt, 4),
    },
  ]
  for (const command of commands) {
    const previousVersion = completedJob.version
    const transitioned = authority.transition(completedJob, command)
    assert.equal(transitioned.ok, true, `${command.type} fixture transition`)
    completedJob = transitioned.job
    assert.equal(await productionJobs.save(completedJob, previousVersion), true)
  }
  const completedStatus = expectSuccess(
    await createdQueryService.getProductionStatus(query(owner)),
    'H-I query trusted downstream COMPLETED Job',
  )
  assert.equal(completedStatus.status, 'COMPLETED')

  const readyReference = Object.freeze({
    artifactId: 'artifact:wp17-ready',
    mediaType: 'video',
    format: 'mp4',
    resourceReference: 'artifact-storage://wp17/final.mp4',
  })
  const deliveries = application.createInMemoryArtifactDeliveryQuerySource([
    Object.freeze({
      projectId: project.projectId,
      requestId: admission.requestId,
      jobId: admission.job.jobId,
      reference: readyReference,
    }),
  ])
  const queryService = application.createProductApplicationQueryService({
    users,
    workspaces,
    memberships,
    projects,
    productionJobs,
    deliveries,
  })
  const delivery = expectSuccess(
    await queryService.getProductionDelivery(query(owner)),
    'J-K READY delivery query',
  )
  assert.equal(delivery.artifactId, readyReference.artifactId)
  assert.equal(delivery.resourceReference, readyReference.resourceReference)

  const workspaceBefore = JSON.stringify(workspaces.getById('workspace:wp17'))
  const projectBefore = JSON.stringify(projects.getById(project.projectId))
  const jobBefore = JSON.stringify(await productionJobs.getById(admission.job.jobId))
  for (const [role, user] of [
    ['OWNER', owner],
    ['EDITOR', editor],
    ['VIEWER', viewer],
  ]) {
    assert.deepEqual(
      expectSuccess(
        await queryService.getWorkspace({
          context: context(user, '2026-08-30T02:07:00.000Z'),
          workspaceId: 'workspace:wp17',
        }),
        `${role} Workspace read`,
      ),
      workspaceBundle.workspace,
    )
    assert.deepEqual(
      expectSuccess(await queryService.getProject({
        context: context(user, '2026-08-30T02:07:00.000Z'),
        projectId: project.projectId,
      }), `${role} Project read`),
      project,
    )
    expectSuccess(
      await queryService.getProductionStatus(query(user)),
      `${role} Production status read`,
    )
    expectSuccess(
      await queryService.getProductionDelivery(query(user)),
      `${role} delivery read`,
    )
  }

  expectSuccess(
    await commandService.revokeWorkspaceMember({
      context: context(owner, '2026-08-30T02:08:00.000Z'),
      membershipId: viewerMembership.membershipId,
      expectedVersion: viewerMembership.version,
    }),
    'revoke VIEWER',
  )
  expectFailure(
    await queryService.getProject({
      context: context(viewer, '2026-08-30T02:09:00.000Z'),
      projectId: project.projectId,
    }),
    'FORBIDDEN',
    'REVOKED read',
  )
  expectFailure(
    await queryService.getProject({
      context: context(owner, '2026-08-30T02:09:00.000Z'),
      projectId: 'project:missing',
    }),
    'NOT_FOUND',
    'missing Project',
  )
  expectFailure(
    await queryService.getProductionStatus({
      ...query(owner),
      jobId: 'production-job:missing',
    }),
    'NOT_FOUND',
    'missing Job',
  )
  expectFailure(
    await createdQueryService.getProductionDelivery(query(owner)),
    'NOT_FOUND',
    'missing Delivery',
  )
  expectFailure(
    await queryService.getProductionStatus({
      ...query(owner),
      requestId: 'request:mismatched',
    }),
    'CONFLICT',
    'stale correlation',
  )
  assert.equal(JSON.stringify(workspaces.getById('workspace:wp17')), workspaceBefore)
  assert.equal(JSON.stringify(projects.getById(project.projectId)), projectBefore)
  assert.equal(
    JSON.stringify(await productionJobs.getById(admission.job.jobId)),
    jobBefore,
  )
  assert.equal(editorMembership.status, 'ACTIVE')

  const querySource = await readFile(
    new URL('../src/application/productApplicationQueryService.ts', import.meta.url),
    'utf8',
  )
  assert.doesNotMatch(querySource, /\.save\s*\(|\.execute\s*\(|\.enqueue\s*\(/)
  assert.doesNotMatch(querySource, /\.generate\s*\(|\.publish\s*\(|\.render\s*\(/)
  assert.doesNotMatch(querySource, /\/providers|\/queue|\/worker|\/runtime/)

  console.log('Product Application Query Integration Validation')
  console.log('A-K end-to-end Application command/query flow: PASS')
  console.log('OWNER / EDITOR / VIEWER read: PASS')
  console.log('REVOKED read: REJECTED')
  console.log('missing Project / Job / Delivery: NOT_FOUND')
  console.log('stale / mismatched correlation: REJECTED')
  console.log('Application Query domain mutation: ABSENT')
  console.log('Provider / Queue / Worker calls: ABSENT')
  console.log('Artifact publication / Runtime touch: ABSENT')
} finally {
  await server.close()
}
