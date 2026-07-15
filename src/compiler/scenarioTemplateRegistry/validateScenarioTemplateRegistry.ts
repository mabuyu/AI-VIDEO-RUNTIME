import type {
  RegistryValidationResult,
  ScenarioTemplateRegistry,
  ScenarioTemplateVersion,
  TemplateRegistryIssue,
} from './types'

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0

const isVersion = (value: unknown): value is ScenarioTemplateVersion =>
  (typeof value === 'string' && value.length > 0) ||
  (typeof value === 'number' && Number.isFinite(value))

const identityKey = (templateId: string, version: ScenarioTemplateVersion): string =>
  `${templateId.length}:${templateId}|${typeof version}:${String(version)}`

const issueSortKey = (issue: TemplateRegistryIssue): string =>
  `${issue.templateId ?? ''}|${typeof issue.scenarioTemplateVersion}:${String(issue.scenarioTemplateVersion ?? '')}|${issue.code}|${issue.path ?? ''}`

function validateTemplateShape(template: unknown, path: string): readonly TemplateRegistryIssue[] {
  if (!isRecord(template)) {
    return [{ code: 'INVALID_REGISTRY_ENTRY', message: 'template must be an object', path }]
  }

  const issues: TemplateRegistryIssue[] = []
  if (!isRecord(template.identity)) issues.push({ code: 'INVALID_REGISTRY_ENTRY', message: 'template.identity must be an object', path: `${path}.identity` })
  if (!isNonEmptyString(template.category)) issues.push({ code: 'INVALID_REGISTRY_ENTRY', message: 'template.category must be a non-empty string', path: `${path}.category` })
  if (!isNonEmptyString(template.description)) issues.push({ code: 'INVALID_REGISTRY_ENTRY', message: 'template.description must be a non-empty string', path: `${path}.description` })
  if (!Array.isArray(template.applicableConditions)) issues.push({ code: 'INVALID_REGISTRY_ENTRY', message: 'template.applicableConditions must be an array', path: `${path}.applicableConditions` })
  if (!Array.isArray(template.requiredSemanticIntent)) issues.push({ code: 'INVALID_REGISTRY_ENTRY', message: 'template.requiredSemanticIntent must be an array', path: `${path}.requiredSemanticIntent` })
  if (!isRecord(template.durationConstraint)) issues.push({ code: 'INVALID_REGISTRY_ENTRY', message: 'template.durationConstraint must be an object', path: `${path}.durationConstraint` })
  if (!Array.isArray(template.phases) || template.phases.length === 0) issues.push({ code: 'INVALID_REGISTRY_ENTRY', message: 'template.phases must be a non-empty array', path: `${path}.phases` })
  return issues
}

export function validateScenarioTemplateRegistry(registry: unknown): RegistryValidationResult {
  if (!isRecord(registry) || !Array.isArray(registry.entries)) {
    return { ok: false, issues: [{ code: 'INVALID_REGISTRY', message: 'registry.entries must be an array', path: 'entries' }] }
  }

  const issues: TemplateRegistryIssue[] = []
  const identities = new Map<string, number[]>()

  registry.entries.forEach((entry, index) => {
    const path = `entries[${index}]`
    if (!isRecord(entry)) {
      issues.push({ code: 'INVALID_REGISTRY_ENTRY', message: 'registry entry must be an object', path })
      return
    }

    const templateId = entry.templateId
    const version = entry.scenarioTemplateVersion
    const issueIdentity = {
      ...(isNonEmptyString(templateId) ? { templateId } : {}),
      ...(isVersion(version) ? { scenarioTemplateVersion: version } : {}),
    }

    if (!isNonEmptyString(templateId)) issues.push({ code: 'INVALID_REGISTRY_ENTRY', message: 'templateId must be a non-empty string', path: `${path}.templateId`, ...issueIdentity })
    if (!isVersion(version)) issues.push({ code: 'INVALID_REGISTRY_ENTRY', message: 'scenarioTemplateVersion must be a non-empty string or finite number', path: `${path}.scenarioTemplateVersion`, ...issueIdentity })
    if (entry.availability !== 'available' && entry.availability !== 'unavailable') issues.push({ code: 'INVALID_REGISTRY_ENTRY', message: 'availability must be available or unavailable', path: `${path}.availability`, ...issueIdentity })
    issues.push(...validateTemplateShape(entry.template, `${path}.template`).map((issue) => ({ ...issue, ...issueIdentity })))

    if (isNonEmptyString(templateId) && isVersion(version)) {
      const key = identityKey(templateId, version)
      identities.set(key, [...(identities.get(key) ?? []), index])
      if (isRecord(entry.template) && isRecord(entry.template.identity)) {
        const templateIdentity = entry.template.identity
        if (templateIdentity.templateId !== templateId || templateIdentity.scenarioTemplateVersion !== version) {
          issues.push({ code: 'IDENTITY_MISMATCH', message: 'entry identity must exactly match template.identity', path: `${path}.template.identity`, templateId, scenarioTemplateVersion: version })
        }
      }
    }
  })

  for (const indexes of identities.values()) {
    if (indexes.length < 2) continue
    const entry = registry.entries[indexes[0]]
    if (!isRecord(entry) || !isNonEmptyString(entry.templateId) || !isVersion(entry.scenarioTemplateVersion)) continue
    issues.push({ code: 'DUPLICATE_IDENTITY', message: 'registry identity must be unique', path: indexes.map((index) => `entries[${index}]`).join(','), templateId: entry.templateId, scenarioTemplateVersion: entry.scenarioTemplateVersion })
  }

  if (issues.length > 0) return { ok: false, issues: issues.toSorted((left, right) => issueSortKey(left).localeCompare(issueSortKey(right))) }
  return { ok: true, registry: registry as unknown as ScenarioTemplateRegistry, issues: [] }
}
