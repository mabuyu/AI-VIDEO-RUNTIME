import type {
  CommercialDemoIntelligenceReport,
  CommercialDemoPlan,
  CommercialDemoReport,
  CreateCommercialIntelligenceReportInput,
  DemoShowcasePipeline,
} from '../types'
import type {
  CommercialDemoExecutionReport,
  DemoExecutionSimulation,
} from '../../commercialExecution/types'

export function createCommercialDemoReport(
  input: CreateCommercialIntelligenceReportInput,
): CommercialDemoIntelligenceReport
export function createCommercialDemoReport(
  plan: CommercialDemoPlan,
  pipeline: DemoShowcasePipeline,
): CommercialDemoReport
export function createCommercialDemoReport(
  plan: CommercialDemoPlan,
  pipeline: DemoShowcasePipeline,
  simulation: DemoExecutionSimulation,
): CommercialDemoExecutionReport
export function createCommercialDemoReport(
  planOrInput:
    | CommercialDemoPlan
    | CreateCommercialIntelligenceReportInput,
  pipeline?: DemoShowcasePipeline,
  simulation?: DemoExecutionSimulation,
):
  | CommercialDemoReport
  | CommercialDemoExecutionReport
  | CommercialDemoIntelligenceReport {
  if ('proposal' in planOrInput && 'estimate' in planOrInput) {
    const { proposal, estimate, simulation: intelligenceSimulation } =
      planOrInput
    if (
      proposal.recommendedScenarioId !== estimate.scenarioId ||
      proposal.recommendedScenarioId !==
        intelligenceSimulation.scenarioId ||
      proposal.requestId !== intelligenceSimulation.requestId
    ) {
      throw new TypeError(
        'Commercial Proposal, Estimate, and Simulation do not correlate',
      )
    }

    return Object.freeze({
      reportId: `commercial-demo-report-${proposal.requestId}`,
      proposal,
      estimate,
      recommendation: Object.freeze({
        recommendedTemplateId: proposal.recommendedTemplateId,
        recommendedScenarioId: proposal.recommendedScenarioId,
      }),
      simulation: intelligenceSimulation,
    })
  }

  const plan = planOrInput
  if (pipeline === undefined) {
    throw new TypeError(
      'Demo Showcase Pipeline is required for a Commercial Demo Plan report',
    )
  }
  const reportId = `commercial-demo-report-${plan.request.requestId}`
  const requestSummary = Object.freeze({
    requestId: plan.request.requestId,
    prompt: plan.request.prompt,
    category: plan.request.category,
    metadata: plan.request.metadata,
  })

  if (simulation !== undefined) {
    if (
      simulation.requestId !== plan.request.requestId ||
      simulation.scenarioId !== plan.scenario.scenarioId ||
      simulation.workflowId !== plan.workflow.workflowId
    ) {
      throw new TypeError(
        'Demo Execution Simulation does not match Commercial Demo Plan',
      )
    }

    return Object.freeze({
      reportId,
      requestSummary,
      scenario: plan.scenario,
      workflow: plan.workflow,
      simulation,
      pipeline,
    })
  }

  return Object.freeze({
    reportId,
    requestSummary,
    selectedTemplate: plan.recommendation.templateId,
    scenarioId: plan.scenario.scenarioId,
    workflowId: plan.workflow.workflowId,
    pipeline,
  })
}
