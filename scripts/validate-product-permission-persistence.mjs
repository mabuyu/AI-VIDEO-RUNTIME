import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

function expectSuccess(result, property, label) {
  assert.equal(result.ok, true, `${label} should succeed`)
  assert.equal(Object.isFrozen(result), true, `${label} result must be frozen`)
  if (property === undefined) return result
  assert.equal(Object.isFrozen(result[property]), true, `${label} snapshot must be frozen`)
  return result[property]
}

function expectRejected(result, code, label) {
  assert.equal(result.ok, false, `${label} should be rejected`)
  assert.equal(
    result.issues.some((issue) => issue.code === code),
    true,
    `${label} should report ${code}`,
  )
  assert.equal(Object.isFrozen(result), true, `${label} result must be frozen`)
  assert.equal(Object.isFrozen(result.issues), true, `${label} issues must be frozen`)
}

function expectValue(value, label) {
  assert.notEqual(value, undefined, `${label} should exist`)
  assert.equal(Object.isFrozen(value), true, `${label} must be frozen`)
  return value
}

function productionRequest(user, workspace, project, requestId) {
  return Object.freeze({
    requestId,
    projectId: project.projectId,
    workspaceId: workspace.workspaceId,
    requestedByUserId: user.userId,
    productionIntent: 'Validate permission-aware trusted product admission',
    outputSpecification: Object.freeze({
      mediaType: 'video',
      format: 'mp4',
    }),
  })
}

try {
  const platform = await server.ssrLoadModule('/src/platform/index.ts')
  const {
    createInMemoryProjectRepository,
    createInMemoryWorkspaceMembershipRepository,
    createInMemoryWorkspaceRepository,
    createPlatformUser,
    createProjectAuthority,
    createProjectProductionOrchestrator,
    createWorkspaceMembershipAuthority,
    createWorkspacePermissionEvaluator,
    createWorkspaceWithOwnerMembership,
    workspaceMembershipId,
  } = platform

  const owner = expectSuccess(
    createPlatformUser({
      userId: 'user:wp14-owner',
      createdAt: '2026-08-30T00:00:00.000Z',
    }),
    'user',
    'owner user creation',
  )
  const editor = expectSuccess(
    createPlatformUser({
      userId: 'user:wp14-editor',
      createdAt: '2026-08-30T00:00:00.000Z',
    }),
    'user',
    'editor user creation',
  )
  const viewer = expectSuccess(
    createPlatformUser({
      userId: 'user:wp14-viewer',
      createdAt: '2026-08-30T00:00:00.000Z',
    }),
    'user',
    'viewer user creation',
  )

  const workspaceBundle = expectSuccess(
    createWorkspaceWithOwnerMembership({
      workspaceId: 'workspace:wp14',
      owner,
      name: 'WP14 Workspace',
      createdAt: '2026-08-30T00:01:00.000Z',
    }),
    undefined,
    'Workspace with owner membership creation',
  )
  const { workspace, ownerMembership } = workspaceBundle
  assert.equal(workspace.ownerUserId, owner.userId)
  assert.equal(ownerMembership.userId, workspace.ownerUserId)
  assert.equal(ownerMembership.workspaceId, workspace.workspaceId)
  assert.equal(ownerMembership.role, 'OWNER')
  assert.equal(ownerMembership.status, 'ACTIVE')
  assert.equal(ownerMembership.version, 0)
  assert.equal(
    ownerMembership.membershipId,
    `workspace-membership:${workspace.workspaceId}:${owner.userId}`,
  )
  assert.equal(
    workspaceMembershipId(workspace.workspaceId, owner.userId),
    ownerMembership.membershipId,
  )

  const membershipAuthority = createWorkspaceMembershipAuthority()
  const editorMembership = expectSuccess(
    membershipAuthority.createMembership({
      workspace,
      user: editor,
      role: 'EDITOR',
      createdAt: '2026-08-30T00:02:00.000Z',
      actorMembership: ownerMembership,
    }),
    'membership',
    'EDITOR membership creation',
  )
  const viewerMembership = expectSuccess(
    membershipAuthority.createMembership({
      workspace,
      user: viewer,
      role: 'VIEWER',
      createdAt: '2026-08-30T00:02:00.000Z',
      actorMembership: ownerMembership,
    }),
    'membership',
    'VIEWER membership creation',
  )
  assert.equal(
    editorMembership.membershipId,
    `workspace-membership:${workspace.workspaceId}:${editor.userId}`,
  )
  assert.equal(
    viewerMembership.membershipId,
    `workspace-membership:${workspace.workspaceId}:${viewer.userId}`,
  )

  expectRejected(
    membershipAuthority.changeRole(
      workspace,
      ownerMembership,
      ownerMembership,
      'EDITOR',
      '2026-08-30T00:03:00.000Z',
    ),
    'OWNER_MEMBERSHIP_PROTECTED',
    'owner downgrade',
  )
  expectRejected(
    membershipAuthority.revokeMembership(
      workspace,
      ownerMembership,
      ownerMembership,
      '2026-08-30T00:03:00.000Z',
    ),
    'OWNER_MEMBERSHIP_PROTECTED',
    'owner revocation',
  )
  expectRejected(
    membershipAuthority.createMembership({
      workspace,
      user: owner,
      role: 'VIEWER',
      createdAt: '2026-08-30T00:03:00.000Z',
    }),
    'OWNER_ROLE_REQUIRED',
    'owner bootstrap with non-owner role',
  )
  expectRejected(
    membershipAuthority.changeRole(
      workspace,
      editorMembership,
      viewerMembership,
      'EDITOR',
      '2026-08-30T00:03:00.000Z',
    ),
    'MEMBERSHIP_MANAGEMENT_DENIED',
    'EDITOR membership management',
  )

  const permissions = createWorkspacePermissionEvaluator()
  assert.deepEqual(Object.keys(permissions), [
    'canManageWorkspace',
    'canManageMembership',
    'canCreateProject',
    'canEditProject',
    'canArchiveProject',
    'canRequestProduction',
    'canViewProject',
  ])
  const ownerDecisions = Object.values(permissions).map((decision) =>
    decision(ownerMembership),
  )
  assert.deepEqual(ownerDecisions, [true, true, true, true, true, true, true])
  assert.deepEqual(
    Object.values(permissions).map((decision) => decision(editorMembership)),
    [false, false, true, true, true, true, true],
  )
  assert.deepEqual(
    Object.values(permissions).map((decision) => decision(viewerMembership)),
    [false, false, false, false, false, false, true],
  )

  const projectAuthority = createProjectAuthority()
  const project = expectSuccess(
    projectAuthority.createProject({
      projectId: 'project:wp14',
      workspace,
      name: 'WP14 Project',
      createdAt: '2026-08-30T00:04:00.000Z',
    }),
    'project',
    'Project creation',
  )
  const orchestrator = createProjectProductionOrchestrator()
  const editorAdmission = orchestrator.admit({
    user: editor,
    workspace,
    project,
    membership: editorMembership,
    request: productionRequest(
      editor,
      workspace,
      project,
      'request:wp14-editor',
    ),
  })
  expectSuccess(editorAdmission, undefined, 'EDITOR production admission')
  expectRejected(
    orchestrator.admit({
      user: viewer,
      workspace,
      project,
      membership: viewerMembership,
      request: productionRequest(
        viewer,
        workspace,
        project,
        'request:wp14-viewer',
      ),
    }),
    'PRODUCTION_PERMISSION_DENIED',
    'VIEWER production admission',
  )
  const revokedViewerMembership = expectSuccess(
    membershipAuthority.revokeMembership(
      workspace,
      ownerMembership,
      viewerMembership,
      '2026-08-30T00:05:00.000Z',
    ),
    'membership',
    'VIEWER membership revocation',
  )
  assert.equal(revokedViewerMembership.status, 'REVOKED')
  assert.equal(revokedViewerMembership.version, 1)
  expectRejected(
    orchestrator.admit({
      user: viewer,
      workspace,
      project,
      membership: revokedViewerMembership,
      request: productionRequest(
        viewer,
        workspace,
        project,
        'request:wp14-revoked',
      ),
    }),
    'MEMBERSHIP_REVOKED',
    'revoked membership production admission',
  )

  const workspaceRepository = createInMemoryWorkspaceRepository()
  const projectRepository = createInMemoryProjectRepository()
  const membershipRepository = createInMemoryWorkspaceMembershipRepository()
  expectSuccess(
    workspaceRepository.save(workspace, null),
    undefined,
    'initial Workspace save',
  )
  expectSuccess(
    projectRepository.save(project, null),
    undefined,
    'initial Project save',
  )
  expectSuccess(
    membershipRepository.save(ownerMembership, null),
    undefined,
    'initial owner Membership save',
  )
  expectSuccess(
    membershipRepository.save(editorMembership, null),
    undefined,
    'initial editor Membership save',
  )
  expectSuccess(
    membershipRepository.save(viewerMembership, null),
    undefined,
    'initial viewer Membership save',
  )
  assert.equal(workspaceRepository.exists(workspace.workspaceId), true)
  assert.equal(projectRepository.exists(project.projectId), true)
  assert.equal(membershipRepository.exists(editorMembership.membershipId), true)

  const loadedWorkspace = expectValue(
    workspaceRepository.getById(workspace.workspaceId),
    'rehydrated Workspace',
  )
  const loadedProject = expectValue(
    projectRepository.getById(project.projectId),
    'rehydrated Project',
  )
  const loadedOwnerMembership = expectValue(
    membershipRepository.getByWorkspaceAndUser(
      workspace.workspaceId,
      owner.userId,
    ),
    'rehydrated owner Membership',
  )
  const loadedEditorMembership = expectValue(
    membershipRepository.getById(editorMembership.membershipId),
    'rehydrated editor Membership',
  )
  assert.notEqual(loadedWorkspace, workspace)
  assert.notEqual(loadedProject, project)
  assert.notEqual(loadedEditorMembership, editorMembership)
  assert.deepEqual(loadedWorkspace, workspace)
  assert.deepEqual(loadedProject, project)
  assert.deepEqual(loadedEditorMembership, editorMembership)

  expectSuccess(
    orchestrator.admit({
      user: editor,
      workspace: loadedWorkspace,
      project: loadedProject,
      membership: loadedEditorMembership,
      request: productionRequest(
        editor,
        loadedWorkspace,
        loadedProject,
        'request:wp14-rehydrated',
      ),
    }),
    undefined,
    'rehydrated Product context production admission',
  )

  const workspaceAuthority = platform.createWorkspaceAuthority()
  const renamedWorkspace = expectSuccess(
    workspaceAuthority.renameWorkspace(
      loadedWorkspace,
      'WP14 Persisted Workspace',
      '2026-08-30T00:06:00.000Z',
    ),
    'workspace',
    'rehydrated Workspace authority mutation',
  )
  expectSuccess(
    workspaceRepository.save(renamedWorkspace, 0),
    undefined,
    'Workspace CAS update',
  )
  const staleWorkspaceUpdate = expectSuccess(
    workspaceAuthority.renameWorkspace(
      workspace,
      'WP14 Stale Workspace',
      '2026-08-30T00:07:00.000Z',
    ),
    'workspace',
    'stale Workspace authority mutation',
  )
  expectRejected(
    workspaceRepository.save(staleWorkspaceUpdate, 0),
    'VERSION_CONFLICT',
    'stale Workspace CAS update',
  )
  assert.equal(
    workspaceRepository.getById(workspace.workspaceId)?.name,
    'WP14 Persisted Workspace',
  )

  const renamedProject = expectSuccess(
    projectAuthority.renameProject(
      loadedProject,
      'WP14 Persisted Project',
      '2026-08-30T00:06:00.000Z',
    ),
    'project',
    'rehydrated Project authority mutation',
  )
  expectSuccess(
    projectRepository.save(renamedProject, 0),
    undefined,
    'Project CAS update',
  )
  const staleProjectUpdate = expectSuccess(
    projectAuthority.renameProject(
      project,
      'WP14 Stale Project',
      '2026-08-30T00:07:00.000Z',
    ),
    'project',
    'stale Project authority mutation',
  )
  expectRejected(
    projectRepository.save(staleProjectUpdate, 0),
    'VERSION_CONFLICT',
    'stale Project CAS update',
  )
  assert.equal(
    projectRepository.getById(project.projectId)?.name,
    'WP14 Persisted Project',
  )

  const changedEditorMembership = expectSuccess(
    membershipAuthority.changeRole(
      loadedWorkspace,
      loadedOwnerMembership,
      loadedEditorMembership,
      'VIEWER',
      '2026-08-30T00:06:00.000Z',
    ),
    'membership',
    'rehydrated Membership authority mutation',
  )
  expectSuccess(
    membershipRepository.save(changedEditorMembership, 0),
    undefined,
    'Membership CAS update',
  )
  const staleMembershipUpdate = expectSuccess(
    membershipAuthority.changeRole(
      workspace,
      ownerMembership,
      editorMembership,
      'OWNER',
      '2026-08-30T00:07:00.000Z',
    ),
    'membership',
    'stale Membership authority mutation',
  )
  expectRejected(
    membershipRepository.save(staleMembershipUpdate, 0),
    'VERSION_CONFLICT',
    'stale Membership CAS update',
  )
  assert.equal(
    membershipRepository.getById(editorMembership.membershipId)?.role,
    'VIEWER',
  )

  expectRejected(
    workspaceAuthority.renameWorkspace(
      Object.freeze({ ...workspace }),
      'Forged Workspace',
      '2026-08-30T00:08:00.000Z',
    ),
    'INVALID_WORKSPACE',
    'forged Workspace authority mutation',
  )
  expectRejected(
    projectAuthority.renameProject(
      Object.freeze({ ...project }),
      'Forged Project',
      '2026-08-30T00:08:00.000Z',
    ),
    'INVALID_PROJECT',
    'forged Project authority mutation',
  )
  expectRejected(
    membershipAuthority.changeRole(
      workspace,
      ownerMembership,
      Object.freeze({ ...editorMembership }),
      'VIEWER',
      '2026-08-30T00:08:00.000Z',
    ),
    'INVALID_MEMBERSHIP',
    'forged Membership authority mutation',
  )
  expectRejected(
    workspaceRepository.save(Object.freeze({ ...workspace }), null),
    'INVALID_SNAPSHOT',
    'forged Workspace repository save',
  )
  expectRejected(
    projectRepository.save(Object.freeze({ ...project }), null),
    'INVALID_SNAPSHOT',
    'forged Project repository save',
  )
  expectRejected(
    membershipRepository.save(Object.freeze({ ...editorMembership }), null),
    'INVALID_SNAPSHOT',
    'forged Membership repository save',
  )

  const mutableWorkspaceRecord = { ...workspace }
  const mutableProjectRecord = { ...project }
  const mutableMembershipRecord = { ...ownerMembership }
  const defensiveWorkspaceRepository = createInMemoryWorkspaceRepository([
    mutableWorkspaceRecord,
  ])
  const defensiveProjectRepository = createInMemoryProjectRepository([
    mutableProjectRecord,
  ])
  const defensiveMembershipRepository =
    createInMemoryWorkspaceMembershipRepository([mutableMembershipRecord])
  mutableWorkspaceRecord.name = 'tampered outside repository'
  mutableProjectRecord.name = 'tampered outside repository'
  mutableMembershipRecord.role = 'VIEWER'
  assert.equal(
    defensiveWorkspaceRepository.getById(workspace.workspaceId)?.name,
    workspace.name,
  )
  assert.equal(
    defensiveProjectRepository.getById(project.projectId)?.name,
    project.name,
  )
  assert.equal(
    defensiveMembershipRepository.getById(ownerMembership.membershipId)?.role,
    'OWNER',
  )
  assert.throws(
    () =>
      createInMemoryWorkspaceRepository([
        { ...workspace, unsupportedField: true },
      ]),
    TypeError,
    'strict WorkspaceRecord validation',
  )
  assert.throws(
    () =>
      createInMemoryProjectRepository([{ ...project, version: -1 }]),
    TypeError,
    'strict ProjectRecord validation',
  )
  assert.throws(
    () =>
      createInMemoryWorkspaceMembershipRepository([
        { ...ownerMembership, membershipId: 'membership:forged' },
      ]),
    TypeError,
    'strict WorkspaceMembershipRecord validation',
  )

  assert.deepEqual(Object.keys(workspaceRepository), ['save', 'getById', 'exists'])
  assert.deepEqual(Object.keys(projectRepository), ['save', 'getById', 'exists'])
  assert.deepEqual(Object.keys(membershipRepository), [
    'save',
    'getById',
    'getByWorkspaceAndUser',
    'exists',
  ])
  assert.equal(workspace.name, 'WP14 Workspace')
  assert.equal(project.name, 'WP14 Project')
  assert.equal(editorMembership.role, 'EDITOR')
  assert.equal(workspace.version, 0)
  assert.equal(project.version, 0)
  assert.equal(editorMembership.version, 0)

  const repositoryUrls = [
    '../src/platform/workspaceRepository.ts',
    '../src/platform/projectRepository.ts',
    '../src/platform/workspaceMembershipRepository.ts',
    '../src/platform/productRecordValidation.ts',
  ]
  const repositorySources = await Promise.all(
    repositoryUrls.map((url) =>
      readFile(new URL(url, import.meta.url), 'utf8'),
    ),
  )
  const repositorySource = repositorySources.join('\n')
  const imports = Array.from(
    repositorySource.matchAll(/from\s+['"]([^'"]+)['"]/g),
    (match) => match[1].toLowerCase(),
  )
  for (const forbiddenImport of [
    '/jobs',
    '/jobinfrastructure',
    '/queue',
    '/worker',
    '/artifacts',
    '/runtime',
  ]) {
    assert.equal(
      imports.some((specifier) => specifier.includes(forbiddenImport)),
      false,
      `Product Repository forbidden import ${forbiddenImport}`,
    )
  }
  assert.doesNotMatch(
    repositorySource,
    /ProductionPlan|ProductionJob|Artifact|RuntimeReference/,
  )
  assert.doesNotMatch(
    repositorySource,
    /renameWorkspace\s*\(|archiveProject\s*\(|changeRole\s*\(|revokeMembership\s*\(/,
  )

  const publicIndexSource = await readFile(
    new URL('../src/platform/index.ts', import.meta.url),
    'utf8',
  )
  assert.doesNotMatch(
    publicIndexSource,
    /export\s+\{[^}]*\b(?:authorize|rehydrate|trust|sign|register)\w*/i,
  )

  console.log('Product Permission / Persistence Validation')
  console.log('A. owner membership creation: PASS')
  console.log('B. membershipId deterministic: PASS')
  console.log('C. owner cannot be downgraded: REJECTED')
  console.log('D. owner cannot be revoked: REJECTED')
  console.log('E. OWNER permissions: PASS')
  console.log('F. EDITOR permissions (archive included): PASS')
  console.log('G. VIEWER permissions restricted to view: PASS')
  console.log('H. EDITOR production admission: PASS')
  console.log('I. VIEWER production admission: REJECTED')
  console.log('J. revoked membership admission: REJECTED')
  console.log('K. Workspace save/load/rehydrate: PASS')
  console.log('L. Project save/load/rehydrate: PASS')
  console.log('M. Membership save/load/rehydrate: PASS')
  console.log('N. rehydrated Workspace accepted by Authority: PASS')
  console.log('O. rehydrated Project accepted by Authority: PASS')
  console.log('P. rehydrated Membership accepted by Authority: PASS')
  console.log('Q. rehydrated Product context production admission: PASS')
  console.log('R. Workspace CAS: PASS')
  console.log('S. stale Workspace CAS: REJECTED')
  console.log('T. Project CAS: PASS')
  console.log('U. stale Project CAS: REJECTED')
  console.log('V. Membership CAS: PASS')
  console.log('W. stale Membership CAS: REJECTED')
  console.log('X. forged Workspace: REJECTED')
  console.log('Y. forged Project: REJECTED')
  console.log('Z. forged Membership: REJECTED')
  console.log('AA. Repository defensive copy: PASS')
  console.log('AB. Repository does not mutate domain state: PASS')
  console.log('AC. Product Repository Job/Artifact/Runtime isolation: PASS')
  console.log('strict persistent record validation: PASS')
  console.log('private trusted rehydration boundary: PASS')
} finally {
  await server.close()
}
