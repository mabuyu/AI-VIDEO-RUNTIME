import type { CompilerInput, CompilerOutput } from '../compiler'
import type {
  RuntimeDataAdapterDiagnostic,
  RuntimeDataAdapterDiagnosticCode,
  RuntimeDataAdapterResult,
} from './types'

function createAdapterDiagnostic(
  code: RuntimeDataAdapterDiagnosticCode,
  message: string,
  path: string,
  expected?: unknown,
  actual?: unknown,
): RuntimeDataAdapterDiagnostic {
  return {
    source: 'adapter',
    level: 'error',
    code,
    message,
    path,
    expected,
    actual,
  }
}

export function adaptRuntimeData(
  input: Readonly<CompilerInput>,
  output: Readonly<CompilerOutput>,
): RuntimeDataAdapterResult {
  const compilerDiagnostics: RuntimeDataAdapterDiagnostic[] =
    output.diagnostics.map((diagnostic) => ({
      source: 'compiler',
      level: diagnostic.level,
      code: diagnostic.code,
      message: diagnostic.message,
      path: diagnostic.path,
      expected: diagnostic.expected,
      actual: diagnostic.actual,
      suggestion: diagnostic.suggestion,
    }))

  if (compilerDiagnostics.some((diagnostic) => diagnostic.level === 'error')) {
    return { ok: false, diagnostics: compilerDiagnostics }
  }

  const diagnostics = [...compilerDiagnostics]

  if (output.timeline === null) {
    diagnostics.push(createAdapterDiagnostic('TIMELINE_MISSING', 'Compiler output timeline is required', 'output.timeline', 'CompiledTimeline', null))
  }

  if (output.camera === null) {
    diagnostics.push(createAdapterDiagnostic('CAMERA_MISSING', 'Compiler output camera is required', 'output.camera', 'CompiledCameraTrack[]', null))
  }

  if (output.timeline === null || output.camera === null) {
    return { ok: false, diagnostics }
  }

  if (output.timeline.fps !== input.project.fps) {
    diagnostics.push(createAdapterDiagnostic('TIMELINE_FPS_MISMATCH', 'Timeline fps must match project fps', 'output.timeline.fps', input.project.fps, output.timeline.fps))
  }

  if (output.timeline.duration !== input.project.duration) {
    diagnostics.push(createAdapterDiagnostic('TIMELINE_DURATION_MISMATCH', 'Timeline duration must match project duration', 'output.timeline.duration', input.project.duration, output.timeline.duration))
  }

  if (output.camera.length !== input.scenes.length) {
    diagnostics.push(createAdapterDiagnostic('CAMERA_COUNT_MISMATCH', 'Camera track count must match scene count', 'output.camera.length', input.scenes.length, output.camera.length))
  }

  const comparableCameraCount = Math.min(output.camera.length, input.scenes.length)

  for (let index = 0; index < comparableCameraCount; index += 1) {
    const camera = output.camera[index]
    const scene = input.scenes[index]

    if (camera.start !== scene.start) {
      diagnostics.push(createAdapterDiagnostic('CAMERA_START_MISMATCH', 'Camera start must match its scene start', `output.camera[${index}].start`, scene.start, camera.start))
    }

    if (camera.duration !== scene.duration) {
      diagnostics.push(createAdapterDiagnostic('CAMERA_DURATION_MISMATCH', 'Camera duration must match its scene duration', `output.camera[${index}].duration`, scene.duration, camera.duration))
    }
  }

  if (diagnostics.some((diagnostic) => diagnostic.level === 'error')) {
    return { ok: false, diagnostics }
  }

  return {
    ok: true,
    data: {
      project: input.project,
      scenes: input.scenes,
      subtitles: input.subtitles,
      timeline: output.timeline,
      camera: output.camera,
    },
    diagnostics,
  }
}
