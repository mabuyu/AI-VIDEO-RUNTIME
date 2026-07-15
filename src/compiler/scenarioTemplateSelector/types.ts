import type { CompilerInputCandidate } from '../input'
import type { ScenarioTemplate, ScenarioTemplateRegistry, ScenarioTemplateVersion } from '../scenarioTemplateRegistry'

export interface ScenarioTemplateSelectorInput {
  readonly registry: ScenarioTemplateRegistry
  readonly semanticIntent: CompilerInputCandidate
}

export interface ScenarioTemplateSelectionMetadata {
  readonly evaluatedCandidateCount: number
  readonly matchedCandidateCount: 1
}

export interface SelectedScenarioTemplate {
  readonly templateId: string
  readonly scenarioTemplateVersion: ScenarioTemplateVersion
  readonly template: ScenarioTemplate
  readonly metadata: ScenarioTemplateSelectionMetadata
}

export interface TemplateSelectionIssue {
  readonly code: 'INVALID_REGISTRY' | 'NO_MATCH' | 'MULTIPLE_MATCHES'
  readonly message: string
  readonly path?: string
  readonly templateId?: string
  readonly scenarioTemplateVersion?: ScenarioTemplateVersion
}

export type ScenarioTemplateSelectorResult =
  | { readonly ok: true; readonly selected: SelectedScenarioTemplate; readonly issues: readonly [] }
  | { readonly ok: false; readonly issues: readonly TemplateSelectionIssue[] }
