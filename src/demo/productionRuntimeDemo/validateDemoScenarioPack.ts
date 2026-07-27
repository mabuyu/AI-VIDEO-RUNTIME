import type {
  DemoExpectedPipelineStage,
  DemoScenarioCategory,
  DemoScenarioPackIssue,
  DemoScenarioPackValidationResult,
} from './types'

const scenarioKeys = Object.freeze([
  'scenarioId',
  'name',
  'description',
  'category',
  'scenarioIntent',
  'productionInput',
  'expectedPipeline',
])

const productionInputKeys = Object.freeze([
  'prompt',
  'targetDurationSeconds',
  'aspectRatio',
  'outputSpecification',
])

const outputSpecificationKeys = Object.freeze(['mediaType', 'format'])

const expectedPipeline: readonly DemoExpectedPipelineStage[] = Object.freeze([
  'Production',
  'Artifact',
  'Runtime',
])

const categories: readonly DemoScenarioCategory[] = Object.freeze([
  'marketing',
  'education',
  'social',
])

const noIssues: readonly [] = Object.freeze([])

const artifactOwnershipKeys = new Set([
  'artifact',
  'artifactEnvelope',
  'artifactId',
  'artifactStatus',
  'artifactValidation',
  'readyArtifact',
])

const runtimeReferenceKeys = new Set([
  'artifactRuntimeReference',
  'runtimeReference',
  'runtimeArtifactInput',
  'runtimeDataV2',
  'runtimeContext',
])

const productionLifecycleKeys = new Set([
  'status',
  'state',
  'lifecycle',
  'productionStatus',
  'jobStatus',
  'attemptStatus',
])

const productionLifecycleStates = new Set([
  'CREATED',
  'SCHEDULED',
  'RUNNING',
  'COMPLETED',
  'FAILED',
])

function isRecord(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(
  value: Readonly<Record<string, unknown>>,
  expectedKeys: readonly string[],
): boolean {
  const keys = Object.keys(value)
  return (
    keys.length === expectedKeys.length &&
    keys.every((key) => expectedKeys.includes(key))
  )
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function inspectForbiddenContent(
  value: unknown,
  path: string,
  issues: DemoScenarioPackIssue[],
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      inspectForbiddenContent(item, `${path}[${index}]`, issues),
    )
    return
  }

  if (typeof value === 'string') {
    if (value === 'READY') {
      issues.push({
        code: 'FORBIDDEN_READY_STATE',
        message: 'Demo Scenario must not contain Artifact READY state',
        path,
      })
    }
    if (productionLifecycleStates.has(value)) {
      issues.push({
        code: 'FORBIDDEN_PRODUCTION_LIFECYCLE',
        message: 'Demo Scenario must not contain Production lifecycle state',
        path,
      })
    }
    return
  }

  if (!isRecord(value)) {
    return
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`
    if (artifactOwnershipKeys.has(key)) {
      issues.push({
        code: 'FORBIDDEN_ARTIFACT_OWNERSHIP',
        message: 'Demo Scenario must not own Artifact data',
        path: childPath,
      })
    }
    if (runtimeReferenceKeys.has(key)) {
      issues.push({
        code: 'FORBIDDEN_RUNTIME_REFERENCE',
        message: 'Demo Scenario must not own Runtime Reference data',
        path: childPath,
      })
    }
    if (key === 'READY' || key === 'ready') {
      issues.push({
        code: 'FORBIDDEN_READY_STATE',
        message: 'Demo Scenario must not contain Artifact READY state',
        path: childPath,
      })
    }
    if (productionLifecycleKeys.has(key)) {
      issues.push({
        code: 'FORBIDDEN_PRODUCTION_LIFECYCLE',
        message: 'Demo Scenario must not own Production lifecycle state',
        path: childPath,
      })
    }
    inspectForbiddenContent(child, childPath, issues)
  }
}

function validateScenarioShape(
  candidate: unknown,
  path: string,
): readonly DemoScenarioPackIssue[] {
  const issues: DemoScenarioPackIssue[] = []
  if (!isRecord(candidate)) {
    return [
      {
        code: 'INVALID_SCENARIO',
        message: 'Demo Scenario must be an object',
        path,
      },
    ]
  }

  if (!hasExactKeys(candidate, scenarioKeys)) {
    issues.push({
      code: 'INVALID_SCENARIO',
      message: 'Demo Scenario must contain exactly the contract fields',
      path,
    })
  }

  if (
    !isNonEmptyString(candidate.scenarioId) ||
    !isNonEmptyString(candidate.name) ||
    !isNonEmptyString(candidate.description) ||
    !categories.includes(candidate.category as DemoScenarioCategory) ||
    !isNonEmptyString(candidate.scenarioIntent)
  ) {
    issues.push({
      code: 'INVALID_SCENARIO',
      message: 'Demo Scenario identity and descriptive fields are invalid',
      path,
    })
  }

  const input = candidate.productionInput
  if (
    !isRecord(input) ||
    !hasExactKeys(input, productionInputKeys) ||
    !isNonEmptyString(input.prompt) ||
    typeof input.targetDurationSeconds !== 'number' ||
    !Number.isFinite(input.targetDurationSeconds) ||
    input.targetDurationSeconds <= 0 ||
    (input.aspectRatio !== '16:9' && input.aspectRatio !== '9:16') ||
    !isRecord(input.outputSpecification) ||
    !hasExactKeys(input.outputSpecification, outputSpecificationKeys) ||
    input.outputSpecification.mediaType !== 'video' ||
    input.outputSpecification.format !== 'video/mp4'
  ) {
    issues.push({
      code: 'INVALID_SCENARIO',
      message: 'Demo Scenario productionInput is invalid',
      path: `${path}.productionInput`,
    })
  }

  if (
    !Array.isArray(candidate.expectedPipeline) ||
    candidate.expectedPipeline.length !== expectedPipeline.length ||
    candidate.expectedPipeline.some(
      (stage, index) => stage !== expectedPipeline[index],
    )
  ) {
    issues.push({
      code: 'INVALID_EXPECTED_PIPELINE',
      message:
        'expectedPipeline must preserve Production -> Artifact -> Runtime',
      path: `${path}.expectedPipeline`,
    })
  }

  if (
    !Object.isFrozen(candidate) ||
    !Object.isFrozen(candidate.productionInput) ||
    !Object.isFrozen(candidate.expectedPipeline)
  ) {
    issues.push({
      code: 'INVALID_SCENARIO',
      message: 'Demo Scenario contract values must be immutable',
      path,
    })
  }

  inspectForbiddenContent(candidate, path, issues)
  return issues
}

export function validateDemoScenarioPack(
  candidates: unknown,
): DemoScenarioPackValidationResult {
  if (!Array.isArray(candidates)) {
    return Object.freeze({
      ok: false,
      issues: Object.freeze([
        Object.freeze({
          code: 'INVALID_SCENARIO',
          message: 'Demo Scenario Pack must be an array',
          path: 'scenarios',
        }),
      ]),
    })
  }

  const issues: DemoScenarioPackIssue[] = []
  if (candidates.length < 3) {
    issues.push({
      code: 'INSUFFICIENT_SCENARIOS',
      message: 'Demo Scenario Pack requires at least three scenarios',
      path: 'scenarios',
    })
  }

  const scenarioIds = new Map<string, number[]>()
  candidates.forEach((candidate, index) => {
    const path = `scenarios[${index}]`
    issues.push(...validateScenarioShape(candidate, path))
    if (isRecord(candidate) && isNonEmptyString(candidate.scenarioId)) {
      scenarioIds.set(candidate.scenarioId, [
        ...(scenarioIds.get(candidate.scenarioId) ?? []),
        index,
      ])
    }
  })

  for (const [scenarioId, indexes] of scenarioIds) {
    if (indexes.length > 1) {
      issues.push({
        code: 'DUPLICATE_SCENARIO_ID',
        message: `scenarioId must be unique: ${scenarioId}`,
        path: indexes.map((index) => `scenarios[${index}]`).join(','),
      })
    }
  }

  if (issues.length > 0) {
    return Object.freeze({
      ok: false,
      issues: Object.freeze(
        issues.map((issue) => Object.freeze({ ...issue })),
      ),
    })
  }

  return Object.freeze({
    ok: true,
    scenarioCount: candidates.length,
    issues: noIssues,
  })
}
