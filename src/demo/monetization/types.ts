export type ProductionCapabilityLevel =
  | 'ESSENTIAL'
  | 'ADVANCED'
  | 'PROFESSIONAL'
  | 'ENTERPRISE'

export type MonetizationComplexityLevel = 'low' | 'medium' | 'high'

export interface ProductionTier {
  readonly tierId: string
  readonly name: string
  readonly capabilityLevel: ProductionCapabilityLevel
  readonly maxDuration: number
  readonly maxScenes: number
  readonly complexityLevel: MonetizationComplexityLevel
}

export interface UsagePlan {
  readonly planId: string
  readonly name: string
  readonly monthlyCredits: number
  readonly demoSessions: number
  readonly simulationQuota: number
}

export type CommercialCapability =
  | 'Marketing Templates'
  | 'Education Templates'
  | 'Social Templates'
  | 'Premium Simulation'
  | 'Enterprise Delivery'

export interface CommercialPackage {
  readonly packageId: string
  readonly name: string
  readonly plan: UsagePlan
  readonly tier: ProductionTier
  readonly capabilities: readonly CommercialCapability[]
}

export type CommercialDemoCategory =
  | 'marketing'
  | 'education'
  | 'social'

export interface CommercialDemoContext {
  readonly category: CommercialDemoCategory
  readonly estimatedDurationSeconds: number
  readonly estimatedSceneCount: number
  readonly complexityLevel: MonetizationComplexityLevel
  readonly requiresPremiumSimulation: boolean
}

export type RecommendedPackage = CommercialPackage

export interface CommercialPackageService {
  getProductionTiers(): readonly ProductionTier[]
  getUsagePlans(): readonly UsagePlan[]
  getPackages(): readonly CommercialPackage[]
  recommendPackage(context: CommercialDemoContext): RecommendedPackage
}
