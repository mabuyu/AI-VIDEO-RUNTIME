import scenesData from '../data/scenes.json'

export interface SceneCamera {
  scaleFrom: number
  scaleTo: number
  xFrom: number
  xTo: number
  yFrom: number
  yTo: number
  shake: number
}

export interface RuntimeScene {
  scene: string
  start: number
  duration: number
  text: string
  highlight: string
  background: string
  position: string
  animation: string
  camera: SceneCamera
}

export const scenes = scenesData as RuntimeScene[]

export function getScenes() {
  return scenes
}

export function getTotalDuration() {
  const lastScene = scenes[scenes.length - 1]
  return lastScene.start + lastScene.duration
}

export function getCurrentScene(timeMs: number) {
  return (
    scenes.find((scene) => {
      return (
        timeMs >= scene.start &&
        timeMs < scene.start + scene.duration
      )
    }) || scenes[0]
  )
}

export function getCurrentSceneIndex(timeMs: number) {
  const currentScene = getCurrentScene(timeMs)
  return scenes.indexOf(currentScene)
}

export function getSceneProgress(
  timeMs: number,
  scene: RuntimeScene
) {
  const sceneElapsedTime = timeMs - scene.start

  return Math.min(
    Math.max(sceneElapsedTime / scene.duration, 0),
    1
  )
}

export function getGlobalProgress(timeMs: number) {
  const totalDuration = getTotalDuration()

  return Math.min(
    Math.max(timeMs / totalDuration, 0),
    1
  )
}