import type {
  DemoScenario,
  DemoScenarioCategory,
  ProductionWorkflowContract,
} from '../productionRuntimeDemo'
import type {
  PromptIntent,
  TemplateRecommendation,
} from '../productionIntelligence'
import type {
  CommercialDemoProposal,
  ProductionEstimate,
} from '../commercialIntelligence/types'
import type { DemoExecutionSimulation } from '../commercialExecution/types'

export type DemoMetadataPrimitive = string | number | boolean | null

export type DemoMetadataValue =
  | DemoMetadataPrimitive
  | readonly DemoMetadataValue[]
  | { readonly [key: string]: DemoMetadataValue }

export type DemoRequestMetadata = Readonly<
  Record<string, DemoMetadataValue>
>

export interface DemoRequest {
  readonly requestId: string
  readonly prompt: string
  readonly category: DemoScenarioCategory
  readonly requestedTemplate?: string
  readonly metadata: DemoRequestMetadata
}

export interface CreateDemoRequestInput {
  readonly requestId: string
  readonly prompt: string
  readonly category: DemoScenarioCategory
  readonly requestedTemplate?: string
  readonly metadata?: Readonly<Record<string, DemoMetadataValue>>
}

export interface CommercialDemoPlan {
  readonly request: DemoRequest
  readonly intent: PromptIntent
  readonly recommendation: TemplateRecommendation
  readonly scenario: DemoScenario
  readonly workflow: ProductionWorkflowContract
}

export interface CommercialDemoService {
  createPlan(request: DemoRequest): CommercialDemoPlan
}

export type DemoShowcaseStage =
  | 'Prompt'
  | 'Intent'
  | 'Template'
  | 'Scenario'
  | 'Workflow'
  | 'Production'
  | 'Artifact'
  | 'Runtime'

export interface DemoShowcasePipeline {
  readonly pipelineId: string
  readonly stages: readonly DemoShowcaseStage[]
}

export interface CommercialDemoRequestSummary {
  readonly requestId: string
  readonly prompt: string
  readonly category: DemoScenarioCategory
  readonly metadata: DemoRequestMetadata
}

export interface CommercialDemoReport {
  readonly reportId: string
  readonly requestSummary: CommercialDemoRequestSummary
  readonly selectedTemplate: string
  readonly scenarioId: string
  readonly workflowId: string
  readonly pipeline: DemoShowcasePipeline
}

export interface CommercialReportRecommendation {
  readonly recommendedTemplateId: string
  readonly recommendedScenarioId: string
}

export interface CreateCommercialIntelligenceReportInput {
  readonly proposal: CommercialDemoProposal
  readonly estimate: ProductionEstimate
  readonly simulation: DemoExecutionSimulation
}

export interface CommercialDemoIntelligenceReport {
  readonly reportId: string
  readonly proposal: CommercialDemoProposal
  readonly estimate: ProductionEstimate
  readonly recommendation: CommercialReportRecommendation
  readonly simulation: DemoExecutionSimulation
}
