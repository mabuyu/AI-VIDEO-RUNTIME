import { getCommercialPackages } from '../commercialPackages'
import { getProductionTiers } from '../productionTiers'
import type {
  CommercialCapability,
  CommercialDemoContext,
  CommercialPackage,
  CommercialPackageService,
  MonetizationComplexityLevel,
} from '../types'
import { getUsagePlans } from '../usagePlans'

const categoryCapabilities: Readonly<
  Record<CommercialDemoContext['category'], CommercialCapability>
> = Object.freeze({
  marketing: 'Marketing Templates',
  education: 'Education Templates',
  social: 'Social Templates',
})

const complexityRank: Readonly<
  Record<MonetizationComplexityLevel, number>
> = Object.freeze({
  low: 0,
  medium: 1,
  high: 2,
})

function requirePositiveFiniteNumber(
  value: number,
  field: string,
): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${field} must be a positive finite number`)
  }
  return value
}

function supportsContext(
  commercialPackage: CommercialPackage,
  context: CommercialDemoContext,
): boolean {
  const requiredTemplateCapability = categoryCapabilities[context.category]

  return (
    commercialPackage.tier.maxDuration >=
      context.estimatedDurationSeconds &&
    commercialPackage.tier.maxScenes >= context.estimatedSceneCount &&
    complexityRank[commercialPackage.tier.complexityLevel] >=
      complexityRank[context.complexityLevel] &&
    commercialPackage.capabilities.includes(requiredTemplateCapability) &&
    (!context.requiresPremiumSimulation ||
      commercialPackage.capabilities.includes('Premium Simulation'))
  )
}

export function createCommercialPackageService(): CommercialPackageService {
  return Object.freeze({
    getProductionTiers,
    getUsagePlans,
    getPackages: getCommercialPackages,
    recommendPackage(context: CommercialDemoContext) {
      if (
        typeof context !== 'object' ||
        context === null ||
        !(context.category in categoryCapabilities) ||
        !(context.complexityLevel in complexityRank) ||
        typeof context.requiresPremiumSimulation !== 'boolean'
      ) {
        throw new TypeError('Commercial Demo Context is invalid')
      }

      requirePositiveFiniteNumber(
        context.estimatedDurationSeconds,
        'estimatedDurationSeconds',
      )
      requirePositiveFiniteNumber(
        context.estimatedSceneCount,
        'estimatedSceneCount',
      )

      const recommendation = getCommercialPackages().find(
        (commercialPackage) =>
          supportsContext(commercialPackage, context),
      )
      if (recommendation === undefined) {
        throw new RangeError(
          'No Commercial Package supports the Demo Context',
        )
      }

      return recommendation
    },
  })
}
