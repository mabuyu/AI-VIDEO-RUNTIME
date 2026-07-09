import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

try {
  const {
    createRuntimeDataV2Consumption,
    loadStaticRuntimeDataV2,
    validateRuntimeDataV2,
  } =
    await server.ssrLoadModule('/src/runtimeData/index.ts')
  const { createRuntimeBootstrapV2: bootstrapRuntimeDataV2 } =
    await server.ssrLoadModule('/src/runtime/bootstrap/index.ts')

  const candidate = loadStaticRuntimeDataV2()
  const result = validateRuntimeDataV2(candidate)

  if (!result.ok) {
    console.error('Static RuntimeDataV2 validation failed')
    console.error(JSON.stringify(result.issues, null, 2))
    process.exitCode = 1
  } else {
    const consumption = createRuntimeDataV2Consumption(result.data)
    const bootstrap = bootstrapRuntimeDataV2(consumption)

    console.log('Static RuntimeDataV2 validation passed')
    console.log(`ok = ${result.ok}`)
    console.log(`issueCount = ${result.issues.length}`)
    console.log(`consumptionAccepted = ${consumption.data === result.data}`)
    console.log(`bootstrapReady = ${bootstrap.ready}`)
    console.log(`bootstrapAccepted = ${bootstrap.consumption === consumption}`)
  }
} finally {
  await server.close()
}
