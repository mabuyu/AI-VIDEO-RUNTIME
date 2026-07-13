import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

try {
  const { loadStaticRuntimeDataV2, validateRuntimeDataV2 } =
    await server.ssrLoadModule('/src/runtimeData/index.ts')
  const base = loadStaticRuntimeDataV2()
  const candidate = (audio) => ({ ...base, audio })
  const generatedAudio = [{
    id: 'audio-generated-main', type: 'generated-audio', start: 0,
    duration: base.timeline.duration, volume: 0.8,
    segments: [{ start: 0, duration: base.timeline.duration, audioRef: 'audio://fixture/main' }],
  }]
  const silence = [{
    id: 'audio-silence-main', type: 'silence', start: 0,
    duration: base.timeline.duration, volume: 0,
    segments: [{ start: 0, duration: base.timeline.duration }],
  }]
  const cases = [
    ['generated-audio PASS', generatedAudio, true],
    ['silence PASS', silence, true],
    ['missing audioRef FAIL', [{ ...generatedAudio[0], segments: [{ start: 0, duration: base.timeline.duration }] }], false],
    ['silence with audioRef FAIL', [{ ...silence[0], segments: [{ start: 0, duration: base.timeline.duration, audioRef: 'forbidden' }] }], false],
    ['invalid segment FAIL', [{ ...generatedAudio[0], segments: [{ start: 1, duration: base.timeline.duration - 1, audioRef: 'audio://fixture/main' }] }], false],
    ['audio empty FAIL', [], false],
  ]

  let failed = false
  for (const [name, audio, expectedOk] of cases) {
    const result = validateRuntimeDataV2(candidate(audio))
    const passed = result.ok === expectedOk
    console.log(`${name}: ${passed ? 'PASS' : 'FAIL'}`)
    if (!passed) {
      failed = true
      console.error(JSON.stringify(result.issues, null, 2))
    }
  }
  if (failed) process.exitCode = 1
} finally {
  await server.close()
}
