import {
  createCommercialDemoReport,
  type CommercialDemoPlan,
  type DemoShowcasePipeline,
} from '../../commercialDemo'
import type {
  CommercialDemoExecutionReport,
  DemoExecutionSimulation,
} from '../types'

export function extendCommercialDemoReport(
  plan: CommercialDemoPlan,
  pipeline: DemoShowcasePipeline,
  simulation: DemoExecutionSimulation,
): CommercialDemoExecutionReport {
  return createCommercialDemoReport(plan, pipeline, simulation)
}
