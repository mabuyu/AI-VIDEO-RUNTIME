import { getProductionTiers } from './productionTiers'
import type {
  CommercialCapability,
  CommercialPackage,
  ProductionTier,
  UsagePlan,
} from './types'
import { getUsagePlans } from './usagePlans'

function requireTier(tierId: string): ProductionTier {
  const tier = getProductionTiers().find(
    (candidate) => candidate.tierId === tierId,
  )
  if (tier === undefined) {
    throw new RangeError(`Production Tier is unavailable: ${tierId}`)
  }
  return tier
}

function requirePlan(planId: string): UsagePlan {
  const plan = getUsagePlans().find(
    (candidate) => candidate.planId === planId,
  )
  if (plan === undefined) {
    throw new RangeError(`Usage Plan is unavailable: ${planId}`)
  }
  return plan
}

function freezeCapabilities(
  capabilities: readonly CommercialCapability[],
): readonly CommercialCapability[] {
  return Object.freeze([...capabilities])
}

const commercialPackages: readonly CommercialPackage[] = Object.freeze([
  Object.freeze({
    packageId: 'starter-ai-video-package',
    name: 'Starter AI Video Package',
    plan: requirePlan('starter'),
    tier: requireTier('basic'),
    capabilities: freezeCapabilities(['Marketing Templates']),
  }),
  Object.freeze({
    packageId: 'creator-ai-video-package',
    name: 'Creator AI Video Package',
    plan: requirePlan('creator'),
    tier: requireTier('standard'),
    capabilities: freezeCapabilities([
      'Marketing Templates',
      'Education Templates',
    ]),
  }),
  Object.freeze({
    packageId: 'business-ai-video-package',
    name: 'Business AI Video Package',
    plan: requirePlan('business'),
    tier: requireTier('professional'),
    capabilities: freezeCapabilities([
      'Marketing Templates',
      'Education Templates',
      'Social Templates',
      'Premium Simulation',
    ]),
  }),
  Object.freeze({
    packageId: 'enterprise-ai-video-package',
    name: 'Enterprise AI Video Package',
    plan: requirePlan('business'),
    tier: requireTier('enterprise'),
    capabilities: freezeCapabilities([
      'Marketing Templates',
      'Education Templates',
      'Social Templates',
      'Premium Simulation',
      'Enterprise Delivery',
    ]),
  }),
])

export function getCommercialPackages(): readonly CommercialPackage[] {
  return commercialPackages
}
