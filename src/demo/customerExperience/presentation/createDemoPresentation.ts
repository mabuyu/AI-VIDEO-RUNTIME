import type {
  CreateDemoPresentationInput,
  DemoPresentation,
  DemoWorkflowOverviewStage,
} from '../types'

const workflowOverview: readonly DemoWorkflowOverviewStage[] =
  Object.freeze(['Prompt', 'Scenario', 'Workflow', 'Simulation'])

export function createDemoPresentation(
  input: CreateDemoPresentationInput,
): DemoPresentation {
  const { proposal, recommendedPackage, simulation } = input
  if (
    proposal.requestId !== simulation.requestId ||
    proposal.recommendedScenarioId !== simulation.scenarioId
  ) {
    throw new TypeError(
      'Commercial Proposal and Simulation do not correlate',
    )
  }
  if (simulation.status !== 'COMPLETED') {
    throw new TypeError(
      'Demo Presentation requires a completed Execution Simulation',
    )
  }

  return Object.freeze({
    presentationId: `customer-demo-presentation-${simulation.simulationId}`,
    title: `Customer Demo: ${proposal.objective}`,
    customerGoal: proposal.objective,
    recommendedSolution: Object.freeze({
      template: proposal.recommendedTemplateId,
      scenario: proposal.recommendedScenarioId,
    }),
    packageRecommendationSummary: Object.freeze({
      packageId: recommendedPackage.packageId,
      name: recommendedPackage.name,
      planId: recommendedPackage.plan.planId,
      planName: recommendedPackage.plan.name,
      tierId: recommendedPackage.tier.tierId,
      tierName: recommendedPackage.tier.name,
      capabilities: Object.freeze([
        ...recommendedPackage.capabilities,
      ]),
    }),
    workflowOverview: Object.freeze([...workflowOverview]),
    simulationSummary: Object.freeze({
      simulationId: simulation.simulationId,
      scenarioId: simulation.scenarioId,
      workflowId: simulation.workflowId,
      stageCount: simulation.stages.length,
      status: simulation.status,
    }),
    valueSummary: Object.freeze({
      productionReadiness: 'SIMULATED',
      workflowCompleteness: 'COMPLETE',
      demoStatus: 'COMPLETED',
    }),
  })
}
