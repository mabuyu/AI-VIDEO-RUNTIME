import type {
  CommercialDemoProposal,
} from '../../commercialIntelligence'
import type {
  DemoExecutionSimulation,
  DemoExecutionStage,
} from '../../commercialExecution'
import type {
  CreateCustomerDemoSessionInput,
  CustomerDemoSession,
  CustomerDemoSessionStatus,
} from '../types'

const sessionStatuses: ReadonlySet<CustomerDemoSessionStatus> = new Set([
  'CREATED',
  'REQUEST_RECEIVED',
  'PROPOSAL_READY',
  'SIMULATION_READY',
  'PRESENTATION_READY',
  'COMPLETED',
])

function requireNonEmptyString(value: string, field: string): string {
  if (value.trim().length === 0) {
    throw new TypeError(`${field} must be a non-empty string`)
  }
  return value.trim()
}

function copyProposal(
  proposal: CommercialDemoProposal,
): CommercialDemoProposal {
  return Object.freeze({
    proposalId: proposal.proposalId,
    requestId: proposal.requestId,
    category: proposal.category,
    objective: proposal.objective,
    targetAudience: proposal.targetAudience,
    recommendedTemplateId: proposal.recommendedTemplateId,
    recommendedScenarioId: proposal.recommendedScenarioId,
    creativeDirection: proposal.creativeDirection,
    durationEstimate: proposal.durationEstimate,
    productionTier: proposal.productionTier,
  })
}

function copySimulationStage(
  stage: DemoExecutionStage,
): DemoExecutionStage {
  return Object.freeze({
    stageId: stage.stageId,
    name: stage.name,
    status: stage.status,
    description: stage.description,
  })
}

function copySimulation(
  simulation: DemoExecutionSimulation,
): DemoExecutionSimulation {
  return Object.freeze({
    simulationId: simulation.simulationId,
    requestId: simulation.requestId,
    scenarioId: simulation.scenarioId,
    workflowId: simulation.workflowId,
    stages: Object.freeze(
      simulation.stages.map((stage) => copySimulationStage(stage)),
    ),
    status: simulation.status,
  })
}

export function createCustomerDemoSession(
  input: CreateCustomerDemoSessionInput,
): CustomerDemoSession {
  const sessionId = requireNonEmptyString(input.sessionId, 'sessionId')
  const requestId = requireNonEmptyString(
    input.customerRequest.requestId,
    'customerRequest.requestId',
  )
  if (
    input.proposal.requestId !== requestId ||
    input.simulation.requestId !== requestId ||
    input.proposal.recommendedScenarioId !== input.simulation.scenarioId
  ) {
    throw new TypeError(
      'Customer Request, Commercial Proposal, and Simulation do not correlate',
    )
  }
  if (!sessionStatuses.has(input.status)) {
    throw new TypeError('Customer Demo Session status is unsupported')
  }

  return Object.freeze({
    sessionId,
    customerRequest: Object.freeze({
      requestId,
      prompt: requireNonEmptyString(
        input.customerRequest.prompt,
        'customerRequest.prompt',
      ),
      category: input.customerRequest.category,
    }),
    proposal: copyProposal(input.proposal),
    simulation: copySimulation(input.simulation),
    status: input.status,
  })
}
