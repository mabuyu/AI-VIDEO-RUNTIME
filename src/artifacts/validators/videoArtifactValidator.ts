/// <reference types="node" />

import { open, stat } from 'node:fs/promises'
import type {
  ArtifactEnvelope,
  ArtifactValidationCheck,
} from '../contracts'
import type {
  ArtifactValidationIssue,
  ArtifactValidationResult,
  ArtifactValidator,
} from './artifactValidator'

const VIDEO_MIME_TYPE = 'video/mp4'
const MP4_SIGNATURE_OFFSET = 4
const MP4_SIGNATURE = new Uint8Array([0x66, 0x74, 0x79, 0x70])

function check(
  name: string,
  passed: boolean,
  message?: string,
): ArtifactValidationCheck {
  return { name, passed, ...(message === undefined ? {} : { message }) }
}

function issue(
  code: string,
  message: string,
  path?: string,
): ArtifactValidationIssue {
  return { code, message, ...(path === undefined ? {} : { path }) }
}

async function readSignature(filePath: string): Promise<Uint8Array | undefined> {
  let handle
  try {
    handle = await open(filePath, 'r')
    const bytes = new Uint8Array(
      MP4_SIGNATURE_OFFSET + MP4_SIGNATURE.byteLength,
    )
    const { bytesRead } = await handle.read(bytes, 0, bytes.byteLength, 0)
    return bytesRead === bytes.byteLength ? bytes : undefined
  } catch {
    return undefined
  } finally {
    await handle?.close()
  }
}

function hasIsoBmffFtypSignature(bytes: Uint8Array | undefined): boolean {
  return (
    bytes !== undefined &&
    MP4_SIGNATURE.every(
      (value, index) => bytes[MP4_SIGNATURE_OFFSET + index] === value,
    )
  )
}

export const videoArtifactValidator: ArtifactValidator = {
  async validate(
    artifact: ArtifactEnvelope,
  ): Promise<ArtifactValidationResult> {
    const checks: ArtifactValidationCheck[] = []
    const issues: ArtifactValidationIssue[] = []

    let fileSize: number | undefined
    let fileExists = false
    try {
      const fileInfo = await stat(artifact.location.path)
      fileExists = fileInfo.isFile()
      if (fileExists) fileSize = fileInfo.size
    } catch {
      fileExists = false
    }

    checks.push(
      check(
        'FILE_EXISTS',
        fileExists,
        fileExists ? undefined : 'Artifact path must reference an existing file',
      ),
    )
    if (!fileExists) {
      issues.push(
        issue(
          'ARTIFACT_FILE_NOT_FOUND',
          'Artifact path must reference an existing regular file',
          'artifact.location.path',
        ),
      )
    }

    const mimeTypeValid = artifact.metadata.mimeType === VIDEO_MIME_TYPE
    checks.push(
      check(
        'MIME_TYPE',
        mimeTypeValid,
        mimeTypeValid ? undefined : 'Video artifact MIME type must be video/mp4',
      ),
    )
    if (!mimeTypeValid) {
      issues.push(
        issue(
          'INVALID_VIDEO_MIME_TYPE',
          'Video artifact MIME type must be video/mp4',
          'artifact.metadata.mimeType',
        ),
      )
    }

    const positiveSize = fileSize !== undefined && fileSize > 0
    checks.push(
      check(
        'POSITIVE_SIZE',
        positiveSize,
        positiveSize ? undefined : 'Video artifact file size must be greater than zero',
      ),
    )
    if (!positiveSize) {
      issues.push(
        issue(
          'INVALID_VIDEO_SIZE',
          'Video artifact file size must be greater than zero',
          'artifact.location.path',
        ),
      )
    }

    const signatureValid =
      fileExists &&
      hasIsoBmffFtypSignature(await readSignature(artifact.location.path))
    checks.push(
      check(
        'FILE_SIGNATURE',
        signatureValid,
        signatureValid
          ? undefined
          : 'Video artifact must contain an ISO BMFF ftyp signature',
      ),
    )
    if (!signatureValid) {
      issues.push(
        issue(
          'INVALID_VIDEO_SIGNATURE',
          'Video artifact must contain an ISO BMFF ftyp signature',
          'artifact.location.path',
        ),
      )
    }

    const metadataSizeConsistent =
      fileSize !== undefined && artifact.metadata.size === fileSize
    checks.push(
      check(
        'METADATA_CONSISTENCY',
        metadataSizeConsistent,
        metadataSizeConsistent
          ? undefined
          : 'Artifact metadata.size must match the observed file size',
      ),
    )
    if (!metadataSizeConsistent) {
      issues.push(
        issue(
          'ARTIFACT_METADATA_SIZE_MISMATCH',
          'Artifact metadata.size must match the observed file size',
          'artifact.metadata.size',
        ),
      )
    }

    const valid = issues.length === 0
    return {
      valid,
      validation: {
        status: valid ? 'verified' : 'failed',
        checks,
      },
      issues,
    }
  },
}
