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

  return { success: true, output: result.output }
}

export function compileScenario(
  input: ScenarioCompilerInput,
  producers: ScenarioCompilerProducerPorts,
): ScenarioCompilerResult {
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
