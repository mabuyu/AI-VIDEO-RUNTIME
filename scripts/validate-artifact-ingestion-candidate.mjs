import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
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

function assertFailure(result, expectedCode, label) {
  assert.equal(result.ok, false, `${label}: expected rejection`)
  assert.equal(
    result.issues.some((issue) => issue.code === expectedCode),
    true,
    `${label}: expected ${expectedCode}`,
  )
  assert.equal('candidate' in result, false, `${label}: candidate leaked`)
  assertDeepFrozen(result, `${label}.result`)
}

function assertForbiddenCandidateFieldsAbsent(value, path = 'candidate') {
  if (typeof value !== 'object' || value === null) return

  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '')
    assert.equal(
      ['ready', 'lifecycle', 'storage', 'runtimereference'].some((field) =>
        normalizedKey.startsWith(field),
      ),
      false,
      `${path}.${key}: forbidden Candidate authority`,
    )
    assertForbiddenCandidateFieldsAbsent(child, `${path}.${key}`)
  }
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
  const execution = await server.ssrLoadModule('/src/execution/index.ts')

  assert.equal(typeof artifacts.createArtifactCreationBoundary, 'function')
  assert.equal('createArtifactCandidate' in artifacts, false)
  assert.deepEqual(Object.keys(execution), ['createExecutionManager'])

  const boundary = artifacts.createArtifactCreationBoundary()
  assert.deepEqual(Object.keys(boundary), ['createArtifactCandidate'])
  assert.equal(Object.isFrozen(boundary), true)

  const first = await boundary.createArtifactCandidate(generationOutput)
  const second = await boundary.createArtifactCandidate(generationOutput)

  assert.equal(first.ok, true)
  assert.equal(second.ok, true)
  assert.deepEqual(Object.keys(first), ['ok', 'candidate'])
  assert.deepEqual(Object.keys(first.candidate), [
    'candidateId',
    'generationOutputId',
    'generationResultId',
    'providerId',
    'outputReference',
    'mediaType',
    'format',
    'sourceMetadata',
  ])
  assert.deepEqual(Object.keys(first.candidate.sourceMetadata), [
    'taskId',
    'providerTaskId',
  ])
  assert.equal(
    first.candidate.candidateId,
    `artifact-candidate:${generationOutput.id}`,
  )
  assert.equal(first.candidate.candidateId, second.candidate.candidateId)
  assert.equal(first.candidate.generationOutputId, generationOutput.id)
  assert.equal(
    first.candidate.generationResultId,
    generationOutput.generationResultId,
  )
  assert.equal(first.candidate.providerId, generationOutput.providerId)
  assert.equal(
    first.candidate.outputReference,
    generationOutput.outputReference,
  )
  assert.equal(
    first.candidate.mediaType,
    generationOutput.metadata.mediaType,
  )
  assert.equal(first.candidate.format, generationOutput.metadata.format)
  assert.deepEqual(first.candidate.sourceMetadata, {
    taskId: generationOutput.metadata.taskId,
    providerTaskId: generationOutput.metadata.providerTaskId,
  })
  assert.notEqual(first.candidate.sourceMetadata, generationOutput.metadata)
  assertDeepFrozen(first, 'successResult')
  assertDeepFrozen(second, 'repeatedSuccessResult')
  assertForbiddenCandidateFieldsAbsent(first.candidate)

  for (const forbiddenField of [
    'artifactId',
    'artifactType',
    'status',
    'location',
    'validation',
    'artifact',
    'artifactEnvelope',
  ]) {
    assert.equal(forbiddenField in first.candidate, false)
    assert.equal(forbiddenField in first, false)
  }

  const invalidCases = [
    [null, 'INVALID_GENERATION_OUTPUT', 'non-object input'],
    [
      { ...generationOutput, id: '' },
      'INVALID_GENERATION_OUTPUT_ID',
      'missing GenerationOutput identity',
    ],
    [
      { ...generationOutput, generationResultId: '  ' },
      'INVALID_GENERATION_RESULT_ID',
      'missing GenerationResult identity',
    ],
    [
      { ...generationOutput, providerId: '\t' },
      'INVALID_PROVIDER_ID',
      'missing provider identity',
    ],
    [
      { ...generationOutput, outputReference: '  ' },
      'INVALID_OUTPUT_REFERENCE',
      'missing output reference',
    ],
    [
      { ...generationOutput, metadata: undefined },
      'INVALID_SOURCE_METADATA',
      'missing media metadata',
    ],
    [
      {
        ...generationOutput,
        metadata: { ...generationOutput.metadata, mediaType: 'audio' },
      },
      'INVALID_MEDIA_TYPE',
      'invalid media type',
    ],
    [
      {
        ...generationOutput,
        metadata: { ...generationOutput.metadata, format: '  ' },
      },
      'INVALID_FORMAT',
      'missing media format',
    ],
    [
      {
        ...generationOutput,
        metadata: { ...generationOutput.metadata, providerTaskId: '' },
      },
      'INVALID_SOURCE_METADATA',
      'missing source provenance',
    ],
    [
      { ...generationOutput, providerNativeResponse: {} },
      'INVALID_GENERATION_OUTPUT',
      'provider native response leakage',
    ],
    [
      {
        ...generationOutput,
        id: 'generation-output:mock-video:wrong-task',
      },
      'INVALID_GENERATION_OUTPUT_ID',
      'GenerationOutput provenance mismatch',
    ],
    [
      {
        ...generationOutput,
        generationResultId:
          'generation-result:mock-video:wrong-task',
      },
      'INVALID_GENERATION_RESULT_ID',
      'GenerationResult provenance mismatch',
    ],
  ]

  for (const [input, expectedCode, label] of invalidCases) {
    assertFailure(
      await boundary.createArtifactCandidate(input),
      expectedCode,
      label,
    )
  }

  const implementationSources = await Promise.all(
    [
      '../src/artifacts/candidates/createArtifactCandidate.ts',
      '../src/artifacts/candidates/createArtifactCreationBoundary.ts',
    ].map((path) => readFile(new URL(path, import.meta.url), 'utf8')),
  )
  const implementationSource = implementationSources.join('\n')

  for (const forbiddenOperation of [
    'fetch(',
    'node:fs',
    'writeFile',
    'createWriteStream',
    'randomUUID',
    'ArtifactEnvelope',
    'ArtifactRuntimeReference',
  ]) {
    assert.equal(
      implementationSource.includes(forbiddenOperation),
      false,
      `Forbidden WP05 operation or ownership: ${forbiddenOperation}`,
    )
  }

  console.log('Artifact Ingestion Candidate validation passed')
  console.log('validGenerationOutputAdmission = PASS')
  console.log('stableCandidateIdentity = PASS')
  console.log('generationProvenancePreserved = PASS')
  console.log('invalidGenerationOutputRejection = PASS')
  console.log('candidateDeepFreeze = PASS')
  console.log('formalArtifactCreation = ABSENT')
  console.log('runtimeAndLifecycleAuthority = ABSENT')
  console.log('executionBoundaryPreserved = PASS')
} finally {
  await server.close()
}
