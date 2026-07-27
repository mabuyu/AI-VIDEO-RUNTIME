import { productionRuntimeDemoScenarios } from './scenarios'
import type {
  ProductionWorkflowContract,
  ProductionWorkflowInputMapping,
  ProductionWorkflowPipelineStage,
} from './types'

const inputMapping: readonly ProductionWorkflowInputMapping[] =
  Object.freeze([
    Object.freeze({
      scenarioField: 'scenarioIntent',
      productionField: 'production.generationIntent',
    }),
    Object.freeze({
      scenarioField: 'productionInput',
      productionField: 'production.input',
    }),
  ])

const pipeline: readonly ProductionWorkflowPipelineStage[] = Object.freeze([
  'Scenario',
  'Production',
  'Artifact',
  'Runtime',
])

const workflowIds: Readonly<Record<string, string>> = Object.freeze({
  'product-demo-001': 'product-demo-workflow-001',
  'education-demo-001': 'education-demo-workflow-001',
  'social-demo-001': 'social-demo-workflow-001',
  'product-launch-showcase-001': 'product-launch-workflow-001',
  'brand-story-showcase-001': 'brand-story-workflow-001',
  'tutorial-showcase-001': 'tutorial-workflow-001',
  'social-campaign-showcase-001': 'social-campaign-workflow-001',
})

export const productionWorkflowContracts: readonly ProductionWorkflowContract[] =
  Object.freeze(
    productionRuntimeDemoScenarios.map((scenario) =>
      Object.freeze({
        workflowId: workflowIds[scenario.scenarioId],
        scenarioId: scenario.scenarioId,
        inputMapping,
        pipeline,
      }),
    ),
  )
