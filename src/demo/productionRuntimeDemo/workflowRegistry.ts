import type { ProductionWorkflowRegistry } from './types'
import { productionWorkflowContracts } from './workflows'

export const productionWorkflowRegistry: ProductionWorkflowRegistry =
  Object.freeze({
    getWorkflows() {
      return productionWorkflowContracts
    },
  })
