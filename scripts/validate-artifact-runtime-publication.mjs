import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

const REFERENCE_KEYS = Object.freeze([
  'artifactId',
  'mediaType',
  'format',
  'resourceReference',
])
const FORBIDDEN_REFERENCE_FIELDS = Object.freeze([
  'providerId',
  'providerTaskId',
  'taskId',
  'candidateId',
  'generationOutputId',
  'generationResultId',
  'status',
  'repository',
  'record',
  'storage',
  'sourceMetadata',
  'trusted',
  'trustMarker',
  'lifecycle',
  'providerNativeResponse',
])

function assertDeepFrozen(value, label) {
  if (typeof value !== 'object' || value === null) return

  assert.equal(Object.isFrozen(value), true, `${label} must be frozen`)
  for (const [key, child] of Object.entries(value)) {
    assertDeepFrozen(child, `${label}.${key}`)
  }
}

function assertPublicationFailure(result, expectedCode, label) {
  assert.equal(result.ok, false, `${label}: expected rejection`)
  assert.deepEqual(Object.keys(result), ['ok', 'issues'])
  assert.equal('reference' in result, false, `${label}: reference leaked`)
  assert.equal(
    result.issues.some((issue) => issue.code === expectedCode),
    true,
    `${label}: expected ${expectedCode}`,
  )
  assertDeepFrozen(result, `${label}.result`)
}

function transitionSuccessfully(authority, artifact, targetStatus, label) {
  const result = authority.transition(artifact, targetStatus)
  assert.equal(result.ok, true, `${label}: expected success`)
  return result.artifact
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

const generationOutput = Object.freeze({
  id: 'generation-output:mock-video:provider-task-001',
  generationResultId: 'generation-result:mock-video:provider-task-001',
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
  const publicationModule = await server.ssrLoadModule(
    '/src/artifacts/runtime/productionArtifactRuntimePublication.ts',
  )

  assert.equal(
    typeof artifacts.createArtifactRuntimePublicationBoundary,
    'function',
  )
  assert.deepEqual(Object.keys(publicationModule), [
    'createArtifactRuntimePublicationBoundary',
  ])
  for (const forbiddenTrustCapability of [
    'trustArtifact',
    'registerArtifact',
    'signArtifact',
    'createAuthorizedCreatedProductionArtifactSnapshot',
    'createAuthorizedRehydratedProductionArtifactSnapshot',
    'createAuthorizedTransitionedProductionArtifactSnapshot',
  ]) {
    assert.equal(
      forbiddenTrustCapability in artifacts,
      false,
      `Public trust bypass is forbidden: ${forbiddenTrustCapability}`,
    )
  }

  const creationBoundary = artifacts.createArtifactCreationBoundary()
  const ingestion = await creationBoundary.createArtifactCandidate(
    generationOutput,
  )
  assert.equal(ingestion.ok, true)

  const materialization = artifacts.materializeArtifact(ingestion.candidate)
  assert.equal(materialization.ok, true)
  const created = materialization.artifact

  const lifecycleAuthority = artifacts.createArtifactLifecycleAuthority()
  const processingForReady = transitionSuccessfully(
    lifecycleAuthority,
    created,
    'PROCESSING',
    'CREATED -> PROCESSING (ready branch)',
  )
  const ready = transitionSuccessfully(
    lifecycleAuthority,
    processingForReady,
    'READY',
    'PROCESSING -> READY',
  )
  const archived = transitionSuccessfully(
    lifecycleAuthority,
    ready,
    'ARCHIVED',
    'READY -> ARCHIVED',
  )
  const processingForFailure = transitionSuccessfully(
    lifecycleAuthority,
    created,
    'PROCESSING',
    'CREATED -> PROCESSING (failure branch)',
  )
  const failed = transitionSuccessfully(
    lifecycleAuthority,
    processingForFailure,
    'FAILED',
    'PROCESSING -> FAILED',
  )

  const publicationBoundary =
    artifacts.createArtifactRuntimePublicationBoundary()
  assert.deepEqual(Object.keys(publicationBoundary), ['publish'])
  assert.equal(Object.isFrozen(publicationBoundary), true)

  const publication = publicationBoundary.publish(ready)
  assert.equal(publication.ok, true)
  assert.deepEqual(Object.keys(publication), ['ok', 'reference'])
  assert.deepEqual(Object.keys(publication.reference), REFERENCE_KEYS)
  assert.equal(publication.reference.artifactId, ready.artifactId)
  assert.equal(publication.reference.mediaType, ready.mediaType)
  assert.equal(publication.reference.format, ready.format)
  assert.equal(
    publication.reference.resourceReference,
    ready.outputReference,
  )
  assertDeepFrozen(publication, 'readyPublication')

  assert.throws(() => {
    publication.reference.resourceReference = 'mutated://reference'
  }, TypeError)
  assert.equal(
    publication.reference.resourceReference,
    generationOutput.outputReference,
  )

  for (const forbiddenField of FORBIDDEN_REFERENCE_FIELDS) {
    assert.equal(
      forbiddenField in publication.reference,
      false,
      `Runtime Reference leaked ${forbiddenField}`,
    )
  }

  for (const [status, artifact] of Object.entries({
    CREATED: created,
    PROCESSING: processingForReady,
    FAILED: failed,
    ARCHIVED: archived,
  })) {
    assertPublicationFailure(
      publicationBoundary.publish(artifact),
      'ARTIFACT_NOT_READY',
      `trusted ${status}`,
    )
  }

  const forgedReady = {
    ...ready,
    sourceMetadata: { ...ready.sourceMetadata },
  }
  assertPublicationFailure(
    publicationBoundary.publish(forgedReady),
    'INVALID_PRODUCTION_ARTIFACT',
    'mutable forged READY Artifact',
  )

  const frozenForgedReady = Object.freeze({
    ...ready,
    sourceMetadata: Object.freeze({ ...ready.sourceMetadata }),
  })
  assertPublicationFailure(
    publicationBoundary.publish(frozenForgedReady),
    'UNTRUSTED_PRODUCTION_ARTIFACT',
    'deep-frozen forged READY Artifact',
  )

  const frozenTamperedReady = Object.freeze({
    ...ready,
    artifactId: `artifact:tampered:${ready.candidateId}`,
    sourceMetadata: Object.freeze({ ...ready.sourceMetadata }),
  })
  assertPublicationFailure(
    publicationBoundary.publish(frozenTamperedReady),
    'UNTRUSTED_PRODUCTION_ARTIFACT',
    'deep-frozen identity-tampered READY Artifact',
  )

  const repeatedPublication = publicationBoundary.publish(ready)
  assert.equal(repeatedPublication.ok, true)
  assert.deepEqual(repeatedPublication.reference, publication.reference)

  const repository = artifacts.createInMemoryArtifactRepository()
  await repository.save(ready)
  const rehydratedReady = await repository.getById(ready.artifactId)
  assert.notEqual(rehydratedReady, null)
  assert.notEqual(rehydratedReady, ready)
  assert.equal(rehydratedReady.status, 'READY')

  const rehydratedPublication = publicationBoundary.publish(rehydratedReady)
  assert.equal(rehydratedPublication.ok, true)
  assert.deepEqual(
    rehydratedPublication.reference,
    publication.reference,
  )
  assertDeepFrozen(rehydratedPublication, 'rehydratedReadyPublication')

  const publicationSource = await readFile(
    new URL(
      '../src/artifacts/runtime/productionArtifactRuntimePublication.ts',
      import.meta.url,
    ),
    'utf8',
  )
  const runtimeReferenceStart = publicationSource.indexOf(
    'export interface ProductionArtifactRuntimeReference',
  )
  const publicationIssueStart = publicationSource.indexOf(
    'export type ProductionArtifactRuntimePublicationIssueCode',
  )
  const runtimeReferenceContract = publicationSource.slice(
    runtimeReferenceStart,
    publicationIssueStart,
  )

  assert.notEqual(runtimeReferenceStart, -1)
  assert.notEqual(publicationIssueStart, -1)
  for (const field of REFERENCE_KEYS) {
    assert.match(runtimeReferenceContract, new RegExp(`readonly ${field}:`))
  }
  for (const forbiddenField of FORBIDDEN_REFERENCE_FIELDS) {
    assert.doesNotMatch(
      runtimeReferenceContract,
      new RegExp(`\\b${forbiddenField}\\b`, 'i'),
    )
  }
  assert.match(
    publicationSource,
    /isAuthorizedProductionArtifactSnapshot/,
  )
  assert.match(publicationSource, /hasValidProvenance/)
  assert.match(publicationSource, /value\.status !== 'READY'/)
  assert.match(
    publicationSource,
    /resourceReference: value\.outputReference/,
  )

  for (const [label, pattern] of [
    ['Provider dependency', /from\s+['"][^'"]*(?:provider|generation)/i],
    ['Repository dependency', /from\s+['"][^'"]*repository/i],
    ['Storage dependency', /from\s+['"][^'"]*storage/i],
    ['Lifecycle dependency', /from\s+['"][^'"]*lifecycle/i],
    ['Runtime implementation dependency', /from\s+['"][^'"]*\.\.\/\.\.\/runtime(?:\/|['"])/i],
    ['RuntimeData dependency', /from\s+['"][^'"]*runtimeData/i],
    ['Renderer dependency', /from\s+['"][^'"]*renderer/i],
    ['filesystem operation', /node:fs|writeFile|createWriteStream/],
    ['network operation', /fetch\s*\(|XMLHttpRequest|WebSocket/],
    ['random reference identity', /randomUUID|Math\.random/],
    ['media transfer', /\bupload\b|\bdownload\b/i],
    ['database', /\bdatabase\b|PostgreSQL|SQLite|\bSQL\b/i],
    ['object storage implementation', /\bS3\b|\bOSS\b|\bCOS\b/],
    ['queue or worker', /\bqueue\b|\bworker\b/i],
    ['retry or scheduler', /\bretry\b|\bscheduler\b/i],
    ['billing', /\bbilling\b/i],
    ['provider-specific resource semantics', /provider:\/\/|kling|runway|openai/i],
  ]) {
    assert.equal(
      pattern.test(publicationSource),
      false,
      `Forbidden publication capability: ${label}`,
    )
  }

  const [runtimeSources, runtimeDataSources, rendererSource] =
    await Promise.all([
      readTypeScriptSources(new URL('../src/runtime/', import.meta.url)),
      readTypeScriptSources(new URL('../src/runtimeData/', import.meta.url)),
      readFile(
        new URL('../src/utils/sceneRenderer.tsx', import.meta.url),
        'utf8',
      ),
    ])
  const frozenRuntimeSource = [
    ...runtimeSources,
    ...runtimeDataSources,
    rendererSource,
  ].join('\n')
  assert.doesNotMatch(
    frozenRuntimeSource,
    /ProductionArtifactRuntimeReference|createArtifactRuntimePublicationBoundary/,
  )

  assert.equal(typeof artifacts.createArtifactRuntimeReference, 'function')
  assert.equal(
    typeof artifacts.createArtifactRuntimePublicationAdapter,
    'function',
  )

  console.log('Artifact Runtime Publication validation passed')
  console.log('trustedReadyPublication = PASS')
  console.log('minimalRuntimeReferenceContract = PASS')
  console.log('runtimeReferenceDeepFreeze = PASS')
  console.log('nonReadyTrustedStatuses = REJECTED (4/4)')
  console.log('forgedReadyArtifact = REJECTED')
  console.log('deepFrozenForgedReadyArtifact = REJECTED')
  console.log('trustedRepositoryRehydration = PASS')
  console.log('repeatedPublicationStability = PASS')
  console.log('providerRepositoryStorageIsolation = PASS')
  console.log('runtimeMutation = ABSENT')
  console.log('stage3LegacyRuntimeReference = PRESERVED')
} finally {
  await server.close()
}
