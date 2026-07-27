import type { UsagePlan } from './types'

const usagePlans: readonly UsagePlan[] = Object.freeze([
  Object.freeze({
    planId: 'starter',
    name: 'Starter',
    monthlyCredits: 100,
    demoSessions: 3,
    simulationQuota: 3,
  }),
  Object.freeze({
    planId: 'creator',
    name: 'Creator',
    monthlyCredits: 500,
    demoSessions: 15,
    simulationQuota: 20,
  }),
  Object.freeze({
    planId: 'business',
    name: 'Business',
    monthlyCredits: 2000,
    demoSessions: 50,
    simulationQuota: 100,
  }),
])

export function getUsagePlans(): readonly UsagePlan[] {
  return usagePlans
}
