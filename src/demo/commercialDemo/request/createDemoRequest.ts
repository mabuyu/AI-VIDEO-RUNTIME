import type {
  CreateDemoRequestInput,
  DemoMetadataValue,
  DemoRequest,
  DemoRequestMetadata,
} from '../types'

const categories = new Set(['marketing', 'education', 'social'])

function copyMetadataValue(value: DemoMetadataValue): DemoMetadataValue {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => copyMetadataValue(item)))
  }
  if (typeof value === 'object' && value !== null) {
    return Object.freeze(
      Object.fromEntries(
        Object.entries(value).map(([key, child]) => [
          key,
          copyMetadataValue(child),
        ]),
      ),
    )
  }
  return value
}

function copyMetadata(
  metadata: Readonly<Record<string, DemoMetadataValue>> | undefined,
): DemoRequestMetadata {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(metadata ?? {}).map(([key, value]) => [
        key,
        copyMetadataValue(value),
      ]),
    ),
  )
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${field} must be a non-empty string`)
  }
  return value.trim()
}

export function createDemoRequest(
  input: CreateDemoRequestInput,
): DemoRequest {
  if (typeof input !== 'object' || input === null) {
    throw new TypeError('Demo Request input must be an object')
  }
  if (!categories.has(input.category)) {
    throw new TypeError('Demo Request category is unsupported')
  }

  const requestId = requireNonEmptyString(input.requestId, 'requestId')
  const prompt = requireNonEmptyString(input.prompt, 'prompt')
  const requestedTemplate =
    input.requestedTemplate === undefined
      ? undefined
      : requireNonEmptyString(
          input.requestedTemplate,
          'requestedTemplate',
        )

  return Object.freeze({
    requestId,
    prompt,
    category: input.category,
    ...(requestedTemplate === undefined ? {} : { requestedTemplate }),
    metadata: copyMetadata(input.metadata),
  })
}
