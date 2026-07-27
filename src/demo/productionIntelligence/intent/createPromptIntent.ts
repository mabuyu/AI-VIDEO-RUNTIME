import type { DemoScenarioCategory } from '../../productionRuntimeDemo'
import type {
  PromptExtractedRequirements,
  PromptIntent,
} from '../types'

const categoryRules: Readonly<
  Record<DemoScenarioCategory, readonly string[]>
> = Object.freeze({
  marketing: Object.freeze([
    '宣传',
    '推广',
    '产品',
    '品牌',
    'marketing',
    'promotion',
    'product',
    'brand',
  ]),
  education: Object.freeze([
    '教育',
    '教程',
    '科普',
    '课程',
    '教学',
    'education',
    'tutorial',
    'explain',
    'lesson',
  ]),
  social: Object.freeze([
    '短视频',
    '社交',
    '抖音',
    '小红书',
    'tiktok',
    'shorts',
    'social',
    'instagram',
  ]),
})

const objectiveByCategory: Readonly<
  Record<DemoScenarioCategory, string>
> = Object.freeze({
  marketing: 'product introduction',
  education: 'concept explanation',
  social: 'audience engagement',
})

const defaultDurationByCategory: Readonly<
  Record<DemoScenarioCategory, number>
> = Object.freeze({
  marketing: 30,
  education: 45,
  social: 15,
})

function includesAny(prompt: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => prompt.includes(keyword))
}

function extractCategory(normalizedPrompt: string): DemoScenarioCategory {
  if (includesAny(normalizedPrompt, categoryRules.social)) {
    return 'social'
  }
  if (includesAny(normalizedPrompt, categoryRules.education)) {
    return 'education'
  }
  return 'marketing'
}

function extractAudience(normalizedPrompt: string): string {
  if (includesAny(normalizedPrompt, ['年轻', '青年', 'young'])) {
    return 'young'
  }
  if (includesAny(normalizedPrompt, ['初学', '入门', 'beginner'])) {
    return 'beginner'
  }
  if (includesAny(normalizedPrompt, ['学生', 'student'])) {
    return 'students'
  }
  if (includesAny(normalizedPrompt, ['企业', 'business', 'professional'])) {
    return 'business'
  }
  return 'general audience'
}

function extractStyle(normalizedPrompt: string): string {
  if (includesAny(normalizedPrompt, ['科技', 'technology', 'tech'])) {
    return 'technology'
  }
  if (includesAny(normalizedPrompt, ['电影', 'cinematic'])) {
    return 'cinematic'
  }
  if (includesAny(normalizedPrompt, ['极简', 'minimal'])) {
    return 'minimal'
  }
  if (includesAny(normalizedPrompt, ['活力', 'energetic'])) {
    return 'energetic'
  }
  return 'polished'
}

function extractDurationSeconds(
  rawPrompt: string,
  category: DemoScenarioCategory,
): number {
  const match = rawPrompt.match(
    /(\d+(?:\.\d+)?)\s*(?:秒|s(?:ec(?:ond)?s?)?)/i,
  )
  if (match !== null) {
    const duration = Number(match[1])
    if (Number.isFinite(duration) && duration > 0) {
      return duration
    }
  }
  return defaultDurationByCategory[category]
}

function extractPlatform(normalizedPrompt: string): string | undefined {
  const platforms = Object.freeze([
    'YouTube Shorts',
    'TikTok',
    'Instagram',
    '抖音',
    '小红书',
    '哔哩哔哩',
  ])
  return platforms.find((platform) =>
    normalizedPrompt.includes(platform.toLowerCase()),
  )
}

function extractSubject(
  rawPrompt: string,
  category: DemoScenarioCategory,
): string {
  const firstClause = rawPrompt.split(/[，,。.!！?？]/u)[0].trim()
  const withoutDuration = firstClause.replace(
    /\d+(?:\.\d+)?\s*(?:秒|s(?:ec(?:ond)?s?)?)/gi,
    '',
  )
  const stripped = withoutDuration
    .replace(/^(?:请)?(?:制作|创建|做|生成)(?:一个|一支|一段)?/u, '')
    .replace(
      /(?:产品)?宣传视频|产品介绍视频|教育视频|教学视频|科普视频|教程视频|短视频|视频$/u,
      '',
    )
    .trim()

  if (stripped.length > 0) {
    return stripped
  }

  if (category === 'education') {
    return 'requested topic'
  }
  if (category === 'social') {
    return 'requested social topic'
  }
  return 'featured product'
}

function createIntentId(): string {
  return `prompt-intent-${globalThis.crypto.randomUUID()}`
}

export function createPromptIntent(rawPrompt: string): PromptIntent {
  if (typeof rawPrompt !== 'string' || rawPrompt.trim().length === 0) {
    throw new TypeError('rawPrompt must be a non-empty string')
  }

  const copiedPrompt = rawPrompt.trim()
  const normalizedPrompt = copiedPrompt.toLowerCase()
  const category = extractCategory(normalizedPrompt)
  const platform = extractPlatform(normalizedPrompt)
  const requirements: PromptExtractedRequirements = Object.freeze({
    subject: extractSubject(copiedPrompt, category),
    audience: extractAudience(normalizedPrompt),
    style: extractStyle(normalizedPrompt),
    duration: `${extractDurationSeconds(copiedPrompt, category)}s`,
    ...(platform === undefined ? {} : { platform }),
  })

  return Object.freeze({
    intentId: createIntentId(),
    rawPrompt: copiedPrompt,
    category,
    objective: objectiveByCategory[category],
    extractedRequirements: requirements,
  })
}
