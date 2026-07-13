import type {
  CompilerInputCandidate,
  PromptCompilerInputAdapterResult,
  PromptCompilerInputIssue,
  PromptDurationIntent,
  PromptProductionInput,
} from './types'
import { SUPPORTED_PROMPT_CONTRACT_VERSION } from './types'

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireRecord(
  value: unknown,
  path: string,
  issues: PromptCompilerInputIssue[],
): value is UnknownRecord {
  if (isRecord(value)) return true
  issues.push({ code: 'MISSING_REQUIRED_FIELD', message: `${path} must be an object`, path })
  return false
}

function requireString(record: UnknownRecord, field: string, path: string, issues: PromptCompilerInputIssue[]): void {
  const value = record[field]
  if (typeof value !== 'string' || value.trim().length === 0) {
    issues.push({ code: 'INCOMPLETE_INTENT', message: `${path} must be a non-empty string`, path })
  }
}

function validateDuration(value: unknown, path: string, issues: PromptCompilerInputIssue[]): void {
  if (!requireRecord(value, path, issues)) return
  if (typeof value.value !== 'number' || !Number.isFinite(value.value) || value.value <= 0) {
    issues.push({ code: 'INVALID_FIELD', message: `${path}.value must be a finite number greater than zero`, path: `${path}.value` })
  }
  if (value.unit !== 'seconds' && value.unit !== 'minutes') {
    issues.push({ code: 'INVALID_FIELD', message: `${path}.unit must be seconds or minutes`, path: `${path}.unit` })
  }
  if (value.flexibility !== 'exact' && value.flexibility !== 'approximate') {
    issues.push({ code: 'INVALID_FIELD', message: `${path}.flexibility must be exact or approximate`, path: `${path}.flexibility` })
  }
}

function validateStringArray(value: unknown, path: string, issues: PromptCompilerInputIssue[], nonEmpty: boolean): void {
  if (!Array.isArray(value) || (nonEmpty && value.length === 0)) {
    issues.push({ code: 'INCOMPLETE_INTENT', message: `${path} must be ${nonEmpty ? 'a non-empty' : 'an'} array`, path })
    return
  }
  value.forEach((item, index) => {
    if (typeof item !== 'string' || item.trim().length === 0) {
      issues.push({ code: 'INVALID_FIELD', message: `${path}[${index}] must be a non-empty string`, path: `${path}[${index}]` })
    }
  })
}

function validateIntent(intent: UnknownRecord, issues: PromptCompilerInputIssue[]): void {
  const project = intent.project
  if (requireRecord(project, 'intent.project', issues)) {
    for (const field of ['title', 'purpose', 'audience']) requireString(project, field, `intent.project.${field}`, issues)
    validateDuration(project.targetDuration, 'intent.project.targetDuration', issues)
  }

  const content = intent.content
  if (requireRecord(content, 'intent.content', issues)) {
    for (const field of ['topic', 'message']) requireString(content, field, `intent.content.${field}`, issues)
    validateStringArray(content.keyPoints, 'intent.content.keyPoints', issues, true)
  }

  const style = intent.style
  if (requireRecord(style, 'intent.style', issues)) {
    for (const field of ['visualStyle', 'tone', 'pace', 'atmosphere']) requireString(style, field, `intent.style.${field}`, issues)
  }

  const timeline = intent.timeline
  if (requireRecord(timeline, 'intent.timeline', issues)) {
    for (const field of ['pacing', 'structure']) requireString(timeline, field, `intent.timeline.${field}`, issues)
    validateStringArray(timeline.emphasis, 'intent.timeline.emphasis', issues, false)
  }

  if (!Array.isArray(intent.scenes) || intent.scenes.length === 0) {
    issues.push({ code: 'INCOMPLETE_INTENT', message: 'intent.scenes must be a non-empty array', path: 'intent.scenes' })
  } else {
    const ids = new Set<string>()
    intent.scenes.forEach((scene, index) => {
      const path = `intent.scenes[${index}]`
      if (!requireRecord(scene, path, issues)) return
      for (const field of ['id', 'purpose', 'message', 'transitionIntent']) requireString(scene, field, `${path}.${field}`, issues)
      validateDuration(scene.durationIntent, `${path}.durationIntent`, issues)
      if (typeof scene.id === 'string' && scene.id.trim().length > 0) {
        if (ids.has(scene.id)) issues.push({ code: 'INVALID_FIELD', message: `${path}.id must be unique`, path: `${path}.id` })
        ids.add(scene.id)
      }
    })
  }

  const audio = intent.audio
  if (requireRecord(audio, 'intent.audio', issues)) {
    for (const field of ['intent', 'mood', 'voice', 'silencePreference']) requireString(audio, field, `intent.audio.${field}`, issues)
  }
}

export function adaptPromptSemanticIntent(candidate: unknown): PromptCompilerInputAdapterResult {
  const issues: PromptCompilerInputIssue[] = []
  if (!isRecord(candidate)) {
    return { success: false, issues: [{ code: 'INVALID_INPUT', message: 'input must be an object', path: '$' }] }
  }

  if (String(candidate.promptContractVersion) !== SUPPORTED_PROMPT_CONTRACT_VERSION) {
    issues.push({
      code: 'UNSUPPORTED_PROMPT_CONTRACT_VERSION',
      message: `promptContractVersion must be ${SUPPORTED_PROMPT_CONTRACT_VERSION}`,
      path: 'promptContractVersion',
    })
  }

  if (!requireRecord(candidate.intent, 'intent', issues)) return { success: false, issues }
  validateIntent(candidate.intent, issues)
  if (issues.length > 0) return { success: false, issues }

  const { project, content, style, scenes, timeline, audio } = (candidate as unknown as PromptProductionInput).intent
  const input: CompilerInputCandidate = {
    projectIntent: project,
    contentIntent: content,
    styleIntent: style,
    sceneIntents: scenes,
    timelineIntent: timeline,
    audioIntent: audio,
  }
  return { success: true, input }
}

export type { PromptDurationIntent }
