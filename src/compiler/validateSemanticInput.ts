import type {
  CompilerDiagnostic,
  CompilerInput,
  SceneCameraIntent,
  SemanticProject,
  SemanticScene,
  SemanticSubtitle,
} from './types'

const SUPPORTED_SCENE_TYPES = ['hook', 'problem', 'value', 'contrast']

type TimedItem = {
  start: number
  duration: number
}

type IndexedTimedItem<T extends TimedItem> = {
  index: number
  item: T
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isTimedItem(value: unknown): value is TimedItem {
  return (
    isRecord(value) &&
    isFiniteNumber(value.start) &&
    isFiniteNumber(value.duration)
  )
}

function addDiagnostic(
  diagnostics: CompilerDiagnostic[],
  diagnostic: CompilerDiagnostic
) {
  diagnostics.push(diagnostic)
}

function validateStringField(
  diagnostics: CompilerDiagnostic[],
  target: Record<string, unknown>,
  field: string,
  path: string
) {
  if (typeof target[field] !== 'string' || target[field] === '') {
    addDiagnostic(diagnostics, {
      level: 'error',
      code: 'REQUIRED_STRING_FIELD',
      message: `${path}.${field} must be a non-empty string`,
      path: `${path}.${field}`,
      expected: 'non-empty string',
      actual: target[field],
      suggestion: `Provide ${path}.${field} as a non-empty string.`,
    })
  }
}

function validateNumberField(
  diagnostics: CompilerDiagnostic[],
  target: Record<string, unknown>,
  field: string,
  path: string
) {
  if (!isFiniteNumber(target[field])) {
    addDiagnostic(diagnostics, {
      level: 'error',
      code: 'REQUIRED_NUMBER_FIELD',
      message: `${path}.${field} must be a finite number`,
      path: `${path}.${field}`,
      expected: 'finite number',
      actual: target[field],
      suggestion: `Provide ${path}.${field} as a number in ms when it is a time field.`,
    })
  }
}

function validatePositiveNumberField(
  diagnostics: CompilerDiagnostic[],
  target: Record<string, unknown>,
  field: string,
  path: string
) {
  validateNumberField(diagnostics, target, field, path)

  if (isFiniteNumber(target[field]) && target[field] <= 0) {
    addDiagnostic(diagnostics, {
      level: 'error',
      code: 'REQUIRED_POSITIVE_NUMBER_FIELD',
      message: `${path}.${field} must be greater than 0`,
      path: `${path}.${field}`,
      expected: '> 0',
      actual: target[field],
      suggestion: `Provide ${path}.${field} as a positive number.`,
    })
  }
}

function validateProject(
  diagnostics: CompilerDiagnostic[],
  project: SemanticProject
) {
  if (!isRecord(project)) {
    addDiagnostic(diagnostics, {
      level: 'error',
      code: 'PROJECT_REQUIRED',
      message: 'project must be an object',
      path: 'project',
      expected: 'object',
      actual: project,
      suggestion: 'Provide a project object before compiling.',
    })
    return
  }

  validateStringField(diagnostics, project, 'title', 'project')
  validateStringField(diagnostics, project, 'author', 'project')
  validateStringField(diagnostics, project, 'version', 'project')
  validatePositiveNumberField(diagnostics, project, 'fps', 'project')
  validatePositiveNumberField(diagnostics, project, 'width', 'project')
  validatePositiveNumberField(diagnostics, project, 'height', 'project')
  validatePositiveNumberField(diagnostics, project, 'duration', 'project')
  validateStringField(diagnostics, project, 'background', 'project')
}

function validateCamera(
  diagnostics: CompilerDiagnostic[],
  camera: SceneCameraIntent,
  path: string
) {
  if (!isRecord(camera)) {
    addDiagnostic(diagnostics, {
      level: 'error',
      code: 'SCENE_CAMERA_REQUIRED',
      message: `${path} must be an object`,
      path,
      expected: 'object',
      actual: camera,
      suggestion: 'Provide camera intent on every scene.',
    })
    return
  }

  validateNumberField(diagnostics, camera, 'scaleFrom', path)
  validateNumberField(diagnostics, camera, 'scaleTo', path)
  validateNumberField(diagnostics, camera, 'xFrom', path)
  validateNumberField(diagnostics, camera, 'xTo', path)
  validateNumberField(diagnostics, camera, 'yFrom', path)
  validateNumberField(diagnostics, camera, 'yTo', path)
  validateNumberField(diagnostics, camera, 'shake', path)
}

function validateSceneFields(
  diagnostics: CompilerDiagnostic[],
  scene: SemanticScene,
  index: number
) {
  const path = `scenes[${index}]`

  if (!isRecord(scene)) {
    addDiagnostic(diagnostics, {
      level: 'error',
      code: 'SCENE_REQUIRED',
      message: `${path} must be an object`,
      path,
      expected: 'object',
      actual: scene,
      suggestion: 'Provide every scene as an object.',
    })
    return
  }

  validateStringField(diagnostics, scene, 'scene', path)
  validateNumberField(diagnostics, scene, 'start', path)
  validatePositiveNumberField(diagnostics, scene, 'duration', path)
  validateStringField(diagnostics, scene, 'text', path)
  validateStringField(diagnostics, scene, 'highlight', path)
  validateStringField(diagnostics, scene, 'background', path)
  validateStringField(diagnostics, scene, 'position', path)
  validateStringField(diagnostics, scene, 'animation', path)
  validateCamera(diagnostics, scene.camera, `${path}.camera`)

  if (
    typeof scene.scene === 'string' &&
    !SUPPORTED_SCENE_TYPES.includes(scene.scene)
  ) {
    addDiagnostic(diagnostics, {
      level: 'error',
      code: 'UNSUPPORTED_SCENE_TYPE',
      message: `${path}.scene uses an unsupported scene type`,
      path: `${path}.scene`,
      expected: SUPPORTED_SCENE_TYPES,
      actual: scene.scene,
      suggestion: 'Use hook, problem, value, or contrast.',
    })
  }
}

function validateSubtitleFields(
  diagnostics: CompilerDiagnostic[],
  subtitle: SemanticSubtitle,
  index: number
) {
  const path = `subtitles[${index}]`

  if (!isRecord(subtitle)) {
    addDiagnostic(diagnostics, {
      level: 'error',
      code: 'SUBTITLE_REQUIRED',
      message: `${path} must be an object`,
      path,
      expected: 'object',
      actual: subtitle,
      suggestion: 'Provide every subtitle as an object.',
    })
    return
  }

  validateStringField(diagnostics, subtitle, 'id', path)
  validateNumberField(diagnostics, subtitle, 'start', path)
  validatePositiveNumberField(diagnostics, subtitle, 'duration', path)
  validateStringField(diagnostics, subtitle, 'text', path)
}

function getEndTime(item: { start: number; duration: number }) {
  return item.start + item.duration
}

function validateSceneTiming(
  diagnostics: CompilerDiagnostic[],
  scenes: SemanticScene[]
) {
  const timedScenes = scenes
    .map((scene, index) => {
      if (!isTimedItem(scene)) return null

      return {
        index,
        item: scene,
      }
    })
    .filter((scene): scene is IndexedTimedItem<SemanticScene> => scene !== null)

  if (timedScenes.length === 0) {
    addDiagnostic(diagnostics, {
      level: 'error',
      code: 'SCENES_REQUIRED',
      message: 'scenes must contain at least one valid timed scene',
      path: 'scenes',
      expected: 'non-empty array with finite start and duration',
      actual: scenes,
      suggestion: 'Provide at least one scene before compiling.',
    })
    return
  }

  const firstTimedScene = timedScenes[0]

  if (firstTimedScene.index !== 0 || firstTimedScene.item.start !== 0) {
    addDiagnostic(diagnostics, {
      level: 'error',
      code: 'FIRST_SCENE_START_INVALID',
      message: 'first scene must start at 0',
      path: 'scenes[0].start',
      expected: 0,
      actual: isRecord(scenes[0]) ? scenes[0].start : scenes[0],
      suggestion: 'Set the first scene start to 0.',
    })
  }

  timedScenes.forEach(({ item: scene, index }) => {
    if (typeof scene.start === 'number' && scene.start < 0) {
      addDiagnostic(diagnostics, {
        level: 'error',
        code: 'NEGATIVE_SCENE_START',
        message: `scenes[${index}].start must not be negative`,
        path: `scenes[${index}].start`,
        expected: '>= 0',
        actual: scene.start,
        suggestion: 'Use a non-negative scene start time.',
      })
    }

    if (typeof scene.duration === 'number' && scene.duration <= 0) {
      addDiagnostic(diagnostics, {
        level: 'error',
        code: 'INVALID_SCENE_DURATION',
        message: `scenes[${index}].duration must be greater than 0`,
        path: `scenes[${index}].duration`,
        expected: '> 0',
        actual: scene.duration,
        suggestion: 'Use a positive scene duration in ms.',
      })
    }
  })

  for (let index = 1; index < timedScenes.length; index += 1) {
    const previousScene = timedScenes[index - 1].item
    const currentScene = timedScenes[index].item
    const currentSceneIndex = timedScenes[index].index
    const previousEnd = getEndTime(previousScene)

    if (currentScene.start < previousEnd) {
      addDiagnostic(diagnostics, {
        level: 'error',
        code: 'SCENE_OVERLAP',
        message: `scenes[${currentSceneIndex}] overlaps the previous valid scene`,
        path: `scenes[${currentSceneIndex}].start`,
        expected: `>= ${previousEnd}`,
        actual: currentScene.start,
        suggestion: 'Move the scene start to the previous scene end or later.',
      })
    }

    if (currentScene.start > previousEnd) {
      addDiagnostic(diagnostics, {
        level: 'warning',
        code: 'SCENE_GAP',
        message: `scenes[${currentSceneIndex}] starts after the previous valid scene ends`,
        path: `scenes[${currentSceneIndex}].start`,
        expected: previousEnd,
        actual: currentScene.start,
        suggestion: 'Confirm the gap is intentional or make scenes continuous.',
      })
    }
  }
}

function validateSubtitleTiming(
  diagnostics: CompilerDiagnostic[],
  scenes: SemanticScene[],
  subtitles: SemanticSubtitle[]
) {
  if (subtitles.length !== scenes.length) {
    addDiagnostic(diagnostics, {
      level: 'error',
      code: 'SUBTITLE_COUNT_MISMATCH',
      message: 'subtitle count must equal scene count in v1',
      path: 'subtitles',
      expected: scenes.length,
      actual: subtitles.length,
      suggestion: 'Provide exactly one subtitle for each scene.',
    })
  }

  const seenSubtitleIds = new Set<string>()

  subtitles.forEach((subtitle, index) => {
    const subtitleIsRecord = isRecord(subtitle)

    if (!subtitleIsRecord) return

    if (typeof subtitle.id === 'string' && seenSubtitleIds.has(subtitle.id)) {
      addDiagnostic(diagnostics, {
        level: 'error',
        code: 'DUPLICATE_SUBTITLE_ID',
        message: `subtitle id "${subtitle.id}" is duplicated`,
        path: `subtitles[${index}].id`,
        expected: 'unique subtitle id',
        actual: subtitle.id,
        suggestion: 'Use a unique id for each subtitle.',
      })
    }

    if (typeof subtitle.id === 'string') {
      seenSubtitleIds.add(subtitle.id)
    }

    if (typeof subtitle.start === 'number' && subtitle.start < 0) {
      addDiagnostic(diagnostics, {
        level: 'error',
        code: 'NEGATIVE_SUBTITLE_START',
        message: `subtitles[${index}].start must not be negative`,
        path: `subtitles[${index}].start`,
        expected: '>= 0',
        actual: subtitle.start,
        suggestion: 'Use a non-negative subtitle start time.',
      })
    }

    if (typeof subtitle.duration === 'number' && subtitle.duration <= 0) {
      addDiagnostic(diagnostics, {
        level: 'error',
        code: 'INVALID_SUBTITLE_DURATION',
        message: `subtitles[${index}].duration must be greater than 0`,
        path: `subtitles[${index}].duration`,
        expected: '> 0',
        actual: subtitle.duration,
        suggestion: 'Use a positive subtitle duration in ms.',
      })
    }

    const scene = scenes[index]

    if (!isTimedItem(scene) || !isTimedItem(subtitle)) return

    const subtitleEnd = getEndTime(subtitle)
    const sceneEnd = getEndTime(scene)

    if (subtitle.start < scene.start || subtitleEnd > sceneEnd) {
      addDiagnostic(diagnostics, {
        level: 'error',
        code: 'SUBTITLE_OUT_OF_SCENE',
        message: `subtitles[${index}] must stay inside scenes[${index}]`,
        path: `subtitles[${index}]`,
        expected: {
          start: scene.start,
          end: sceneEnd,
        },
        actual: {
          start: subtitle.start,
          end: subtitleEnd,
        },
        suggestion: 'Align the subtitle timing with the matching scene.',
      })
    }
  })
}

function validateDurationConsistency(
  diagnostics: CompilerDiagnostic[],
  input: CompilerInput
) {
  if (!isRecord(input.project) || !isFiniteNumber(input.project.duration)) {
    return
  }

  const sceneEndTimes = input.scenes
    .filter(isTimedItem)
    .map(getEndTime)
  const subtitleEndTimes = input.subtitles
    .filter(isTimedItem)
    .map(getEndTime)
  const maxEndTime = Math.max(0, ...sceneEndTimes, ...subtitleEndTimes)

  if (input.project.duration !== maxEndTime) {
    addDiagnostic(diagnostics, {
      level: 'error',
      code: 'PROJECT_DURATION_MISMATCH',
      message: 'project.duration must equal max scene/subtitle end time',
      path: 'project.duration',
      expected: maxEndTime,
      actual: input.project.duration,
      suggestion: 'Set project.duration to the maximum scene or subtitle end time.',
    })
  }
}

export function validateSemanticInput(input: CompilerInput): CompilerDiagnostic[] {
  const diagnostics: CompilerDiagnostic[] = []

  if (!isRecord(input)) {
    return [
      {
        level: 'error',
        code: 'COMPILER_INPUT_REQUIRED',
        message: 'compiler input must be an object',
        path: 'input',
        expected: 'object',
        actual: input,
        suggestion: 'Call compile with project, scenes, and subtitles.',
      },
    ]
  }

  const projectIsRecord = isRecord(input.project)
  const scenesIsArray = Array.isArray(input.scenes)
  const subtitlesIsArray = Array.isArray(input.subtitles)

  validateProject(diagnostics, input.project)

  if (!scenesIsArray) {
    addDiagnostic(diagnostics, {
      level: 'error',
      code: 'SCENES_ARRAY_REQUIRED',
      message: 'scenes must be an array',
      path: 'scenes',
      expected: 'array',
      actual: input.scenes,
      suggestion: 'Provide scenes as an array.',
    })
  }

  if (!subtitlesIsArray) {
    addDiagnostic(diagnostics, {
      level: 'error',
      code: 'SUBTITLES_ARRAY_REQUIRED',
      message: 'subtitles must be an array',
      path: 'subtitles',
      expected: 'array',
      actual: input.subtitles,
      suggestion: 'Provide subtitles as an array.',
    })
  }

  if (!projectIsRecord || !scenesIsArray || !subtitlesIsArray) {
    return diagnostics
  }

  input.scenes.forEach((scene, index) => {
    validateSceneFields(diagnostics, scene, index)
  })

  input.subtitles.forEach((subtitle, index) => {
    validateSubtitleFields(diagnostics, subtitle, index)
  })

  validateSceneTiming(diagnostics, input.scenes)
  validateSubtitleTiming(diagnostics, input.scenes, input.subtitles)
  validateDurationConsistency(diagnostics, input)

  return diagnostics
}
