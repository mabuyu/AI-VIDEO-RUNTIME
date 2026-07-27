import { productionRuntimeDemoTemplates } from './templates'
import type { DemoTemplateRegistry } from './types'

export const demoTemplateRegistry: DemoTemplateRegistry = Object.freeze({
  getTemplates() {
    return productionRuntimeDemoTemplates
  },
})
