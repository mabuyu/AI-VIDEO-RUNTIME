import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

try {
  const {
    createRuntimeDataV2Consumption,
    createRuntimeDataV2Readers,
    loadStaticRuntimeDataV2,
    validateRuntimeDataV2,
  } =
    await server.ssrLoadModule('/src/runtimeData/index.ts')
  const { createRuntimeBootstrapV2: bootstrapRuntimeDataV2 } =
    await server.ssrLoadModule('/src/runtime/bootstrap/index.ts')

  const { createRuntimeDataV2Services } =
    await server.ssrLoadModule('/src/runtime/services/index.ts')
  const { createRuntimeContextV2 } =
    await server.ssrLoadModule('/src/runtime/context/index.ts')
  const { createRuntimeDebugSnapshotV2 } =
    await server.ssrLoadModule('/src/runtime/debug/index.ts')
  const { createRuntimeApplicationV2 } =
    await server.ssrLoadModule('/src/runtime/application/index.ts')

  const candidate = loadStaticRuntimeDataV2()
  const result = validateRuntimeDataV2(candidate)

  if (!result.ok) {
    console.error('Static RuntimeDataV2 validation failed')
    console.error(JSON.stringify(result.issues, null, 2))
    process.exitCode = 1
  } else {
    const consumption = createRuntimeDataV2Consumption(result.data)
    const bootstrap = bootstrapRuntimeDataV2(consumption)
    const readers = createRuntimeDataV2Readers(bootstrap)
    const services = createRuntimeDataV2Services(readers)
    const context = createRuntimeContextV2({
      bootstrap,
      readers,
      services,
    })
    const debugSnapshot = createRuntimeDebugSnapshotV2(context)
    const application = createRuntimeApplicationV2({
      source: {
        type: 'static',
        sourceId: 'static-runtime-data-v2',
        revision: 'milestone-2a-task-a1',
      },
    })

    console.log('Static RuntimeDataV2 validation passed')
    console.log(`ok = ${result.ok}`)
    console.log(`issueCount = ${result.issues.length}`)
    console.log(`consumptionAccepted = ${consumption.data === result.data}`)
    console.log(`bootstrapReady = ${bootstrap.ready}`)
    console.log(`bootstrapAccepted = ${bootstrap.consumption === consumption}`)
    console.log(`readersCreated = ${readers.effect.getEffects().length > 0}`)
    console.log(`servicesCreated = ${services.effect.getEffects().length > 0}`)
    console.log(`contextCreated = ${context.state.status === 'ready'}`)
    console.log(`contextReady = ${context.readiness.ready}`)
    console.log(`contextAcceptedBootstrap = ${context.bootstrap === bootstrap}`)
    console.log(`contextAcceptedReaders = ${context.readers === readers}`)
    console.log(`contextAcceptedServices = ${context.services === services}`)
    console.log(
      `debugSnapshotCreated = ${debugSnapshot.context.status === 'ready'}`,
    )
    console.log(`debugSnapshotReady = ${debugSnapshot.readiness.ready}`)
    console.log(
      `debugSnapshotBootstrapReady = ${debugSnapshot.bootstrap.ready}`,
    )
    console.log(
      `debugSnapshotEffectCount = ${debugSnapshot.readers.effectCount}`,
    )
    console.log(
      `debugSnapshotServiceCount = ${debugSnapshot.services.domainCount}`,
    )
    console.log(`applicationCreated = ${application.ok}`)
    console.log(
      `applicationContextReady = ${
        application.ok && application.context.readiness.ready
      }`,
    )
    console.log(
      `applicationDebugSnapshotReady = ${
        application.ok && application.debugSnapshot.readiness.ready
      }`,
    )
    console.log(
      `effectActiveAt0 = ${services.effect.getCurrentEffectState(0).isActive}`,
    )
    console.log(
      `effectActiveAt5700 = ${services.effect.getCurrentEffectState(5700).isActive}`,
    )
    console.log(`effectAt5700 = ${readers.effect.getCurrentEffect(5700)}`)
  }
} finally {
  await server.close()
}
