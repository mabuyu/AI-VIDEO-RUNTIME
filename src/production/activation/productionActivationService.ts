import { createActivationRequest } from './createActivationRequest'
import { isArtifactRuntimeReference } from '../../artifacts/runtime'
import type {
  ArtifactActivationPort,
  ProductionActivationIssue,
  ProductionActivationRequestInput,
  ProductionActivationResult,
} from './productionActivationTypes'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function freezeIssues(
  issues: readonly ProductionActivationIssue[],
): readonly ProductionActivationIssue[] {
  return Object.freeze(
    issues.map((issue) =>
      Object.freeze({
        code: issue.code,
        message: issue.message,
        ...(issue.path === undefined ? {} : { path: issue.path }),
      }),
    ),
  )
}

function failure(
  issues: readonly ProductionActivationIssue[],
): ProductionActivationResult {
  return Object.freeze({
    ok: false,
    issues: freezeIssues(issues),
  })
}

function mapInvalidResult(
  candidate: unknown,
): ProductionActivationResult {
  if (isRecord(candidate) && typeof candidate.ok === 'boolean') {
    const allowedKeys =
      candidate.ok === true
        ? ['ok', 'artifactRuntimeReference']
        : ['ok', 'issues']
    const extraKeys = Object.keys(candidate).filter(
      (key) => !allowedKeys.includes(key),
    )
    if (extraKeys.length > 0) {
      const forbiddenKey = extraKeys.find((key) => {
        const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '')
        return [
          'artifact',
          'lifecycle',
          'ready',
          'renderer',
          'runtime',
          'storage',
          'validation',
        ].some((prefix) => normalizedKey.startsWith(prefix))
      })

      return failure([
        forbiddenKey === undefined
          ? {
              code: 'INVALID_ACTIVATION_RESULT',
              message:
                'Successful Artifact Activation result must contain only one published Runtime Reference',
            }
          : {
              code: 'FORBIDDEN_FIELD',
              message:
                'Artifact Activation result cannot expose Artifact lifecycle or Runtime authority',
              path: forbiddenKey,
            },
      ])
    }
  }

  if (!isRecord(candidate) || typeof candidate.ok !== 'boolean') {
    return failure([
      {
        code: 'INVALID_ACTIVATION_RESULT',
        message:
          'Artifact Activation Port returned an invalid activation result',
      },
    ])
  }

  if (candidate.ok === true) {
    if (
      Object.keys(candidate).length !== 2 ||
      !isArtifactRuntimeReference(candidate.artifactRuntimeReference)
    ) {
      return failure([
        {
          code: 'INVALID_ACTIVATION_RESULT',
          message:
            'Artifact Activation Port did not return an immutable published Runtime Reference',
        },
      ])
    }

    const accepted = candidate as Extract<
      ProductionActivationResult,
      { readonly ok: true }
    >
    return Object.freeze({
      ok: true,
      artifactRuntimeReference: accepted.artifactRuntimeReference,
    })
  }

  if (
    Object.keys(candidate).length !== 2 ||
    !Array.isArray(candidate.issues) ||
    candidate.issues.length === 0 ||
    candidate.issues.some(
      (issue) =>
        !isRecord(issue) ||
        typeof issue.code !== 'string' ||
        !issue.code.trim() ||
        typeof issue.message !== 'string' ||
        !issue.message.trim(),
    )
  ) {
    return failure([
      {
        code: 'INVALID_ACTIVATION_RESULT',
        message:
          'Artifact Activation Port returned an invalid activation result',
      },
    ])
  }

  const issues = candidate.issues as readonly ProductionActivationIssue[]
  return failure(issues)
}

export class ProductionActivationService {
  readonly #artifactActivationPort: ArtifactActivationPort

  constructor(artifactActivationPort: ArtifactActivationPort) {
    this.#artifactActivationPort = artifactActivationPort
  }

  async activate(
    input: ProductionActivationRequestInput,
  ): Promise<ProductionActivationResult> {
    const creation = createActivationRequest(input)
    if (!creation.ok) {
      return failure(creation.issues)
    }

    let portResult: unknown
    try {
      portResult = await this.#artifactActivationPort.activate(creation.request)
    } catch {
      return failure([
        {
          code: 'ARTIFACT_ACTIVATION_FAILED',
          message: 'Artifact Activation Port rejected or failed activation',
        },
      ])
    }

    return mapInvalidResult(portResult)
  }
}

export function createProductionActivationService(
  artifactActivationPort: ArtifactActivationPort,
): ProductionActivationService {
  const service = new ProductionActivationService(artifactActivationPort)
  Object.freeze(service)
  return service
}
