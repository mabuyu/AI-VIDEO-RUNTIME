import type { DemoExecutionStage } from '../types'

export const demoExecutionStages: readonly DemoExecutionStage[] =
  Object.freeze([
    Object.freeze({
      stageId: 'demo-execution-stage-request-received',
      name: 'REQUEST_RECEIVED',
      status: 'SIMULATED',
      description: 'The commercial Demo Request has been received.',
    }),
    Object.freeze({
      stageId: 'demo-execution-stage-intent-analyzed',
      name: 'INTENT_ANALYZED',
      status: 'SIMULATED',
      description: 'Production Intelligence has analyzed the Demo intent.',
    }),
    Object.freeze({
      stageId: 'demo-execution-stage-template-selected',
      name: 'TEMPLATE_SELECTED',
      status: 'SIMULATED',
      description: 'A registered Demo Template has been selected.',
    }),
    Object.freeze({
      stageId: 'demo-execution-stage-scenario-generated',
      name: 'SCENARIO_GENERATED',
      status: 'SIMULATED',
      description: 'A canonical Demo Scenario has been generated.',
    }),
    Object.freeze({
      stageId: 'demo-execution-stage-workflow-created',
      name: 'WORKFLOW_CREATED',
      status: 'SIMULATED',
      description: 'A registered Workflow Contract has been selected.',
    }),
    Object.freeze({
      stageId: 'demo-execution-stage-production-ready',
      name: 'PRODUCTION_READY',
      status: 'SIMULATED',
      description: 'Production handoff is represented for display only.',
    }),
    Object.freeze({
      stageId: 'demo-execution-stage-artifact-ready-simulation',
      name: 'ARTIFACT_READY_SIMULATION',
      status: 'SIMULATED',
      description: 'Artifact availability is represented for display only.',
    }),
    Object.freeze({
      stageId: 'demo-execution-stage-runtime-ready-simulation',
      name: 'RUNTIME_READY_SIMULATION',
      status: 'SIMULATED',
      description: 'Runtime availability is represented for display only.',
    }),
    Object.freeze({
      stageId: 'demo-execution-stage-demo-completed',
      name: 'DEMO_COMPLETED',
      status: 'SIMULATED',
      description: 'The commercial execution walkthrough is complete.',
    }),
  ])
