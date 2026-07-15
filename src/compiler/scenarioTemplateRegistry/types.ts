export type ScenarioTemplateVersion = string | number

export interface ScenarioTemplateIdentity {
  readonly templateId: string
  readonly scenarioTemplateVersion: ScenarioTemplateVersion
}

export interface ScenarioApplicableCondition {
  readonly semanticPath: string
  readonly expectation: string
}

export interface ScenarioSemanticRequirement {
  readonly semanticPath: string
  readonly requirement: string
}

export type ScenarioDurationConstraint =
  | { readonly type: 'exact'; readonly value: number; readonly unit: 'seconds' | 'minutes' }
  | { readonly type: 'range'; readonly min: number; readonly max: number; readonly unit: 'seconds' | 'minutes' }

export type ScenarioPhaseDurationConstraint =
  | { readonly type: 'ratio'; readonly value: number }
  | { readonly type: 'range'; readonly min: number; readonly max: number; readonly unit: 'seconds' | 'minutes' }

export interface ScenarioTemplatePhase {
  readonly id: string
  readonly narrativeRole: string
  readonly order: number
  readonly durationConstraint: ScenarioPhaseDurationConstraint
  readonly presence: 'required' | 'optional'
}

export interface ScenarioTemplate {
  readonly identity: ScenarioTemplateIdentity
  readonly category: string
  readonly description: string
  readonly applicableConditions: readonly ScenarioApplicableCondition[]
  readonly requiredSemanticIntent: readonly ScenarioSemanticRequirement[]
  readonly durationConstraint: ScenarioDurationConstraint
  readonly phases: readonly ScenarioTemplatePhase[]
}

export type ScenarioTemplateAvailability = 'available' | 'unavailable'

export interface ScenarioTemplateRegistryEntry {
  readonly templateId: string
  readonly scenarioTemplateVersion: ScenarioTemplateVersion
  readonly availability: ScenarioTemplateAvailability
  readonly template: ScenarioTemplate
}

export interface ScenarioTemplateRegistry {
  readonly entries: readonly ScenarioTemplateRegistryEntry[]
}

export interface TemplateRegistryIssue {
  readonly code: string
  readonly message: string
  readonly path?: string
  readonly templateId?: string
  readonly scenarioTemplateVersion?: ScenarioTemplateVersion
}

export type RegistryValidationResult =
  | { readonly ok: true; readonly registry: ScenarioTemplateRegistry; readonly issues: readonly [] }
  | { readonly ok: false; readonly issues: readonly TemplateRegistryIssue[] }
