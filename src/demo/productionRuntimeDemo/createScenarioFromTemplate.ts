import type {
  DemoProductionInput,
  DemoScenario,
  DemoScenarioTemplate,
  DemoTemplateInput,
  DemoTemplateInputFieldSchema,
} from './types'

function isValidFieldValue(
  value: unknown,
  schema: DemoTemplateInputFieldSchema,
): boolean {
  if (schema.type === 'string') {
    return typeof value === 'string' && value.trim().length > 0
  }

  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    (schema.minimum === undefined || value >= schema.minimum)
  )
}

function copyTemplateInput(
  template: DemoScenarioTemplate,
  input: DemoTemplateInput,
): DemoTemplateInput {
  const expectedKeys = Object.keys(template.inputSchema)
  const actualKeys = Object.keys(input)
  const hasExactKeys =
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key) => expectedKeys.includes(key))

  if (
    !hasExactKeys ||
    expectedKeys.some(
      (key) => !isValidFieldValue(input[key], template.inputSchema[key]),
    )
  ) {
    throw new TypeError(
      `Invalid input for Demo Scenario Template: ${template.templateId}`,
    )
  }

  return Object.freeze({ ...input })
}

function freezeProductionInput(
  productionInput: DemoProductionInput,
): DemoProductionInput {
  return Object.freeze({
    ...productionInput,
    outputSpecification: Object.freeze({
      ...productionInput.outputSpecification,
    }),
  })
}

function freezeScenario(scenario: DemoScenario): DemoScenario {
  return Object.freeze({
    ...scenario,
    productionInput: freezeProductionInput(scenario.productionInput),
    expectedPipeline: Object.freeze([...scenario.expectedPipeline]),
  })
}

export function createScenarioFromTemplate(
  template: DemoScenarioTemplate,
  input: DemoTemplateInput,
): DemoScenario {
  const copiedInput = copyTemplateInput(template, input)
  return freezeScenario(template.buildScenario(copiedInput))
}
