import {
  createDemoRequest,
  createCommercialDemoService,
} from '../../commercialDemo'
import { createCommercialDemoExecutionSimulator } from '../../commercialExecution'
import { createCommercialIntelligenceService } from '../../commercialIntelligence'
import { createCommercialPackageService } from '../../monetization'
import { createDemoPresentation } from '../presentation/createDemoPresentation'
import { createCustomerDemoSession } from '../session/createCustomerDemoSession'
import type {
  CreateDemoExperienceInput,
  CustomerDemoExperienceDependencies,
  CustomerDemoExperienceResult,
  CustomerDemoExperienceService,
} from '../types'

function defaultSessionIdFactory(): string {
  return `customer-demo-session-${globalThis.crypto.randomUUID()}`
}

export function createCustomerDemoExperienceService(
  dependencies: Partial<CustomerDemoExperienceDependencies> = {},
): CustomerDemoExperienceService {
  const commercialDemo =
    dependencies.commercialDemo ?? createCommercialDemoService()
  const commercialIntelligence =
    dependencies.commercialIntelligence ??
    createCommercialIntelligenceService()
  const executionSimulator =
    dependencies.executionSimulator ??
    createCommercialDemoExecutionSimulator()
  const commercialPackages =
    dependencies.commercialPackages ?? createCommercialPackageService()
  const createSessionId =
    dependencies.createSessionId ?? defaultSessionIdFactory

  return Object.freeze({
    createDemoExperience(
      input: CreateDemoExperienceInput,
    ): CustomerDemoExperienceResult {
      const request = createDemoRequest(input.request)
      const plan = commercialDemo.createPlan(request)
      const proposal = commercialIntelligence.createProposal({
        requestId: request.requestId,
        intent: plan.intent,
        templateRecommendation: plan.recommendation,
        scenario: plan.scenario,
      })
      const estimate = commercialIntelligence.createEstimate({
        scenario: plan.scenario,
        proposal,
      })
      const recommendedPackage = commercialPackages.recommendPackage({
        category: request.category,
        estimatedDurationSeconds:
          plan.scenario.productionInput.targetDurationSeconds,
        estimatedSceneCount: estimate.sceneCount,
        complexityLevel: estimate.complexityLevel,
        requiresPremiumSimulation: true,
      })
      const simulation = executionSimulator.simulate(plan)
      const presentation = createDemoPresentation({
        proposal,
        recommendedPackage,
        simulation,
      })
      const session = createCustomerDemoSession({
        sessionId: createSessionId(),
        customerRequest: request,
        proposal,
        simulation,
        status: 'COMPLETED',
      })

      return Object.freeze({ session, presentation })
    },
  })
}
