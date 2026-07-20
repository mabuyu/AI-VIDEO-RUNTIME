/// <reference types="node" />

import { randomUUID } from 'node:crypto'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { VideoReference } from '../../providers/video/types'
import {
  type ArtifactEnvelope,
  type ArtifactMetadata,
  type ArtifactSource,
} from '../contracts'
import { validateArtifact } from '../validation/validateArtifact'

const VIDEO_ARTIFACT_DIRECTORY = resolve('output/artifacts/videos')

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
  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await response.arrayBuffer())
  } catch {
    return failed('VIDEO_DOWNLOAD_FAILED', 'Video response body could not be read')
  }

  const artifactId = randomUUID()
  const finalPath = resolve(VIDEO_ARTIFACT_DIRECTORY, `${artifactId}.mp4`)
  const temporaryPath = `${finalPath}.tmp`
  let accepted = false

  try {
    await mkdir(VIDEO_ARTIFACT_DIRECTORY, { recursive: true })
    await writeFile(temporaryPath, bytes, { flag: 'wx' })

    const artifactSource: ArtifactSource = {
      ...source,
      reference: videoReference.reference,
    }
    const metadata: ArtifactMetadata = {
      mimeType,
      size: bytes.byteLength,
    }
    const pendingArtifact: ArtifactEnvelope = {
      artifactId,
      artifactType: 'video',
      status: 'PENDING_VALIDATION',
      source: artifactSource,
      location: { type: 'local-file', path: temporaryPath },
      metadata,
      validation: {
        status: 'pending',
        checks: [],
      },
    }

    const candidateValidation = await validateArtifact(pendingArtifact)
    if (candidateValidation.artifact.status !== 'READY') {
      return {
        success: false,
        issues: candidateValidation.issues,
      }
    }

    await rename(temporaryPath, finalPath)

    const acceptedCandidate: ArtifactEnvelope = {
      ...pendingArtifact,
      location: { type: 'local-file', path: finalPath },
    }
    const acceptedValidation = await validateArtifact(acceptedCandidate)
    if (acceptedValidation.artifact.status !== 'READY') {
      return {
        success: false,
        issues: acceptedValidation.issues,
      }
    }

    accepted = true
    return { success: true, artifact: acceptedValidation.artifact }
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
