import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

function expectSuccess(result, label) {
  assert.equal(result.ok, true, `${label} should succeed`)
  return result
}

function expectRejected(result, code, label) {
  assert.equal(result.ok, false, `${label} should be rejected`)
  assert.equal(result.issues[0]?.code, code, `${label} rejection code`)
  assert.equal(Object.isFrozen(result), true, `${label} result immutable`)
  assert.equal(Object.isFrozen(result.issues), true, `${label} issues immutable`)
}

function assertFrozen(value, label) {
  assert.equal(Object.isFrozen(value), true, `${label} must be immutable`)
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(path) : [path]
  }))
  return files.flat().filter((path) => path.endsWith('.ts'))
}

try {
  const platform = await server.ssrLoadModule('/src/platform/index.ts')
  const {
    createPlatformUser,
    createProjectAuthority,
    createWorkspaceAuthority,
  } = platform

  const createdUser = expectSuccess(createPlatformUser({
    userId: 'user:wp12-owner',
    createdAt: '2026-08-30T00:00:00.000Z',
  }), 'PlatformUser creation')
  const user = createdUser.user
  assert.deepEqual(Object.keys(user), ['userId', 'status', 'createdAt'])
  assert.equal(user.status, 'ACTIVE')

  const workspaceAuthority = createWorkspaceAuthority()
  const createdWorkspace = expectSuccess(workspaceAuthority.createWorkspace({
    workspaceId: 'workspace:wp12',
    owner: user,
    name: 'WP12 Workspace',
    createdAt: '2026-08-30T00:01:00.000Z',
  }), 'Workspace creation')
  const workspace = createdWorkspace.workspace
  assert.deepEqual(Object.keys(workspace), [
    'workspaceId', 'ownerUserId', 'name', 'status', 'version', 'createdAt', 'updatedAt',
  ])
  assert.equal(workspace.ownerUserId, user.userId)
  assert.equal(workspace.version, 0)

  const renamedWorkspace = expectSuccess(workspaceAuthority.renameWorkspace(
    workspace,
    'Renamed Workspace',
    '2026-08-30T00:02:00.000Z',
  ), 'Workspace rename').workspace
  assert.equal(renamedWorkspace.name, 'Renamed Workspace')
  assert.equal(renamedWorkspace.ownerUserId, user.userId)
  assert.equal(renamedWorkspace.version, 1)

  const projectAuthority = createProjectAuthority()
  const createdProject = expectSuccess(projectAuthority.createProject({
    projectId: 'project:wp12',
    workspace: renamedWorkspace,
    name: 'WP12 Project',
    createdAt: '2026-08-30T00:03:00.000Z',
  }), 'Project creation').project
  assert.deepEqual(Object.keys(createdProject), [
    'projectId', 'workspaceId', 'name', 'status', 'version', 'createdAt', 'updatedAt',
  ])
  assert.equal(createdProject.workspaceId, renamedWorkspace.workspaceId)
  assert.equal(createdProject.version, 0)

  const renamedProject = expectSuccess(projectAuthority.renameProject(
    createdProject,
    'Renamed Project',
    '2026-08-30T00:04:00.000Z',
  ), 'Project rename').project
  assert.equal(renamedProject.name, 'Renamed Project')
  assert.equal(renamedProject.workspaceId, renamedWorkspace.workspaceId)
  assert.equal(renamedProject.version, 1)

  const archivedProject = expectSuccess(projectAuthority.archiveProject(
    renamedProject,
    '2026-08-30T00:05:00.000Z',
  ), 'Project archive').project
  assert.equal(archivedProject.status, 'ARCHIVED')
  assert.equal(archivedProject.version, 2)
  expectRejected(projectAuthority.renameProject(
    archivedProject,
    'Forbidden Rename',
    '2026-08-30T00:06:00.000Z',
  ), 'PROJECT_ARCHIVED', 'Archived Project mutation')

  const archivedWorkspace = expectSuccess(workspaceAuthority.archiveWorkspace(
    renamedWorkspace,
    '2026-08-30T00:05:00.000Z',
  ), 'Workspace archive').workspace
  assert.equal(archivedWorkspace.status, 'ARCHIVED')
  assert.equal(archivedWorkspace.version, 2)
  assert.equal(archivedWorkspace.ownerUserId, user.userId)
  expectRejected(projectAuthority.createProject({
    projectId: 'project:forbidden',
    workspace: archivedWorkspace,
    name: 'Forbidden Project',
    createdAt: '2026-08-30T00:06:00.000Z',
  }), 'WORKSPACE_ARCHIVED', 'Archived Workspace project creation')

  const forgedWorkspace = { ...workspace }
  expectRejected(workspaceAuthority.renameWorkspace(
    forgedWorkspace,
    'Forged Rename',
    '2026-08-30T00:07:00.000Z',
  ), 'INVALID_WORKSPACE', 'Forged Workspace mutation')
  expectRejected(projectAuthority.createProject({
    projectId: 'project:forged-workspace',
    workspace: forgedWorkspace,
    name: 'Forged Workspace Project',
    createdAt: '2026-08-30T00:07:00.000Z',
  }), 'INVALID_WORKSPACE', 'Forged Workspace project creation')

  const forgedProject = { ...createdProject }
  expectRejected(projectAuthority.renameProject(
    forgedProject,
    'Forged Rename',
    '2026-08-30T00:07:00.000Z',
  ), 'INVALID_PROJECT', 'Forged Project mutation')

  for (const [snapshot, label] of [
    [user, 'PlatformUser'],
    [workspace, 'Workspace'],
    [renamedWorkspace, 'Renamed Workspace'],
    [archivedWorkspace, 'Archived Workspace'],
    [createdProject, 'Project'],
    [renamedProject, 'Renamed Project'],
    [archivedProject, 'Archived Project'],
  ]) assertFrozen(snapshot, label)

  for (const field of ['productionPlan', 'ProductionPlan', 'productionJob', 'ProductionJob']) {
    assert.equal(field in createdProject, false, `Project excludes ${field}`)
  }

  const files = await sourceFiles(fileURLToPath(new URL('../src/platform', import.meta.url)))
  const sources = await Promise.all(files.map((file) => readFile(file, 'utf8')))
  const imports = sources.join('\n').matchAll(/from\s+['"]([^'"]+)['"]/g)
  const specifiers = [...imports].map((match) => match[1].toLowerCase())
  for (const forbidden of [
    'provider', 'runtime', 'executionmanager', 'queue', 'worker',
    'retrypolicy', 'artifact', 'generationpipeline',
  ]) {
    assert.equal(
      specifiers.some((specifier) => specifier.includes(forbidden)),
      false,
      `Product Layer cannot import ${forbidden}`,
    )
  }
  const publicApi = Object.keys(platform).map((name) => name.toLowerCase())
  for (const forbidden of ['trust', 'sign', 'register', 'rehydrate', 'authorize']) {
    assert.equal(
      publicApi.some((name) => name.includes(forbidden)),
      false,
      `Public API cannot expose ${forbidden}`,
    )
  }

  console.log('Product Platform Authority Validation')
  console.log('A. PlatformUser creation: PASS')
  console.log('B. Workspace creation: PASS')
  console.log('C. Workspace owner preserved: PASS')
  console.log('D. Workspace rename: PASS')
  console.log('E. Workspace archive: PASS')
  console.log('F. Workspace version increments: PASS')
  console.log('G. Project creation under Workspace: PASS')
  console.log('H. Project workspaceId preserved: PASS')
  console.log('I. Project rename: PASS')
  console.log('J. Project archive: PASS')
  console.log('K. Project version increments: PASS')
  console.log('L. Archived Workspace cannot accept new Project: REJECTED')
  console.log('M. Archived Project cannot mutate: REJECTED')
  console.log('N. Forged Workspace: REJECTED')
  console.log('O. Forged Project: REJECTED')
  console.log('P. Snapshots immutable: PASS')
  console.log('Q. Project excludes ProductionPlan: PASS')
  console.log('R. Project excludes ProductionJob: PASS')
  console.log('S. Product Layer has no Provider dependency: PASS')
  console.log('T. Product Layer has no Runtime dependency: PASS')
} finally {
  await server.close()
}
