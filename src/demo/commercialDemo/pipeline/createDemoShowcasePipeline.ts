import type {
  DemoShowcasePipeline,
  DemoShowcaseStage,
} from '../types'

const showcaseStages: readonly DemoShowcaseStage[] = Object.freeze([
  'Prompt',
  'Intent',
  'Template',
  'Scenario',
  'Workflow',
  'Production',
  'Artifact',
  'Runtime',
])

export function createDemoShowcasePipeline(
  pipelineId = 'commercial-demo-showcase-pipeline-v1',
): DemoShowcasePipeline {
  if (typeof pipelineId !== 'string' || pipelineId.trim().length === 0) {
    throw new TypeError('pipelineId must be a non-empty string')
  }

  return Object.freeze({
    pipelineId: pipelineId.trim(),
    stages: showcaseStages,
  })
}
