import {
  createIssue,
  isRecord,
  validateFiniteNumber,
  validateRequiredString,
} from './helpers'
import type { RuntimeValidationIssue } from './types'
import { RUNTIME_VALIDATION_CODES } from './types'

const STRING_FIELDS = ['title', 'author', 'version', 'background'] as const
const POSITIVE_NUMBER_FIELDS = ['fps', 'width', 'height', 'duration'] as const

export function validateProject(project: unknown): RuntimeValidationIssue[] {
  const issues: RuntimeValidationIssue[] = []

  if (!isRecord(project)) {
    return [
      createIssue({
        severity: 'error',
        code: RUNTIME_VALIDATION_CODES.projectObjectRequired,
        domain: 'project',
        path: 'project',
        message: 'project must be an object',
        expected: 'object',
        actual: project,
      }),
    ]
  }

  for (const field of STRING_FIELDS) {
    validateRequiredString(project[field], 'project', `project.${field}`, issues)
  }

  for (const field of POSITIVE_NUMBER_FIELDS) {
    const value = project[field]
    if (validateFiniteNumber(value, 'project', `project.${field}`, issues) && value <= 0) {
      issues.push(
        createIssue({
          severity: 'error',
          code: RUNTIME_VALIDATION_CODES.positiveNumberRequired,
          domain: 'project',
          path: `project.${field}`,
          message: `project.${field} must be greater than 0`,
          expected: '> 0',
          actual: value,
        }),
      )
    }
  }

  return issues
}
