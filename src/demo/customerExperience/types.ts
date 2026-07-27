import type { DemoRequest } from '../commercialDemo'
import type { DemoExecutionSimulation } from '../commercialExecution'
import type {
  CommercialDemoProposal,
  CommercialIntelligenceService,
} from '../commercialIntelligence'
import type { CommercialDemoService } from '../commercialDemo'
import type { CommercialDemoExecutionSimulator } from '../commercialExecution'
import type { DemoScenarioCategory } from '../productionRuntimeDemo'
import type {
  CommercialPackage,
  CommercialPackageService,
} from '../monetization'

export type CustomerDemoSessionStatus =
  | 'CREATED'
  | 'REQUEST_RECEIVED'
  | 'PROPOSAL_READY'
  | 'SIMULATION_READY'
  | 'PRESENTATION_READY'
  | 'COMPLETED'

export interface CustomerDemoRequest {
  readonly requestId: string
  readonly prompt: string
  readonly category: DemoScenarioCategory
}

export interface CustomerDemoSession {
  readonly sessionId: string
  readonly customerRequest: CustomerDemoRequest
  readonly proposal: CommercialDemoProposal
  readonly simulation: DemoExecutionSimulation
  readonly status: CustomerDemoSessionStatus
}

export interface CreateCustomerDemoSessionInput {
  readonly sessionId: string
  readonly customerRequest: DemoRequest
  readonly proposal: CommercialDemoProposal
  readonly simulation: DemoExecutionSimulation
  readonly status: CustomerDemoSessionStatus
}

export interface DemoRecommendedSolution {
  readonly template: string
  readonly scenario: string
}

export interface DemoPackageRecommendationSummary {
  readonly packageId: string
  readonly name: string
  readonly planId: string
  readonly planName: string
  readonly tierId: string
  readonly tierName: string
  readonly capabilities: CommercialPackage['capabilities']
}

export type DemoWorkflowOverviewStage =
  | 'Prompt'
  | 'Scenario'
  | 'Workflow'
  | 'Simulation'

export interface DemoSimulationSummary {
  readonly simulationId: string
  readonly scenarioId: string
  readonly workflowId: string
  readonly stageCount: number
  readonly status: DemoExecutionSimulation['status']
}

export interface DemoValueSummary {
  readonly productionReadiness: 'SIMULATED'
  readonly workflowCompleteness: 'COMPLETE'
  readonly demoStatus: 'COMPLETED'
}

export interface DemoPresentation {
  readonly presentationId: string
  readonly title: string
  readonly customerGoal: string
  readonly recommendedSolution: DemoRecommendedSolution
  readonly packageRecommendationSummary: DemoPackageRecommendationSummary
  readonly workflowOverview: readonly DemoWorkflowOverviewStage[]
  readonly simulationSummary: DemoSimulationSummary
  readonly valueSummary: DemoValueSummary
}

export interface CreateDemoPresentationInput {
  readonly proposal: CommercialDemoProposal
  readonly recommendedPackage: CommercialPackage
  readonly simulation: DemoExecutionSimulation
}

export interface CreateDemoExperienceInput {
  readonly request: DemoRequest
}

export interface CustomerDemoExperienceResult {
  readonly session: CustomerDemoSession
  readonly presentation: DemoPresentation
}

export interface CustomerDemoExperienceService {
  createDemoExperience(
    input: CreateDemoExperienceInput,
  ): CustomerDemoExperienceResult
}

export type CustomerDemoSessionIdFactory = () => string

export interface CustomerDemoExperienceDependencies {
  readonly commercialDemo: CommercialDemoService
  readonly commercialIntelligence: CommercialIntelligenceService
  readonly commercialPackages: CommercialPackageService
  readonly executionSimulator: CommercialDemoExecutionSimulator
  readonly createSessionId: CustomerDemoSessionIdFactory
}
