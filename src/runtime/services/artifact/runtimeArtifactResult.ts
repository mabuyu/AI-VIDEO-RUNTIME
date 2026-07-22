import type {
  RuntimeArtifactConsumptionIssue,
  RuntimeArtifactConsumptionIssueCode,
  RuntimeArtifactConsumptionResult,
  RuntimeArtifactResolutionResult,
} from './types'

export function createRuntimeArtifactIssue(
  code: RuntimeArtifactConsumptionIssueCode,
  message: string,
): RuntimeArtifactConsumptionIssue {
  return Object.freeze({ code, message })
}

function freezeIssues(
  issues: readonly RuntimeArtifactConsumptionIssue[],
): readonly RuntimeArtifactConsumptionIssue[] {
  return Object.freeze(
    issues.map((issue) => createRuntimeArtifactIssue(issue.code, issue.message)),
  )
}

export function createRuntimeArtifactConsumptionFailure(
  issues: readonly RuntimeArtifactConsumptionIssue[],
): RuntimeArtifactConsumptionResult {
  return Object.freeze({ ok: false, issues: freezeIssues(issues) })
}

export function createRuntimeArtifactResolutionFailure(
  issues: readonly RuntimeArtifactConsumptionIssue[],
): RuntimeArtifactResolutionResult {
  return Object.freeze({ ok: false, issues: freezeIssues(issues) })
}
