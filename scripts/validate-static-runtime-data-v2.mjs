import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

try {
  const { loadStaticRuntimeDataV2, validateRuntimeDataV2 } =
    await server.ssrLoadModule('/src/runtimeData/index.ts')

  const candidate = loadStaticRuntimeDataV2()
  const result = validateRuntimeDataV2(candidate)

  if (!result.ok) {
    console.error('Static RuntimeDataV2 validation failed')
    console.error(JSON.stringify(result.issues, null, 2))
    process.exitCode = 1
  } else {
    console.log('Static RuntimeDataV2 validation passed')
    console.log(`ok = ${result.ok}`)
    console.log(`issueCount = ${result.issues.length}`)
  }
} finally {
  await server.close()
}
