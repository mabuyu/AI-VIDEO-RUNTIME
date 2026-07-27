import type {
  DemoExpectedPipelineStage,
  DemoProductionInput,
  DemoScenario,
  DemoScenarioTemplate,
  DemoTemplateInput,
  DemoTemplateInputSchema,
} from './types'

const expectedPipeline: readonly DemoExpectedPipelineStage[] = Object.freeze([
  'Production',
  'Artifact',
  'Runtime',
])

const outputSpecification = Object.freeze({
  mediaType: 'video' as const,
  format: 'video/mp4' as const,
})

function createInputSchema(
  fields: DemoTemplateInputSchema,
): DemoTemplateInputSchema {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [
        key,
        Object.freeze({ ...value }),
      ]),
    ),
  )
}

function createDefaultProductionInput(
  input: Omit<DemoProductionInput, 'outputSpecification'>,
): DemoProductionInput {
  return Object.freeze({
    ...input,
    outputSpecification,
  })
}

function readString(input: DemoTemplateInput, key: string): string {
  const value = input[key]
  if (typeof value !== 'string') {
    throw new TypeError(`Template input ${key} must be a string`)
  }
  return value
}

function readNumber(input: DemoTemplateInput, key: string): number {
  const value = input[key]
  if (typeof value !== 'number') {
    throw new TypeError(`Template input ${key} must be a number`)
  }
  return value
}

function buildScenario(
  scenario: Omit<DemoScenario, 'expectedPipeline'>,
): DemoScenario {
  return Object.freeze({
    ...scenario,
    productionInput: Object.freeze({
      ...scenario.productionInput,
      outputSpecification: Object.freeze({
        ...scenario.productionInput.outputSpecification,
      }),
    }),
    expectedPipeline,
  })
}

const productMarketingDefaultProductionInput =
  createDefaultProductionInput({
    prompt: 'Create a polished product marketing video.',
    targetDurationSeconds: 30,
    aspectRatio: '16:9',
  })

const educationVideoDefaultProductionInput =
  createDefaultProductionInput({
    prompt: 'Create a clear educational explainer video.',
    targetDurationSeconds: 45,
    aspectRatio: '16:9',
  })

const socialVideoDefaultProductionInput =
  createDefaultProductionInput({
    prompt: 'Create a concise social short video.',
    targetDurationSeconds: 15,
    aspectRatio: '9:16',
  })

export const productMarketingTemplate: DemoScenarioTemplate =
  Object.freeze({
    templateId: 'product-marketing-template-001',
    name: 'Product Marketing Template',
    category: 'marketing',
    description:
      'Builds a polished product introduction for a defined audience and visual style.',
    inputSchema: createInputSchema({
      productName: { type: 'string', required: true },
      targetAudience: { type: 'string', required: true },
      style: { type: 'string', required: true },
      duration: { type: 'number', required: true, minimum: 1 },
    }),
    defaultProductionInput: productMarketingDefaultProductionInput,
    buildScenario(input: DemoTemplateInput) {
      const productName = readString(input, 'productName')
      const targetAudience = readString(input, 'targetAudience')
      const style = readString(input, 'style')
      const duration = readNumber(input, 'duration')

      return buildScenario({
        scenarioId: 'product-demo-001',
        name: 'Product Marketing Video',
        description:
          'A polished widescreen introduction that presents a product problem, value, and call to action.',
        category: 'marketing',
        scenarioIntent: `Create a ${style} product introduction video for ${targetAudience}`,
        productionInput: {
          ...productMarketingDefaultProductionInput,
          prompt: `Introduce ${productName} to ${targetAudience} with a ${style} product story that presents the problem, value, and call to action.`,
          targetDurationSeconds: duration,
        },
      })
    },
  })

export const educationVideoTemplate: DemoScenarioTemplate = Object.freeze({
  templateId: 'education-video-template-001',
  name: 'Education Video Template',
  category: 'education',
  description:
    'Builds a concise lesson with a clear explanation sequence and recap.',
  inputSchema: createInputSchema({
    topic: { type: 'string', required: true },
    audience: { type: 'string', required: true },
    duration: { type: 'number', required: true, minimum: 1 },
  }),
  defaultProductionInput: educationVideoDefaultProductionInput,
  buildScenario(input: DemoTemplateInput) {
    const topic = readString(input, 'topic')
    const audience = readString(input, 'audience')
    const duration = readNumber(input, 'duration')

    return buildScenario({
      scenarioId: 'education-demo-001',
      name: 'Education Video',
      description:
        'A concise lesson that explains a core concept through a clear sequence and recap.',
      category: 'education',
      scenarioIntent: `Create educational content about ${topic} for ${audience}`,
      productionInput: {
        ...educationVideoDefaultProductionInput,
        prompt: `Explain ${topic} through a clear learning sequence and recap for ${audience}.`,
        targetDurationSeconds: duration,
      },
    })
  },
})

export const socialVideoTemplate: DemoScenarioTemplate = Object.freeze({
  templateId: 'social-video-template-001',
  name: 'Social Short Video Template',
  category: 'social',
  description:
    'Builds a vertical short-form concept for a selected social platform.',
  inputSchema: createInputSchema({
    topic: { type: 'string', required: true },
    platform: { type: 'string', required: true },
    duration: { type: 'number', required: true, minimum: 1 },
  }),
  defaultProductionInput: socialVideoDefaultProductionInput,
  buildScenario(input: DemoTemplateInput) {
    const topic = readString(input, 'topic')
    const platform = readString(input, 'platform')
    const duration = readNumber(input, 'duration')

    return buildScenario({
      scenarioId: 'social-demo-001',
      name: 'Social Short Video',
      description:
        'A vertical short-form concept built around an immediate hook, one useful insight, and a closing action.',
      category: 'social',
      scenarioIntent: `Create a ${platform} short-form video about ${topic}`,
      productionInput: {
        ...socialVideoDefaultProductionInput,
        prompt: `Create a ${platform} short about ${topic} with an immediate hook, one useful insight, and a closing action.`,
        targetDurationSeconds: duration,
      },
    })
  },
})

export const productLaunchTemplate: DemoScenarioTemplate = Object.freeze({
  templateId: 'product-launch-template-001',
  name: 'Product Launch Template',
  category: 'marketing',
  description:
    'Builds a commercial product launch story from reveal through audience call to action.',
  inputSchema: productMarketingTemplate.inputSchema,
  defaultProductionInput: productMarketingDefaultProductionInput,
  buildScenario(input: DemoTemplateInput) {
    const productName = readString(input, 'productName')
    const targetAudience = readString(input, 'targetAudience')
    const style = readString(input, 'style')
    const duration = readNumber(input, 'duration')

    return buildScenario({
      scenarioId: 'product-launch-showcase-001',
      name: 'Product Launch Video',
      description:
        'A commercial launch showcase that reveals a product, demonstrates its value, and closes with a launch action.',
      category: 'marketing',
      scenarioIntent: `Launch ${productName} to ${targetAudience} with a ${style} reveal and call to action`,
      productionInput: {
        ...productMarketingDefaultProductionInput,
        prompt: `Launch ${productName} for ${targetAudience} with a ${style} reveal, value demonstration, and launch call to action.`,
        targetDurationSeconds: duration,
      },
    })
  },
})

export const brandStoryTemplate: DemoScenarioTemplate = Object.freeze({
  templateId: 'brand-story-template-001',
  name: 'Brand Story Template',
  category: 'marketing',
  description:
    'Builds a commercial brand narrative around purpose, audience value, and memorable identity.',
  inputSchema: productMarketingTemplate.inputSchema,
  defaultProductionInput: productMarketingDefaultProductionInput,
  buildScenario(input: DemoTemplateInput) {
    const productName = readString(input, 'productName')
    const targetAudience = readString(input, 'targetAudience')
    const style = readString(input, 'style')
    const duration = readNumber(input, 'duration')

    return buildScenario({
      scenarioId: 'brand-story-showcase-001',
      name: 'Brand Story Video',
      description:
        'A commercial brand story that connects origin, purpose, audience value, and identity.',
      category: 'marketing',
      scenarioIntent: `Tell the ${style} brand story of ${productName} for ${targetAudience}`,
      productionInput: {
        ...productMarketingDefaultProductionInput,
        prompt: `Tell the ${style} brand story of ${productName}, connecting its purpose and identity to ${targetAudience}.`,
        targetDurationSeconds: duration,
      },
    })
  },
})

export const tutorialVideoTemplate: DemoScenarioTemplate = Object.freeze({
  templateId: 'tutorial-video-template-001',
  name: 'Tutorial Video Template',
  category: 'education',
  description:
    'Builds a commercial tutorial with an outcome, ordered steps, and recap.',
  inputSchema: educationVideoTemplate.inputSchema,
  defaultProductionInput: educationVideoDefaultProductionInput,
  buildScenario(input: DemoTemplateInput) {
    const topic = readString(input, 'topic')
    const audience = readString(input, 'audience')
    const duration = readNumber(input, 'duration')

    return buildScenario({
      scenarioId: 'tutorial-showcase-001',
      name: 'Tutorial Video',
      description:
        'An educational showcase that presents a practical outcome, ordered steps, and a concise recap.',
      category: 'education',
      scenarioIntent: `Teach ${topic} to ${audience} through a step-by-step tutorial`,
      productionInput: {
        ...educationVideoDefaultProductionInput,
        prompt: `Teach ${topic} to ${audience} with a clear outcome, ordered steps, and concise recap.`,
        targetDurationSeconds: duration,
      },
    })
  },
})

export const socialCampaignTemplate: DemoScenarioTemplate = Object.freeze({
  templateId: 'social-campaign-template-001',
  name: 'Social Campaign Template',
  category: 'social',
  description:
    'Builds a campaign-ready social video with a hook, message, and participation action.',
  inputSchema: socialVideoTemplate.inputSchema,
  defaultProductionInput: socialVideoDefaultProductionInput,
  buildScenario(input: DemoTemplateInput) {
    const topic = readString(input, 'topic')
    const platform = readString(input, 'platform')
    const duration = readNumber(input, 'duration')

    return buildScenario({
      scenarioId: 'social-campaign-showcase-001',
      name: 'Social Campaign Video',
      description:
        'A social campaign showcase designed around an immediate hook, campaign message, and participation action.',
      category: 'social',
      scenarioIntent: `Create a ${platform} campaign video about ${topic}`,
      productionInput: {
        ...socialVideoDefaultProductionInput,
        prompt: `Create a ${platform} campaign video about ${topic} with an immediate hook, a memorable message, and a participation action.`,
        targetDurationSeconds: duration,
      },
    })
  },
})

export const productionRuntimeDemoTemplates: readonly DemoScenarioTemplate[] =
  Object.freeze([
    productMarketingTemplate,
    educationVideoTemplate,
    socialVideoTemplate,
    productLaunchTemplate,
    brandStoryTemplate,
    tutorialVideoTemplate,
    socialCampaignTemplate,
  ])
