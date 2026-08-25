import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

function assertDeepFrozen(value, label) {
  if (typeof value !== 'object' || value === null) return

  assert.equal(Object.isFrozen(value), true, `${label} must be frozen`)
  for (const [key, child] of Object.entries(value)) {
    assertDeepFrozen(child, `${label}.${key}`)
  }
}

function assertLifecycleRejected(result, label) {
  assert.equal(result.ok, false, `${label}: expected rejection`)
  assert.equal(
    result.issues.some((issue) => issue.code === 'INVALID_ARTIFACT'),
    true,
    `${label}: expected INVALID_ARTIFACT`,
  )
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
  const repositoryBoundary = await server.ssrLoadModule(
    '/src/artifacts/repository/index.ts',
  )
  const repositoryImplementation = await server.ssrLoadModule(
    '/src/artifacts/repository/inMemoryArtifactRepository.ts',
  )
  const storageBoundary = await server.ssrLoadModule(
    '/src/artifacts/storage/index.ts',
  )
  const executionBoundary = await server.ssrLoadModule(
    '/src/execution/index.ts',
  )

  assert.equal(typeof artifacts.createInMemoryArtifactRepository, 'function')
  assert.deepEqual(Object.keys(repositoryBoundary), [
    'createInMemoryArtifactRepository',
  ])
  assert.equal('rehydrateProductionArtifact' in artifacts, false)
  assert.equal('rehydrateProductionArtifact' in repositoryBoundary, false)
  assert.deepEqual(Object.keys(storageBoundary), [])
  assert.deepEqual(Object.keys(executionBoundary), ['createExecutionManager'])

  const creationBoundary = artifacts.createArtifactCreationBoundary()
  const ingestionResult =
    await creationBoundary.createArtifactCandidate(generationOutput)
  assert.equal(ingestionResult.ok, true)

  const materialization = artifacts.materializeArtifact(
    ingestionResult.candidate,
  )
  assert.equal(materialization.ok, true)
  const created = materialization.artifact

  const repository = artifacts.createInMemoryArtifactRepository()
  assert.deepEqual(Object.keys(repository), ['save', 'getById', 'exists'])
  assert.equal(Object.isFrozen(repository), true)
  assert.equal(await repository.exists(created.artifactId), false)
  assert.equal(await repository.getById(created.artifactId), null)

  await repository.save(created)
  assert.equal(await repository.exists(created.artifactId), true)

  const rehydratedCreated = await repository.getById(created.artifactId)
  assert.notEqual(rehydratedCreated, null)
  assert.deepEqual(rehydratedCreated, created)
  assert.notEqual(rehydratedCreated, created)
  assert.notEqual(rehydratedCreated.sourceMetadata, created.sourceMetadata)
  assertDeepFrozen(rehydratedCreated, 'rehydratedCreated')

  const authority = artifacts.createArtifactLifecycleAuthority()
  const processingResult = authority.transition(
    rehydratedCreated,
    'PROCESSING',
  )
  assert.equal(processingResult.ok, true)
  await repository.save(processingResult.artifact)

  const rehydratedProcessing = await repository.getById(created.artifactId)
  assert.notEqual(rehydratedProcessing, null)
  assert.equal(rehydratedProcessing.status, 'PROCESSING')
  const readyResult = authority.transition(rehydratedProcessing, 'READY')
  assert.equal(readyResult.ok, true)
  await repository.save(readyResult.artifact)

  const rehydratedReady = await repository.getById(created.artifactId)
  assert.notEqual(rehydratedReady, null)
  assert.equal(rehydratedReady.status, 'READY')
  const archivedResult = authority.transition(rehydratedReady, 'ARCHIVED')
  assert.equal(archivedResult.ok, true)

  const record = Object.freeze({
    artifactId: created.artifactId,
    candidateId: created.candidateId,
    generationOutputId: created.generationOutputId,
    generationResultId: created.generationResultId,
    providerId: created.providerId,
    outputReference: created.outputReference,
    mediaType: created.mediaType,
    format: created.format,
    status: created.status,
    sourceMetadata: Object.freeze({
      taskId: created.sourceMetadata.taskId,
      providerTaskId: created.sourceMetadata.providerTaskId,
    }),
  })
  assert.equal(repositoryImplementation.isProductionArtifactRecord(record), true)

  const forgedArtifact = Object.freeze({
    ...record,
    sourceMetadata: Object.freeze({ ...record.sourceMetadata }),
  })
  assertLifecycleRejected(
    authority.transition(forgedArtifact, 'PROCESSING'),
    'deep-frozen plain object',
  )
  await assert.rejects(
    repository.save(forgedArtifact),
    /only save an authorized ProductionArtifact/,
  )
  assert.throws(
    () =>
      repositoryImplementation.rehydrateProductionArtifact(
        record,
        Object.freeze({}),
      ),
    /requires trusted repository access/,
  )

  const tamperedRecords = Object.freeze([
    { ...record, artifactId: `artifact:tampered:${record.candidateId}` },
    { ...record, candidateId: 'artifact-candidate:tampered' },
    { ...record, generationOutputId: 'generation-output:tampered' },
    { ...record, generationResultId: 'generation-result:tampered' },
    { ...record, providerId: 'tampered-provider' },
    { ...record, status: 'UNKNOWN' },
    {
      ...record,
      sourceMetadata: {
        ...record.sourceMetadata,
        providerTaskId: 'tampered-provider-task',
      },
    },
    {
      ...record,
      sourceMetadata: { ...record.sourceMetadata, taskId: '' },
    },
    { ...record, trusted: true },
  ])

  for (const [index, tamperedRecord] of tamperedRecords.entries()) {
    assert.equal(
      repositoryImplementation.isProductionArtifactRecord(tamperedRecord),
      false,
      `tampered record ${index}: validator rejection`,
    )
    assert.throws(
      () =>
        repositoryImplementation.rehydrateProductionArtifact(
          tamperedRecord,
          Object.freeze({}),
        ),
      /invalid ProductionArtifactRecord/,
      `tampered record ${index}: rehydration rejection`,
    )
  }

  const secondRead = await repository.getById(created.artifactId)
  assert.notEqual(secondRead, null)
  assert.notEqual(secondRead, rehydratedReady)
  assert.notEqual(secondRead.sourceMetadata, rehydratedReady.sourceMetadata)
  assert.equal(secondRead.status, 'READY')
  assert.equal(rehydratedCreated.status, 'CREATED')
  assert.equal(await repository.getById('artifact:unknown'), null)
  assert.equal(await repository.exists('artifact:unknown'), false)

  const [repositoryContractSource, repositoryImplementationSource] =
    await Promise.all([
      readFile(
        new URL(
          '../src/artifacts/repository/artifactRepository.ts',
          import.meta.url,
        ),
        'utf8',
      ),
      readFile(
        new URL(
          '../src/artifacts/repository/inMemoryArtifactRepository.ts',
          import.meta.url,
        ),
        'utf8',
      ),
    ])
  const [repositoryIndexSource, artifactIndexSource, entityIndexSource] =
    await Promise.all([
      readFile(
        new URL('../src/artifacts/repository/index.ts', import.meta.url),
        'utf8',
      ),
      readFile(
        new URL('../src/artifacts/index.ts', import.meta.url),
        'utf8',
      ),
      readFile(
        new URL('../src/artifacts/entities/index.ts', import.meta.url),
        'utf8',
      ),
    ])
  const storageSources = await readTypeScriptSources(
    new URL('../src/artifacts/storage/', import.meta.url),
  )
  const runtimeSources = await Promise.all([
    readTypeScriptSources(new URL('../src/runtime/', import.meta.url)),
    readTypeScriptSources(new URL('../src/runtimeData/', import.meta.url)),
  ])

  const recordContractStart = repositoryContractSource.indexOf(
    'export interface ProductionArtifactRecord',
  )
  const repositoryContractStart = repositoryContractSource.indexOf(
    'export interface ArtifactRepository',
  )
  const recordContractSource = repositoryContractSource.slice(
    recordContractStart,
    repositoryContractStart,
  )
  for (const field of [
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
    'taskId',
    'providerTaskId',
  ]) {
    assert.match(recordContractSource, new RegExp(`readonly ${field}:`))
  }
  assert.doesNotMatch(
    recordContractSource,
    /Runtime|Storage|trust|location|\([^)]*\)\s*:/,
  )

  assert.match(repositoryImplementationSource, /new Map</)
  assert.match(repositoryImplementationSource, /copyAsImmutableRecord/)
  assert.match(repositoryImplementationSource, /Object\.freeze/)
  assert.match(
    repositoryImplementationSource,
    /isAuthorizedProductionArtifactSnapshot/,
  )
  assert.doesNotMatch(repositoryIndexSource, /rehydrateProductionArtifact/)
  assert.doesNotMatch(artifactIndexSource, /rehydrateProductionArtifact/)
  assert.doesNotMatch(entityIndexSource, /AuthorizedRehydrated/)

  const repositorySources =
    `${repositoryContractSource}\n${repositoryImplementationSource}\n${repositoryIndexSource}`
  for (const [label, pattern] of [
    ['Storage dependency', /from\s+['"][^'"]*storage/i],
    ['Lifecycle dependency', /from\s+['"][^'"]*lifecycle/i],
    ['Runtime dependency', /from\s+['"][^'"]*runtime/i],
    ['Runtime Reference', /RuntimeReference/],
    ['filesystem', /node:fs|writeFile|createWriteStream/],
    ['network', /fetch\s*\(|XMLHttpRequest|WebSocket|https?:\/\//],
    ['database', /\bdatabase\b|\bSQL\b/],
    ['media transfer', /\bupload\b|\bdownload\b/],
    ['queue', /\bqueue\b/],
    ['worker', /\bworker\b/],
    ['retry', /\bretry\b/],
    ['scheduler', /\bscheduler\b/],
  ]) {
    assert.equal(pattern.test(repositorySources), false, label)
  }

  const storageSource = storageSources.join('\n')
  assert.match(storageSource, /readonly store:/)
  assert.match(storageSource, /readonly resolve:/)
  assert.match(storageSource, /readonly exists:/)
  assert.doesNotMatch(
    storageSource,
    /ProductionArtifact|ArtifactRepository|status|lifecycle|Runtime|node:fs|fetch\s*\(|\bclass\b|\bfunction\b|new Map|upload|download/,
  )
  assert.equal(
    runtimeSources.flat().some((source) =>
      /artifacts\/(?:repository|storage)/.test(source),
    ),
    false,
  )

  console.log('Artifact Repository / Storage Boundary validation passed')
  console.log('artifactSaveLoadRehydration = PASS')
  console.log('rehydratedLifecycleTransition = PASS')
  console.log('forgedArtifactAuthority = REJECTED')
  console.log('recordIdentityAndProvenanceTampering = REJECTED')
  console.log('repositoryDefensiveCopy = PASS')
  console.log('repositoryExists = PASS')
  console.log('unknownArtifact = NULL')
  console.log('storageImplementation = ABSENT')
  console.log('repositoryStorageIsolation = PASS')
  console.log('runtimeBoundary = UNTOUCHED')
  console.log('productionExecutionEntry = ExecutionManager')
  console.log('generationPipelineVisibility = INTERNAL')
} finally {
  await server.close()
}
