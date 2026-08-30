import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

const PROJECT_REQUEST_KEYS = Object.freeze([
  'requestId',
  'projectId',
  'workspaceId',
  'requestedByUserId',
  'productionIntent',
  'outputSpecification',
])
const PRODUCTION_REQUEST_KEYS = Object.freeze([
  'requestId',
  'generationIntent',
  'outputSpecification',
])
const PLAN_KEYS = Object.freeze(['planId', 'requestId', 'tasks'])
const TASK_KEYS = Object.freeze([
  'taskId',
  'requestId',
  'providerId',
  'generationIntent',
  'outputSpecification',
])
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

function assertDeepFrozen(value, label) {
  if (typeof value !== 'object' || value === null) return

  assert.equal(Object.isFrozen(value), true, `${label} must be immutable`)
  for (const [key, child] of Object.entries(value)) {
    assertDeepFrozen(child, `${label}.${key}`)
  }
}

function expectSuccess(result, label) {
  assert.equal(result.ok, true, `${label} should succeed`)
  assert.deepEqual(
    Object.keys(result),
    ['ok', 'projectId', 'workspaceId', 'requestId', 'plan', 'job'],
    `${label} result envelope`,
  )
  assertDeepFrozen(result, `${label}.result`)
  return result
}

function expectAuthoritySuccess(result, property, label) {
  assert.equal(result.ok, true, `${label} should succeed`)
  assertDeepFrozen(result, `${label}.result`)
  return result[property]
}

function expectRejected(result, expectedCode, label) {
  assert.equal(result.ok, false, `${label} should be rejected`)
  assert.deepEqual(Object.keys(result), ['ok', 'issues'], `${label} envelope`)
  assert.equal('plan' in result, false, `${label} leaked a ProductionPlan`)
  assert.equal('job' in result, false, `${label} leaked a ProductionJob`)
  assert.equal(
    result.issues.some((issue) => issue.code === expectedCode),
    true,
    `${label} should report ${expectedCode}`,
  )
  assertDeepFrozen(result, `${label}.result`)
}

try {
  const platform = await server.ssrLoadModule('/src/platform/index.ts')
  const {
    createDeterministicProductionPlanningBoundary,
    createPlatformUser,
    createProjectAuthority,
    createProjectProductionOrchestrator,
    createWorkspaceAuthority,
    createWorkspaceMembershipAuthority,
  } = platform

  assert.equal(typeof createProjectProductionOrchestrator, 'function')
  assert.equal(typeof createDeterministicProductionPlanningBoundary, 'function')

  const owner = expectAuthoritySuccess(
    createPlatformUser({
      userId: 'user:wp13-owner',
      createdAt: '2026-08-30T00:00:00.000Z',
    }),
    'user',
    'ACTIVE owner creation',
  )
  const disabledUser = expectAuthoritySuccess(
    createPlatformUser({
      userId: 'user:wp13-disabled',
      status: 'DISABLED',
      createdAt: '2026-08-30T00:00:00.000Z',
    }),
    'user',
    'DISABLED user creation',
  )
  const nonOwner = expectAuthoritySuccess(
    createPlatformUser({
      userId: 'user:wp13-non-owner',
      createdAt: '2026-08-30T00:00:00.000Z',
    }),
    'user',
    'non-owner user creation',
  )

  const workspaceAuthority = createWorkspaceAuthority()
  const workspace = expectAuthoritySuccess(
    workspaceAuthority.createWorkspace({
      workspaceId: 'workspace:wp13',
      owner,
      name: 'WP13 Workspace',
      createdAt: '2026-08-30T00:01:00.000Z',
    }),
    'workspace',
    'ACTIVE Workspace creation',
  )
  const projectAuthority = createProjectAuthority()
  const membershipAuthority = createWorkspaceMembershipAuthority()
  const ownerMembership = expectAuthoritySuccess(
    membershipAuthority.createMembership({
      workspace,
      user: owner,
      role: 'OWNER',
      createdAt: '2026-08-30T00:01:00.000Z',
    }),
    'membership',
    'owner membership creation',
  )
  const viewerMembership = expectAuthoritySuccess(
    membershipAuthority.createMembership({
      workspace,
      user: nonOwner,
      role: 'VIEWER',
      createdAt: '2026-08-30T00:01:30.000Z',
      actorMembership: ownerMembership,
    }),
    'membership',
    'viewer membership creation',
  )
  const project = expectAuthoritySuccess(
    projectAuthority.createProject({
      projectId: 'project:wp13',
      workspace,
      name: 'WP13 Project',
      createdAt: '2026-08-30T00:02:00.000Z',
    }),
    'project',
    'ACTIVE Project creation',
  )

  const baseRequest = Object.freeze({
    requestId: 'request:wp13-admission',
    projectId: project.projectId,
    workspaceId: workspace.workspaceId,
    requestedByUserId: owner.userId,
    productionIntent: 'Create a deterministic product-to-production admission',
    outputSpecification: Object.freeze({
      mediaType: 'video',
      format: 'mp4',
    }),
  })
  assert.deepEqual(Object.keys(baseRequest), PROJECT_REQUEST_KEYS)
  assertDeepFrozen(baseRequest, 'ProjectProductionRequest')

  function requestWith(overrides = {}) {
    return {
      requestId: baseRequest.requestId,
      projectId: baseRequest.projectId,
      workspaceId: baseRequest.workspaceId,
      requestedByUserId: baseRequest.requestedByUserId,
      productionIntent: baseRequest.productionIntent,
      outputSpecification: {
        mediaType: baseRequest.outputSpecification.mediaType,
        format: baseRequest.outputSpecification.format,
      },
      ...overrides,
    }
  }

  const deterministicPlanningBoundary =
    createDeterministicProductionPlanningBoundary()
  const mappedProductionRequests = []
  const observingPlanningBoundary = Object.freeze({
    createPlan(productionRequest) {
      mappedProductionRequests.push(productionRequest)
      return deterministicPlanningBoundary.createPlan(productionRequest)
    },
  })
  const orchestrator = createProjectProductionOrchestrator(
    observingPlanningBoundary,
  )
  assert.deepEqual(Object.keys(orchestrator), ['admit'])
  assert.equal(Object.isFrozen(orchestrator), true)
  assert.equal(Object.isFrozen(deterministicPlanningBoundary), true)

  const admissionInput = {
    user: owner,
    workspace,
    project,
    membership: ownerMembership,
    request: baseRequest,
  }
  const admission = expectSuccess(
    orchestrator.admit(admissionInput),
    'ACTIVE owner + ACTIVE Workspace + ACTIVE Project admission',
  )

  assert.equal(mappedProductionRequests.length, 1)
  const productionRequest = mappedProductionRequests[0]
  assert.deepEqual(Object.keys(productionRequest), PRODUCTION_REQUEST_KEYS)
  assert.deepEqual(Object.keys(productionRequest.outputSpecification), [
    'mediaType',
    'format',
  ])
  assert.equal(productionRequest.requestId, baseRequest.requestId)
  assert.equal(productionRequest.generationIntent, baseRequest.productionIntent)
  assert.deepEqual(
    productionRequest.outputSpecification,
    baseRequest.outputSpecification,
  )
  for (const productOnlyField of [
    'projectId',
    'workspaceId',
    'requestedByUserId',
    'productionIntent',
  ]) {
    assert.equal(
      productOnlyField in productionRequest,
      false,
      `ProductionRequest leaked ${productOnlyField}`,
    )
  }
  assertDeepFrozen(productionRequest, 'mapped ProductionRequest')

  assert.equal(admission.projectId, project.projectId)
  assert.equal(admission.workspaceId, workspace.workspaceId)
  assert.equal(admission.requestId, baseRequest.requestId)
  assert.deepEqual(Object.keys(admission.plan), PLAN_KEYS)
  assert.equal(
    admission.plan.planId,
    `production-plan:${baseRequest.requestId}`,
  )
  assert.equal(admission.plan.requestId, baseRequest.requestId)
  assert.equal(admission.plan.tasks.length, 1)
  assert.deepEqual(Object.keys(admission.plan.tasks[0]), TASK_KEYS)
  assert.equal(
    admission.plan.tasks[0].taskId,
    `generation-task:${baseRequest.requestId}`,
  )
  assert.equal(admission.plan.tasks[0].requestId, baseRequest.requestId)
  assert.equal(
    admission.plan.tasks[0].generationIntent,
    baseRequest.productionIntent,
  )
  assert.deepEqual(
    admission.plan.tasks[0].outputSpecification,
    baseRequest.outputSpecification,
  )
  assert.equal('projectId' in admission.plan, false)

  assert.deepEqual(Object.keys(admission.job), JOB_KEYS)
  assert.equal(admission.job.status, 'CREATED')
  assert.equal(admission.job.version, 0)
  assert.equal(admission.job.attemptCount, 0)
  assert.equal(admission.job.maxAttempts, 3)
  assert.equal(admission.job.currentAttemptId, null)
  assert.equal(admission.job.lease, null)
  assert.equal(admission.job.planId, admission.plan.planId)
  assert.equal(admission.job.requestId, admission.plan.requestId)
  assert.equal(
    admission.job.jobId,
    `production-job:${admission.plan.planId}`,
  )
  assert.equal('commandId' in admission.job, false)
  assert.equal('attemptsSummary' in admission.job, false)
  assert.equal('projectId' in admission.job, false)

  const repeatedAdmission = expectSuccess(
    orchestrator.admit(admissionInput),
    'repeated deterministic admission',
  )
  assert.equal(mappedProductionRequests.length, 2)
  assert.deepEqual(repeatedAdmission.plan, admission.plan)
  assert.equal(repeatedAdmission.projectId, admission.projectId)
  assert.equal(repeatedAdmission.workspaceId, admission.workspaceId)
  assert.equal(repeatedAdmission.requestId, admission.requestId)
  assert.equal(repeatedAdmission.job.jobId, admission.job.jobId)
  assert.equal(repeatedAdmission.job.planId, admission.job.planId)
  assert.equal(repeatedAdmission.job.requestId, admission.job.requestId)
  assert.equal(repeatedAdmission.job.status, 'CREATED')

  const wrongPlanIdentityOrchestrator = createProjectProductionOrchestrator(
    Object.freeze({
      createPlan(productionRequest) {
        const validPlan =
          deterministicPlanningBoundary.createPlan(productionRequest)
        return Object.freeze({
          ...validPlan,
          planId: `production-plan:wrong:${productionRequest.requestId}`,
        })
      },
    }),
  )
  expectRejected(
    wrongPlanIdentityOrchestrator.admit(admissionInput),
    'PRODUCTION_PLANNING_FAILED',
    'valid but non-deterministic ProductionPlan identity',
  )

  const archivedWorkspace = expectAuthoritySuccess(
    workspaceAuthority.archiveWorkspace(
      workspace,
      '2026-08-30T00:10:00.000Z',
    ),
    'workspace',
    'Workspace archive',
  )
  const archivedProject = expectAuthoritySuccess(
    projectAuthority.archiveProject(
      project,
      '2026-08-30T00:10:00.000Z',
    ),
    'project',
    'Project archive',
  )
  const otherWorkspace = expectAuthoritySuccess(
    workspaceAuthority.createWorkspace({
      workspaceId: 'workspace:wp13-other',
      owner,
      name: 'Other WP13 Workspace',
      createdAt: '2026-08-30T00:03:00.000Z',
    }),
    'workspace',
    'other Workspace creation',
  )
  const otherProject = expectAuthoritySuccess(
    projectAuthority.createProject({
      projectId: 'project:wp13-other',
      workspace: otherWorkspace,
      name: 'Other WP13 Project',
      createdAt: '2026-08-30T00:04:00.000Z',
    }),
    'project',
    'other Project creation',
  )

  expectRejected(
    orchestrator.admit({
      user: disabledUser,
      workspace,
      project,
      membership: ownerMembership,
      request: requestWith({ requestedByUserId: disabledUser.userId }),
    }),
    'USER_DISABLED',
    'DISABLED user',
  )
  expectRejected(
    orchestrator.admit({
      user: owner,
      workspace: archivedWorkspace,
      project,
      membership: ownerMembership,
      request: requestWith(),
    }),
    'WORKSPACE_ARCHIVED',
    'ARCHIVED Workspace',
  )
  expectRejected(
    orchestrator.admit({
      user: owner,
      workspace,
      project: archivedProject,
      membership: ownerMembership,
      request: requestWith(),
    }),
    'PROJECT_ARCHIVED',
    'ARCHIVED Project',
  )
  expectRejected(
    orchestrator.admit({
      user: owner,
      workspace,
      project,
      membership: ownerMembership,
      request: requestWith({ workspaceId: 'workspace:wrong' }),
    }),
    'WORKSPACE_MISMATCH',
    'wrong request Workspace',
  )
  expectRejected(
    orchestrator.admit({
      user: owner,
      workspace,
      project: otherProject,
      membership: ownerMembership,
      request: requestWith({ projectId: otherProject.projectId }),
    }),
    'WORKSPACE_MISMATCH',
    'Project belonging to another Workspace',
  )
  expectRejected(
    orchestrator.admit({
      user: owner,
      workspace,
      project,
      membership: ownerMembership,
      request: requestWith({ projectId: 'project:wrong' }),
    }),
    'PROJECT_MISMATCH',
    'wrong Project',
  )
  expectRejected(
    orchestrator.admit({
      user: nonOwner,
      workspace,
      project,
      membership: viewerMembership,
      request: requestWith({ requestedByUserId: nonOwner.userId }),
    }),
    'PRODUCTION_PERMISSION_DENIED',
    'VIEWER user',
  )
  expectRejected(
    orchestrator.admit({
      user: Object.freeze({ ...owner }),
      workspace,
      project,
      membership: ownerMembership,
      request: requestWith(),
    }),
    'INVALID_USER',
    'forged User',
  )
  expectRejected(
    orchestrator.admit({
      user: owner,
      workspace: Object.freeze({ ...workspace }),
      project,
      membership: ownerMembership,
      request: requestWith(),
    }),
    'INVALID_WORKSPACE',
    'forged Workspace',
  )
  expectRejected(
    orchestrator.admit({
      user: owner,
      workspace,
      project: Object.freeze({ ...project }),
      membership: ownerMembership,
      request: requestWith(),
    }),
    'INVALID_PROJECT',
    'forged Project',
  )
  expectRejected(
    orchestrator.admit({
      user: owner,
      workspace,
      project,
      membership: Object.freeze({ ...ownerMembership }),
      request: requestWith(),
    }),
    'INVALID_MEMBERSHIP',
    'forged Membership',
  )
  assert.equal(
    mappedProductionRequests.length,
    2,
    'Rejected Product contexts must not reach ProductionPlanningBoundary',
  )

  const [contractSource, planningSource, orchestratorSource, indexSource] =
    await Promise.all([
      readFile(
        new URL(
          '../src/platform/contracts/projectProduction.ts',
          import.meta.url,
        ),
        'utf8',
      ),
      readFile(
        new URL('../src/platform/projectProductionPlanning.ts', import.meta.url),
        'utf8',
      ),
      readFile(
        new URL(
          '../src/platform/projectProductionOrchestrator.ts',
          import.meta.url,
        ),
        'utf8',
      ),
      readFile(new URL('../src/platform/index.ts', import.meta.url), 'utf8'),
    ])

  const requestContractMatch = contractSource.match(
    /export interface ProjectProductionRequest \{([\s\S]*?)\n\}/,
  )
  assert.notEqual(requestContractMatch, null)
  const requestContract = requestContractMatch[1]
  const declaredRequestFields = Array.from(
    requestContract.matchAll(/readonly\s+([A-Za-z_$][\w$]*)\s*:/g),
    (match) => match[1],
  )
  assert.deepEqual(declaredRequestFields, PROJECT_REQUEST_KEYS)
  for (const forbiddenRequestField of [
    'ProviderAdapter',
    'ProductionJob',
    'Artifact',
    'Runtime',
  ]) {
    assert.doesNotMatch(
      requestContract,
      new RegExp(`\\b${forbiddenRequestField}\\b`),
    )
  }

  assert.match(
    indexSource,
    /export \{ createProjectProductionOrchestrator \}/,
  )
  assert.match(
    indexSource,
    /export \{ createDeterministicProductionPlanningBoundary \}/,
  )
  assert.match(
    orchestratorSource,
    /import \{ createProductionJob \} from ['"]\.\.\/jobs['"]/,
  )
  assert.equal(
    orchestratorSource.match(/\bcreateProductionJob\s*\(/g)?.length,
    1,
    'Orchestrator must call the authoritative createProductionJob exactly once',
  )
  assert.match(orchestratorSource, /createProductionJob\(plan\)/)
  assert.doesNotMatch(
    orchestratorSource,
    /createProductionJobStateAuthority|\.transition\s*\(/,
  )

  const wp13Source = [
    contractSource,
    planningSource,
    orchestratorSource,
    indexSource,
  ].join('\n')
  const importSpecifiers = Array.from(
    wp13Source.matchAll(/from\s+['"]([^'"]+)['"]/g),
    (match) => match[1],
  )
  const lowerImportSpecifiers = importSpecifiers.map((specifier) =>
    specifier.toLowerCase(),
  )
  for (const forbiddenImport of [
    '/execution',
    '/providers',
    '/artifacts',
    '/queue',
    '/worker',
    '/runtime',
    '/runtimedata',
    '/jobinfrastructure',
  ]) {
    assert.equal(
      lowerImportSpecifiers.some((specifier) =>
        specifier.includes(forbiddenImport),
      ),
      false,
      `Forbidden Project orchestration import: ${forbiddenImport}`,
    )
  }
  for (const forbiddenLegacyImport of [
    '/production/factory',
    '/production/types/productionjob',
    '/production/state/productionjobstate',
  ]) {
    assert.equal(
      lowerImportSpecifiers.some((specifier) =>
        specifier.includes(forbiddenLegacyImport),
      ),
      false,
      `Forbidden legacy ProductionJob import: ${forbiddenLegacyImport}`,
    )
  }
  assert.equal(
    lowerImportSpecifiers.some(
      (specifier) =>
        specifier === '../production' || specifier === '../../production',
    ),
    false,
    'Project orchestration must not consume the legacy production barrel',
  )
  const jobImports = lowerImportSpecifiers.filter((specifier) =>
    specifier.includes('/jobs'),
  )
  assert.equal(jobImports.length > 0, true, 'Authoritative Job API import missing')
  assert.equal(
    jobImports.every((specifier) => specifier.endsWith('/jobs')),
    true,
    'Job imports must use the src/jobs public API',
  )

  const forbiddenOperations = [
    [
      'ExecutionManager invocation',
      /\bExecutionManager\b|\bexecutionManager\b|\.execute\s*\(/,
    ],
    [
      'Provider invocation',
      /\b(?:ProviderAdapter|ProviderRegistry|createProviderExecution|GenerationPipeline|createGenerationPipeline)\b|\.generate\s*\(/,
    ],
    [
      'Queue or Worker invocation',
      /\b(?:ProductionJobQueue|createProductionJobDispatch|createInMemoryProductionJobQueue|createProductionJobWorker|WorkerBoundary)\b|\.enqueue\s*\(|\.processNext\s*\(/,
    ],
    [
      'Artifact lifecycle invocation',
      /\b(?:ArtifactCreationBoundary|ArtifactLifecycleAuthority|createArtifact|materializeArtifact)\b/,
    ],
    [
      'Runtime invocation',
      /\b(?:RuntimeData|RuntimeDataV2|Renderer|SceneRenderer)\b|\.render\s*\(/,
    ],
    ['retry policy', /\bRetryPolicy\b|\bbackoff\b/i],
    ['random identity', /randomUUID|Math\.random/],
  ]
  for (const [label, pattern] of forbiddenOperations) {
    assert.equal(pattern.test(wp13Source), false, `Forbidden ${label}`)
  }

  console.log('Project Production Orchestration Validation')
  console.log('A. ACTIVE owner + ACTIVE Workspace + ACTIVE Project: PASS')
  console.log('B. ProjectProductionRequest correlation preserved: PASS')
  console.log('C. ProductionRequest created: PASS')
  console.log('D. ProductionPlan created: PASS')
  console.log('E. ProductionJob CREATED: PASS')
  console.log('F. Job uses src/jobs authoritative API: PASS')
  console.log('G. job.planId correlation: PASS')
  console.log('H. job.requestId correlation: PASS')
  console.log('I. deterministic repeated admission: PASS')
  console.log('J. DISABLED user: REJECTED')
  console.log('K. ARCHIVED Workspace: REJECTED')
  console.log('L. ARCHIVED Project: REJECTED')
  console.log('M. wrong Workspace: REJECTED')
  console.log('N. wrong Project: REJECTED')
  console.log('O. VIEWER permission: REJECTED')
  console.log('P. forged User: REJECTED')
  console.log('Q. forged Workspace: REJECTED')
  console.log('R. forged Project: REJECTED')
  console.log('R2. forged Membership: REJECTED')
  console.log('S. ExecutionManager invocation: ABSENT')
  console.log('T. Provider invocation: ABSENT')
  console.log('U. Queue / Worker invocation: ABSENT')
  console.log('V. Artifact lifecycle invocation: ABSENT')
  console.log('W. Runtime invocation: ABSENT')
  console.log('immutable admission boundary: PASS')
  console.log('authoritative ProductionJob exact shape: PASS')
  console.log('deterministic ProductionPlan identity enforcement: PASS')
} finally {
  await server.close()
}
