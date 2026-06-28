import type {
  RuntimeValidationDomain,
  RuntimeValidationIssue,
  RuntimeValidationIssueCode,
  RuntimeValidationSeverity,
} from './types'
import { RUNTIME_VALIDATION_CODES } from './types'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

interface CreateIssueInput {
  readonly severity: RuntimeValidationSeverity
  readonly code: RuntimeValidationIssueCode
  readonly domain: RuntimeValidationDomain
  readonly path: string
  readonly message: string
  readonly expected?: unknown
  readonly actual?: unknown
  readonly suggestion?: string
}

export function createIssue(input: CreateIssueInput): RuntimeValidationIssue {
  return input
}

export function validateRequiredString(
  value: unknown,
  domain: RuntimeValidationDomain,
  path: string,
  issues: RuntimeValidationIssue[],
): value is string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return true
  }

  issues.push(
    createIssue({
      severity: 'error',
      code: RUNTIME_VALIDATION_CODES.requiredString,
      domain,
      path,
      message: `${path} must be a non-empty string`,
      expected: 'non-empty string',
      actual: value,
    }),
  )
  return false
}

export function validateFiniteNumber(
  value: unknown,
  domain: RuntimeValidationDomain,
  path: string,
  issues: RuntimeValidationIssue[],
): value is number {
  if (isFiniteNumber(value)) {
    return true
  }

  issues.push(
    createIssue({
      severity: 'error',
      code: RUNTIME_VALIDATION_CODES.finiteNumberRequired,
      domain,
      path,
      message: `${path} must be a finite number`,
      expected: 'finite number',
      actual: value,
    }),
  )
  return false
}
