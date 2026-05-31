import { sceneRegistry } from './sceneRegistry'

export function renderSceneByType(
  sceneType: string,
  props: any
) {
  const SceneComponent =
    sceneRegistry[sceneType as keyof typeof sceneRegistry]

  if (!SceneComponent) return null

  return <SceneComponent {...props} />
}