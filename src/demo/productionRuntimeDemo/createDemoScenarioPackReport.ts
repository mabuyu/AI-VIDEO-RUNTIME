import type {
  DemoScenario,
  ProductionRuntimeDemoPackReportResult,
} from './types'
import { validateDemoScenarioPack } from './validateDemoScenarioPack'

export function createDemoScenarioPackReport(
  scenarios: readonly DemoScenario[],
): ProductionRuntimeDemoPackReportResult {
  const validation = validateDemoScenarioPack(scenarios)
  if (!validation.ok) {
    return Object.freeze({
      ok: false,
      issues: validation.issues,
    })
  }

  const entries = Object.freeze(
    scenarios.map((scenario) =>
      Object.freeze({
        scenarioId: scenario.scenarioId,
        name: scenario.name,
        category: scenario.category,
        scenarioIntent: scenario.scenarioIntent,
        expectedPipeline: scenario.expectedPipeline,
      }),
    ),
  )
  const categories = Object.freeze([
    ...new Set(scenarios.map((scenario) => scenario.category)),
  ])

  return Object.freeze({
    ok: true,
    report: Object.freeze({
      packId: 'production-runtime-demo-pack',
      scenarioCount: validation.scenarioCount,
      categories,
      scenarios: entries,
      validation: 'PASS',
    }),
  })
}
