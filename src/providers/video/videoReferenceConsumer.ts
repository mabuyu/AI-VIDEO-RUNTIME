/// <reference types="node" />

import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'

const VIDEO_OUTPUT_DIRECTORY = resolve('output/videos/generated')
const ALLOWED_VIDEO_CONTENT_TYPES = new Set(['video/mp4'])

export interface VideoReferenceConsumptionIssue {
  readonly code: string
  readonly message: string
  readonly path?: string
}

export interface ConsumedVideoReference {
  readonly filePath: string
  readonly fileSize: number
  readonly contentType: string
}

export type VideoReferenceConsumptionResult =
  | ConsumedVideoReference
  | { readonly issues: readonly VideoReferenceConsumptionIssue[] }

function failure(
  code: string,
  message: string,
  path?: string,
): VideoReferenceConsumptionResult {
  return { issues: [{ code, message, path }] }
}

function parseHttpUrl(videoReference: string): URL | undefined {
  try {
    const url = new URL(videoReference)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    return url
  } catch {
    return undefined
  }
}

export async function consumeVideoReference(
  videoReference: string,
): Promise<VideoReferenceConsumptionResult> {
  if (typeof videoReference !== 'string' || !videoReference.trim()) {
    return failure('INVALID_VIDEO_REFERENCE', 'videoReference must be a non-empty HTTP URL', 'videoReference')
  }

  const url = parseHttpUrl(videoReference)
  if (!url) {
    return failure('INVALID_VIDEO_REFERENCE', 'videoReference must be a valid HTTP URL', 'videoReference')
  }

  let response: Response
  try {
    response = await fetch(url)
  } catch {
    return failure('VIDEO_DOWNLOAD_FAILED', 'Video download request failed', 'videoReference')
  }

  if (!response.ok) {
    return failure('VIDEO_DOWNLOAD_FAILED', `Video download failed with HTTP ${response.status}`, 'videoReference')
  }

  const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ?? ''
  if (!ALLOWED_VIDEO_CONTENT_TYPES.has(contentType)) {
    return failure('INVALID_VIDEO_CONTENT_TYPE', 'Downloaded resource must have content type video/mp4')
  }

  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await response.arrayBuffer())
  } catch {
    return failure('VIDEO_DOWNLOAD_FAILED', 'Video response body could not be read')
  }

  if (bytes.byteLength === 0) {
    return failure('EMPTY_VIDEO_FILE', 'Downloaded video file must contain data')
  }

  const fileName = `${randomUUID()}.mp4`
  const filePath = resolve(VIDEO_OUTPUT_DIRECTORY, fileName)
  const temporaryFilePath = `${filePath}.tmp`

  try {
    await mkdir(VIDEO_OUTPUT_DIRECTORY, { recursive: true })
    await writeFile(temporaryFilePath, bytes, { flag: 'wx' })
    const fileInfo = await stat(temporaryFilePath)
    if (!fileInfo.isFile() || fileInfo.size <= 0) {
      await rm(temporaryFilePath, { force: true })
      return failure('EMPTY_VIDEO_FILE', 'Downloaded video file must contain data')
    }

    await rename(temporaryFilePath, filePath)
    return { filePath, fileSize: fileInfo.size, contentType }
  } catch {
    await rm(temporaryFilePath, { force: true })
    await rm(filePath, { force: true })
    return failure('VIDEO_FILE_WRITE_FAILED', 'Downloaded video could not be saved locally')
  }
}
