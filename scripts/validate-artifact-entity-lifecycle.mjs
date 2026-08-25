import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

const ARTIFACT_KEYS = Object.freeze([
  'artifactId',
  'candidateId',
  'generationOutputId',
  'generationResultId',
  'providerId',
  'outputReference',
  'mediaType',
  'format',
  'status',
  'sourceMetadata',
])
const STATUSES = Object.freeze([
  'CREATED',
  'PROCESSING',
  'READY',
  'FAILED',
  'ARCHIVED',
])
const ALLOWED_TRANSITIONS = new Set([
  'CREATED->PROCESSING',
  'PROCESSING->READY',
  'PROCESSING->FAILED',
  'READY->ARCHIVED',
  'FAILED->ARCHIVED',
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

async function readTypeScriptSources(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true })
  const sources = await Promise.all(
    entries.map(async (entry) => {
      const entryUrl = new URL(
        `${entry.name}${entry.isDirectory() ? '/' : ''}`,
        directoryUrl,
      )

      if (entry.isDirectory()) return readTypeScriptSources(entryUrl)
      if (entry.isFile() && entry.name.endsWith('.ts')) {
        return [await readFile(entryUrl, 'utf8')]
      }
      return []
    }),
  )

  return sources.flat()
}

function assertArtifactShape(artifact, expectedStatus, label) {
  assert.deepEqual(Object.keys(artifact), ARTIFACT_KEYS, `${label}: exact fields`)
  assert.equal(artifact.status, expectedStatus, `${label}: status`)
  assert.deepEqual(Object.keys(artifact.sourceMetadata), [
    'taskId',
    'providerTaskId',
  ])

  for (const forbiddenField of [
    'artifactEnvelope',
    'artifactRuntimeReference',
    'runtimeReference',
    'location',
    'validation',
    'storage',
  ]) {
    assert.equal(
      forbiddenField in artifact,
      false,
      `${label}: forbidden field ${forbiddenField}`,
    )
  }

  assertDeepFrozen(artifact, label)
}

function assertProvenancePreserved(artifact, candidate, label) {
  for (const field of [
    'candidateId',
    'generationOutputId',
    'generationResultId',
    'providerId',
    'outputReference',
    'mediaType',
    'format',
  ]) {
    assert.equal(artifact[field], candidate[field], `${label}.${field}`)
  }
  assert.deepEqual(
    artifact.sourceMetadata,
    candidate.sourceMetadata,
    `${label}.sourceMetadata`,
  )
}

function assertMaterializationFailure(result, expectedCode, label) {
  assert.equal(result.ok, false, `${label}: expected rejection`)
  assert.deepEqual(Object.keys(result), ['ok', 'issues'])
  assert.equal('artifact' in result, false, `${label}: partial Artifact leaked`)
  assert.equal(
    result.issues.some((issue) => issue.code === expectedCode),
    true,
    `${label}: expected ${expectedCode}`,
  )
  assertDeepFrozen(result, `${label}.result`)
}

function assertTransitionFailure(result, expectedCode, label) {
  assert.equal(result.ok, false, `${label}: expected rejection`)
  assert.deepEqual(Object.keys(result), ['ok', 'issues'])
  assert.equal('artifact' in result, false, `${label}: partial Artifact leaked`)
  assert.equal(
    result.issues.some((issue) => issue.code === expectedCode),
    true,
    `${label}: expected ${expectedCode}`,
  )
  assertDeepFrozen(result, `${label}.result`)
}

function transitionSuccessfully(authority, artifact, targetStatus, label) {
  const before = cloneSnapshot(artifact)
  const result = authority.transition(artifact, targetStatus)

  assert.equal(result.ok, true, `${label}: expected success`)
  assert.deepEqual(Object.keys(result), ['ok', 'artifact'])
  assert.notEqual(result.artifact, artifact, `${label}: requires a new snapshot`)
  assert.notEqual(
    result.artifact.sourceMetadata,
    artifact.sourceMetadata,
    `${label}: requires copied sourceMetadata`,
  )
  assertArtifactShape(result.artifact, targetStatus, `${label}.artifact`)
  assert.equal(result.artifact.artifactId, artifact.artifactId)
  assert.equal(result.artifact.candidateId, artifact.candidateId)
  assert.equal(result.artifact.generationOutputId, artifact.generationOutputId)
  assert.equal(result.artifact.generationResultId, artifact.generationResultId)
  assert.equal(result.artifact.providerId, artifact.providerId)
  assert.equal(result.artifact.outputReference, artifact.outputReference)
  assert.equal(result.artifact.mediaType, artifact.mediaType)
  assert.equal(result.artifact.format, artifact.format)
  assert.deepEqual(result.artifact.sourceMetadata, artifact.sourceMetadata)
  assert.deepEqual(artifact, before, `${label}: input snapshot mutated`)
  assertDeepFrozen(result, `${label}.result`)

  return result.artifact
}

const generationOutput = Object.freeze({
  id: 'generation-output:mock-video:provider-task-001',
  generationResultId:
    'generation-result:mock-video:provider-task-001',
  providerId: 'mock-video',
  outputReference: 'provider://outputs/video-001',
  metadata: Object.freeze({
    mediaType: 'video',
    format: 'mp4',
    taskId: 'task-001',
    providerTaskId: 'provider-task-001',
  }),
})

try {
  const artifacts = await server.ssrLoadModule('/src/artifacts/index.ts')
  const entityBoundary = await server.ssrLoadModule(
    '/src/artifacts/entities/index.ts',
  )
  const lifecycleBoundary = await server.ssrLoadModule(
    '/src/artifacts/lifecycle/index.ts',
  )

  assert.equal(typeof artifacts.createArtifactCreationBoundary, 'function')
  assert.equal(typeof artifacts.materializeArtifact, 'function')
  assert.equal(typeof artifacts.createArtifactLifecycleAuthority, 'function')
  assert.deepEqual(Object.keys(entityBoundary).sort(), ['materializeArtifact'])
  assert.deepEqual(Object.keys(lifecycleBoundary).sort(), [
    'createArtifactLifecycleAuthority',
  ])

  const creationBoundary = artifacts.createArtifactCreationBoundary()
  const ingestionResult =
    await creationBoundary.createArtifactCandidate(generationOutput)
  assert.equal(ingestionResult.ok, true)
  const candidate = ingestionResult.candidate

  const firstMaterialization = artifacts.materializeArtifact(candidate)
  const secondMaterialization = artifacts.materializeArtifact(candidate)

  assert.equal(firstMaterialization.ok, true)
  assert.equal(secondMaterialization.ok, true)
  assert.deepEqual(Object.keys(firstMaterialization), ['ok', 'artifact'])

  const created = firstMaterialization.artifact
  assertArtifactShape(created, 'CREATED', 'createdArtifact')
  assert.equal(created.artifactId, `artifact:${candidate.candidateId}`)
  assert.equal(created.artifactId, secondMaterialization.artifact.artifactId)
  assert.deepEqual(created, secondMaterialization.artifact)
  assert.notEqual(created, secondMaterialization.artifact)
  assert.notEqual(created, candidate)
  assert.notEqual(created.sourceMetadata, candidate.sourceMetadata)
  assertProvenancePreserved(created, candidate, 'createdArtifact')
  assertDeepFrozen(firstMaterialization, 'firstMaterialization')
  assertDeepFrozen(secondMaterialization, 'secondMaterialization')

  assert.throws(() => {
    created.status = 'READY'
  }, TypeError)
  assert.throws(() => {
    created.sourceMetadata.taskId = 'mutated-task'
  }, TypeError)
  assert.equal(created.status, 'CREATED')
  assert.equal(created.sourceMetadata.taskId, candidate.sourceMetadata.taskId)

  const invalidMaterializationCases = [
    [null, 'INVALID_ARTIFACT_CANDIDATE', 'non-object Candidate'],
    [
      { ...candidate, providerNativeResponse: {} },
      'INVALID_ARTIFACT_CANDIDATE',
      'provider response leakage',
    ],
    [
      { ...candidate, candidateId: 'artifact-candidate:tampered' },
      'INVALID_CANDIDATE_ID',
      'tampered Candidate identity',
    ],
    [
      {
        ...candidate,
        sourceMetadata: {
          ...candidate.sourceMetadata,
          storageLocation: 'local-file://forbidden',
        },
      },
      'INVALID_SOURCE_METADATA',
      'storage metadata leakage',
    ],
    [
      { ...candidate, outputReference: '  ' },
      'INVALID_OUTPUT_REFERENCE',
      'missing output reference',
    ],
    [
      { ...candidate, mediaType: 'audio' },
      'INVALID_MEDIA_TYPE',
      'invalid media type',
    ],
    [
      { ...candidate, format: '\t' },
      'INVALID_FORMAT',
      'missing media format',
    ],
    [
      {
        ...candidate,
        sourceMetadata: { ...candidate.sourceMetadata, taskId: '' },
      },
      'INVALID_SOURCE_METADATA',
      'missing task provenance',
    ],
    [
      {
        ...candidate,
        sourceMetadata: { ...candidate.sourceMetadata, providerTaskId: '' },
      },
      'INVALID_SOURCE_METADATA',
      'missing provider task provenance',
    ],
  ]

  for (const [input, expectedCode, label] of invalidMaterializationCases) {
    assertMaterializationFailure(
      artifacts.materializeArtifact(input),
      expectedCode,
      label,
    )
  }

  const authority = artifacts.createArtifactLifecycleAuthority()
  assert.deepEqual(Object.keys(authority), ['transition'])
  assert.equal(Object.isFrozen(authority), true)

  const processingForReady = transitionSuccessfully(
    authority,
    created,
    'PROCESSING',
    'CREATED -> PROCESSING (ready branch)',
  )
  const ready = transitionSuccessfully(
    authority,
    processingForReady,
    'READY',
    'PROCESSING -> READY',
  )
  const archivedFromReady = transitionSuccessfully(
    authority,
    ready,
    'ARCHIVED',
    'READY -> ARCHIVED',
  )

  const processingForFailure = transitionSuccessfully(
    authority,
    created,
    'PROCESSING',
    'CREATED -> PROCESSING (failure branch)',
  )
  const failed = transitionSuccessfully(
    authority,
    processingForFailure,
    'FAILED',
    'PROCESSING -> FAILED',
  )
  const archivedFromFailed = transitionSuccessfully(
    authority,
    failed,
    'ARCHIVED',
    'FAILED -> ARCHIVED',
  )

  assert.equal(ready.status, 'READY')
  assert.equal('runtimeReference' in ready, false)
  assert.equal('artifactRuntimeReference' in ready, false)
  assert.deepEqual(archivedFromReady, archivedFromFailed)

  const snapshots = Object.freeze({
    CREATED: created,
    PROCESSING: processingForReady,
    READY: ready,
    FAILED: failed,
    ARCHIVED: archivedFromReady,
  })
  let allowedCount = 0
  let rejectedCount = 0

  for (const currentStatus of STATUSES) {
    for (const targetStatus of STATUSES) {
      const source = snapshots[currentStatus]
      const before = cloneSnapshot(source)
      const edge = `${currentStatus}->${targetStatus}`
      const result = authority.transition(source, targetStatus)

      if (ALLOWED_TRANSITIONS.has(edge)) {
        allowedCount += 1
        assert.equal(result.ok, true, `${edge}: expected allowed transition`)
        assertArtifactShape(result.artifact, targetStatus, `${edge}.artifact`)
        assert.notEqual(result.artifact, source)
        assertDeepFrozen(result, `${edge}.result`)
      } else {
        rejectedCount += 1
        assertTransitionFailure(result, 'INVALID_TRANSITION', edge)
      }

      assert.deepEqual(source, before, `${edge}: source snapshot mutated`)
    }
  }

  assert.equal(allowedCount, 5)
  assert.equal(rejectedCount, 20)

  for (const targetStatus of STATUSES) {
    assertTransitionFailure(
      authority.transition(archivedFromReady, targetStatus),
      'INVALID_TRANSITION',
      `ARCHIVED terminal -> ${targetStatus}`,
    )
  }

  const mutableForgedArtifact = {
    ...created,
    status: 'PROCESSING',
    sourceMetadata: { ...created.sourceMetadata },
  }
  assertTransitionFailure(
    authority.transition(mutableForgedArtifact, 'READY'),
    'INVALID_ARTIFACT',
    'mutable forged Artifact',
  )

  const frozenForgedReadyArtifact = Object.freeze({
    ...created,
    status: 'READY',
    sourceMetadata: Object.freeze({ ...created.sourceMetadata }),
  })
  assertTransitionFailure(
    authority.transition(frozenForgedReadyArtifact, 'ARCHIVED'),
    'INVALID_ARTIFACT',
    'deep-frozen forged READY Artifact',
  )

  const invalidCurrentStatusArtifact = Object.freeze({
    ...created,
    status: 'UNKNOWN',
    sourceMetadata: Object.freeze({ ...created.sourceMetadata }),
  })
  assertTransitionFailure(
    authority.transition(invalidCurrentStatusArtifact, 'PROCESSING'),
    'INVALID_CURRENT_STATUS',
    'invalid current status',
  )
  assertTransitionFailure(
    authority.transition(created, 'UNKNOWN'),
    'INVALID_TARGET_STATUS',
    'invalid target status',
  )
  assertTransitionFailure(
    authority.transition(created, 'RETRYING'),
    'INVALID_TARGET_STATUS',
    'retry status is outside WP06',
  )

  const productionArtifactContractSource = await readFile(
    new URL(
      '../src/artifacts/entities/productionArtifact.ts',
      import.meta.url,
    ),
    'utf8',
  )
  const statusContractMatch = productionArtifactContractSource.match(
    /export type ProductionArtifactStatus =([\s\S]*?)\n\nexport interface/,
  )
  assert.notEqual(statusContractMatch, null, 'ProductionArtifactStatus contract')
  const declaredStatuses = Array.from(
    statusContractMatch[1].matchAll(/'([^']+)'/g),
    (match) => match[1],
  )
  assert.deepEqual(declaredStatuses, STATUSES)

  const [entitySources, lifecycleSources] = await Promise.all([
    readTypeScriptSources(
      new URL('../src/artifacts/entities/', import.meta.url),
    ),
    readTypeScriptSources(
      new URL('../src/artifacts/lifecycle/', import.meta.url),
    ),
  ])
  const wp06ImplementationSources = [...entitySources, ...lifecycleSources]
  const wp06ImplementationSource = wp06ImplementationSources.join('\n')
  const allProductionSources = await readTypeScriptSources(
    new URL('../src/', import.meta.url),
  )
  const snapshotAuthorityImporters = allProductionSources.filter((source) =>
    /from\s+['"][^'"]*productionArtifactSnapshot['"]/.test(source),
  )
  assert.equal(snapshotAuthorityImporters.length, 4)
  assert.equal(
    snapshotAuthorityImporters.some((source) =>
      source.includes('export function materializeArtifact'),
    ),
    true,
  )
  assert.equal(
    snapshotAuthorityImporters.some((source) =>
      source.includes('export function createArtifactLifecycleAuthority'),
    ),
    true,
  )
  assert.equal(
    snapshotAuthorityImporters.some((source) =>
      source.includes('function rehydrateProductionArtifact'),
    ),
    true,
  )
  assert.equal(
    snapshotAuthorityImporters.some((source) =>
      source.includes('createArtifactRuntimePublicationBoundary'),
    ),
    true,
  )
  const forbiddenImplementationPatterns = [
    ['Stage3 ArtifactEnvelope reuse', /\bArtifactEnvelope\b/],
    ['Runtime integration', /runtime/i],
    ['Renderer integration', /renderer/i],
    ['filesystem access', /node:fs/i],
    ['file operation', /(?:writeFile|copyFile|createWriteStream)/i],
    ['external network call', /(?:fetch|XMLHttpRequest|WebSocket)/i],
    ['random identity', /randomUUID/i],
    ['repository implementation', /repository/i],
    ['database implementation', /database/i],
    ['storage implementation', /storage/i],
    ['media transfer', /(?:upload|download)/i],
    ['queue infrastructure', /queue/i],
    ['worker infrastructure', /worker/i],
    ['retry policy', /retry/i],
    ['scheduler infrastructure', /scheduler/i],
  ]

  for (const [label, pattern] of forbiddenImplementationPatterns) {
    assert.equal(
      pattern.test(wp06ImplementationSource),
      false,
      `Forbidden WP06 dependency or operation: ${label}`,
    )
  }

  console.log('Artifact Entity & Lifecycle Authority validation passed')
  console.log('candidateToProductionArtifact = PASS')
  console.log('stableArtifactIdentity = PASS')
  console.log('candidateProvenancePreserved = PASS')
  console.log('initialCreatedStatus = PASS')
  console.log('artifactDeepFreeze = PASS')
  console.log('allowedTransitionMatrix = PASS (5/5)')
  console.log('rejectedTransitionMatrix = PASS (20/20)')
  console.log('originalSnapshotMutation = ABSENT')
  console.log('forgedSnapshotAuthorityBypass = REJECTED')
  console.log('internalSnapshotSignerImportBoundary = PASS')
  console.log('archivedTerminalState = PASS')
  console.log('runtimeReferenceCreation = ABSENT (WP06 scope)')
  console.log('storageImplementation = ABSENT (WP06 scope)')
} finally {
  await server.close()
}
