export type DemoScenarioCategory = 'marketing' | 'education' | 'social'

export type DemoScenarioAspectRatio = '16:9' | '9:16'

export interface DemoProductionOutputSpecification {
  readonly mediaType: 'video'
  readonly format: 'video/mp4'
}

export interface DemoProductionInput {
  readonly prompt: string
  readonly targetDurationSeconds: number
  readonly aspectRatio: DemoScenarioAspectRatio
  readonly outputSpecification: DemoProductionOutputSpecification
}

export type DemoExpectedPipelineStage =
  | 'Production'
  | 'Artifact'
  | 'Runtime'

export interface DemoScenario {
  readonly scenarioId: string
  readonly name: string
  readonly description: string
  readonly category: DemoScenarioCategory
  readonly scenarioIntent: string
  readonly productionInput: DemoProductionInput
  readonly expectedPipeline: readonly DemoExpectedPipelineStage[]
}

export interface DemoScenarioRegistry {
  getScenarios(): readonly DemoScenario[]
}

export type DemoTemplateInputValue = string | number

export type DemoTemplateInput = Readonly<
  Record<string, DemoTemplateInputValue>
>

export type DemoTemplateInputFieldType = 'string' | 'number'

export interface DemoTemplateInputFieldSchema {
  readonly type: DemoTemplateInputFieldType
  readonly required: true
  readonly minimum?: number
}

export type DemoTemplateInputSchema = Readonly<
  Record<string, DemoTemplateInputFieldSchema>
>

export interface DemoScenarioTemplate {
  readonly templateId: string
  readonly name: string
  readonly category: DemoScenarioCategory
  readonly description: string
  readonly inputSchema: DemoTemplateInputSchema
  readonly defaultProductionInput: DemoProductionInput
  readonly buildScenario: (input: DemoTemplateInput) => DemoScenario
}

export interface DemoTemplateRegistry {
  getTemplates(): readonly DemoScenarioTemplate[]
}

export type ProductionWorkflowPipelineStage =
  | 'Scenario'
  | 'Production'
  | 'Artifact'
  | 'Runtime'

export type ProductionWorkflowScenarioField =
  | 'scenarioIntent'
  | 'productionInput'

export type ProductionWorkflowProductionField =
  | 'production.generationIntent'
  | 'production.input'

export interface ProductionWorkflowInputMapping {
  readonly scenarioField: ProductionWorkflowScenarioField
  readonly productionField: ProductionWorkflowProductionField
}

export interface ProductionWorkflowContract {
  readonly workflowId: string
  readonly scenarioId: string
  readonly inputMapping: readonly ProductionWorkflowInputMapping[]
  readonly pipeline: readonly ProductionWorkflowPipelineStage[]
}

export interface ProductionWorkflowRegistry {
  getWorkflows(): readonly ProductionWorkflowContract[]
}

export interface DemoScenarioPackIssue {
  readonly code:
    | 'INVALID_SCENARIO'
    | 'DUPLICATE_SCENARIO_ID'
    | 'INSUFFICIENT_SCENARIOS'
    | 'INVALID_EXPECTED_PIPELINE'
    | 'FORBIDDEN_ARTIFACT_OWNERSHIP'
    | 'FORBIDDEN_RUNTIME_REFERENCE'
    | 'FORBIDDEN_READY_STATE'
    | 'FORBIDDEN_PRODUCTION_LIFECYCLE'
  readonly message: string
  readonly path: string
}

export type DemoScenarioPackValidationResult =
  | {
      readonly ok: true
      readonly scenarioCount: number
      readonly issues: readonly []
    }
  | {
      readonly ok: false
      readonly issues: readonly DemoScenarioPackIssue[]
    }

export interface DemoScenarioReportEntry {
  readonly scenarioId: string
  readonly name: string
  readonly category: DemoScenarioCategory
  readonly scenarioIntent: string
  readonly expectedPipeline: readonly DemoExpectedPipelineStage[]
}

export interface ProductionRuntimeDemoPackReport {
  readonly packId: 'production-runtime-demo-pack'
  readonly scenarioCount: number
  readonly categories: readonly DemoScenarioCategory[]
  readonly scenarios: readonly DemoScenarioReportEntry[]
  readonly validation: 'PASS'
}

export type ProductionRuntimeDemoPackReportResult =
  | {
      readonly ok: true
      readonly report: ProductionRuntimeDemoPackReport
    }
  | {
      readonly ok: false
      readonly issues: readonly DemoScenarioPackIssue[]
    }
