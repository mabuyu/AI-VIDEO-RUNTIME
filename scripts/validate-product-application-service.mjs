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
  assert.equal(Object.isFrozen(result), true, `${label} result must be immutable`)
  assert.equal(Object.isFrozen(result.error), true, `${label} error must be immutable`)
}

try {
  const application = await server.ssrLoadModule('/src/application/index.ts')
  const platform = await server.ssrLoadModule('/src/platform/index.ts')
  const infrastructure = await server.ssrLoadModule('/src/jobInfrastructure/index.ts')

  const owner = platform.createPlatformUser({
    userId: 'user:wp15-owner',
    createdAt: '2026-08-30T00:00:00.000Z',
  }).user
  const editor = platform.createPlatformUser({
    userId: 'user:wp15-editor',
    createdAt: '2026-08-30T00:00:00.000Z',
  }).user
  const viewer = platform.createPlatformUser({
    userId: 'user:wp15-viewer',
    createdAt: '2026-08-30T00:00:00.000Z',
  }).user
  const users = application.createInMemoryPlatformUserSource([
    owner,
    editor,
    viewer,
  ])
  const workspaces = platform.createInMemoryWorkspaceRepository()
  const memberships = platform.createInMemoryWorkspaceMembershipRepository()
  const projects = platform.createInMemoryProjectRepository()
  const jobRepository = infrastructure.createInMemoryProductionJobRepository()
  const productionJobs = application.createProductionJobApplicationStore(
    jobRepository,
  )
  const calls = { admission: 0 }
  const productionOrchestrator = platform.createProjectProductionOrchestrator()
  const observingOrchestrator = Object.freeze({
    admit(input) {
      calls.admission += 1
      return productionOrchestrator.admit(input)
    },
  })
  const service = application.createProductApplicationService({
    users,
    workspaces,
    memberships,
    projects,
    productionJobs,
    productionOrchestrator: observingOrchestrator,
  })
  const context = (user, occurredAt) => Object.freeze({
    actor: Object.freeze({ userId: user.userId }),
    occurredAt,
  })

  const workspaceBundle = expectSuccess(
    await service.createWorkspace({
      context: context(owner, '2026-08-30T00:01:00.000Z'),
      workspaceId: 'workspace:wp15',
      name: 'WP15 Workspace',
    }),
    'createWorkspace',
  )
  assert.equal(workspaceBundle.ownerMembership.role, 'OWNER')
  assert.deepEqual(workspaces.getById('workspace:wp15'), workspaceBundle.workspace)
  assert.deepEqual(
    memberships.getByWorkspaceAndUser('workspace:wp15', owner.userId),
    workspaceBundle.ownerMembership,
  )

  const editorMembership = expectSuccess(
    await service.addWorkspaceMember({
      context: context(owner, '2026-08-30T00:02:00.000Z'),
      workspaceId: 'workspace:wp15',
      userId: editor.userId,
      role: 'EDITOR',
    }),
    'addWorkspaceMember EDITOR',
  )
  const viewerMembership = expectSuccess(
    await service.addWorkspaceMember({
      context: context(owner, '2026-08-30T00:03:00.000Z'),
      workspaceId: 'workspace:wp15',
      userId: viewer.userId,
      role: 'VIEWER',
    }),
    'addWorkspaceMember VIEWER',
  )
  const changedViewer = expectSuccess(
    await service.changeWorkspaceMemberRole({
      context: context(owner, '2026-08-30T00:04:00.000Z'),
      membershipId: viewerMembership.membershipId,
      role: 'EDITOR',
      expectedVersion: 0,
    }),
    'changeWorkspaceMemberRole',
  )
  assert.equal(changedViewer.role, 'EDITOR')
  const revokedViewer = expectSuccess(
    await service.revokeWorkspaceMember({
      context: context(owner, '2026-08-30T00:05:00.000Z'),
      membershipId: viewerMembership.membershipId,
      expectedVersion: 1,
    }),
    'revokeWorkspaceMember',
  )
  assert.equal(revokedViewer.status, 'REVOKED')

  const renamedWorkspace = expectSuccess(
    await service.renameWorkspace({
      context: context(owner, '2026-08-30T00:06:00.000Z'),
      workspaceId: 'workspace:wp15',
      name: 'WP15 Renamed Workspace',
      expectedVersion: 0,
    }),
    'renameWorkspace',
  )
  assert.equal(renamedWorkspace.version, 1)
  expectFailure(
    await service.renameWorkspace({
      context: context(owner, '2026-08-30T00:07:00.000Z'),
      workspaceId: 'workspace:wp15',
      name: 'Stale Rename',
      expectedVersion: 0,
    }),
    'CONFLICT',
    'Workspace CAS conflict',
  )
  expectSuccess(
    await service.createWorkspace({
      context: context(owner, '2026-08-30T00:07:30.000Z'),
      workspaceId: 'workspace:wp15-archive',
      name: 'WP15 Archive Workspace',
    }),
    'create archive Workspace target',
  )
  const archivedWorkspace = expectSuccess(
    await service.archiveWorkspace({
      context: context(owner, '2026-08-30T00:07:45.000Z'),
      workspaceId: 'workspace:wp15-archive',
      expectedVersion: 0,
    }),
    'archiveWorkspace',
  )
  assert.equal(archivedWorkspace.status, 'ARCHIVED')

  const project = expectSuccess(
    await service.createProject({
      context: context(editor, '2026-08-30T00:08:00.000Z'),
      projectId: 'project:wp15',
      workspaceId: 'workspace:wp15',
      name: 'WP15 Project',
    }),
    'createProject',
  )
  const renamedProject = expectSuccess(
    await service.renameProject({
      context: context(editor, '2026-08-30T00:09:00.000Z'),
      projectId: project.projectId,
      name: 'WP15 Renamed Project',
      expectedVersion: 0,
    }),
    'renameProject',
  )
  assert.equal(renamedProject.version, 1)

  const admission = expectSuccess(
    await service.requestProjectProduction({
      context: context(editor, '2026-08-30T00:10:00.000Z'),
      requestId: 'request:wp15',
      projectId: project.projectId,
      productionIntent: 'Validate the application admission boundary',
      outputSpecification: Object.freeze({ mediaType: 'video', format: 'mp4' }),
    }),
    'requestProjectProduction',
  )
  assert.equal(admission.job.status, 'CREATED')
  assert.equal(admission.job.requestId, admission.requestId)
  const storedJob = await productionJobs.getById(admission.job.jobId)
  assert.equal(storedJob.status, admission.job.status)
  assert.equal(storedJob.planId, admission.planId)
  assert.equal(storedJob.requestId, admission.requestId)
  assert.deepEqual(Object.keys(admission.job), [
    'jobId',
    'planId',
    'requestId',
    'status',
    'attemptCount',
    'updatedAt',
  ])
  assert.equal('lease' in admission.job, false)
  assert.equal('maxAttempts' in admission.job, false)
  assert.equal('currentAttemptId' in admission.job, false)
  assert.equal('tasks' in admission, false)
  assert.equal(calls.admission, 1)

  expectFailure(
    await service.requestProjectProduction({
      context: context(viewer, '2026-08-30T00:11:00.000Z'),
      requestId: 'request:wp15-revoked',
      projectId: project.projectId,
      productionIntent: 'This must not reach admission',
      outputSpecification: Object.freeze({ mediaType: 'video', format: 'mp4' }),
    }),
    'FORBIDDEN',
    'revoked production permission',
  )
  assert.equal(calls.admission, 1)
  expectFailure(
    await service.renameProject({
      context: context(owner, '2026-08-30T00:12:00.000Z'),
      projectId: 'project:missing',
      name: 'Missing',
      expectedVersion: 0,
    }),
    'NOT_FOUND',
    'missing Project',
  )
  expectFailure(
    await service.createWorkspace({
      context: context(owner, '2026-08-30T00:13:00.000Z'),
      workspaceId: 'workspace:invalid',
      name: ' ',
    }),
    'INVALID_REQUEST',
    'invalid request mapping',
  )

  const archiveTarget = expectSuccess(
    await service.createProject({
      context: context(owner, '2026-08-30T00:14:00.000Z'),
      projectId: 'project:wp15-archive',
      workspaceId: 'workspace:wp15',
      name: 'Archive Target',
    }),
    'create archive target',
  )
  const archivedProject = expectSuccess(
    await service.archiveProject({
      context: context(owner, '2026-08-30T00:15:00.000Z'),
      projectId: archiveTarget.projectId,
      expectedVersion: 0,
    }),
    'archiveProject',
  )
  assert.equal(archivedProject.status, 'ARCHIVED')

  const source = await readFile(
    new URL('../src/application/productApplicationService.ts', import.meta.url),
    'utf8',
  )
  assert.doesNotMatch(source, /\.execute\s*\(|\.enqueue\s*\(|\.generate\s*\(/)
  assert.doesNotMatch(source, /\/providers|\/queue|\/worker|\/runtime/)
  assert.doesNotMatch(source, /createProductionJobStateAuthority|\.transition\s*\(/)

  console.log('Product Application Service Validation')
  console.log('workspace commands: PASS')
  console.log('membership commands: PASS')
  console.log('project commands: PASS')
  console.log('production admission: PASS')
  console.log('permission denial: PASS')
  console.log('CAS conflict: PASS')
  console.log('not found mapping: PASS')
  console.log('invalid request mapping: PASS')
  console.log('infrastructure leakage: ABSENT')
  console.log('no execution / queue / provider / runtime: PASS')
} finally {
  await server.close()
}
