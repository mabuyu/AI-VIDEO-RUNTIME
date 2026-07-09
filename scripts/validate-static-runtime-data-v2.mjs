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

    console.log('Static RuntimeDataV2 validation passed')
    console.log(`ok = ${result.ok}`)
    console.log(`issueCount = ${result.issues.length}`)
    console.log(`consumptionAccepted = ${consumption.data === result.data}`)
    console.log(`bootstrapReady = ${bootstrap.ready}`)
    console.log(`bootstrapAccepted = ${bootstrap.consumption === consumption}`)
    console.log(`readersCreated = ${readers.effect.getEffects().length > 0}`)
    console.log(`servicesCreated = ${services.effect.getEffects().length > 0}`)
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
