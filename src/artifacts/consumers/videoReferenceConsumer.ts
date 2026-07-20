/// <reference types="node" />

import { randomUUID } from 'node:crypto'
import { mkdir, open, rename, rm, stat, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { VideoReference } from '../../providers/video/types'
import {
  type ArtifactEnvelope,
  type ArtifactLocation,
  type ArtifactMetadata,
  type ArtifactSource,
  type ArtifactValidation,
  validateArtifactEnvelope,
} from '../contracts'

const VIDEO_ARTIFACT_DIRECTORY = resolve('output/artifacts/videos')
const VIDEO_MIME_TYPE = 'video/mp4'
const MP4_SIGNATURE_OFFSET = 4
const MP4_SIGNATURE = new Uint8Array([0x66, 0x74, 0x79, 0x70])

export type VideoArtifactSource = Required<
  Pick<ArtifactSource, 'provider' | 'model' | 'generationId'>
>

export interface VideoArtifactConsumerIssue {
  readonly code: string
  readonly message: string
  readonly path?: string
}

export type VideoArtifactConsumerResult =
  | {
      readonly success: true
      readonly artifact: ArtifactEnvelope
    }
  | {
      readonly success: false
      readonly issues: readonly VideoArtifactConsumerIssue[]
    }

function failed(
  code: string,
  message: string,
  path?: string,
): VideoArtifactConsumerResult {
  return {
    success: false,
    issues: [{ code, message, path }],
  }
}

function parseHttpUrl(reference: string): URL | undefined {
  try {
    const url = new URL(reference)
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url
      : undefined
  } catch {
    return undefined
  }
}

function normalizedContentType(response: Response): string {
  return (
    response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ??
    ''
  )
}

function hasMp4Signature(bytes: Uint8Array): boolean {
  if (bytes.byteLength < MP4_SIGNATURE_OFFSET + MP4_SIGNATURE.byteLength) {
    return false
  }

  return MP4_SIGNATURE.every(
    (value, index) => bytes[MP4_SIGNATURE_OFFSET + index] === value,
  )
}

async function finalFileMatches(
  filePath: string,
  expectedSize: number,
): Promise<boolean> {
  const fileInfo = await stat(filePath)
  if (!fileInfo.isFile() || fileInfo.size !== expectedSize) return false

  const handle = await open(filePath, 'r')
  try {
    const signatureBytes = new Uint8Array(
      MP4_SIGNATURE_OFFSET + MP4_SIGNATURE.byteLength,
    )
    const { bytesRead } = await handle.read(
      signatureBytes,
      0,
      signatureBytes.byteLength,
      0,
    )
    return bytesRead === signatureBytes.byteLength && hasMp4Signature(signatureBytes)
  } finally {
    await handle.close()
  }
}

export async function consumeVideoReferenceToArtifact(
  videoReference: VideoReference,
  source: VideoArtifactSource,
): Promise<VideoArtifactConsumerResult> {
  if (
    videoReference?.referenceType !== 'provider-video' ||
    typeof videoReference.reference !== 'string' ||
    !videoReference.reference.trim()
  ) {
    return failed(
      'INVALID_VIDEO_REFERENCE',
      'videoReference must contain a non-empty provider-video reference',
      'videoReference',
    )
  }

  const invalidSourceField = (['provider', 'model', 'generationId'] as const).find(
    (field) => typeof source?.[field] !== 'string' || !source[field].trim(),
  )
  if (invalidSourceField) {
    return failed(
      'INVALID_ARTIFACT_SOURCE',
      `source.${invalidSourceField} must be a non-empty string`,
      `source.${invalidSourceField}`,
    )
  }

  const url = parseHttpUrl(videoReference.reference)
  if (!url) {
    return failed(
      'INVALID_VIDEO_REFERENCE',
      'videoReference.reference must be a valid HTTP(S) URL',
      'videoReference.reference',
    )
  }

  let response: Response
  try {
    response = await fetch(url)
  } catch {
    return failed(
      'VIDEO_DOWNLOAD_FAILED',
      'Video download request failed',
      'videoReference.reference',
    )
  }

  if (!response.ok) {
    return failed(
      'VIDEO_DOWNLOAD_FAILED',
      `Video download failed with HTTP ${response.status}`,
      'videoReference.reference',
    )
  }

  const mimeType = normalizedContentType(response)
  if (mimeType !== VIDEO_MIME_TYPE) {
    return failed(
      'INVALID_VIDEO_CONTENT_TYPE',
      'Downloaded resource must have content type video/mp4',
      'artifact.metadata.mimeType',
    )
  }

  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await response.arrayBuffer())
  } catch {
    return failed('VIDEO_DOWNLOAD_FAILED', 'Video response body could not be read')
  }

  if (bytes.byteLength === 0) {
    return failed(
      'EMPTY_VIDEO_FILE',
      'Downloaded video file must contain data',
      'artifact.metadata.size',
    )
  }

  if (!hasMp4Signature(bytes)) {
    return failed(
      'INVALID_VIDEO_SIGNATURE',
      'Downloaded video must contain an ISO BMFF ftyp signature',
      'artifact.validation.checks',
    )
  }

  const artifactId = randomUUID()
  const finalPath = resolve(VIDEO_ARTIFACT_DIRECTORY, `${artifactId}.mp4`)
  const temporaryPath = `${finalPath}.tmp`
  let accepted = false

  try {
    await mkdir(VIDEO_ARTIFACT_DIRECTORY, { recursive: true })
    await writeFile(temporaryPath, bytes, { flag: 'wx' })

    const candidateInfo = await stat(temporaryPath)
    if (!candidateInfo.isFile() || candidateInfo.size <= 0) {
      return failed(
        'INVALID_VIDEO_FILE',
        'Temporary video candidate must be a non-empty regular file',
      )
    }

    const artifactSource: ArtifactSource = {
      ...source,
      reference: videoReference.reference,
    }
    const location: ArtifactLocation = {
      type: 'local-file',
      path: finalPath,
    }
    const metadata: ArtifactMetadata = {
      mimeType,
      size: candidateInfo.size,
    }
    const checks: ArtifactValidation['checks'] = [
      { name: 'FILE_EXISTS', passed: true },
      { name: 'MIME_TYPE', passed: true },
      { name: 'POSITIVE_SIZE', passed: true },
      { name: 'FILE_SIGNATURE', passed: true },
      { name: 'METADATA_CONSISTENCY', passed: true },
    ]
    const pendingArtifact: ArtifactEnvelope = {
      artifactId,
      artifactType: 'video',
      status: 'PENDING_VALIDATION',
      source: artifactSource,
      location,
      metadata,
      validation: {
        status: 'pending',
        checks,
      },
    }

    const pendingValidationResult = validateArtifactEnvelope(pendingArtifact)
    if (!pendingValidationResult.valid) {
      return {
        success: false,
        issues: pendingValidationResult.issues.map((message) => ({
          code: 'INVALID_ARTIFACT_ENVELOPE',
          message,
        })),
      }
    }

    await rename(temporaryPath, finalPath)

    if (!(await finalFileMatches(finalPath, metadata.size))) {
      return failed(
        'ARTIFACT_ACCEPTANCE_FAILED',
        'Accepted video artifact did not match validated metadata',
        'artifact.location.path',
      )
    }

    const artifact: ArtifactEnvelope = {
      ...pendingArtifact,
      status: 'READY',
      validation: {
        status: 'verified',
        checks,
      },
    }
    const readyValidationResult = validateArtifactEnvelope(artifact)
    if (!readyValidationResult.valid) {
      return {
        success: false,
        issues: readyValidationResult.issues.map((message) => ({
          code: 'INVALID_ARTIFACT_ENVELOPE',
          message,
        })),
      }
    }

    accepted = true
    return { success: true, artifact }
  } catch {
    return failed(
      'ARTIFACT_INGESTION_FAILED',
      'Video artifact could not be accepted locally',
    )
  } finally {
    await Promise.allSettled([
      rm(temporaryPath, { force: true }),
      ...(accepted ? [] : [rm(finalPath, { force: true })]),
    ])
  }
}
