import type {
  RuntimeContextV2,
  RuntimeContextV2Dependencies,
} from './types'

export function createRuntimeContextV2({
  bootstrap,
  readers,
  services,
}: RuntimeContextV2Dependencies): RuntimeContextV2 {
  return {
    bootstrap,
    readiness: {
      ready: bootstrap.ready,
    },
    readers,
    services,
    state: {
      status: 'ready',
    },
  }
}
