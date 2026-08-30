import type {
  ApplicationErrorCode,
  ApplicationResult,
} from './contracts'

export function applicationSuccess<T>(value: T): ApplicationResult<T> {
  return Object.freeze({ ok: true, value })
}

export function applicationFailure<T = never>(
  code: ApplicationErrorCode,
  message: string,
): ApplicationResult<T> {
  return Object.freeze({
    ok: false,
    error: Object.freeze({ code, message }),
  })
}
