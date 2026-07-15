import type {
  DomainProducerIssue,
  ProducerResult,
  ScenarioCompilerDomain,
  ScenarioCompilerInput,
  ScenarioCompilerIssue,
  ScenarioCompilerProducerPorts,
  ScenarioCompilerResult,
} from './types'

type ScenarioCompilerFailure = Extract<ScenarioCompilerResult, { readonly success: false }>

const baseProducerInput = (input: ScenarioCompilerInput) => ({
  selectedScenarioTemplate: input.selectedScenarioTemplate,
  compilerInputCandidate: input.compilerInputCandidate,
  planningContext: input.planningContext,
})

function producerFailure(
  domain: ScenarioCompilerDomain,
  issues: readonly DomainProducerIssue[],
): ScenarioCompilerFailure {
  const compilerIssues: readonly ScenarioCompilerIssue[] = issues.length > 0
    ? issues.map((issue) => ({
        code: 'PRODUCER_GENERATION_FAILED',
        message: issue.message,
        domain,
        ...(issue.path === undefined ? {} : { path: issue.path }),
        producerIssueCode: issue.code,
      }))
    : [{
        code: 'PRODUCER_GENERATION_FAILED',
        message: `${domain} producer failed without an issue`,
        domain,
      }]

  return { success: false, issues: compilerIssues }
}

function generationFailure(
  domain: ScenarioCompilerDomain,
  expectedGenerationId: string,
  actualGenerationId: string | undefined,
): ScenarioCompilerFailure {
  const actual = typeof actualGenerationId === 'string'
    ? `received "${actualGenerationId}"`
    : 'received no generationId'

  return {
    success: false,
    issues: [{
      code: 'INCOMPATIBLE_PLANNING_CONTEXT',
      message: `${domain} producer ${actual}; expected "${expectedGenerationId}"`,
      domain,
      path: 'generationId',
    }],
  }
}

function missingProducerPort(domain: ScenarioCompilerDomain): ScenarioCompilerFailure {
  return {
    success: false,
    issues: [{
      code: 'INVALID_COMPILER_INPUT',
      message: `${domain} producer port is required`,
      domain,
      path: `producers.${domain}`,
    }],
  }
}

function incompleteOutput(domain: ScenarioCompilerDomain): ScenarioCompilerFailure {
  return {
    success: false,
    issues: [{
      code: 'INCOMPLETE_DOMAIN_OUTPUT',
      message: `${domain} producer succeeded without output`,
      domain,
      path: 'output',
    }],
  }
}

function acceptProducerResult<TOutput>(
  domain: ScenarioCompilerDomain,
  expectedGenerationId: string,
  result: ProducerResult<TOutput>,
): { readonly success: true; readonly output: TOutput } | ScenarioCompilerFailure {
  if (!result.success) {
    return producerFailure(domain, result.issues)
  }

  if (result.generationId !== expectedGenerationId) {
    return generationFailure(domain, expectedGenerationId, result.generationId)
  }

  if (result.output === undefined || result.output === null) {
    return incompleteOutput(domain)
  }

  return { success: true, output: result.output }
}

export function compileScenario(
  input: ScenarioCompilerInput,
  producers: ScenarioCompilerProducerPorts,
): ScenarioCompilerResult {
  const domains: readonly ScenarioCompilerDomain[] = [
    'scene',
    'timeline',
    'camera',
    'effect',
    'composition',
    'depth',
    'audio',
  ]
  for (const domain of domains) {
    if (typeof producers?.[domain]?.produce !== 'function') {
      return missingProducerPort(domain)
    }
  }

  const sharedInput = baseProducerInput(input)
  const generationId = input.planningContext.generationId

  const scene = acceptProducerResult(
    'scene',
    generationId,
    producers.scene.produce(sharedInput),
  )
  if (!scene.success) return scene

  const timeline = acceptProducerResult(
    'timeline',
    generationId,
    producers.timeline.produce({ ...sharedInput, scene: scene.output }),
  )
  if (!timeline.success) return timeline

  const camera = acceptProducerResult(
    'camera',
    generationId,
    producers.camera.produce({
      ...sharedInput,
      scene: scene.output,
      timeline: timeline.output,
    }),
  )
  if (!camera.success) return camera

  const effect = acceptProducerResult(
    'effect',
    generationId,
    producers.effect.produce({
      ...sharedInput,
      scene: scene.output,
      timeline: timeline.output,
    }),
  )
  if (!effect.success) return effect

  const composition = acceptProducerResult(
    'composition',
    generationId,
    producers.composition.produce({
      ...sharedInput,
      scene: scene.output,
      timeline: timeline.output,
      camera: camera.output,
    }),
  )
  if (!composition.success) return composition

  const depth = acceptProducerResult(
    'depth',
    generationId,
    producers.depth.produce({
      ...sharedInput,
      scene: scene.output,
      timeline: timeline.output,
      camera: camera.output,
      composition: composition.output,
    }),
  )
  if (!depth.success) return depth

  const audio = acceptProducerResult(
    'audio',
    generationId,
    producers.audio.produce({
      ...sharedInput,
      scene: scene.output,
      timeline: timeline.output,
    }),
  )
  if (!audio.success) return audio

  return {
    success: true,
    output: {
      generationId,
      scene: scene.output,
      timeline: timeline.output,
      camera: camera.output,
      effect: effect.output,
      depth: depth.output,
      composition: composition.output,
      audio: audio.output,
    },
  }
}
