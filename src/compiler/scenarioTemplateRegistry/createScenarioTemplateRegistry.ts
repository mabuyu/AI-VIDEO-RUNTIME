import type { ScenarioTemplateRegistry, ScenarioTemplateRegistryEntry } from './types'

export function createScenarioTemplateRegistry(
  entries: readonly ScenarioTemplateRegistryEntry[],
): ScenarioTemplateRegistry {
  return { entries }
}
