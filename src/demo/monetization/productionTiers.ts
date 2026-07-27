import type { ProductionTier } from './types'

const productionTiers: readonly ProductionTier[] = Object.freeze([
  Object.freeze({
    tierId: 'basic',
    name: 'Basic',
    capabilityLevel: 'ESSENTIAL',
    maxDuration: 15,
    maxScenes: 3,
    complexityLevel: 'low',
  }),
  Object.freeze({
    tierId: 'standard',
    name: 'Standard',
    capabilityLevel: 'ADVANCED',
    maxDuration: 60,
    maxScenes: 8,
    complexityLevel: 'medium',
  }),
  Object.freeze({
    tierId: 'professional',
    name: 'Professional',
    capabilityLevel: 'PROFESSIONAL',
    maxDuration: 180,
    maxScenes: 24,
    complexityLevel: 'high',
  }),
  Object.freeze({
    tierId: 'enterprise',
    name: 'Enterprise',
    capabilityLevel: 'ENTERPRISE',
    maxDuration: 600,
    maxScenes: 80,
    complexityLevel: 'high',
  }),
])

export function getProductionTiers(): readonly ProductionTier[] {
  return productionTiers
}
