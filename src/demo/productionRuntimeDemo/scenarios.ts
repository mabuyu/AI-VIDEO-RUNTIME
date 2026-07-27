import { createScenarioFromTemplate } from './createScenarioFromTemplate'
import {
  brandStoryTemplate,
  educationVideoTemplate,
  productLaunchTemplate,
  productMarketingTemplate,
  socialCampaignTemplate,
  socialVideoTemplate,
  tutorialVideoTemplate,
} from './templates'
import type { DemoScenario } from './types'

export const productionRuntimeDemoScenarios: readonly DemoScenario[] =
  Object.freeze([
    createScenarioFromTemplate(productMarketingTemplate, {
      productName: 'AI Workspace',
      targetAudience: 'campaign teams',
      style: 'polished',
      duration: 30,
    }),
    createScenarioFromTemplate(educationVideoTemplate, {
      topic:
        'how photosynthesis converts light energy into chemical energy',
      audience: 'beginner learners',
      duration: 45,
    }),
    createScenarioFromTemplate(socialVideoTemplate, {
      topic: 'three ways to improve the opening seconds of a short video',
      platform: 'social',
      duration: 15,
    }),
    createScenarioFromTemplate(productLaunchTemplate, {
      productName: 'Nova Studio',
      targetAudience: 'creative teams',
      style: 'cinematic',
      duration: 30,
    }),
    createScenarioFromTemplate(brandStoryTemplate, {
      productName: 'Northstar',
      targetAudience: 'purpose-driven customers',
      style: 'authentic',
      duration: 45,
    }),
    createScenarioFromTemplate(tutorialVideoTemplate, {
      topic: 'building a reusable AI video workflow',
      audience: 'new production teams',
      duration: 45,
    }),
    createScenarioFromTemplate(socialCampaignTemplate, {
      topic: 'the Create Forward campaign',
      platform: 'TikTok',
      duration: 15,
    }),
  ])
