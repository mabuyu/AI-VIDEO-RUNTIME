import { validateScenarioTemplateRegistry } from '../scenarioTemplateRegistry'
import type { ScenarioDurationConstraint, ScenarioTemplate, ScenarioTemplateVersion, TemplateRegistryIssue } from '../scenarioTemplateRegistry'
import type { ScenarioTemplateSelectorInput, ScenarioTemplateSelectorResult, TemplateSelectionIssue } from './types'

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const identityKey = (templateId: string, version: ScenarioTemplateVersion): string =>
  `${templateId.length}:${templateId}|${typeof version}:${String(version)}`

function readSemanticPath(root: unknown, semanticPath: string): unknown {
  const segments = semanticPath.split('.').filter((segment) => segment.length > 0)
  if (segments.length === 0) return undefined
  let current: unknown = root
  for (const segment of segments) {
    if (!isRecord(current) || !(segment in current)) return undefined
    current = current[segment]
  }
  return current
}

function durationMatches(
  constraint: ScenarioDurationConstraint,
  duration: ScenarioTemplateSelectorInput['semanticIntent']['projectIntent']['targetDuration'],
): boolean {
  if (duration.unit !== constraint.unit) return false
  if (constraint.type === 'exact') {
    return duration.flexibility === 'exact' && duration.value === constraint.value
  }
  return duration.value >= constraint.min && duration.value <= constraint.max
}

function matchesTemplate(template: ScenarioTemplate, semanticIntent: ScenarioTemplateSelectorInput['semanticIntent']): boolean {
  if (!durationMatches(template.durationConstraint, semanticIntent.projectIntent.targetDuration)) return false
  for (const condition of template.applicableConditions) {
    if (readSemanticPath(semanticIntent, condition.semanticPath) !== condition.expectation) return false
  }
  for (const requirement of template.requiredSemanticIntent) {
    if (readSemanticPath(semanticIntent, requirement.semanticPath) === undefined) return false
  }
  return true
}

const issueKey = (issue: TemplateRegistryIssue | TemplateSelectionIssue): string =>
  `${issue.templateId ?? ''}|${typeof issue.scenarioTemplateVersion}:${String(issue.scenarioTemplateVersion ?? '')}|${issue.code}|${issue.path ?? ''}`

function invalidRegistryIssues(issues: readonly TemplateRegistryIssue[]): readonly TemplateSelectionIssue[] {
  return issues.map((issue) => ({
    code: 'INVALID_REGISTRY' as const,
    message: `${issue.code}: ${issue.message}`,
    ...(issue.path === undefined ? {} : { path: issue.path }),
    ...(issue.templateId === undefined ? {} : { templateId: issue.templateId }),
    ...(issue.scenarioTemplateVersion === undefined ? {} : { scenarioTemplateVersion: issue.scenarioTemplateVersion }),
  })).toSorted((left, right) => issueKey(left).localeCompare(issueKey(right)))
}

export function selectScenarioTemplate(input: ScenarioTemplateSelectorInput): ScenarioTemplateSelectorResult {
  const validation = validateScenarioTemplateRegistry(input.registry)
  if (!validation.ok) return { ok: false, issues: invalidRegistryIssues(validation.issues) }

  const candidates = validation.registry.entries.filter((entry) => entry.availability === 'available')
  const matches = candidates
    .filter((entry) => matchesTemplate(entry.template, input.semanticIntent))
    .toSorted((left, right) => identityKey(left.templateId, left.scenarioTemplateVersion).localeCompare(identityKey(right.templateId, right.scenarioTemplateVersion)))

  if (matches.length === 0) {
    return { ok: false, issues: [{ code: 'NO_MATCH', message: 'No available scenario template exactly matches the semantic intent' }] }
  }
  if (matches.length > 1) {
    return { ok: false, issues: matches.map((entry) => ({
      code: 'MULTIPLE_MATCHES',
      message: 'More than one available scenario template exactly matches the semantic intent',
      templateId: entry.templateId,
      scenarioTemplateVersion: entry.scenarioTemplateVersion,
    })) }
  }

  const selected = matches[0]
  return {
    ok: true,
    selected: {
      templateId: selected.templateId,
      scenarioTemplateVersion: selected.scenarioTemplateVersion,
      template: selected.template,
      metadata: { evaluatedCandidateCount: candidates.length, matchedCandidateCount: 1 },
    },
    issues: [],
  }
}
