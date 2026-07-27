import type { CommercialDemoPlan } from '../../commercialDemo'
import type {
  DemoExecutionSimulation,
  DemoExecutionStage,
} from '../types'

function copyStages(
  stages: readonly DemoExecutionStage[],
): readonly DemoExecutionStage[] {
  return Object.freeze(
    stages.map((stage) =>
      Object.freeze({
        stageId: stage.stageId,
        name: stage.name,
        status: stage.status,
        description: stage.description,
      }),
    ),
  )
}

export function createDemoExecutionSimulation(
  plan: CommercialDemoPlan,
  stages: readonly DemoExecutionStage[],
): DemoExecutionSimulation {
  if (plan.workflow.scenarioId !== plan.scenario.scenarioId) {
    throw new TypeError(
      'Commercial Demo Plan Workflow does not match its Scenario',
    )
  }
  if (stages.length === 0) {
    throw new TypeError('Demo Execution stages must not be empty')
  }

  return Object.freeze({
    simulationId: `demo-execution-simulation-${plan.request.requestId}`,
    requestId: plan.request.requestId,
    scenarioId: plan.scenario.scenarioId,
    workflowId: plan.workflow.workflowId,
    stages: copyStages(stages),
    status: 'COMPLETED',
  })
}
