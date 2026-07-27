import type {
  CommercialDemoPlan,
  CommercialDemoRequestSummary,
  DemoShowcasePipeline,
} from '../commercialDemo'
import type {
  DemoScenario,
  ProductionWorkflowContract,
} from '../productionRuntimeDemo'

export type DemoExecutionSimulationStatus =
  | 'CREATED'
  | 'PLANNING'
  | 'SCENARIO_READY'
  | 'WORKFLOW_READY'
  | 'PRODUCTION_SIMULATED'
  | 'COMPLETED'

export type DemoExecutionStageName =
  | 'REQUEST_RECEIVED'
  | 'INTENT_ANALYZED'
  | 'TEMPLATE_SELECTED'
  | 'SCENARIO_GENERATED'
  | 'WORKFLOW_CREATED'
  | 'PRODUCTION_READY'
  | 'ARTIFACT_READY_SIMULATION'
  | 'RUNTIME_READY_SIMULATION'
  | 'DEMO_COMPLETED'

export type DemoExecutionStageStatus = 'SIMULATED'

export interface DemoExecutionStage {
  readonly stageId: string
  readonly name: DemoExecutionStageName
  readonly status: DemoExecutionStageStatus
  readonly description: string
}

export interface DemoExecutionSimulation {
  readonly simulationId: string
  readonly requestId: string
  readonly scenarioId: string
  readonly workflowId: string
  readonly stages: readonly DemoExecutionStage[]
  readonly status: DemoExecutionSimulationStatus
}

export interface DemoExecutionRegistry {
  getSimulationStages(): readonly DemoExecutionStage[]
}

export interface CommercialDemoExecutionSimulator {
  simulate(plan: CommercialDemoPlan): DemoExecutionSimulation
}

export interface CommercialDemoExecutionReport {
  readonly reportId: string
  readonly requestSummary: CommercialDemoRequestSummary
  readonly scenario: DemoScenario
  readonly workflow: ProductionWorkflowContract
  readonly simulation: DemoExecutionSimulation
  readonly pipeline: DemoShowcasePipeline
}
