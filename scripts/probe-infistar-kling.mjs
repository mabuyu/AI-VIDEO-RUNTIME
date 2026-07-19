const DEFAULT_MODEL = 'kling-v2-5-turbo'
const CAPABILITY_PATH = 'v1/models'
const REQUEST_TIMEOUT_MS = 10_000

const PROVIDER_ERROR = Object.freeze({
  AUTH_FAILED: 'AUTH_FAILED',
  MODEL_NOT_AVAILABLE: 'MODEL_NOT_AVAILABLE',
  QUOTA_EXHAUSTED: 'QUOTA_EXHAUSTED',
  ENDPOINT_INVALID: 'ENDPOINT_INVALID',
  UNKNOWN_PROVIDER_ERROR: 'UNKNOWN_PROVIDER_ERROR',
})

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readText(value) {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return ''
}

function readProviderError(body) {
  if (!isRecord(body)) return { code: '', message: '' }
  const data = isRecord(body.data) ? body.data : undefined
  const candidates = [
    isRecord(body.error) ? body.error : undefined,
    isRecord(data?.error) ? data.error : undefined,
    body,
    data,
  ]

  for (const candidate of candidates) {
    if (!candidate) continue
    const code = readText(candidate.code ?? candidate.error_code ?? candidate.errorCode)
    const message = readText(candidate.message ?? candidate.error_message ?? candidate.errorMessage)
    if (code || message) return { code, message }
  }
  return { code: '', message: '' }
}

function classifyProviderError(httpStatus, body) {
  const providerError = readProviderError(body)
  const diagnostic = `${providerError.code} ${providerError.message}`.toLowerCase()

  if (httpStatus === 429
    || /fail_to_fetch_task|quota|rate.?limit/.test(diagnostic)) {
    return PROVIDER_ERROR.QUOTA_EXHAUSTED
  }
  if (/model.*(not.*available|unsupported|denied|not.*found)/.test(diagnostic)) {
    return PROVIDER_ERROR.MODEL_NOT_AVAILABLE
  }
  if (httpStatus === 401
    || /unauthori[sz]ed|authentication|invalid.*(api.?key|token)/.test(diagnostic)) {
    return PROVIDER_ERROR.AUTH_FAILED
  }
  if (httpStatus === 403) return PROVIDER_ERROR.AUTH_FAILED
  if (httpStatus === 404) return PROVIDER_ERROR.ENDPOINT_INVALID
  return PROVIDER_ERROR.UNKNOWN_PROVIDER_ERROR
}

function parseBody(text) {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function collectModelIds(body) {
  const candidates = Array.isArray(body)
    ? body
    : isRecord(body) && Array.isArray(body.data)
      ? body.data
      : isRecord(body) && Array.isArray(body.models)
        ? body.models
        : null

  if (!candidates) return null
  const ids = candidates.flatMap((candidate) => {
    if (typeof candidate === 'string' && candidate.trim()) return [candidate.trim()]
    if (!isRecord(candidate)) return []
    const id = candidate.id ?? candidate.model ?? candidate.name
    return typeof id === 'string' && id.trim() ? [id.trim()] : []
  })
  return ids
}

async function safeGet(url, headers = undefined) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    return {
      reached: true,
      status: response.status,
      body: parseBody(await response.text()),
    }
  } catch {
    return { reached: false, status: null, body: null }
  }
}

function printReport(report) {
  console.log('Infistar Kling Provider Availability Probe')
  console.log(JSON.stringify(report, null, 2))
}

const apiKey = process.env.KLING_API_KEY?.trim() ?? ''
const configuredModel = process.env.KLING_MODEL?.trim() ?? ''
const configuredBaseUrl = process.env.KLING_BASE_URL?.trim() ?? ''
const model = configuredModel || DEFAULT_MODEL

const report = {
  environment: {
    KLING_API_KEY: apiKey ? 'present' : 'missing',
    KLING_MODEL: configuredModel ? 'present' : `missing; using default ${DEFAULT_MODEL}`,
    KLING_BASE_URL: configuredBaseUrl ? 'present' : 'missing',
  },
  endpoint: {
    status: 'not_checked',
    httpStatus: null,
  },
  capability: {
    check: 'GET /v1/models',
    status: 'not_checked',
    httpStatus: null,
  },
  model: {
    name: model,
    status: 'unknown',
  },
  providerError: {
    classification: null,
  },
  safety: {
    method: 'GET only',
    videoTaskCreated: false,
  },
}

const knownQuotaFailure = classifyProviderError(429, {
  code: 'fail_to_fetch_task',
  message: 'Upstream quota exhausted',
})
if (knownQuotaFailure !== PROVIDER_ERROR.QUOTA_EXHAUSTED) {
  throw new Error('Provider error classifier failed its quota-exhausted invariant')
}

if (!configuredBaseUrl) {
  printReport(report)
  process.exitCode = 1
} else {
  let baseUrl
  try {
    baseUrl = new URL(configuredBaseUrl)
    if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password) {
      throw new Error('Invalid Base URL')
    }
  } catch {
    report.endpoint.status = 'invalid'
    report.providerError.classification = PROVIDER_ERROR.ENDPOINT_INVALID
    printReport(report)
    process.exitCode = 1
  }

  if (baseUrl) {
    const normalizedBaseUrl = `${baseUrl.toString().replace(/\/+$/, '')}/`
    const endpointResult = await safeGet(normalizedBaseUrl)
    report.endpoint.status = endpointResult.reached ? 'reachable' : 'unreachable'
    report.endpoint.httpStatus = endpointResult.status

    if (!endpointResult.reached) {
      report.providerError.classification = PROVIDER_ERROR.ENDPOINT_INVALID
      printReport(report)
      process.exitCode = 1
    } else if (!apiKey) {
      printReport(report)
      process.exitCode = 1
    } else {
      const capabilityUrl = new URL(CAPABILITY_PATH, normalizedBaseUrl)
      const capabilityResult = await safeGet(capabilityUrl, {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      })
      report.capability.status = capabilityResult.reached ? 'reachable' : 'unreachable'
      report.capability.httpStatus = capabilityResult.status

      if (!capabilityResult.reached) {
        report.providerError.classification = PROVIDER_ERROR.ENDPOINT_INVALID
        process.exitCode = 1
      } else if (capabilityResult.status >= 200 && capabilityResult.status < 300) {
        const modelIds = collectModelIds(capabilityResult.body)
        if (modelIds) {
          report.model.status = modelIds.includes(model) ? 'available' : 'denied'
          if (report.model.status === 'denied') {
            report.providerError.classification = PROVIDER_ERROR.MODEL_NOT_AVAILABLE
            process.exitCode = 1
          }
        }
      } else {
        const classification = classifyProviderError(capabilityResult.status, capabilityResult.body)
        report.providerError.classification = classification
        report.model.status = [PROVIDER_ERROR.AUTH_FAILED, PROVIDER_ERROR.MODEL_NOT_AVAILABLE]
          .includes(classification) ? 'denied' : 'unknown'
        process.exitCode = 1
      }

      printReport(report)
    }
  }
}
