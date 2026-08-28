import type { ProductionPlan } from '../production/contracts'
import { validateProductionPlan } from '../production/validation'
import type { ProductionPlanSource } from './contracts'
import { materializeImmutableBoundaryValue } from './boundarySnapshot'

function createPlanSnapshot(candidate: unknown): ProductionPlan {
  let snapshot: unknown
  try {
    snapshot = materializeImmutableBoundaryValue(candidate)
  } catch {
    throw new TypeError(
      'ProductionPlanSource requires readable data-only ProductionPlan values',
    )
  }

  const validation = validateProductionPlan(snapshot)
  if (!validation.valid) {
    throw new TypeError(
      validation.issues[0]?.message ??
        'ProductionPlanSource rejected an invalid ProductionPlan',
    )
  }

  return snapshot as ProductionPlan
}

/** Map-backed reference source for boundary validation only. */
export function createInMemoryProductionPlanSource(
  initialPlans: readonly ProductionPlan[] = [],
): ProductionPlanSource {
  const plans = new Map<string, ProductionPlan>()

  for (const plan of initialPlans) {
    const snapshot = createPlanSnapshot(plan)
    if (plans.has(snapshot.planId)) {
      throw new TypeError(
        `ProductionPlanSource received duplicate planId ${snapshot.planId}`,
      )
    }
    plans.set(snapshot.planId, snapshot)
  }

  return Object.freeze({
    async resolve(planId: string): Promise<ProductionPlan | null> {
      const stored = plans.get(planId)
      return stored === undefined ? null : createPlanSnapshot(stored)
    },
  })
}
