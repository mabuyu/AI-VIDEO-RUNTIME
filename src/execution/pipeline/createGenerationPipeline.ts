import type { GenerationOutput as ArtifactGenerationOutput } from '../../artifacts/contracts'
import type {
  GenerationIssue,
  GenerationOutput,
  GenerationResult,
  GenerationTask,
  ProductionPlan,
} from '../../production/contracts'
import {
  validateGenerationResult,
  validateProductionPlan,
} from '../../production/validation'
import type { ProviderAdapter } from '../../providers/contracts'
import type { ProviderRegistry } from '../../providers/registry'
import { adaptGenerationResultToOutput } from '../adapters'
import type {
  ExecutionError,
  ExecutionResult,
  GenerationPipeline,
} from '../types'

function freezeGenerationIssues(
  issues: readonly GenerationIssue[],
): readonly GenerationIssue[] {
  return Object.freeze(issues.map((issue) => Object.freeze({ ...issue })))
}

function freezeGenerationOutput(
  output: GenerationOutput | null,
): GenerationOutput | null {
  return output === null ? null : Object.freeze({ ...output })
}

function freezeGenerationResult(result: GenerationResult): GenerationResult {
  return Object.freeze({
    taskId: result.taskId,
    providerId: result.providerId,
    providerTaskId: result.providerTaskId,
    status: result.status,
    output: freezeGenerationOutput(result.output),
    issues: freezeGenerationIssues(result.issues),
  })
}

function freezeResults(
  results: readonly GenerationResult[],
): readonly GenerationResult[] {
  return Object.freeze(results.map(freezeGenerationResult))
}

function freezeGenerationOutputs(
  outputs: readonly ArtifactGenerationOutput[],
): readonly ArtifactGenerationOutput[] {
  return Object.freeze(
    outputs.map((output) =>
      Object.freeze({
        ...output,
        metadata: Object.freeze({ ...output.metadata }),
      }),
    ),
  )
}

function freezeErrors(
  errors: readonly ExecutionError[],
): readonly ExecutionError[] {
  return Object.freeze(errors.map((error) => Object.freeze({ ...error })))
}

function terminalResult(
  executionId: string,
  planId: string,
  status: 'COMPLETED' | 'FAILED',
  results: readonly GenerationResult[],
  generationOutputs: readonly ArtifactGenerationOutput[],
  errors: readonly ExecutionError[],
): ExecutionResult {
  return Object.freeze({
    executionId,
    planId,
    status,
    results: freezeResults(results),
    generationOutputs: freezeGenerationOutputs(generationOutputs),
    errors: freezeErrors(errors),
  })
}

function failedResult(
  executionId: string,
  planId: string,
  results: readonly GenerationResult[],
  generationOutputs: readonly ArtifactGenerationOutput[],
  error: ExecutionError,
): ExecutionResult {
  return terminalResult(
    executionId,
    planId,
    'FAILED',
    results,
    generationOutputs,
    [error],
  )
}

function getPlanId(candidate: unknown): string {
  if (
    typeof candidate === 'object' &&
    candidate !== null &&
    'planId' in candidate &&
    typeof candidate.planId === 'string'
  ) {
    return candidate.planId
  }

  return ''
}

async function executeTask(
  task: GenerationTask,
  adapter: ProviderAdapter,
): Promise<GenerationResult | ExecutionError> {
  let candidate: unknown

  try {
    candidate = await adapter.generate(task)
  } catch {
    return {
      code: 'PROVIDER_EXECUTION_FAILED',
      message: 'Provider Adapter generate() failed',
      taskId: task.taskId,
      providerId: task.providerId,
    }
  }

  const validation = validateGenerationResult(candidate)
  if (!validation.valid) {
    return {
      code: 'INVALID_GENERATION_RESULT',
      message:
        validation.issues[0]?.message ??
        'Provider Adapter returned an invalid GenerationResult',
      taskId: task.taskId,
      providerId: task.providerId,
    }
  }

  const result = candidate as GenerationResult
  if (
    result.taskId !== task.taskId ||
    result.providerId !== task.providerId ||
    adapter.metadata.id !== task.providerId
  ) {
    return {
      code: 'RESULT_CORRELATION_MISMATCH',
      message:
        'GenerationResult must match the task and selected Provider Adapter',
      taskId: task.taskId,
      providerId: task.providerId,
    }
  }

  return freezeGenerationResult(result)
}

function isExecutionError(
  candidate: GenerationResult | ExecutionError,
): candidate is ExecutionError {
  return 'code' in candidate
}

function taskFailure(result: GenerationResult): ExecutionError {
  return {
    code: 'GENERATION_TASK_FAILED',
    message:
      result.issues[0]?.message ??
      `GenerationTask finished with non-success status ${result.status}`,
    taskId: result.taskId,
    providerId: result.providerId,
  }
}

export function createGenerationPipeline(
  providerRegistry: ProviderRegistry,
): GenerationPipeline {
  return Object.freeze({
    async execute(
      executionId: string,
      plan: ProductionPlan,
    ): Promise<ExecutionResult> {
      const validation = validateProductionPlan(plan)
      if (!validation.valid) {
        return failedResult(executionId, getPlanId(plan), [], [], {
          code: 'INVALID_PRODUCTION_PLAN',
          message:
            validation.issues[0]?.message ??
            'Generation Pipeline requires a valid ProductionPlan',
        })
      }

      const results: GenerationResult[] = []
      const generationOutputs: ArtifactGenerationOutput[] = []

      for (const task of plan.tasks) {
        const adapter = providerRegistry.resolve(task.providerId)
        if (adapter === undefined) {
          return failedResult(
            executionId,
            plan.planId,
            results,
            generationOutputs,
            {
              code: 'PROVIDER_ADAPTER_NOT_FOUND',
              message: `No Provider Adapter is registered for ${task.providerId}`,
              taskId: task.taskId,
              providerId: task.providerId,
            },
          )
        }

        const taskResult = await executeTask(task, adapter)
        if (isExecutionError(taskResult)) {
          return failedResult(
            executionId,
            plan.planId,
            results,
            generationOutputs,
            taskResult,
          )
        }

        results.push(taskResult)

        if (taskResult.status !== 'SUCCEEDED') {
          return failedResult(
            executionId,
            plan.planId,
            results,
            generationOutputs,
            taskFailure(taskResult),
          )
        }

        const adaptation = adaptGenerationResultToOutput(taskResult)
        if (!adaptation.ok) {
          return failedResult(
            executionId,
            plan.planId,
            results,
            generationOutputs,
            {
              code: 'GENERATION_OUTPUT_ADAPTATION_FAILED',
              message:
                adaptation.issues[0]?.message ??
                'GenerationResult could not be adapted to GenerationOutput',
              taskId: taskResult.taskId,
              providerId: taskResult.providerId,
            },
          )
        }

        generationOutputs.push(adaptation.output)
      }

      return terminalResult(
        executionId,
        plan.planId,
        'COMPLETED',
        results,
        generationOutputs,
        [],
      )
    },
  })
}
